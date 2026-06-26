import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useOutletContext, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { useToast } from "@/hooks/use-toast";
import { useCompanies, BusinessTransaction, BusinessCategory, AllocationRule, BUSINESS_TYPE_LABELS, companyControlsStock, nichoCategorias } from "@/hooks/useCompanies";
import { useBusinessRecurring } from "@/hooks/useBusinessRecurring";
import { useBusinessInventory } from "@/hooks/useBusinessInventory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Briefcase, DollarSign, Wallet, Plus, Pencil, Trash2, ArrowUpRight, ArrowDownRight,
  HelpCircle, Upload, Target, Activity, Link2, CalendarDays, Users, Settings, Package
} from "lucide-react";
import { EmojiIcon } from "@/components/EmojiIcon";
import { format, subMonths, startOfMonth, endOfMonth, startOfYear, parseISO, isWithinInterval, getDaysInMonth, getDate } from "date-fns";
import { ptBR } from "date-fns/locale";
import PrivacyValue from "@/components/PrivacyValue";
import CompanySelector from "@/components/negocios/CompanySelector";
import CompanyWizard from "@/components/negocios/CompanyWizard";
import BusinessOnboarding from "@/components/negocios/BusinessOnboarding";
import AllocationRulesCard from "@/components/negocios/AllocationRulesCard";
import BusinessInsights from "@/components/negocios/BusinessInsights";
import CsvImportDialog from "@/components/negocios/CsvImportDialog";
import CashFlowSimulator from "@/components/negocios/CashFlowSimulator";
import BusinessFunil from "@/components/negocios/BusinessFunil";
import BusinessEstoque from "@/components/negocios/BusinessEstoque";
import BusinessRecurringPending from "@/components/negocios/BusinessRecurringPending";
import BusinessRecurringManager from "@/components/negocios/BusinessRecurringManager";
import BusinessClientsManager from "@/components/negocios/BusinessClientsManager";
import BusinessClientes from "@/components/negocios/BusinessClientes";
import BusinessPropostas from "@/components/negocios/BusinessPropostas";
import BusinessChartsSection from "@/components/negocios/BusinessChartsSection";
import BusinessTransferHistory from "@/components/negocios/BusinessTransferHistory";
import BusinessExtraKPIs from "@/components/negocios/BusinessExtraKPIs";
import BusinessQuickStart from "@/components/negocios/BusinessQuickStart";
import BusinessHealthScore from "@/components/negocios/BusinessHealthScore";
import BusinessRadarSection from "@/components/negocios/BusinessRadarSection";
import DiagnosticoAtlas from "@/components/dashboard/DiagnosticoAtlas";
import PrevisaoCaixa from "@/components/dashboard/PrevisaoCaixa";
import DetectorProblemas from "@/components/dashboard/DetectorProblemas";
import DiagnosticoInteligente from "@/components/dashboard/DiagnosticoInteligente";
import AssistenteAtlasCard from "@/components/dashboard/AssistenteAtlasCard";
import { getShowNegociosNav, setShowNegociosNav } from "@/lib/navPrefs";

// ── PJ→PF categories that trigger cross-ledger ──
const PJ_PF_CATEGORIES = ["pró-labore", "pro-labore", "distribuição de lucros", "transferência pessoal"];
const PJ_PF_TYPES: Record<string, string> = {
  "pró-labore": "prolabore",
  "pro-labore": "prolabore",
  "distribuição de lucros": "lucro",
  "transferência pessoal": "transferencia",
};

// ── Period filter ──
type PeriodChip = "today" | "month_current" | "month_last" | "3m" | "6m" | "12m" | "year_current" | "all" | "custom" | "single_month";

const CHIP_LABELS: Record<string, string> = {
  today: "Hoje",
  month_current: "Este mês",
  month_last: "Mês passado",
  "3m": "3 meses",
  "6m": "6 meses",
  "12m": "12 meses",
  year_current: "Este ano",
  all: "Desde o início",
  custom: "Personalizado",
};

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function getRange(chip: PeriodChip, customStart?: string, customEnd?: string, singleMonth?: string): { start: Date | null; end: Date } {
  const now = new Date();
  const end = endOfMonth(now);
  switch (chip) {
    case "today": return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()), end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59) };
    case "month_current": return { start: startOfMonth(now), end };
    case "month_last": { const pm = subMonths(now, 1); return { start: startOfMonth(pm), end: endOfMonth(pm) }; }
    case "3m": return { start: startOfMonth(subMonths(now, 2)), end };
    case "6m": return { start: startOfMonth(subMonths(now, 5)), end };
    case "12m": return { start: startOfMonth(subMonths(now, 11)), end };
    case "year_current": return { start: startOfYear(now), end };
    case "all": return { start: null, end };
    case "single_month": {
      if (singleMonth) {
        const d = parseISO(singleMonth + "-01");
        return { start: startOfMonth(d), end: endOfMonth(d) };
      }
      return { start: startOfMonth(now), end };
    }
    case "custom": {
      if (customStart && customEnd) {
        return { start: parseISO(customStart + "-01"), end: endOfMonth(parseISO(customEnd + "-01")) };
      }
      return { start: null, end };
    }
  }
}

// ── PF category options for cross-ledger ──
const PF_CATEGORIES = [
  "Pró-labore", "Distribuição de lucros", "Transferência da empresa",
  "Receita PJ", "Outros recebimentos",
];

// Toggle discreto de preferência (atalho de Negócios na barra inferior).
function NegociosNavToggle() {
  const [on, setOn] = useState(getShowNegociosNav());
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 py-3">
      <div className="min-w-0">
        <Label htmlFor="negocios-nav" className="text-sm font-medium">Mostrar atalho de Negócios na barra</Label>
        <p className="text-[11px] text-muted-foreground">Adiciona um ícone de Negócios na barra inferior (mobile).</p>
      </div>
      <Switch id="negocios-nav" checked={on} onCheckedChange={(v) => { setOn(v); setShowNegociosNav(v); }} />
    </div>
  );
}

const AtlasNegocios = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fmt: fmtMoney } = usePrivacyFmt();
  const { onOpenChat } = useOutletContext<{ onOpenChat?: (q?: string) => void }>();
  const {
    companies, selected, loading: companiesLoading,
    selectCompany, createCompany, canCreate, archiveCompany, deleteCompany, updateCompany,
  } = useCompanies();

  const [transactions, setTransactions] = useState<BusinessTransaction[]>([]);
  const [categories, setCategories] = useState<BusinessCategory[]>([]);
  const [allocationRules, setAllocationRules] = useState<AllocationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  const [chip, setChip] = useState<PeriodChip>("month_current");
  const [customStart, setCustomStart] = useState(format(subMonths(new Date(), 2), "yyyy-MM"));
  const [customEnd, setCustomEnd] = useState(format(new Date(), "yyyy-MM"));
  const [customPopoverOpen, setCustomPopoverOpen] = useState(false);
  const [singleMonth, setSingleMonth] = useState(format(new Date(), "yyyy-MM"));

  const [wizardOpen, setWizardOpen] = useState(false);
  const navigate = useNavigate();
  const routeParams = useParams();
  const tabParam = routeParams["*"] || "";
  const view = (["financeiro", "funil", "estoque", "clientes", "propostas"].includes(tabParam) ? tabParam : "financeiro") as "financeiro" | "funil" | "estoque" | "clientes" | "propostas";
  const setView = (k: string) => navigate(`/dashboard/negocios${k === "financeiro" ? "" : "/" + k}`);
  const controlsStock = companyControlsStock(selected);
  const [importOpen, setImportOpen] = useState(false);
  const [manageRecurringOpen, setManageRecurringOpen] = useState(false);
  const [clientsOpen, setClientsOpen] = useState(false);

  // Recurring
  const recurring = useBusinessRecurring(selected?.id || null);
  const inventory = useBusinessInventory(selected?.id || null);

  // Transaction form
  const [formOpen, setFormOpen] = useState(false);
  const [formDir, setFormDir] = useState<"in" | "out">("in");
  const [formDesc, setFormDesc] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const formatCurrency = (value: string) => {
    const digits = value.replace(/\D/g, "");
    const number = parseInt(digits || "0") / 100;
    return number.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formCatId, setFormCatId] = useState<string>("");
  const [editId, setEditId] = useState<string | null>(null);
  // Recurring form fields
  const [formRecurring, setFormRecurring] = useState(false);
  const [formDueDay, setFormDueDay] = useState(1);
  const [formStartMonth, setFormStartMonth] = useState(format(startOfMonth(new Date()), "yyyy-MM"));
  const [formEndMonth, setFormEndMonth] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formClientId, setFormClientId] = useState("none");
  const [formProductId, setFormProductId] = useState("none");
  const [formQty, setFormQty] = useState("");
  const [formBaixaEstoque, setFormBaixaEstoque] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  // PJ→PF cross-ledger
  const [formCrossLedger, setFormCrossLedger] = useState(false);
  const [formPfCategory, setFormPfCategory] = useState("Pró-labore");

  // Delete confirmation with cross-ledger awareness
  const [deleteConfirm, setDeleteConfirm] = useState<{ txId: string; hasLink: boolean } | null>(null);
  const [deleteMode, setDeleteMode] = useState<"both" | "this" | "unlink">("both");

  // ── Fetch data for selected company ──
  const fetchData = useCallback(async () => {
    if (!user || !selected) return;
    setLoading(true);
    const [txRes, catRes, rulesRes] = await Promise.all([
      supabase.from("business_transactions").select("*").eq("company_id", selected.id).order("date", { ascending: false }).limit(5000),
      supabase.from("business_categories").select("*").eq("company_id", selected.id).order("sort_order"),
      supabase.from("allocation_rules").select("*").eq("company_id", selected.id).order("created_at"),
    ]);
    setTransactions((txRes.data || []) as unknown as BusinessTransaction[]);
    setCategories((catRes.data || []) as unknown as BusinessCategory[]);
    setAllocationRules((rulesRes.data || []) as unknown as AllocationRule[]);
    const { data: clientsData } = await supabase
      .from("business_clients")
      .select("id, name, document")
      .eq("company_id", selected.id)
      .eq("active", true)
      .order("name")
      .limit(2000);
    setClients((clientsData || []) as any[]);
    setLoading(false);
    setDataVersion(v => v + 1);
  }, [user, selected]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (view === "estoque" && selected && !controlsStock) setView("financeiro"); }, [view, selected, controlsStock]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Check if selected category is a PJ→PF type ──
  const selectedCatName = useMemo(() => {
    if (!formCatId) return "";
    const cat = categories.find(c => c.id === formCatId);
    return cat?.name?.toLowerCase() || "";
  }, [formCatId, categories]);

  const isCrossLedgerCategory = formDir === "out" && PJ_PF_CATEGORIES.some(c => selectedCatName.includes(c));

  // ── Period filtering ──
  const range = useMemo(() => getRange(chip, customStart, customEnd, singleMonth), [chip, customStart, customEnd, singleMonth]);
  const filtered = useMemo(() => {
    if (!range.start) return transactions;
    return transactions.filter(t => {
      const d = parseISO(t.date);
      return isWithinInterval(d, { start: range.start!, end: range.end });
    });
  }, [transactions, range]);

  // Mês de referência pros cards de IA: o mês mais recente com dados dentro do filtro.
  const mesRef = useMemo(() => {
    if (!filtered.length) return undefined;
    const max = filtered.reduce((m, t) => (t.date > m ? t.date : m), filtered[0].date);
    return max.slice(0, 7);
  }, [filtered]);

  // ── Aggregates ──
  const revenue = useMemo(() => filtered.filter(t => t.direction === "in").reduce((s, t) => s + Number(t.amount), 0), [filtered]);
  const expenses = useMemo(() => filtered.filter(t => t.direction === "out").reduce((s, t) => s + Number(t.amount), 0), [filtered]);
  const profit = revenue - expenses;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  // Health badge
  const healthBadge = useMemo(() => {
    if (filtered.length === 0) return null;
    if (margin > 20) return { label: "Saudável", emoji: "🟢", cls: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30" };
    if (margin >= 10) return { label: "Atenção", emoji: "🟡", cls: "bg-amber-500/15 text-amber-700 border-amber-500/30" };
    return { label: "Crítico", emoji: "🔴", cls: "bg-destructive/15 text-destructive border-destructive/30" };
  }, [margin, filtered]);

  // Projection
  const mesAtual = format(new Date(), "yyyy-MM");
  const recMes = useMemo(() => transactions.filter(t => t.date.startsWith(mesAtual) && t.direction === "in").reduce((s, t) => s + Number(t.amount), 0), [transactions, mesAtual]);
  const despMes = useMemo(() => transactions.filter(t => t.date.startsWith(mesAtual) && t.direction === "out").reduce((s, t) => s + Number(t.amount), 0), [transactions, mesAtual]);
  const projecao = useMemo(() => {
    const now = new Date();
    const dia = getDate(now);
    const diasNoMes = getDaysInMonth(now);
    if (dia < 2) return null;
    const recDia = recMes / dia;
    const despDia = despMes / dia;
    const diasRest = diasNoMes - dia;
    return { recProj: recMes + recDia * diasRest, despProj: despMes + despDia * diasRest, lucroProj: (recMes + recDia * diasRest) - (despMes + despDia * diasRest), diasRest };
  }, [recMes, despMes]);

  // (chart data moved to BusinessChartsSection)

  // ── CRUD ──
  const handleSave = async () => {
    if (!user || !selected || !formDesc.trim() || !formAmount) return;
    const val = parseFloat(formAmount.replace(/\./g, "").replace(",", "."));
    if (isNaN(val) || val <= 0) return;

    // If recurring mode, create template instead
    if (formRecurring && !editId) {
      await recurring.createTemplate({
        type: formDir,
        title: formDesc,
        amount: val,
        category_id: formCatId || null,
        due_day: formDueDay,
        start_month: formStartMonth + "-01",
        end_month: formEndMonth ? formEndMonth + "-01" : null,
      });
      setFormOpen(false); resetForm();
      fetchData();
      return;
    }

    const payload: any = {
      company_id: selected.id, user_id: user.id,
      direction: formDir, description: formDesc, amount: val, date: formDate,
      category_id: formCatId || null, source: "manual",
      notes: formNote || null,
      client_id: formClientId && formClientId !== "none" ? formClientId : null,
      product_id: formProductId && formProductId !== "none" ? formProductId : null,
      quantidade: formQty ? Number(String(formQty).replace(",", ".")) : null,
    };

    let txId: string | null = null;

    if (editId) {
      await supabase.from("business_transactions").update(payload).eq("id", editId);
      txId = editId;
    } else {
      const { data } = await supabase.from("business_transactions").insert(payload).select().single();
      txId = (data as any)?.id || null;
    }

    // Baixa/entrada de estoque (opcional) — só em novos lançamentos
    if (formBaixaEstoque && !editId && formProductId && formProductId !== "none") {
      const item = inventory.items.find(i => i.id === formProductId);
      const q = formQty ? (Number(String(formQty).replace(",", ".")) || 1) : 1;
      if (item) {
        if (formDir === "in") {
          if (item.tipo === "produto") await inventory.registerSale(item.id, q);
          else await inventory.registerMovement(item, "saida", q, "Venda registrada no lançamento");
        } else {
          await inventory.registerMovement(item, "entrada", q, "Compra registrada no lançamento");
        }
      }
    }

    // PJ→PF cross-ledger
    if (formCrossLedger && txId && !editId) {
      const crossType = PJ_PF_TYPES[selectedCatName] || "transferencia";
      await supabase.from("cross_ledger_links").insert({
        user_id: user.id,
        company_id: selected.id,
        pj_transaction_id: txId,
        pf_entry_type: "receita",
        pf_category: formPfCategory,
        pf_amount: val,
        type: crossType,
        month_ref: formDate.substring(0, 7) + "-01",
      } as any);
      await supabase.from("despesas").insert({
        user_id: user.id,
        categoria: formPfCategory,
        descricao: `${formDesc} (PJ → PF)`,
        valor: val,
        data: formDate,
        tipo: "receita_pj",
        status: "pago",
        responsavel: "Pessoa 1",
      } as any);
      toast({ title: "Lançamento registrado e vinculado à PF!" });
    } else {
      toast({ title: editId ? "Lançamento atualizado" : "Lançamento registrado" });
    }

    const done = pendingDoneRef.current;
    setFormOpen(false); resetForm();
    fetchData();
    if (done) done();
  };

  const resetForm = () => {
    pendingDoneRef.current = null;
    setEditId(null); setFormDesc(""); setFormAmount(""); setFormCatId("");
    setFormRecurring(false); setFormDueDay(1);
    setFormStartMonth(format(startOfMonth(new Date()), "yyyy-MM"));
    setFormEndMonth("");
    setFormCrossLedger(false);
    setFormPfCategory("Pró-labore");
    setFormNote("");
    setFormClientId("none");
    setFormProductId("none");
    setFormQty("");
    setFormBaixaEstoque(false);
  };

  // Abre o formulário de lançamento já vinculado a um cliente (vindo da aba Clientes).
  const openNewForClient = (clientId: string, dir: "in" | "out" = "in") => {
    resetForm();
    setFormDir(dir);
    setFormClientId(clientId);
    setFormOpen(true);
  };

  // Custo de produção de um produto: soma da ficha técnica, ou custo unitário.
  const custoProducao = (productId: string): number => {
    const lines = inventory.recipes.filter(r => r.produto_id === productId);
    if (lines.length) return lines.reduce((s, l) => s + (Number(inventory.items.find(i => i.id === l.insumo_id)?.custo_unitario || 0) * Number(l.quantidade)), 0);
    const item = inventory.items.find(i => i.id === productId);
    return Number(item?.custo_unitario || 0);
  };
  const toBRL = (v: number) => (v > 0 ? v.toFixed(2).replace(".", ",") : "");

  // Ao escolher um produto no lançamento, puxa o valor: entrada = preço de venda, saída = custo.
  const onPickProduct = (pid: string) => {
    setFormProductId(pid);
    if (pid === "none") return;
    const item = inventory.items.find(i => i.id === pid);
    if (!item) return;
    const val = formDir === "in" ? Number(item.preco_venda || 0) : (item.tipo === "produto" ? custoProducao(pid) : Number(item.custo_unitario || 0));
    if (val > 0) setFormAmount(toBRL(val));
  };

  // Callback a rodar após o lançamento ser salvo com sucesso (usado pelas propostas).
  const pendingDoneRef = useRef<null | (() => void)>(null);
  // Abre o formulário pré-preenchido (custo de produção / receita de uma proposta) para o usuário confirmar.
  const openPrefilled = (p: { dir: "in" | "out"; amount: number; description: string; clientId?: string | null; onConfirmed?: () => void }) => {
    resetForm();
    setFormDir(p.dir);
    setFormDesc(p.description);
    setFormAmount(toBRL(p.amount));
    if (p.clientId) setFormClientId(p.clientId);
    pendingDoneRef.current = p.onConfirmed || null;
    setFormOpen(true);
  };

  const handleDeleteRequest = async (id: string) => {
    // Check if this transaction has a cross_ledger_link
    if (!user) return;
    const { data: links } = await supabase
      .from("cross_ledger_links")
      .select("id")
      .eq("pj_transaction_id", id)
      .eq("user_id", user.id)
      .limit(1) as any;
    const hasLink = (links || []).length > 0;
    setDeleteConfirm({ txId: id, hasLink });
  };

  const executeDelete = async () => {
    if (!deleteConfirm || !user) return;
    const { txId, hasLink } = deleteConfirm;

    if (hasLink) {
      if (deleteMode === "both") {
        // Delete PF entry linked via cross_ledger, then delete link and PJ tx
        const { data: links } = await supabase
          .from("cross_ledger_links")
          .select("*")
          .eq("pj_transaction_id", txId)
          .eq("user_id", user.id) as any;
        for (const l of links || []) {
          // Try to delete matching PF entry
          await supabase.from("despesas")
            .delete()
            .eq("user_id", user.id)
            .like("descricao", "%(PJ → PF)%")
            .eq("valor", l.pf_amount)
            .eq("categoria", l.pf_category)
            .limit(1);
        }
        await supabase.from("cross_ledger_links").delete().eq("pj_transaction_id", txId).eq("user_id", user.id);
      } else if (deleteMode === "unlink") {
        // Just remove the link, keep PF entry
        await supabase.from("cross_ledger_links").delete().eq("pj_transaction_id", txId).eq("user_id", user.id);
      }
      // "this" mode: just delete PJ tx, keep PF and link (link becomes orphan — acceptable)
    }

    await supabase.from("business_transactions").delete().eq("id", txId);
    setDeleteConfirm(null);
    fetchData();
    toast({ title: "Lançamento excluído" });
  };

  const handleEdit = (t: BusinessTransaction) => {
    setEditId(t.id);
    setFormDir(t.direction);
    setFormDesc(t.description);
    setFormAmount(String(t.amount));
    setFormDate(t.date);
    setFormCatId(t.category_id || "");
    setFormProductId((t as any).product_id || "none");
    setFormQty((t as any).quantidade != null ? String((t as any).quantidade) : "");
    setFormBaixaEstoque(false);
    setFormOpen(true);
  };

  const getCategoryLabel = (catId: string | null) => {
    if (!catId) return "";
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name : "";
  };

  // ── Loading / Onboarding ──
  if (companiesLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;

  if (companies.length === 0) {
    return (
      <>
        <BusinessOnboarding onCreateFirst={() => setWizardOpen(true)} />
        <CompanyWizard open={wizardOpen} onOpenChange={setWizardOpen} onCreate={createCompany} />
      </>
    );
  }

  const openNewEntry = (dir: "in" | "out") => {
    resetForm();
    setFormDir(dir);
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-xl bg-primary/10"><Briefcase className="h-6 w-6 text-primary" /></div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-heading font-bold truncate">{selected?.name || "Atlas Negócios"}</h1>
              <p className="text-[11px] text-muted-foreground">
                {selected ? BUSINESS_TYPE_LABELS[selected.business_type as keyof typeof BUSINESS_TYPE_LABELS] || selected.business_type : ""}
              </p>
            </div>
            {healthBadge && (
              <Badge variant="outline" className={`sm:hidden text-xs px-2 py-0.5 border flex-shrink-0 ${healthBadge.cls}`}>
                <EmojiIcon emoji={healthBadge.emoji} className="h-2.5 w-2.5 mr-1 inline-block align-middle" />{healthBadge.label}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <CompanySelector
              companies={companies}
              selected={selected}
              onSelect={selectCompany}
              onCreateNew={() => setWizardOpen(true)}
              canCreate={canCreate}
            />
            {selected && (
              <button aria-label="Configurações da empresa" onClick={() => navigate("/dashboard/empresa")} className="p-2 rounded-lg border border-border/60 text-muted-foreground hover:text-foreground hover:bg-muted/50 flex-shrink-0">
                <Settings className="h-4 w-4" />
              </button>
            )}
            {healthBadge && (
              <Badge variant="outline" className={`hidden sm:flex text-xs px-3 py-1 border ${healthBadge.cls}`}>
                <EmojiIcon emoji={healthBadge.emoji} className="h-2.5 w-2.5 mr-1 inline-block align-middle" />{healthBadge.label}
              </Badge>
            )}
          </div>
        </div>
      </div>

      <NegociosNavToggle />

      {/* Seletor de visão: Financeiro × Funil */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 text-xs w-full sm:w-auto sm:inline-flex">
        {([{ k: "financeiro", label: "Financeiro" }, { k: "funil", label: "Funil" }, ...(controlsStock ? [{ k: "estoque", label: "Estoque" }] as const : []), { k: "clientes", label: "Clientes" }, { k: "propostas", label: "Propostas" }] as const).map(o => (
          <button
            key={o.k}
            type="button"
            onClick={() => setView(o.k)}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md transition-colors ${view === o.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {view === "funil" && (
        selected
          ? <BusinessFunil companyId={selected.id} />
          : <p className="text-sm text-muted-foreground py-6 text-center">Selecione ou crie uma empresa para usar o funil.</p>
      )}

      {view === "estoque" && controlsStock && (
        selected
          ? <BusinessEstoque companyId={selected.id} categorias={nichoCategorias(selected)} />
          : <p className="text-sm text-muted-foreground py-6 text-center">Selecione ou crie uma empresa para usar o estoque.</p>
      )}

      {view === "clientes" && (
        selected
          ? <BusinessClientes companyId={selected.id} transactions={transactions as any} categories={categories as any} onNovoLancamento={openNewForClient} />
          : <p className="text-sm text-muted-foreground py-6 text-center">Selecione ou crie uma empresa para ver os clientes.</p>
      )}

      {view === "propostas" && (
        selected
          ? <BusinessPropostas companyId={selected.id} controlsStock={controlsStock} onPrefillLancamento={openPrefilled} />
          : <p className="text-sm text-muted-foreground py-6 text-center">Selecione ou crie uma empresa para enviar propostas.</p>
      )}

      {view === "financeiro" && (
      <>
      {/* ── Filtro de período (único) ── */}
      <div className="space-y-2">
        <Select value={chip} onValueChange={v => setChip(v as PeriodChip)}>
          <SelectTrigger className="h-9 w-auto min-w-[160px] rounded-full text-xs gap-1.5 flex-shrink-0">
            <CalendarDays className="h-3.5 w-3.5" />
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CHIP_LABELS) as PeriodChip[]).filter(c => c !== "custom" && c !== "single_month").map(c => (
              <SelectItem key={c} value={c}>{CHIP_LABELS[c]}</SelectItem>
            ))}
            <SelectItem value="single_month">Mês específico</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
          </SelectContent>
        </Select>

        {chip === "single_month" && (
          <div className="grid grid-cols-6 gap-1 max-w-md">
            {MONTH_NAMES.map((m, i) => {
              const year = new Date().getFullYear();
              const val = `${year}-${String(i + 1).padStart(2, "0")}`;
              const isSelected = singleMonth === val;
              return (
                <button
                  key={i}
                  onClick={() => setSingleMonth(val)}
                  className={`text-xs py-1.5 rounded-lg border transition-all ${
                    isSelected ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/50"
                  }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        )}

        {chip === "custom" && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-xs text-muted-foreground">De</Label>
              <Input type="month" value={customStart} onChange={e => setCustomStart(e.target.value)} className="mt-1 h-8 text-xs w-36" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Até</Label>
              <Input type="month" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="mt-1 h-8 text-xs w-36" />
            </div>
          </div>
        )}
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: ArrowUpRight, label: "Receita", desc: "Tudo que já foi recebido.", val: revenue, cls: "text-emerald-600", help: "Total de entradas registradas no período selecionado." },
          { icon: ArrowDownRight, label: "Despesas", desc: "Gastos para operar.", val: expenses, cls: "text-destructive", help: "Total de saídas registradas no período selecionado." },
          { icon: DollarSign, label: "Lucro", desc: "O que sobra.", val: profit, cls: profit >= 0 ? "text-emerald-600" : "text-destructive", help: "Receita menos despesas. O resultado real do negócio." },
          { icon: Wallet, label: "Margem", desc: "Saúde do negócio.", val: margin, cls: margin >= 20 ? "text-emerald-600" : margin >= 10 ? "text-amber-600" : "text-destructive", help: "Mostra quanto sobra do faturamento depois de pagar as despesas. Acima de 20% é saudável.", isMargem: true },
        ].map((c, i) => (
          <Card key={c.label} className="animate-fade-in" style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <c.icon className={`h-4 w-4 ${c.cls}`} />
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">{c.help}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className={`text-lg font-bold font-heading ${c.cls}`}>
                {(c as any).isMargem
                  ? <PrivacyValue>{margin.toFixed(1)}%</PrivacyValue>
                  : <PrivacyValue>{fmtMoney(c.val)}</PrivacyValue>
                }
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{c.desc}</p>
            </CardContent>
          </Card>
        ))}

        <Card className="shadow-soft animate-fade-in">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground font-medium">Recorrências do mês</span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">Prevista: soma das receitas recorrentes ativas. Confirmada: o que já foi recebido e confirmado no mês.</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-muted-foreground">Prevista</span>
              <span className="text-base font-bold font-heading text-primary">
                <PrivacyValue>{fmtMoney(recurring.templates.filter(t => t.type === "in" && t.active).reduce((s, t) => s + Number(t.amount), 0))}</PrivacyValue>
              </span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-[11px] text-muted-foreground">Confirmada</span>
              <span className="text-base font-bold font-heading text-emerald-600">
                <PrivacyValue>{fmtMoney(recurring.instances.filter(i => i.status === "confirmed").reduce((s, i) => s + Number(i.amount), 0))}</PrivacyValue>
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Transactions ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <CardTitle className="text-sm font-heading">Lançamentos</CardTitle>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setClientsOpen(true)}>
                <Users className="h-3.5 w-3.5 mr-1" /> Clientes
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setImportOpen(true)}>
                <Upload className="h-3.5 w-3.5 mr-1" /> Importar CSV
              </Button>
              <Button size="sm" className="h-7 text-xs" onClick={() => openNewEntry("in")}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Entrada
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openNewEntry("out")}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Saída
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum lançamento no período.</p>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Descrição</TableHead>
                    <TableHead className="text-xs">Categoria</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                    <TableHead className="text-xs w-20">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 50).map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{format(parseISO(t.date), "dd/MM/yy")}</TableCell>
                      <TableCell>
                        <Badge variant={t.direction === "in" ? "default" : "destructive"} className="text-[10px]">
                          {t.direction === "in" ? "Entrada" : "Saída"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {t.source === "import" && <EmojiIcon emoji="📥" className="h-3 w-3 text-muted-foreground mr-1 inline-block align-middle" />}
                        {t.source === "recurring" && <EmojiIcon emoji="🔁" className="h-3 w-3 text-muted-foreground mr-1 inline-block align-middle" />}
                        {t.description}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{getCategoryLabel(t.category_id)}</TableCell>
                      <TableCell className={`text-xs text-right font-medium ${t.direction === "in" ? "text-emerald-600" : "text-destructive"}`}>
                        <PrivacyValue>{fmtMoney(Number(t.amount))}</PrivacyValue>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-6 w-6" aria-label="Editar lançamento" onClick={() => handleEdit(t)}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" aria-label="Excluir lançamento" onClick={() => handleDeleteRequest(t.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filtered.length > 50 && <p className="text-xs text-muted-foreground text-center py-2">Mostrando 50 de {filtered.length} lançamentos</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Quick Start (when no transactions) ── */}
      {filtered.length === 0 && transactions.length < 3 && selected && (
        <BusinessQuickStart
          onAddIncome={() => openNewEntry("in")}
          onAddExpense={() => openNewEntry("out")}
          onOpenRecurring={() => setManageRecurringOpen(true)}
          onOpenImport={() => setImportOpen(true)}
        />
      )}

      {/* ── Health Score ── */}
      <BusinessHealthScore
        transactions={filtered}
        allTransactions={transactions}
        categories={categories}
        revenue={revenue}
        expenses={expenses}
        allocationRules={allocationRules}
      />

      {/* ── Recurring Pending ── */}
      {selected && (recurring.pendingInstances.length > 0 || recurring.templates.length > 0) && (
        <BusinessRecurringPending
          pendingInstances={recurring.pendingInstances}
          templates={recurring.templates}
          categories={categories}
          onConfirm={async (inst, amount) => {
            const ok = await recurring.confirmInstance(inst, amount);
            if (ok) fetchData();
          }}
          onSkip={recurring.skipInstance}
          onOpenManagement={() => setManageRecurringOpen(true)}
        />
      )}

      {/* ── Extra KPIs ── */}
      <BusinessExtraKPIs revenue={revenue} expenses={expenses} />

      {/* ── Projection ── */}
      {chip === "month_current" && projecao && (recMes > 0 || despMes > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-heading flex items-center gap-1.5"><EmojiIcon emoji="🔮" className="h-4 w-4" />Projeção do Mês</CardTitle>
              <span className="text-[10px] text-muted-foreground">({projecao.diasRest} dias restantes)</span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Projeção baseada no ritmo diário atual. Quanto mais dados, mais precisa fica.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "Receita projetada", val: projecao.recProj, cls: "text-emerald-600" },
                { label: "Despesa projetada", val: projecao.despProj, cls: "text-destructive" },
                { label: "Lucro projetado", val: projecao.lucroProj, cls: projecao.lucroProj >= 0 ? "text-emerald-600" : "text-destructive" },
              ].map(p => (
                <div key={p.label} className="bg-muted/50 rounded-xl p-3">
                  <p className="text-[11px] text-muted-foreground">{p.label}</p>
                  <p className={`text-sm font-bold font-heading ${p.cls}`}><PrivacyValue>{fmtMoney(p.val)}</PrivacyValue></p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Allocation Rules ── */}
      {selected && <AllocationRulesCard companyId={selected.id} revenue={revenue} expenses={expenses} categories={categories} onRulesChanged={fetchData} />}

      {/* ── Charts Section (Main chart, Top 5, Waterfall, Donut, Planned vs Real, Profit Evolution) ── */}
      <BusinessChartsSection
        transactions={filtered}
        categories={categories}
        allocationRules={allocationRules}
        revenue={revenue}
        expenses={expenses}
      />

      {/* ── Radar Financeiro + AI ── */}
      {selected && (
        <BusinessRadarSection
          transactions={filtered}
          allTransactions={transactions}
          categories={categories}
          revenue={revenue}
          expenses={expenses}
          allocationRules={allocationRules}
          companyName={selected.name}
        />
      )}

      {/* ── Diagnóstico do Atlas ── */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold mb-3 px-1">Diagnóstico do Atlas</p>
        <DiagnosticoAtlas companyId={selected?.id} refreshKey={dataVersion} mesRef={mesRef} />
      </div>

      {/* ── Previsão de Caixa ── */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold mb-3 px-1">Previsão de Caixa</p>
        <PrevisaoCaixa companyId={selected?.id} refreshKey={dataVersion} mesRef={mesRef} />
      </div>

      {/* ── Detector de Problemas ── */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold mb-3 px-1">Detector de Problemas</p>
        <DetectorProblemas companyId={selected?.id} refreshKey={dataVersion} mesRef={mesRef} />
      </div>

      {/* ── Diagnóstico Inteligente ── */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold mb-3 px-1">Diagnóstico Inteligente</p>
        <DiagnosticoInteligente
          grauCompromisso={expenses > 0 && revenue > 0 ? (expenses / revenue) * 100 : 0}
          taxaPoupanca={revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0}
          saldoProjetado={revenue - expenses}
        />
      </div>

      {/* ── Assistente Atlas ── */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold mb-3 px-1">Assistente Atlas</p>
        <AssistenteAtlasCard onOpenChat={onOpenChat || (() => {})} />
      </div>

      {/* ── Cash Flow Simulator ── */}
      <CashFlowSimulator currentRevenue={revenue} currentExpenses={expenses} allocationRules={allocationRules} />

      {/* ── Insights ── */}
      <BusinessInsights
        transactions={filtered}
        allTransactions={transactions}
        categories={categories}
        revenue={revenue}
        expenses={expenses}
        allocationRules={allocationRules}
      />

      {/* ── Transfer History ── */}
      {selected && <BusinessTransferHistory companyId={selected.id} refreshKey={dataVersion} />}
      </>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={o => { if (!o) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir lançamento</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.hasLink
                ? "Este lançamento está vinculado a uma entrada na Pessoa Física. Como deseja proceder?"
                : "Tem certeza que deseja excluir este lançamento?"
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteConfirm?.hasLink && (
            <div className="space-y-2 py-2">
              {([
                { val: "both" as const, label: "Apagar ambos (PJ e PF)", desc: "Remove o lançamento e a entrada vinculada na PF." },
                { val: "this" as const, label: "Apenas este (PJ)", desc: "Remove somente o lançamento da empresa." },
                { val: "unlink" as const, label: "Desvincular e apagar PJ", desc: "Remove o lançamento PJ e o vínculo, mas mantém a entrada PF." },
              ]).map(opt => (
                <button
                  key={opt.val}
                  onClick={() => setDeleteMode(opt.val)}
                  className={`w-full text-left p-3 rounded-lg border text-sm transition-all ${
                    deleteMode === opt.val ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                >
                  <span className="font-medium">{opt.label}</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={executeDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Form Dialog ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar" : "Registrar"} {formDir === "in" ? "Entrada" : "Saída"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex gap-2">
              <Button size="sm" variant={formDir === "in" ? "default" : "outline"} onClick={() => setFormDir("in")}>Entrada</Button>
              <Button size="sm" variant={formDir === "out" ? "destructive" : "outline"} onClick={() => setFormDir("out")}>Saída</Button>
            </div>
            <Input placeholder="Descrição" value={formDesc} onChange={e => setFormDesc(e.target.value)} />
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
              <Input
                placeholder="0,00"
                value={formAmount}
                onChange={e => setFormAmount(formatCurrency(e.target.value))}
                className="pl-9"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Data de recebimento</Label>
              <Input type="date" value={formDate} onChange={e => {
                setFormDate(e.target.value);
                if (e.target.value) setFormStartMonth(e.target.value.substring(0, 7));
              }} />
            </div>
            <Select value={formCatId} onValueChange={setFormCatId}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Categoria (opcional)" /></SelectTrigger>
              <SelectContent>
                {categories.filter(c => c.direction === formDir).map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2"><EmojiIcon emoji={c.emoji} className="h-4 w-4 text-muted-foreground" />{c.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={formClientId} onValueChange={setFormClientId}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Cliente (opcional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum cliente</SelectItem>
                {clients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.document ? ` — ${c.document}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {controlsStock && inventory.items.length > 0 && (
              <div className="space-y-2 rounded-xl border border-border/50 p-2.5">
                <Select value={formProductId} onValueChange={onPickProduct}>
                  <SelectTrigger className="text-sm"><SelectValue placeholder={formDir === "in" ? "Produto vendido (opcional)" : "Produto/insumo (opcional)"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum produto</SelectItem>
                    {inventory.items.map(it => (
                      <SelectItem key={it.id} value={it.id}>{it.nome} · {it.tipo === "produto" ? "produto" : "insumo"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formProductId !== "none" && (
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground w-24">Quantidade</Label>
                      <Input type="number" inputMode="decimal" value={formQty} onChange={e => setFormQty(e.target.value)} placeholder="1" className="h-8 text-sm" />
                    </div>
                    {!editId && (
                      <div className="flex items-center gap-2">
                        <Switch checked={formBaixaEstoque} onCheckedChange={setFormBaixaEstoque} id="baixa-estoque" />
                        <Label htmlFor="baixa-estoque" className="text-xs cursor-pointer">
                          {formDir === "in" ? "Baixar do estoque ao registrar" : "Dar entrada no estoque ao registrar"}
                        </Label>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Comentário (opcional)</Label>
              <Textarea
                placeholder="Observações sobre este lançamento..."
                value={formNote}
                onChange={e => setFormNote(e.target.value)}
                className="min-h-[60px] text-sm resize-none"
              />
            </div>

            {/* PJ → PF cross-ledger toggle */}
            {isCrossLedgerCategory && !editId && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center gap-3">
                  <Switch checked={formCrossLedger} onCheckedChange={setFormCrossLedger} id="cross-ledger-toggle" />
                  <Label htmlFor="cross-ledger-toggle" className="text-sm cursor-pointer flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5 text-primary" />
                    Registrar também como entrada na Pessoa Física
                  </Label>
                </div>
                {formCrossLedger && (
                  <div className="space-y-2 pl-1">
                    <div>
                      <Label className="text-xs text-muted-foreground">Categoria na PF</Label>
                      <Select value={formPfCategory} onValueChange={setFormPfCategory}>
                        <SelectTrigger className="text-sm mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PF_CATEGORIES.map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">
                      <EmojiIcon emoji="💡" className="h-3 w-3 inline-block mr-1 align-text-bottom" />{selectedCatName.includes("pró-labore") || selectedCatName.includes("pro-labore")
                        ? "Pró-labore: valor que você paga a si mesmo como salário da empresa."
                        : selectedCatName.includes("lucro")
                        ? "Distribuição de lucros: retirada do lucro. Regras variam. Valide com seu contador."
                        : "Transferência pessoal: dinheiro retirado do caixa da empresa para uso pessoal."
                      }
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Recurring toggle - only for new entries */}
            {!editId && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center gap-3">
                  <Switch checked={formRecurring} onCheckedChange={setFormRecurring} id="recurring-toggle" />
                  <Label htmlFor="recurring-toggle" className="text-sm cursor-pointer">Recorrente (mensal)</Label>
                </div>
                {formRecurring && (
                  <div className="space-y-2 pl-1">
                    <div>
                      <Label className="text-xs text-muted-foreground">Dia do vencimento (1-28)</Label>
                      <Input
                        type="number" min={1} max={28}
                        value={formDueDay}
                        onChange={e => setFormDueDay(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Mês inicial</Label>
                      <Input type="month" value={formStartMonth} onChange={e => setFormStartMonth(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Mês final (opcional)</Label>
                      <Input type="month" value={formEndMonth} onChange={e => setFormEndMonth(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-[10px] text-muted-foreground italic pt-1">
              <EmojiIcon emoji="⚠️" className="h-3 w-3 inline-block mr-1 align-text-bottom" />Regras fiscais variam. Valide com seu contador.
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSave}>{editId ? "Salvar" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Wizard ── */}
      <CompanyWizard open={wizardOpen} onOpenChange={setWizardOpen} onCreate={createCompany} />

      {/* ── CSV Import ── */}
      {selected && <CsvImportDialog open={importOpen} onOpenChange={setImportOpen} companyId={selected.id} onComplete={fetchData} />}

      {/* ── Recurring Manager ── */}
      <BusinessRecurringManager
        open={manageRecurringOpen}
        onOpenChange={setManageRecurringOpen}
        templates={recurring.allTemplates}
        categories={categories}
        onUpdate={recurring.updateTemplate}
        onDelete={recurring.deleteTemplate}
      />

      {/* ── Clients Manager ── */}
      <BusinessClientsManager
        open={clientsOpen}
        onOpenChange={setClientsOpen}
        companyId={selected?.id || ""}
      />
    </div>
  );
};

export default AtlasNegocios;
