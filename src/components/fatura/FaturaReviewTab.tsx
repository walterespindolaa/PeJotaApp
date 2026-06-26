import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Slider } from "@/components/ui/slider";
import { toast } from "@/hooks/use-toast";
import { Loader2, Check, Trash2, AlertTriangle, Bot, Zap, CheckCircle2, Filter, Save, ShieldCheck } from "lucide-react";
import { normalizeMerchant, generateInstallmentFingerprint } from "@/lib/faturaProviders";
import { upsertMerchantRule } from "@/lib/faturaRulesEngine";
import { validateLineIntegrity, generateIdempotencyKey } from "@/lib/faturaSecurity";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { getCategoryEmoji } from "@/lib/categoryEmojis";
import type { StatementLine } from "./FaturaImportTab";

const CATEGORIES = [
  "Alimentação", "Transporte", "Moradia", "Saúde", "Educação",
  "Lazer", "Assinaturas", "Impostos", "Serviços", "Compras", "Viagem", "Outros"
];

interface Props {
  statementId: string | null;
  lines: StatementLine[];
  setLines: (lines: StatementLine[]) => void;
  statementMonth: string;
  onApplied: () => void;
}

export default function FaturaReviewTab({ statementId, lines, setLines, statementMonth, onApplied }: Props) {
  const { user } = useAuth();
  const { fmt } = usePrivacyFmt();
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [fStatus, setFStatus] = useState("all");
  const [fCategory, setFCategory] = useState("all");
  const [fType, setFType] = useState("all");
  const [fRecurring, setFRecurring] = useState("all");
  const [fInstallment, setFInstallment] = useState("all");
  const [fOrigin, setFOrigin] = useState("all");
  const [fConfidence, setFConfidence] = useState([0]);
  const [fSearch, setFSearch] = useState("");

  const filtered = useMemo(() => {
    return lines.filter(l => {
      if (fStatus !== "all" && l.status !== fStatus && !(fStatus === "duplicate" && l.isDuplicate)) return false;
      if (fCategory !== "all" && l.category !== fCategory) return false;
      if (fType !== "all" && l.expense_type !== fType) return false;
      if (fRecurring === "yes" && !l.recurring) return false;
      if (fRecurring === "no" && l.recurring) return false;
      if (fInstallment === "yes" && !l.installment_total) return false;
      if (fInstallment === "no" && l.installment_total) return false;
      if (fOrigin !== "all" && l.origin !== fOrigin) return false;
      if (l.confidence < fConfidence[0]) return false;
      if (fSearch && !(l.merchant_norm || "").toLowerCase().includes(fSearch.toLowerCase()) && !(l.merchant_raw || "").toLowerCase().includes(fSearch.toLowerCase())) return false;
      return true;
    });
  }, [lines, fStatus, fCategory, fType, fRecurring, fInstallment, fOrigin, fConfidence, fSearch]);

  const updateLine = (idx: number, field: string, value: any) => {
    setLines(lines.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };

  const handleCategoryChange = async (idx: number, cat: string) => {
    updateLine(idx, "category", cat);
    if (user) {
      const l = lines[idx];
      await upsertMerchantRule(user.id, l.merchant_norm || "", cat, l.expense_type || "variavel", l.recurring);
    }
  };

  const handleTypeChange = async (idx: number, type: string) => {
    updateLine(idx, "expense_type", type);
    if (user) {
      const l = lines[idx];
      await upsertMerchantRule(user.id, l.merchant_norm || "", l.category || "Outros", type, l.recurring);
    }
  };

  const toggleSelect = (idx: number) => {
    setSelected(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  };
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((_, i) => i)));
  };

  const bulkAction = (field: string, value: any) => {
    const idxSet = new Set(Array.from(selected).map(i => lines.indexOf(filtered[i])));
    setLines(lines.map((l, i) => idxSet.has(i) ? { ...l, [field]: value } : l));
    setSelected(new Set());
  };

  const markAllReviewed = () => {
    setLines(lines.map(l => l.status === "pending_review" ? { ...l, status: "ready" } : l));
    toast({ title: "Todas marcadas como revisadas" });
  };

  const saveDraft = async () => {
    if (!statementId || !user) return;
    setSaving(true);
    try {
      for (const l of lines) {
        await supabase.from("credit_card_statement_lines" as any).update({
          category: l.category, expense_type: l.expense_type, recurring: l.recurring,
          installment_total: l.installment_total, installment_current: l.installment_current,
          status: l.status, confidence: l.confidence,
        } as any).eq("statement_id", statementId).eq("line_index", l.line_index);
      }
      toast({ title: "Rascunho salvo" });
    } finally { setSaving(false); }
  };

  const handleApply = async () => {
    if (!user || !statementId) return;
    setSaving(true);
    try {
      // Integrity validation before apply
      const toProcess = lines.filter(it => !it.isDuplicate && !(it.knownInstallment && it.keepAsIs) && it.status !== "ignored" && it.status !== "duplicate");
      if (!toProcess.length) { toast({ title: "Nenhuma transação nova para lançar" }); setSaving(false); return; }

      // Validate all lines
      let integrityIssues = 0;
      for (const line of toProcess) {
        const issues = validateLineIntegrity(line);
        if (issues.length > 0) {
          integrityIssues++;
          const idx = lines.indexOf(line);
          if (idx >= 0) updateLine(idx, "status", "pending_review");
        }
      }
      if (integrityIssues > 0) {
        toast({ title: `${integrityIssues} transações com problemas`, description: "Foram marcadas para revisão. Corrija-as antes de aplicar.", variant: "destructive" });
        setSaving(false); return;
      }

      // Check pending_review items without category
      const uncategorized = toProcess.filter(it => it.status === "pending_review" && !it.category);
      if (uncategorized.length > 0) {
        toast({ title: `${uncategorized.length} transações pendentes sem categoria`, description: "Revise ou marque como 'pronto' antes de aplicar.", variant: "destructive" });
        setSaving(false); return;
      }

      // Idempotency check: existing fingerprints for this month
      const { data: existingDespesas } = await supabase.from("despesas")
        .select("descricao,valor,data")
        .eq("user_id", user.id).eq("mes_referencia", statementMonth);
      const existingSet = new Set((existingDespesas || []).map(e => `${e.data}|${e.valor}|${(e.descricao || "").slice(0, 30).toLowerCase()}`));

      const readyLines = toProcess.filter(it => it.status === "ready" || it.category);
      const parceladas = readyLines.filter(it => it.installment_total && it.installment_current && it.installment_total > 1);
      const regulares = readyLines.filter(it => !it.installment_total || !it.installment_current || it.installment_total <= 1);

      // Filter out already-applied items (idempotency)
      const newRegulares = regulares.filter(it => {
        const key = `${it.purchase_date}|${it.amount}|${(it.merchant_norm || "").slice(0, 30).toLowerCase()}`;
        return !existingSet.has(key);
      });

      if (newRegulares.length) {
        const despesas = newRegulares.map(it => ({
          user_id: user.id, categoria: it.category || "Outros", tipo: it.expense_type || "variavel",
          valor: it.amount, data: it.purchase_date,
          descricao: (it.merchant_norm ? `${it.merchant_norm} - ${it.merchant_raw}` : it.merchant_raw || it.raw_text).slice(0, 300),
          recorrente: it.recurring, is_parcelada: false, mes_referencia: statementMonth,
          status: "a_pagar", responsavel: "Pessoa 1", forma_pagamento: "credit_card",
        }));
        const { error } = await supabase.from("despesas").insert(despesas);
        if (error) throw error;
      }

      for (const it of parceladas) {
        const { data: inserted, error } = await supabase.from("despesas").insert({
          user_id: user.id, categoria: it.category || "Outros", tipo: it.expense_type || "variavel",
          valor: it.amount, data: it.purchase_date,
          descricao: (it.merchant_norm ? `${it.merchant_norm} - ${it.merchant_raw}` : it.merchant_raw || it.raw_text).slice(0, 300),
          recorrente: false, is_parcelada: true, parcela_atual: it.installment_current,
          total_parcelas: it.installment_total, data_inicio_parcelas: it.purchase_date,
          mes_referencia: statementMonth, status: "a_pagar", responsavel: "Pessoa 1",
          forma_pagamento: "credit_card",
        }).select("id").single();
        if (error) throw error;
        if (inserted && it.installment_current && it.installment_total) {
          const instances = [];
          for (let n = it.installment_current; n <= it.installment_total; n++) {
            const d = new Date(it.purchase_date); d.setMonth(d.getMonth() + n - it.installment_current);
            instances.push({ user_id: user.id, installment_id: inserted.id, installment_number: n, amount: it.amount, due_date: d.toISOString().split("T")[0], competencia: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, status: "pending" });
          }
          if (instances.length) await supabase.from("installment_instances").insert(instances);
        }
        if (it.installmentFingerprint) {
          await supabase.from("credit_card_installments").upsert({
            user_id: user.id, fingerprint: it.installmentFingerprint, merchant: it.merchant_norm || "",
            amount: it.amount, total_installments: it.installment_total || 1,
            started_at: statementMonth, last_seen_at: statementMonth, status: "active",
          }, { onConflict: "user_id,fingerprint" } as any);
        }
      }

      // Update kept installments
      for (const it of lines.filter(l => l.knownInstallment && l.keepAsIs && l.installmentFingerprint)) {
        await supabase.from("credit_card_installments").update({ last_seen_at: statementMonth } as any).eq("user_id", user.id).eq("fingerprint", it.installmentFingerprint!);
      }

      // Mark statement as applied
      const appliedCount = newRegulares.length + parceladas.length;
      const skippedCount = regulares.length - newRegulares.length;
      await supabase.from("credit_card_statements" as any).update({ status: "applied" } as any).eq("id", statementId);
      await supabase.from("credit_card_statement_lines" as any).update({ status: "applied" } as any).eq("statement_id", statementId).neq("status", "duplicate");
      await supabase.from("credit_card_audit_events" as any).insert({ statement_id: statementId, user_id: user.id, event_type: "applied", detail: { applied: appliedCount, skipped_idempotent: skippedCount } } as any);

      toast({ title: `${appliedCount} despesas lançadas com sucesso!${skippedCount > 0 ? ` (${skippedCount} ignoradas por duplicidade)` : ""}` });
      onApplied();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
      if (statementId) {
        await supabase.from("credit_card_statements" as any).update({ status: "failed" } as any).eq("id", statementId);
        await supabase.from("credit_card_audit_events" as any).insert({ statement_id: statementId, user_id: user!.id, event_type: "apply_failed", detail: { error: e.message } } as any);
      }
    } finally { setSaving(false); }
  };

  const OriginBadge = ({ origin }: { origin: string }) => {
    if (origin === "rule") return <Badge variant="outline" className="text-[9px] px-1 border-success/50 text-success gap-0.5"><Zap className="h-2.5 w-2.5" />Auto</Badge>;
    if (origin === "cache") return <Badge variant="outline" className="text-[9px] px-1 border-blue-500/50 text-blue-500 gap-0.5"><Zap className="h-2.5 w-2.5" />Cache</Badge>;
    return <Badge variant="secondary" className="text-[9px] px-1 gap-0.5"><Bot className="h-2.5 w-2.5" />IA</Badge>;
  };

  if (!lines.length) {
    return <div className="text-center py-16 text-muted-foreground">Nenhuma fatura carregada. Importe ou selecione do histórico.</div>;
  }

  const pendingCount = lines.filter(l => l.status === "pending_review").length;
  const totalAmount = lines.reduce((s, l) => s + l.amount, 0);

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-sm font-semibold">{filtered.length} transações {fStatus !== "all" || fSearch ? "(filtradas)" : ""}</p>
          <p className="text-xs text-muted-foreground">Total: {fmt(totalAmount)} • {pendingCount} pendentes</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-3.5 w-3.5 mr-1" /> Filtros
          </Button>
          <Button variant="outline" size="sm" onClick={markAllReviewed}>
            <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Marcar tudo revisado
          </Button>
          <Button variant="outline" size="sm" onClick={saveDraft} disabled={saving}>
            <Save className="h-3.5 w-3.5 mr-1" /> Salvar rascunho
          </Button>
          <Button size="sm" onClick={handleApply} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
            Aplicar lançamentos
          </Button>
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 bg-muted p-2 rounded-lg text-xs">
          <span className="font-medium">{selected.size} selecionadas:</span>
          <Select onValueChange={v => bulkAction("category", v)}>
            <SelectTrigger className="h-7 w-32 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select onValueChange={v => bulkAction("expense_type", v)}>
            <SelectTrigger className="h-7 w-24 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent><SelectItem value="fixa">Fixa</SelectItem><SelectItem value="variavel">Variável</SelectItem></SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => bulkAction("status", "ignored")}>Ignorar</Button>
        </div>
      )}

      {/* Filter bar */}
      {showFilters && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 bg-muted/50 p-3 rounded-lg">
          <Select value={fStatus} onValueChange={setFStatus}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="pending_review">Pendente</SelectItem>
              <SelectItem value="ready">Pronto</SelectItem>
              <SelectItem value="duplicate">Duplicado</SelectItem>
              <SelectItem value="ignored">Ignorado</SelectItem>
              <SelectItem value="applied">Aplicado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={fCategory} onValueChange={setFCategory}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={fType} onValueChange={setFType}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="fixa">Fixa</SelectItem><SelectItem value="variavel">Variável</SelectItem></SelectContent>
          </Select>
          <Select value={fRecurring} onValueChange={setFRecurring}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Recorrente" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="yes">Sim</SelectItem><SelectItem value="no">Não</SelectItem></SelectContent>
          </Select>
          <Select value={fInstallment} onValueChange={setFInstallment}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Parcelado" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todos</SelectItem><SelectItem value="yes">Sim</SelectItem><SelectItem value="no">Não</SelectItem></SelectContent>
          </Select>
          <Select value={fOrigin} onValueChange={setFOrigin}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Origem" /></SelectTrigger>
            <SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="rule">Regra</SelectItem><SelectItem value="cache">Cache</SelectItem><SelectItem value="ai">IA</SelectItem><SelectItem value="parser">Parser</SelectItem></SelectContent>
          </Select>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground whitespace-nowrap">Conf ≥ {Math.round(fConfidence[0] * 100)}%</span>
            <Slider value={fConfidence} onValueChange={setFConfidence} min={0} max={1} step={0.1} className="w-20" />
          </div>
          <Input placeholder="Buscar merchant…" value={fSearch} onChange={e => setFSearch(e.target.value)} className="h-8 text-xs" />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"><Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} /></TableHead>
              <TableHead className="w-[90px]">Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="w-[100px] text-right">Valor</TableHead>
              <TableHead className="w-[140px]">Categoria</TableHead>
              <TableHead className="w-[90px]">Tipo</TableHead>
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead className="w-[60px]">Conf.</TableHead>
              <TableHead className="w-[40px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((item, fIdx) => {
              const realIdx = lines.indexOf(item);
              return (
                <TableRow key={realIdx} className={item.isDuplicate ? "opacity-50" : item.knownInstallment ? "bg-success/5" : item.status === "ignored" ? "opacity-40" : ""}>
                  <TableCell><Checkbox checked={selected.has(fIdx)} onCheckedChange={() => toggleSelect(fIdx)} /></TableCell>
                  <TableCell className="text-xs">{item.purchase_date}</TableCell>
                  <TableCell className="text-xs max-w-[220px]">
                    <div className="truncate" title={item.merchant_raw || item.raw_text || ""}>
                      {item.merchant_norm && <span className="font-medium">{item.merchant_norm} — </span>}
                      {item.merchant_raw || item.raw_text}
                    </div>
                    {item.isDuplicate && <span className="text-[10px] text-amber-600 flex items-center gap-0.5 mt-0.5"><AlertTriangle className="h-2.5 w-2.5" /> Duplicata</span>}
                    {item.knownInstallment && <span className="text-[10px] text-success flex items-center gap-0.5 mt-0.5"><CheckCircle2 className="h-2.5 w-2.5" /> Já cadastrado</span>}
                  </TableCell>
                  <TableCell className="text-right text-xs font-medium">{fmt(item.amount)}</TableCell>
                  <TableCell>
                    <Select value={item.category || "Outros"} onValueChange={v => handleCategoryChange(realIdx, v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={item.expense_type || "variavel"} onValueChange={v => handleTypeChange(realIdx, v)}>
                      <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="fixa">Fixa</SelectItem><SelectItem value="variavel">Variável</SelectItem></SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="space-x-1">
                    <TooltipProvider delayDuration={200}><Tooltip><TooltipTrigger><OriginBadge origin={item.origin} /></TooltipTrigger><TooltipContent className="text-xs">Origem: {item.origin}</TooltipContent></Tooltip></TooltipProvider>
                    {item.recurring && <Badge variant="outline" className="text-[9px] px-1">Rec</Badge>}
                    {item.installment_total && item.installment_total > 1 && <Badge variant="secondary" className="text-[9px] px-1">{item.installment_current}/{item.installment_total}</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className={`text-xs font-medium ${item.confidence >= 0.8 ? "text-success" : item.confidence >= 0.5 ? "text-amber-500" : "text-destructive"}`}>
                      {Math.round(item.confidence * 100)}%
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { updateLine(realIdx, "status", "ignored"); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
