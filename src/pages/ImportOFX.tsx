import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseOFX, type OFXTransaction } from "@/lib/ofxParser";
import { categorizeTransaction, type LearnedCategory } from "@/lib/ofxCategorizer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileText, Check, AlertTriangle, Plus, ArrowRight, Loader2, X } from "lucide-react";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/dateRange";

type BankAccount = {
  id: string;
  name: string;
  bank_name: string;
  account_type: string;
  last_four: string | null;
};

type ReviewItem = OFXTransaction & {
  category: string;
  selected: boolean;
  responsavel: string;
};

type Step = "upload" | "processing" | "review";

const ImportOFX = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fmt } = usePrivacyFmt();
  const [step, setStep] = useState<Step>("upload");
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("");
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [learnedCategories, setLearnedCategories] = useState<LearnedCategory[]>([]);

  // New account dialog
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: "", bank_name: "", account_type: "checking", last_four: "" });

  // Fetch accounts
  useEffect(() => {
    if (!user) return;
    supabase
      .from("bank_accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("name")
      .then(({ data }) => setAccounts((data as BankAccount[]) || []));
  }, [user]);

  // Fetch learned categories
  useEffect(() => {
    if (!user) return;
    supabase
      .from("merchant_category_learning")
      .select("merchant,categoria")
      .eq("user_id", user.id)
      .then(({ data }) => setLearnedCategories((data as LearnedCategory[]) || []));
  }, [user]);

  const handleCreateAccount = async () => {
    if (!user || !newAccount.name.trim()) return;
    const { data, error } = await supabase
      .from("bank_accounts")
      .insert({ user_id: user.id, ...newAccount } as any)
      .select()
      .single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    const acc = data as BankAccount;
    setAccounts(prev => [...prev, acc]);
    setSelectedAccount(acc.id);
    setShowNewAccount(false);
    setNewAccount({ name: "", bank_name: "", account_type: "checking", last_four: "" });
    toast({ title: "Conta criada!" });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["ofx", "qfx"].includes(ext || "")) {
      toast({ title: "Formato inválido", description: "Aceite apenas arquivos .ofx ou .qfx", variant: "destructive" });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "Arquivo muito grande", description: "Máximo 10MB", variant: "destructive" });
      return;
    }

    setStep("processing");
    setErrors([]);

    try {
      const text = await file.text();
      const result = parseOFX(text);

      if (result.errors.length > 0) setErrors(result.errors);

      if (result.transactions.length === 0) {
        toast({ title: "Nenhuma transação encontrada", variant: "destructive" });
        setStep("upload");
        return;
      }

      // Apply categorization
      const items: ReviewItem[] = result.transactions.map(tx => ({
        ...tx,
        category: categorizeTransaction(tx.description, learnedCategories),
        selected: true,
        responsavel: "Pessoa 1",
      }));

      setReviewItems(items);
      setStep("review");
    } catch (err: any) {
      toast({ title: "Erro ao processar arquivo", description: err.message, variant: "destructive" });
      setStep("upload");
    }
  };

  const toggleSelect = (index: number) => {
    setReviewItems(prev => prev.map((item, i) => i === index ? { ...item, selected: !item.selected } : item));
  };

  const toggleAll = () => {
    const allSelected = reviewItems.every(i => i.selected);
    setReviewItems(prev => prev.map(item => ({ ...item, selected: !allSelected })));
  };

  const updateCategory = (index: number, category: string) => {
    setReviewItems(prev => prev.map((item, i) => i === index ? { ...item, category } : item));
  };

  const updateType = (index: number, type: "income" | "expense") => {
    setReviewItems(prev => prev.map((item, i) => i === index ? { ...item, type } : item));
  };

  const selectedItems = useMemo(() => reviewItems.filter(i => i.selected), [reviewItems]);

  const totals = useMemo(() => {
    const income = selectedItems.filter(i => i.type === "income").reduce((s, i) => s + i.amount, 0);
    const expense = selectedItems.filter(i => i.type === "expense").reduce((s, i) => s + i.amount, 0);
    return { income, expense, balance: income - expense, count: selectedItems.length };
  }, [selectedItems]);

  const handleConfirm = async () => {
    if (!user || selectedItems.length === 0) return;
    setSaving(true);

    try {
      const accountId = selectedAccount || null;

      // 1. Save to transactions table
      const txRows = selectedItems.map(item => ({
        user_id: user.id,
        account_id: accountId,
        date: item.date,
        description: item.description,
        amount: item.amount,
        category: item.category,
        type: item.type,
        source: "ofx",
        responsavel: item.responsavel,
        fit_id: item.fitId,
      }));

      const { error: txError } = await supabase.from("transactions").insert(txRows as any);
      if (txError) {
        if (txError.message.includes("duplicate") || txError.message.includes("unique")) {
          toast({ title: "Duplicatas detectadas", description: "Algumas transações já foram importadas anteriormente.", variant: "destructive" });
        } else {
          throw txError;
        }
      }

      // 2. Also save to receitas/despesas for integration
      const receitaRows = selectedItems
        .filter(i => i.type === "income")
        .map(item => ({
          user_id: user.id,
          data: item.date,
          categoria: item.category === "Receita" ? "Salário/Pró-labore" : item.category,
          descricao: item.description,
          valor: item.amount,
          tipo: "variavel",
          status: "recebido",
          responsavel: item.responsavel,
          recorrente: false,
        }));

      const despesaRows = selectedItems
        .filter(i => i.type === "expense")
        .map(item => ({
          user_id: user.id,
          data: item.date,
          categoria: item.category,
          descricao: item.description,
          valor: item.amount,
          tipo: "variavel",
          status: "pago",
          responsavel: item.responsavel,
          is_parcelada: false,
          recorrente: false,
        }));

      if (receitaRows.length > 0) {
        await supabase.from("receitas").insert(receitaRows as any);
      }
      if (despesaRows.length > 0) {
        await supabase.from("despesas").insert(despesaRows as any);
      }

      // 3. Learn new merchant→category mappings
      const newLearnings = selectedItems.map(item => ({
        user_id: user.id,
        merchant: item.description.slice(0, 50),
        categoria: item.category,
        confidence: 0.8,
      }));

      if (newLearnings.length > 0) {
        await supabase.from("merchant_category_learning").upsert(
          newLearnings as any,
          { onConflict: "user_id,merchant" }
        );
      }

      toast({
        title: "Importação concluída!",
        description: `${selectedItems.length} transações importadas com sucesso.`,
      });

      // Reset
      setStep("upload");
      setReviewItems([]);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold">Importar Extrato OFX</h1>
        <p className="text-muted-foreground text-sm mt-1">Importe transações bancárias do seu arquivo OFX/QFX.</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {[
          { key: "upload", label: "Upload", icon: Upload },
          { key: "processing", label: "Processamento", icon: Loader2 },
          { key: "review", label: "Revisão", icon: Check },
        ].map((s, i) => {
          const isActive = step === s.key;
          const isDone = (step === "review" && s.key !== "review") || (step === "processing" && s.key === "upload");
          return (
            <div key={s.key} className="flex items-center gap-2">
              {i > 0 && <ArrowRight className="h-4 w-4 text-muted-foreground/30" />}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium ${
                isActive ? "bg-primary text-primary-foreground" : isDone ? "bg-success/10 text-success" : "bg-muted/30 text-muted-foreground"
              }`}>
                <s.icon className={`h-3.5 w-3.5 ${isActive && s.key === "processing" ? "animate-spin" : ""}`} />
                {s.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step: Upload */}
      {step === "upload" && (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-sm font-heading">1. Selecione a conta e o arquivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Account selector */}
            <div className="space-y-2">
              <Label className="text-xs">Conta bancária</Label>
              <div className="flex gap-2">
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                  <SelectTrigger className="rounded-xl flex-1">
                    <SelectValue placeholder="Selecione uma conta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} {a.last_four ? `(****${a.last_four})` : ""} – {a.bank_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" className="rounded-xl" onClick={() => setShowNewAccount(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label className="text-xs">Arquivo OFX/QFX</Label>
              <label className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/40 bg-muted/20 cursor-pointer transition-colors">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
                <div className="text-center">
                  <p className="text-sm font-medium">Clique para selecionar ou arraste o arquivo</p>
                  <p className="text-xs text-muted-foreground mt-1">Formatos aceitos: .ofx, .qfx (máx. 10MB)</p>
                </div>
                <input
                  type="file"
                  accept=".ofx,.qfx"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={!selectedAccount}
                />
              </label>
              {!selectedAccount && (
                <p className="text-xs text-warning">Selecione uma conta bancária antes de importar.</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Processing */}
      {step === "processing" && (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Processando arquivo OFX...</p>
          </CardContent>
        </Card>
      )}

      {/* Step: Review */}
      {step === "review" && (
        <div className="space-y-4">
          {/* Errors */}
          {errors.length > 0 && (
            <Card className="rounded-2xl border-warning/40 bg-warning/5">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  <p className="text-xs font-bold text-warning">{errors.length} aviso(s)</p>
                </div>
                {errors.slice(0, 5).map((e, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{e}</p>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground">Total selecionadas</p>
              <p className="text-lg font-heading font-bold">{totals.count}</p>
            </div>
            <div className="p-3 rounded-xl bg-success/10">
              <p className="text-xs text-muted-foreground">Receitas</p>
              <p className="text-sm font-heading font-bold text-success">{fmt(totals.income)}</p>
            </div>
            <div className="p-3 rounded-xl bg-destructive/10">
              <p className="text-xs text-muted-foreground">Despesas</p>
              <p className="text-sm font-heading font-bold text-destructive">{fmt(totals.expense)}</p>
            </div>
            <div className="p-3 rounded-xl bg-primary/10">
              <p className="text-xs text-muted-foreground">Saldo</p>
              <p className={`text-sm font-heading font-bold ${totals.balance >= 0 ? "text-success" : "text-destructive"}`}>{fmt(totals.balance)}</p>
            </div>
          </div>

          {/* Transaction table */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-heading">Revise as transações</CardTitle>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs">
                  {reviewItems.every(i => i.selected) ? "Desmarcar todos" : "Selecionar todos"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewItems.map((item, i) => (
                      <TableRow key={i} className={!item.selected ? "opacity-40" : ""}>
                        <TableCell>
                          <Checkbox checked={item.selected} onCheckedChange={() => toggleSelect(i)} />
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{item.description}</TableCell>
                        <TableCell>
                          <Select value={item.type} onValueChange={(v) => updateType(i, v as "income" | "expense")}>
                            <SelectTrigger className="h-7 w-24 text-xs rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="income">Receita</SelectItem>
                              <SelectItem value="expense">Despesa</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select value={item.category} onValueChange={(v) => updateCategory(i, v)}>
                            <SelectTrigger className="h-7 w-32 text-xs rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, "Transferências", "Outros"])].map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className={`text-right text-xs font-bold ${item.type === "income" ? "text-success" : "text-destructive"}`}>
                          {fmt(item.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => { setStep("upload"); setReviewItems([]); }} className="rounded-xl gap-1.5">
              <X className="h-3.5 w-3.5" /> Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={saving || selectedItems.length === 0}
              className="rounded-xl gap-1.5"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Confirmar {selectedItems.length} transações
            </Button>
          </div>
        </div>
      )}

      {/* New Account Dialog */}
      <Dialog open={showNewAccount} onOpenChange={setShowNewAccount}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Nova Conta Bancária</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Nome da conta</Label>
              <Input
                value={newAccount.name}
                onChange={e => setNewAccount(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Conta corrente Itaú"
                className="rounded-xl"
              />
            </div>
            <div>
              <Label className="text-xs">Banco</Label>
              <Input
                value={newAccount.bank_name}
                onChange={e => setNewAccount(p => ({ ...p, bank_name: e.target.value }))}
                placeholder="Ex: Itaú, Nubank, Bradesco..."
                className="rounded-xl"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={newAccount.account_type} onValueChange={v => setNewAccount(p => ({ ...p, account_type: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Conta Corrente</SelectItem>
                    <SelectItem value="savings">Poupança</SelectItem>
                    <SelectItem value="investment">Investimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Últimos 4 dígitos</Label>
                <Input
                  value={newAccount.last_four}
                  onChange={e => setNewAccount(p => ({ ...p, last_four: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                  placeholder="1234"
                  maxLength={4}
                  className="rounded-xl"
                />
              </div>
            </div>
            <Button onClick={handleCreateAccount} disabled={!newAccount.name.trim()} className="w-full rounded-xl">
              Criar conta
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ImportOFX;
