import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { parseOFX, type OFXTransaction } from "@/lib/ofxParser";
import { categorizeTransaction, type LearnedCategory } from "@/lib/ofxCategorizer";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/dateRange";
import PlanGate from "@/components/PlanGate";
import { useOrganiza } from "@/hooks/useOrganiza";
import { useHouseholdLabels } from "@/hooks/useHouseholdLabels";
import HistoricoImportacoes from "./HistoricoImportacoes";
import {
  Building2, Upload, Plus, FileText, Loader2, Check, X,
  AlertTriangle, ArrowRight, Search, Filter, Wallet,
  ArrowLeftRight, ChevronDown, ChevronRight, Repeat, HelpCircle, Lightbulb,
} from "lucide-react";

const now = new Date();
const currentMesAno = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

function extractMerchant(description: string): string {
  const cleaned = description
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  const words = cleaned.split(" ").filter(w => w.length >= 3 && !/^\d+$/.test(w));
  return words.slice(0, 3).join(" ").slice(0, 60);
}

function matchFixedRecurrence(
  item: { original_description: string; type: "income" | "expense" | "transfer"; category: string },
  knownFixed: { despesas: { descricao: string; categoria: string }[]; receitas: { descricao: string; categoria: string }[] }
): { tipoDespesa: "fixa" | "variavel"; category: string } {
  const merchant = extractMerchant(item.original_description);
  if (!merchant || merchant.length < 3) {
    return { tipoDespesa: "variavel", category: item.category };
  }
  const pool = item.type === "income" ? knownFixed.receitas : knownFixed.despesas;
  const match = pool.find(p => {
    const pMerchant = extractMerchant(p.descricao);
    return pMerchant && (pMerchant === merchant || merchant.includes(pMerchant) || pMerchant.includes(merchant));
  });
  if (match) {
    return { tipoDespesa: "fixa", category: match.categoria };
  }
  return { tipoDespesa: "variavel", category: item.category };
}

type BankAccount = {
  id: string;
  name: string;
  bank_name: string;
  account_type: string;
  last_four: string | null;
};

type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: string;
  source: string;
  account_id: string | null;
  responsavel: string;
};

type ReviewType = "income" | "expense" | "transfer";
type TipoDespesa = "fixa" | "variavel";
type KnownFixedEntry = { descricao: string; categoria: string };
type KnownFixed = { despesas: KnownFixedEntry[]; receitas: KnownFixedEntry[] };
type ReviewItem = Omit<OFXTransaction, "type"> & {
  type: ReviewType;
  category: string;
  selected: boolean;
  responsavel: string;
  original_description: string;
  alreadyImported: boolean;
  tipoDespesa: TipoDespesa;
  matchedAsFixed: boolean;
};

type Step = "idle" | "processing" | "review";

export default function TabBancosExtratos() {
  return (
    <PlanGate
      featureKey="importar_ofx"
      feature={{
        icon: Building2,
        title: "Bancos & Extratos",
        subtitle: "Disponível no plano Pro",
        items: [
          "Importação de extratos OFX/QFX",
          "Categorização automática por merchant",
          "Dedupe automático por FIT ID",
          "Gestão de múltiplas contas bancárias",
        ],
      }}
    >
      <TabBancosExtratosContent />
    </PlanGate>
  );
}

function TabBancosExtratosContent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fmt } = usePrivacyFmt();
  const org = useOrganiza(currentMesAno, "geral");
  const { responsavelOptions } = useHouseholdLabels(org.nomePessoa1, org.nomePessoa2, org.vinculoPessoa2);
  const defaultResponsavel = responsavelOptions[0]?.value ?? "Pessoa 1";

  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>("idle");
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [learnedCategories, setLearnedCategories] = useState<LearnedCategory[]>([]);
  const [knownFixed, setKnownFixed] = useState<KnownFixed>({ despesas: [], receitas: [] });
  const [uploadAccountId, setUploadAccountId] = useState("");
  const [pendingFilename, setPendingFilename] = useState<string | null>(null);
  const [historicoRefresh, setHistoricoRefresh] = useState(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // New account dialog
  const [showNewAccount, setShowNewAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ name: "", bank_name: "", account_type: "checking", last_four: "" });
  const [showHowTo, setShowHowTo] = useState(false);

  // Fetch accounts & transactions
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
      const [accRes, txRes, catRes, despFixRes, recFixRes] = await Promise.all([
        supabase.from("bank_accounts").select("*").eq("user_id", user.id).order("name"),
        supabase.from("transactions" as any).select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(500),
        supabase.from("merchant_category_learning" as any).select("merchant,categoria").eq("user_id", user.id),
        supabase.from("despesas").select("descricao,categoria").eq("user_id", user.id).eq("tipo", "fixa"),
        supabase.from("receitas").select("descricao,categoria").eq("user_id", user.id).eq("tipo", "fixo"),
      ]);
      setAccounts((accRes.data as BankAccount[]) || []);
      setTransactions((txRes.data as unknown as Transaction[]) || []);
      setLearnedCategories((catRes.data as unknown as LearnedCategory[]) || []);

      const dedupe = (rows: { descricao: string | null; categoria: string }[]): KnownFixedEntry[] => {
        const seen = new Set<string>();
        const out: KnownFixedEntry[] = [];
        for (const r of rows) {
          const desc = (r.descricao || "").trim();
          if (!desc) continue;
          const key = extractMerchant(desc);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          out.push({ descricao: desc, categoria: r.categoria });
        }
        return out;
      };
      setKnownFixed({
        despesas: dedupe((despFixRes.data as { descricao: string | null; categoria: string }[]) || []),
        receitas: dedupe((recFixRes.data as { descricao: string | null; categoria: string }[]) || []),
      });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  const handleCreateAccount = async () => {
    if (!user || !newAccount.name.trim()) return;
    const { data, error } = await supabase
      .from("bank_accounts")
      .insert({ user_id: user.id, ...newAccount } as any)
      .select()
      .single();
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    const acc = data as BankAccount;
    setAccounts(prev => [...prev, acc]);
    setShowNewAccount(false);
    setNewAccount({ name: "", bank_name: "", account_type: "checking", last_four: "" });
    toast({ title: "Conta criada!" });
  };

  // Filtered transactions
  const filtered = useMemo(() => {
    let items = transactions;
    if (selectedAccount !== "all") items = items.filter(t => t.account_id === selectedAccount);
    if (filterType !== "all") items = items.filter(t => t.type === filterType);
    if (filterCategory !== "all") items = items.filter(t => t.category === filterCategory);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(t => t.description?.toLowerCase().includes(q));
    }
    return items;
  }, [transactions, selectedAccount, filterType, filterCategory, searchTerm]);

  // Balances
  const balances = useMemo(() => {
    const byAccount: Record<string, number> = {};
    transactions.forEach(t => {
      const accId = t.account_id || "sem_conta";
      if (!byAccount[accId]) byAccount[accId] = 0;
      byAccount[accId] += t.type === "income" ? t.amount : -t.amount;
    });
    const consolidated = Object.values(byAccount).reduce((s, v) => s + v, 0);
    return { byAccount, consolidated };
  }, [transactions]);

  const categories = useMemo(() => {
    const set = new Set(transactions.map(t => t.category).filter(Boolean));
    return Array.from(set).sort();
  }, [transactions]);

  // OFX Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["ofx", "qfx"].includes(ext || "")) {
      toast({ title: "Formato inválido", description: "Aceite apenas .ofx ou .qfx", variant: "destructive" });
      return;
    }
    setStep("processing");
    setErrors([]);
    setPendingFilename(file.name);
    try {
      const text = await file.text();
      const result = parseOFX(text);
      if (result.errors.length > 0) setErrors(result.errors);
      if (result.transactions.length === 0) {
        toast({ title: "Nenhuma transação encontrada", variant: "destructive" });
        setStep("idle");
        return;
      }
      const incomingFitIds = result.transactions.map(tx => tx.fitId).filter(Boolean) as string[];
      let existingFitIds = new Set<string>();
      if (user && uploadAccountId && incomingFitIds.length > 0) {
        const { data: existing } = await supabase
          .from("transactions" as any)
          .select("fit_id")
          .eq("user_id", user.id)
          .eq("account_id", uploadAccountId)
          .in("fit_id", incomingFitIds);
        existingFitIds = new Set(((existing as unknown as { fit_id: string }[]) || []).map(r => r.fit_id));
      }
      const items: ReviewItem[] = result.transactions.map(tx => {
        const already = tx.fitId ? existingFitIds.has(tx.fitId) : false;
        const base: ReviewItem = {
          ...tx,
          category: categorizeTransaction(tx.description, learnedCategories),
          selected: !already,
          responsavel: defaultResponsavel,
          original_description: tx.description,
          alreadyImported: already,
          tipoDespesa: "variavel" as TipoDespesa,
          matchedAsFixed: false,
        };
        const matched = matchFixedRecurrence(base, knownFixed);
        return {
          ...base,
          tipoDespesa: matched.tipoDespesa,
          category: matched.category,
          matchedAsFixed: matched.tipoDespesa === "fixa",
        };
      });
      setReviewItems(items);
      setStep("review");
    } catch (err: any) {
      toast({ title: "Erro ao processar", description: err.message, variant: "destructive" });
      setStep("idle");
    }
    e.target.value = "";
  };

  const toggleSelect = (i: number) => setReviewItems(prev => prev.map((item, idx) => idx === i ? { ...item, selected: !item.selected } : item));
  const toggleAll = () => {
    const all = reviewItems.every(i => i.selected);
    setReviewItems(prev => prev.map(item => ({ ...item, selected: !all })));
  };
  const updateCategory = (i: number, category: string) => setReviewItems(prev => prev.map((item, idx) => idx === i ? { ...item, category } : item));
  const updateType = (i: number, type: ReviewType) => setReviewItems(prev => prev.map((item, idx) => idx === i ? { ...item, type } : item));
  const updateDescription = (i: number, description: string) => setReviewItems(prev => prev.map((item, idx) => idx === i ? { ...item, description } : item));
  const updateResponsavel = (i: number, responsavel: string) => setReviewItems(prev => prev.map((item, idx) => idx === i ? { ...item, responsavel } : item));
  const updateTipoDespesa = (i: number, tipoDespesa: TipoDespesa) => setReviewItems(prev => prev.map((item, idx) => idx === i ? { ...item, tipoDespesa, matchedAsFixed: false } : item));

  const selectedItems = useMemo(() => reviewItems.filter(i => i.selected), [reviewItems]);

  const renderReviewRow = (item: ReviewItem, i: number) => {
    const isTransfer = item.type === "transfer";
    const rowClass = [
      !item.selected ? "opacity-40" : "",
      isTransfer ? "bg-muted/20" : "",
    ].filter(Boolean).join(" ");
    const valueClass = isTransfer
      ? "text-muted-foreground"
      : item.type === "income"
      ? "text-success"
      : "text-destructive";
    return (
      <TableRow key={i} className={rowClass}>
        <TableCell><Checkbox checked={item.selected} onCheckedChange={() => toggleSelect(i)} /></TableCell>
        <TableCell className="text-xs whitespace-nowrap">{new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
        <TableCell className="max-w-[220px]">
          <div className="space-y-1">
            <Input
              value={item.description}
              onChange={(e) => updateDescription(i, e.target.value)}
              maxLength={120}
              className="h-7 text-xs"
            />
            <div className="flex flex-wrap gap-1">
              {item.alreadyImported && (
                <Badge variant="outline" className="text-[10px] text-warning border-warning/40">
                  Já importado
                </Badge>
              )}
              {item.matchedAsFixed && (
                <Badge variant="outline" className="text-[10px] text-primary border-primary/40">
                  <Repeat className="h-2.5 w-2.5 mr-0.5" /> Recorrente
                </Badge>
              )}
            </div>
          </div>
        </TableCell>
        <TableCell>
          <Select value={item.type} onValueChange={(v) => updateType(i, v as ReviewType)}>
            <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Receita</SelectItem>
              <SelectItem value="expense">Despesa</SelectItem>
              <SelectItem value="transfer">Transferência</SelectItem>
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <Select value={item.category} onValueChange={(v) => updateCategory(i, v)}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[...new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, "Transferências", "Outros"])].map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          {isTransfer ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
            <Select value={item.tipoDespesa} onValueChange={(v) => updateTipoDespesa(i, v as TipoDespesa)}>
              <SelectTrigger className="h-7 w-24 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="variavel">Variável</SelectItem>
                <SelectItem value="fixa">Fixa</SelectItem>
              </SelectContent>
            </Select>
          )}
        </TableCell>
        <TableCell>
          <Select value={item.responsavel} onValueChange={(v) => updateResponsavel(i, v)}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {responsavelOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell className={`text-right text-xs font-bold ${valueClass}`}>
          <span className="inline-flex items-center gap-1 justify-end">
            {isTransfer && <ArrowLeftRight className="h-3 w-3" />}
            {fmt(item.amount)}
          </span>
        </TableCell>
      </TableRow>
    );
  };

  const reviewGroups = useMemo(() => {
    if (reviewItems.length <= 30) return null;
    const map = new Map<string, { label: string; entries: { item: ReviewItem; originalIndex: number }[] }>();
    reviewItems.forEach((item, idx) => {
      const ym = item.date.slice(0, 7);
      if (!map.has(ym)) {
        const d = new Date(ym + "-01T12:00:00");
        const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        map.set(ym, { label: label.charAt(0).toUpperCase() + label.slice(1), entries: [] });
      }
      map.get(ym)!.entries.push({ item, originalIndex: idx });
    });
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [reviewItems]);
  const totals = useMemo(() => {
    const income = selectedItems.filter(i => i.type === "income").reduce((s, i) => s + i.amount, 0);
    const expense = selectedItems.filter(i => i.type === "expense").reduce((s, i) => s + i.amount, 0);
    const transfers = selectedItems.filter(i => i.type === "transfer").length;
    return { income, expense, balance: income - expense, count: selectedItems.length, transfers };
  }, [selectedItems]);

  const matchedCount = useMemo(
    () => reviewItems.filter(i => i.matchedAsFixed).length,
    [reviewItems]
  );

  const handleConfirm = async () => {
    if (!user || selectedItems.length === 0) return;
    setSaving(true);
    try {
      const accountId = uploadAccountId || null;
      const itemsPayload = selectedItems.map(item => ({
        date: item.date,
        description: item.description,
        amount: item.amount,
        category: item.category,
        type: item.type,
        tipo_despesa: item.tipoDespesa,
        responsavel: item.responsavel,
        fit_id: item.fitId ?? null,
      }));

      const { data: commitData, error: commitError } = await supabase.functions.invoke("import-ofx-commit", {
        body: { account_id: accountId, items: itemsPayload, filename: pendingFilename },
      });
      if (commitError) throw commitError;
      if (commitData?.error) throw new Error(commitData.error);

      const learnedMap = new Map<string, string>();
      for (const item of selectedItems) {
        const merchant = extractMerchant(item.original_description);
        if (!merchant || item.category === "Outros" || item.category === "Transferências") continue;
        learnedMap.set(merchant, item.category);
      }
      if (learnedMap.size > 0) {
        const learnedRows = Array.from(learnedMap.entries()).map(([merchant, categoria]) => ({
          user_id: user.id, merchant, categoria,
        }));
        await supabase.from("merchant_category_learning" as any).upsert(learnedRows as any, { onConflict: "user_id,merchant" });
        const { data: catRes } = await supabase.from("merchant_category_learning" as any).select("merchant,categoria").eq("user_id", user.id);
        setLearnedCategories((catRes as unknown as LearnedCategory[]) || []);
      }

      const inserted = commitData?.inserted_transactions ?? 0;
      const skipped = commitData?.skipped_duplicates ?? 0;
      toast({
        title: "Importação concluída!",
        description: skipped > 0
          ? `${inserted} importadas, ${skipped} já existiam.`
          : `${inserted} transações importadas.`,
      });

      const { data } = await supabase.from("transactions" as any).select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(500);
      setTransactions((data as unknown as Transaction[]) || []);
      setStep("idle");
      setReviewItems([]);
      setPendingFilename(null);
      setHistoricoRefresh(prev => prev + 1);
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRollback = useCallback(() => {
    if (!user) return;
    supabase.from("transactions" as any).select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(500)
      .then(({ data }) => setTransactions((data as unknown as Transaction[]) || []));
  }, [user]);

  if (step === "review") {
    return (
      <div className="space-y-4">
        {errors.length > 0 && (
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <p className="text-xs font-bold text-warning">{errors.length} aviso(s)</p>
              </div>
              {errors.slice(0, 5).map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-muted/30">
            <p className="text-xs text-muted-foreground">Selecionadas</p>
            <p className="text-lg font-heading font-bold">{totals.count}</p>
          </div>
          <div className="p-3 rounded-xl bg-success/10">
            <p className="text-xs text-muted-foreground">Receitas</p>
            <p className="text-sm font-bold text-success">{fmt(totals.income)}</p>
          </div>
          <div className="p-3 rounded-xl bg-destructive/10">
            <p className="text-xs text-muted-foreground">Despesas</p>
            <p className="text-sm font-bold text-destructive">{fmt(totals.expense)}</p>
          </div>
          <div className="p-3 rounded-xl bg-primary/10">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className={`text-sm font-bold ${totals.balance >= 0 ? "text-success" : "text-destructive"}`}>{fmt(totals.balance)}</p>
          </div>
        </div>
        {totals.transfers > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ArrowLeftRight className="h-3 w-3" />
            {totals.transfers} transferência(s) interna(s) — não contabilizadas em receitas/despesas.
          </p>
        )}

        {matchedCount > 0 && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-3 pb-3">
              <p className="text-xs flex items-center gap-1.5">
                <Repeat className="h-3.5 w-3.5 text-primary" />
                <span className="font-semibold text-primary">{matchedCount} transação(ões)</span>
                <span className="text-muted-foreground">
                  identificadas como recorrentes (já cadastradas como fixas). Categoria e classificação foram preenchidas automaticamente.
                </span>
              </p>
            </CardContent>
          </Card>
        )}

        {reviewItems.length > 0 && reviewItems.every(i => i.alreadyImported) && (
          <Card className="border-warning/40 bg-warning/5">
            <CardContent className="pt-3 pb-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-warning">
                    Todas as {reviewItems.length} transações deste extrato já foram importadas anteriormente.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Se você precisa reimportar, primeiro apague as transações correspondentes em Organiza &gt; Receitas ou Despesas. O Atlas liberará automaticamente a reimportação.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-heading">Revise as transações</CardTitle>
            <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs">
              {reviewItems.every(i => i.selected) ? "Desmarcar todos" : "Selecionar todos"}
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              {reviewGroups ? (
                <div className="space-y-3">
                  {reviewGroups.map(([ym, group]) => (
                    <Collapsible key={ym} defaultOpen>
                      <CollapsibleTrigger className="flex items-center gap-2 w-full px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors group">
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                        <span className="text-xs font-heading font-semibold">{group.label}</span>
                        <Badge variant="outline" className="text-[10px] ml-auto">{group.entries.length}</Badge>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-8"></TableHead>
                              <TableHead>Data</TableHead>
                              <TableHead>Descrição</TableHead>
                              <TableHead>Tipo</TableHead>
                              <TableHead>Categoria</TableHead>
                              <TableHead>Classif.</TableHead>
                              <TableHead>Responsável</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {group.entries.map(({ item, originalIndex }) => renderReviewRow(item, originalIndex))}
                          </TableBody>
                        </Table>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Classif.</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviewItems.map((item, i) => renderReviewRow(item, i))}
                  </TableBody>
                </Table>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-between">
          <Button variant="outline" onClick={() => { setStep("idle"); setReviewItems([]); }} className="gap-1.5">
            <X className="h-3.5 w-3.5" /> Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving || selectedItems.length === 0} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {selectedItems.length === 0
              ? "Nenhuma transação selecionada"
              : `Confirmar ${selectedItems.length} transações`}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Balances & Account selector */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="sm:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <Label className="text-xs font-medium">Conta</Label>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => setShowNewAccount(true)}>
                <Plus className="h-3 w-3" /> Nova conta
              </Button>
            </div>
            <Select value={selectedAccount} onValueChange={setSelectedAccount}>
              <SelectTrigger><SelectValue placeholder="Todas as contas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {accounts.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} {a.last_four ? `(****${a.last_four})` : ""} – {a.bank_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex flex-col justify-center">
            <p className="text-xs text-muted-foreground flex items-center gap-1"><Wallet className="h-3 w-3" /> Saldo consolidado</p>
            <p className={`text-xl font-heading font-bold ${balances.consolidated >= 0 ? "text-success" : "text-destructive"}`}>
              {fmt(balances.consolidated)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Upload OFX */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-heading font-semibold">Importar OFX</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1 text-primary"
                  onClick={() => setShowHowTo(true)}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Como exportar do meu banco?
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Faça upload do extrato bancário em formato OFX/QFX</p>
            </div>
            <div className="flex items-center gap-2">
              <Select value={uploadAccountId} onValueChange={setUploadAccountId}>
                <SelectTrigger className="w-48 h-8 text-xs"><SelectValue placeholder="Selecionar conta..." /></SelectTrigger>
                <SelectContent>
                  {accounts.map(a => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label>
                <Button asChild variant="default" size="sm" className="gap-1.5 cursor-pointer" disabled={!uploadAccountId}>
                  <span><Upload className="h-3.5 w-3.5" /> Upload OFX</span>
                </Button>
                <input type="file" accept=".ofx,.qfx" className="hidden" onChange={handleFileUpload} disabled={!uploadAccountId} />
              </label>
            </div>
          </div>
          {step === "processing" && (
            <div className="flex items-center justify-center py-8 gap-3">
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground">Processando arquivo...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar descrição..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-8 text-xs" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Transaction history */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center justify-between">
            <span>Histórico de movimentações</span>
            <Badge variant="outline" className="text-xs">{filtered.length} registros</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma movimentação encontrada. Importe um arquivo OFX para começar.</p>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Descrição</TableHead>
                    <TableHead className="text-xs">Categoria</TableHead>
                    <TableHead className="text-xs">Banco/Conta</TableHead>
                    <TableHead className="text-xs">Origem</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 100).map(t => {
                    const acc = accounts.find(a => a.id === t.account_id);
                    return (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs whitespace-nowrap">{new Date(t.date + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{t.description}</TableCell>
                        <TableCell className="text-xs">{t.category || "—"}</TableCell>
                        <TableCell className="text-xs">{acc ? `${acc.bank_name} ${acc.last_four ? `****${acc.last_four}` : ""}` : "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{t.source?.toUpperCase() || "OFX"}</Badge></TableCell>
                        <TableCell className={`text-xs text-right font-bold ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                          {fmt(t.amount)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {filtered.length > 100 && <p className="text-xs text-muted-foreground text-center mt-2">Exibindo 100 de {filtered.length}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      <HistoricoImportacoes refreshKey={historicoRefresh} onRollback={handleRollback} />

      {/* How-To Dialog */}
      <Dialog open={showHowTo} onOpenChange={setShowHowTo}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" />
              Como exportar OFX do seu banco
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="nubank" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="nubank" className="text-xs">Nubank</TabsTrigger>
              <TabsTrigger value="itau" className="text-xs">Itaú</TabsTrigger>
              <TabsTrigger value="inter" className="text-xs">Inter</TabsTrigger>
              <TabsTrigger value="bradesco" className="text-xs">Bradesco</TabsTrigger>
              <TabsTrigger value="outros" className="text-xs">Outros</TabsTrigger>
            </TabsList>

            <TabsContent value="nubank" className="space-y-3 text-sm">
              <p className="font-semibold text-sm">Nubank (App mobile)</p>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
                <li>Abra o app do Nubank e toque em <strong>Conta</strong>.</li>
                <li>Role até o final e toque em <strong>Exportar extrato</strong>.</li>
                <li>Escolha o período desejado (até 12 meses).</li>
                <li>Selecione o formato <strong>OFX</strong>.</li>
                <li>O arquivo será enviado ao seu e-mail cadastrado.</li>
                <li>Baixe o anexo e faça o upload aqui.</li>
              </ol>
              <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded flex items-start gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                <span>O Nubank só exporta extratos da conta corrente. Para o cartão de crédito, use a fatura em PDF (funcionalidade separada).</span>
              </p>
            </TabsContent>

            <TabsContent value="itau" className="space-y-3 text-sm">
              <p className="font-semibold text-sm">Itaú (Internet Banking)</p>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
                <li>Acesse o Internet Banking do Itaú pelo navegador.</li>
                <li>Vá em <strong>Conta Corrente → Extrato</strong>.</li>
                <li>Selecione o período (até 6 meses).</li>
                <li>Clique em <strong>Salvar em outros formatos</strong>.</li>
                <li>Escolha <strong>Money 2000 (OFX)</strong> ou <strong>Microsoft Money</strong>.</li>
                <li>Baixe o arquivo e importe aqui.</li>
              </ol>
              <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded flex items-start gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                <span>No app mobile não há opção direta de OFX — use o Internet Banking pelo navegador.</span>
              </p>
            </TabsContent>

            <TabsContent value="inter" className="space-y-3 text-sm">
              <p className="font-semibold text-sm">Banco Inter (App mobile)</p>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
                <li>Abra o Super App Inter.</li>
                <li>Toque em <strong>Conta → Extrato</strong>.</li>
                <li>Toque no ícone de <strong>compartilhar</strong> no canto superior direito.</li>
                <li>Escolha o período desejado.</li>
                <li>Selecione o formato <strong>OFX</strong>.</li>
                <li>Compartilhe o arquivo consigo mesmo (e-mail/Drive) e importe aqui.</li>
              </ol>
            </TabsContent>

            <TabsContent value="bradesco" className="space-y-3 text-sm">
              <p className="font-semibold text-sm">Bradesco (Internet Banking)</p>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground">
                <li>Acesse o Bradesco Net Empresa ou Net Banking.</li>
                <li>Vá em <strong>Conta Corrente → Extrato</strong>.</li>
                <li>Selecione o período (até 90 dias por download).</li>
                <li>Clique em <strong>Salvar</strong> e escolha o formato <strong>OFX (Money)</strong>.</li>
                <li>Baixe e importe aqui.</li>
              </ol>
            </TabsContent>

            <TabsContent value="outros" className="space-y-3 text-sm">
              <p className="font-semibold text-sm">Outros bancos</p>
              <p className="text-xs text-muted-foreground">
                Praticamente todos os bancos brasileiros oferecem exportação em OFX. Procure pelas palavras-chave:
              </p>
              <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground">
                <li><strong>Exportar extrato</strong>, <strong>Salvar extrato</strong>, <strong>Download</strong></li>
                <li>Formatos aceitos: <strong>OFX</strong>, <strong>QFX</strong>, <strong>Money</strong>, <strong>Quicken</strong></li>
                <li>Formatos <strong>não aceitos</strong>: PDF, CSV, Excel</li>
              </ul>
              <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded flex items-start gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
                <span>Se o seu banco só oferece CSV ou PDF, entre em contato com o suporte pedindo o formato OFX — ele é padrão da indústria financeira.</span>
              </p>
              <p className="text-xs text-muted-foreground bg-warning/10 border border-warning/30 p-2 rounded flex items-start gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-warning" />
                <span>Alguns bancos digitais menores (ex: C6, PicPay) ainda não oferecem OFX. Fique de olho nas atualizações do seu app.</span>
              </p>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* New Account Dialog */}
      <Dialog open={showNewAccount} onOpenChange={setShowNewAccount}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">Nova Conta Bancária</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-xs">Nome</Label><Input value={newAccount.name} onChange={e => setNewAccount(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Conta corrente Itaú" /></div>
            <div><Label className="text-xs">Banco</Label><Input value={newAccount.bank_name} onChange={e => setNewAccount(p => ({ ...p, bank_name: e.target.value }))} placeholder="Ex: Itaú, Nubank..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={newAccount.account_type} onValueChange={v => setNewAccount(p => ({ ...p, account_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="checking">Conta Corrente</SelectItem>
                    <SelectItem value="savings">Poupança</SelectItem>
                    <SelectItem value="investment">Investimento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Últimos 4 dígitos</Label>
                <Input value={newAccount.last_four} onChange={e => setNewAccount(p => ({ ...p, last_four: e.target.value.replace(/\D/g, "").slice(0, 4) }))} placeholder="1234" maxLength={4} />
              </div>
            </div>
            <Button onClick={handleCreateAccount} disabled={!newAccount.name.trim()} className="w-full">Criar conta</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
