import {
  createContext, useContext, useState, useEffect, useCallback, useMemo,
  type ReactNode, type Dispatch, type SetStateAction,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/log";
import { useToast } from "@/hooks/use-toast";
import { useExpenseLinks } from "@/hooks/useExpenseLinks";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { useUserRole } from "@/hooks/useUserRole";
import type {
  Investimento, Provento, Indicador, Snapshot, Aporte,
  FiiReport, MacroData, DividendForecastPoint, DividendHistPoint,
} from "@/lib/investimentos/types";
import { emptyForm, REFRESH_LIMIT_KEY, TIPOS_VARIAVEIS } from "@/lib/investimentos/constants";

type FormState = typeof emptyForm;

type InvestimentosContextValue = {
  user: ReturnType<typeof useAuth>["user"];
  isAdmin: boolean;

  fmt: ReturnType<typeof usePrivacyFmt>["fmt"];
  pct: ReturnType<typeof usePrivacyFmt>["pct"];

  loading: boolean;

  investimentos: Investimento[];
  proventos: Provento[];
  indicadores: Indicador[];
  snapshots: Snapshot[];
  aportes: Aporte[];
  transactions: any[];
  quotes: Record<string, any>;
  quotesLoading: boolean;
  mediaDespesas: number;
  fiiReports: FiiReport[];
  macroData: MacroData;
  macroLoading: boolean;
  dividendForecast: DividendForecastPoint[];
  dividendHistChart: DividendHistPoint[];
  nextExDates: Record<string, string>;
  expenseLinks: ReturnType<typeof useExpenseLinks>["links"];

  periodo: string;
  setPeriodo: Dispatch<SetStateAction<string>>;

  dividendPreview: any[];
  setDividendPreview: Dispatch<SetStateAction<any[]>>;
  dividendPreviewOpen: boolean;
  setDividendPreviewOpen: Dispatch<SetStateAction<boolean>>;
  confirmingDividends: boolean;
  loadingDividends: boolean;
  selectedProventoMes: string | null;
  setSelectedProventoMes: Dispatch<SetStateAction<string | null>>;
  divRefreshRemaining: number;

  open: boolean;
  setOpen: Dispatch<SetStateAction<boolean>>;
  editingId: string | null;
  setEditingId: Dispatch<SetStateAction<string | null>>;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  isRendaVariavel: boolean;
  isRendaFixa: boolean;
  handleEdit: (inv: Investimento) => void;
  handleDelete: (id: string) => Promise<void>;
  handleSave: () => Promise<void>;
  handleDialogClose: (v: boolean) => void;

  totalAtual: number;
  totalAportado: number;

  fetchAll: () => Promise<void>;
  fetchQuotes: (invs: Investimento[], force?: boolean) => Promise<void>;
  fetchDividendsFromBrapi: () => Promise<void>;
  confirmDividendImport: () => Promise<void>;
  fetchFiiReports: () => Promise<void>;
  fetchMacroData: () => Promise<void>;
};

const InvestimentosContext = createContext<InvestimentosContextValue | null>(null);

export function useInvestimentos(): InvestimentosContextValue {
  const ctx = useContext(InvestimentosContext);
  if (!ctx) {
    throw new Error("useInvestimentos must be used within InvestimentosProvider");
  }
  return ctx;
}

export function InvestimentosProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fmt, pct } = usePrivacyFmt();
  const { links: expenseLinks } = useExpenseLinks();

  const [investimentos, setInvestimentos] = useState<Investimento[]>([]);
  const [proventos, setProventos] = useState<Provento[]>([]);
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [aportes, setAportes] = useState<Aporte[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<Record<string, any>>({});
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [mediaDespesas, setMediaDespesas] = useState(0);
  const [fiiReports, setFiiReports] = useState<FiiReport[]>([]);
  const [macroData, setMacroData] = useState<MacroData>({ selic: [], ipca: [] });
  const [macroLoading, setMacroLoading] = useState(false);
  const [dividendForecast, setDividendForecast] = useState<DividendForecastPoint[]>([]);
  const [dividendHistChart, setDividendHistChart] = useState<DividendHistPoint[]>([]);
  const [nextExDates, setNextExDates] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const [periodo, setPeriodo] = useState(() => localStorage.getItem("inv_periodo") || "12m");
  useEffect(() => { localStorage.setItem("inv_periodo", periodo); }, [periodo]);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const isRendaVariavel = TIPOS_VARIAVEIS.includes(form.tipo);
  const isRendaFixa = ["Renda Fixa", "Fundo", "Outro"].includes(form.tipo);

  const [dividendPreview, setDividendPreview] = useState<any[]>([]);
  const [dividendPreviewOpen, setDividendPreviewOpen] = useState(false);
  const [confirmingDividends, setConfirmingDividends] = useState(false);
  const [loadingDividends, setLoadingDividends] = useState(false);
  const [selectedProventoMes, setSelectedProventoMes] = useState<string | null>(null);

  const { isAdmin } = useUserRole();
  const today = new Date().toISOString().split("T")[0];
  const getDivRefreshState = () => {
    try {
      const s = localStorage.getItem(REFRESH_LIMIT_KEY);
      if (!s) return { count: 0, date: "" };
      return JSON.parse(s);
    } catch { return { count: 0, date: "" }; }
  };
  const divRefreshState = getDivRefreshState();
  const divRefreshCount = divRefreshState.date === today ? divRefreshState.count : 0;
  const divRefreshRemaining = isAdmin ? 999 : Math.max(0, 2 - divRefreshCount);

  const incrementDivRefresh = () => {
    const state = getDivRefreshState();
    const count = state.date === today ? state.count + 1 : 1;
    localStorage.setItem(REFRESH_LIMIT_KEY, JSON.stringify({ count, date: today }));
  };

  const fetchQuotes = useCallback(async (invs: Investimento[], force = false) => {
    const tickerInvs = invs.filter(i => i.ticker?.trim());
    if (!tickerInvs.length) return;
    setQuotesLoading(true);
    const tipos: Record<string, string> = {};
    tickerInvs.forEach(i => { if (i.ticker) tipos[i.ticker.toUpperCase()] = i.tipo; });
    const { data, error } = await supabase.functions.invoke("get-ticker-quote", {
      body: { tickers: tickerInvs.map(i => i.ticker!.toUpperCase()), tipos, forceRefresh: force },
    });
    if (!error && data?.data) {
      const map: Record<string, any> = {};
      for (const q of data.data) map[q.ticker] = q;
      setQuotes(map);
    }
    setQuotesLoading(false);
  }, []);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
    const [invRes, indRes, despRes, snapRes, aporteRes, provRes, txRes] = await Promise.all([
      supabase.from("investimentos_financeiros").select("*").eq("user_id", user.id).limit(2000),
      supabase.from("indicadores_economicos").select("*").limit(500),
      supabase.from("despesas").select("valor,data").eq("user_id", user.id),
      supabase.from("portfolio_snapshots").select("*").eq("user_id", user.id).order("month_ref").limit(2000),
      supabase.from("aportes_investimentos").select("*").eq("user_id", user.id).order("data").limit(5000),
      supabase.from("proventos_investimentos").select("*").eq("user_id", user.id).order("mes_referencia", { ascending: false }).limit(5000),
      supabase.from("portfolio_transactions").select("*, investimentos_financeiros(nome,ticker)").eq("user_id", user.id).order("data", { ascending: false }).limit(5000),
    ]);
    if (invRes.error) throw invRes.error;
    setInvestimentos((invRes.data as Investimento[]) || []);
    setIndicadores((indRes.data as Indicador[]) || []);
    setSnapshots((snapRes.data as Snapshot[]) || []);
    setAportes((aporteRes.data as Aporte[]) || []);
    setProventos((provRes.data as Provento[]) || []);
    setTransactions((txRes?.data as any[]) || []);
    const despList = despRes.data || [];
    const totalDesp = despList.reduce((s: number, d: any) => s + Number(d.valor), 0);
    const despMonths = new Set(despList.map((d: any) => (d as any).data?.substring?.(0, 7)).filter(Boolean));
    setMediaDespesas(totalDesp / Math.max(1, despMonths.size || 6));

    fetchQuotes((invRes.data as Investimento[]) || []);

    const now = new Date();
    const monthRef = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const inv = (invRes.data as Investimento[]) || [];
    const tv = inv.reduce((s, i) => s + Number(i.valor_atual || 0), 0);
    const tc = inv.reduce((s, i) => s + Number(i.total_aportado || 0), 0);
    if (tv > 0) {
      await supabase.from("portfolio_snapshots").upsert(
        { user_id: user.id, month_ref: monthRef, total_value: tv, total_contributions: tc } as any,
        { onConflict: "user_id,month_ref" }
      );
    }
    } catch (err) {
      logError("InvestimentosContext fetchAll:", err);
      toast({ title: "Não foi possível carregar seus investimentos", description: "Verifique sua conexão e tente novamente.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, fetchQuotes, toast]);

  const fetchDividendsFromBrapi = useCallback(async () => {
    const ativos = investimentos.filter(i => i.ticker?.trim() && Number(i.quantidade) > 0);
    if (!ativos.length) {
      toast({ title: "Nenhum ativo com ticker e quantidade cadastrados." });
      return;
    }
    setLoadingDividends(true);
    const { data, error } = await supabase.functions.invoke("get-ticker-dividends", {
      body: {
        ativos: ativos.map(i => ({
          ticker: i.ticker!,
          quantidade: Number(i.quantidade),
          tipo: i.tipo,
          nome: i.nome,
          investimento_id: i.id,
          data_compra: (i as any).data_compra || null,
        })),
      },
    });
    setLoadingDividends(false);
    if (error || !data) {
      toast({ title: "Erro ao buscar dividendos", variant: "destructive" });
      return;
    }
    incrementDivRefresh();
    const historico: any[] = data.historico || [];

    const { data: existentes } = await supabase
      .from("proventos_investimentos")
      .select("investimento_id, mes_referencia, tipo_provento")
      .eq("user_id", user!.id);

    const existentesSet = new Set(
      (existentes || []).map((e: any) => {
        const mesNorm = e.mes_referencia ? String(e.mes_referencia).substring(0, 7) : "";
        return `${e.investimento_id}|${mesNorm}|${e.tipo_provento}`;
      })
    );

    const novosDividendos = historico.filter(div => {
      const mesNorm = div.mes_referencia ? String(div.mes_referencia).substring(0, 7) : "";
      return !existentesSet.has(`${div.investimento_id}|${mesNorm}|${div.label}`);
    });

    setDividendPreview(novosDividendos);
    setDividendForecast(data.grafico_previsao || []);
    setDividendHistChart(data.grafico_historico || []);

    const previsaoArr: any[] = data.previsao || [];
    const todayStr = new Date().toISOString().split("T")[0];
    const nextByTicker: Record<string, string> = {};
    for (const p of previsaoArr) {
      if (!p.ticker || !p.ex_date) continue;
      if (p.estimado) continue;
      const exDateOnly = String(p.ex_date).substring(0, 10);
      if (exDateOnly < todayStr) continue;
      if (!nextByTicker[p.ticker] || exDateOnly < nextByTicker[p.ticker]) {
        nextByTicker[p.ticker] = exDateOnly;
      }
    }
    setNextExDates(nextByTicker);

    const hoje = new Date();
    const refAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    setSelectedProventoMes(refAtual);

    if (novosDividendos.length === 0) {
      toast({ title: "Nenhum dividendo novo encontrado. Tudo já importado ✓" });
      return;
    }

    setDividendPreviewOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investimentos, user, toast]);

  const confirmDividendImport = useCallback(async () => {
    if (!user || confirmingDividends) return;
    setConfirmingDividends(true);
    let imported = 0;

    const { data: existentes, error: existErr } = await supabase
      .from("proventos_investimentos")
      .select("investimento_id,mes_referencia,tipo_provento")
      .eq("user_id", user.id);

    if (existErr) {
      toast({ title: "Erro ao verificar duplicatas", description: existErr.message, variant: "destructive" });
      setConfirmingDividends(false);
      return;
    }

    const existentesSet = new Set(
      (existentes || []).map((e: any) => {
        const mesNorm = e.mes_referencia ? String(e.mes_referencia).substring(0, 7) : "";
        return `${e.investimento_id}|${mesNorm}|${e.tipo_provento}`;
      })
    );

    const novosDividendos = dividendPreview.filter(div => {
      const mesNorm = div.mes_referencia ? String(div.mes_referencia).substring(0, 7) : "";
      return !existentesSet.has(`${div.investimento_id}|${mesNorm}|${div.label}`);
    });

    const payloads = novosDividendos.map(div => ({
      user_id: user.id,
      investimento_id: div.investimento_id,
      tipo_provento: div.label,
      valor: div.valor_total,
      mes_referencia: div.mes_referencia?.length === 7 ? div.mes_referencia + "-01" : div.mes_referencia,
      observacao: `${div.ticker} — ${div.rate}/cota × ${div.quantidade} cotas${div.related_to ? ` (${div.related_to})` : ""}`,
      ex_date: div.ex_date || null,
    }));

    const CHUNK = 100;
    for (let i = 0; i < payloads.length; i += CHUNK) {
      const chunk = payloads.slice(i, i + CHUNK);
      const { error: insertError } = await supabase
        .from("proventos_investimentos")
        .insert(chunk as any);
      if (!insertError) imported += chunk.length;
      else console.error("Batch insert error:", insertError);
    }

    toast({ title: `${imported} provento(s) importado(s) ✓` });
    setDividendPreviewOpen(false);
    fetchAll();
    setConfirmingDividends(false);
  }, [user, confirmingDividends, dividendPreview, toast, fetchAll]);

  const fetchFiiReports = useCallback(async () => {
    const fiis = investimentos.filter(i => i.tipo === "FII" && i.ticker?.trim());
    if (!fiis.length) return;
    const { data } = await supabase.functions.invoke("get-fii-reports", {
      body: { tickers: fiis.map(i => i.ticker!) },
    });
    if (data?.reports) setFiiReports(data.reports);
  }, [investimentos]);

  const fetchMacroData = useCallback(async () => {
    setMacroLoading(true);
    const { data } = await supabase.functions.invoke("get-macro-data", { body: {} });
    if (data) setMacroData(data);
    setMacroLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    fetchMacroData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    supabase.functions.invoke("indicadores-economicos").catch(() => {});
  }, []);

  const validateForm = useCallback(() => {
    const isVariavel = TIPOS_VARIAVEIS.includes(form.tipo);
    if (!isVariavel && !form.nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" }); return false;
    }
    if (isVariavel && !(form as any).ticker?.trim()) {
      toast({ title: "Ticker é obrigatório para renda variável", variant: "destructive" }); return false;
    }
    if (form.valor_atual < 0 || form.total_aportado < 0) {
      toast({ title: "Valores não podem ser negativos", variant: "destructive" }); return false;
    }
    return true;
  }, [form, toast]);

  const handleSave = useCallback(async () => {
    if (!user || !validateForm()) return;
    const isVariavel = TIPOS_VARIAVEIS.includes(form.tipo);
    const payload = {
      user_id: user.id,
      nome: form.nome.trim() || (isVariavel
        ? (quotes[(form as any).ticker?.toUpperCase()]?.nome || (form as any).ticker?.toUpperCase() || "")
        : ""),
      ticker: (form as any).ticker?.trim().toUpperCase() || "",
      tipo: form.tipo, classe: form.classe,
      instituicao: form.instituicao,
      valor: isVariavel ? form.quantidade * form.preco_medio : form.valor_atual,
      valor_atual: isVariavel
        ? (() => {
            const ticker = (form as any).ticker?.toUpperCase();
            const q = ticker ? quotes[ticker] : null;
            return q?.preco_atual
              ? form.quantidade * q.preco_atual
              : form.quantidade * form.preco_medio;
          })()
        : form.valor_atual,
      total_aportado: isVariavel ? form.quantidade * form.preco_medio : form.total_aportado,
      quantidade: form.quantidade, preco_medio: form.preco_medio,
      indexador: form.indexador === "none" ? "" : form.indexador,
      taxa_contratada: form.taxa_contratada,
      categoria_titulo: form.categoria_titulo || null,
      vencimento_data: form.vencimento_data || null, liquidez: form.liquidez,
      perfil_risco: form.perfil_risco, is_reserva_emergencia: form.is_reserva_emergencia,
      recebe_proventos: form.recebe_proventos,
      frequencia_proventos: form.recebe_proventos ? form.frequencia_proventos : "sem_proventos",
      meses_proventos: form.recebe_proventos ? form.meses_proventos : "",
      data_compra: (form as any).data_compra?.trim() || null,
    };
    if (editingId) {
      const { error } = await supabase.from("investimentos_financeiros").update(payload as any).eq("id", editingId);
      if (error) {
        logError("handleSave update:", error);
        toast({ title: "Não foi possível atualizar o investimento", description: "Tente novamente.", variant: "destructive" });
        return;
      }
      toast({ title: "Investimento atualizado" });
    } else {
      const { error } = await supabase.from("investimentos_financeiros").insert(payload as any);
      if (error) {
        logError("handleSave insert:", error);
        toast({ title: "Não foi possível adicionar o investimento", description: "Tente novamente.", variant: "destructive" });
        return;
      }
      toast({ title: "Investimento adicionado" });
    }
    setForm(emptyForm); setEditingId(null); setOpen(false); fetchAll();
  }, [user, form, editingId, quotes, validateForm, toast, fetchAll]);

  const handleEdit = useCallback((inv: Investimento) => {
    setForm({
      nome: inv.nome, ticker: inv.ticker || "", tipo: inv.tipo, classe: inv.classe, instituicao: inv.instituicao,
      valor_atual: Number(inv.valor_atual), total_aportado: Number(inv.total_aportado),
      quantidade: Number(inv.quantidade), preco_medio: Number(inv.preco_medio),
      indexador: inv.indexador || "none", taxa_contratada: Number(inv.taxa_contratada),
      categoria_titulo: inv.categoria_titulo || "",
      vencimento_data: inv.vencimento_data || "", liquidez: inv.liquidez || "D+0",
      perfil_risco: inv.perfil_risco || "Conservador",
      is_reserva_emergencia: inv.is_reserva_emergencia || false,
      recebe_proventos: inv.recebe_proventos || false,
      frequencia_proventos: inv.frequencia_proventos || "sem_proventos",
      meses_proventos: inv.meses_proventos || "",
      data_compra: (inv as any).data_compra || "",
    });
    setEditingId(inv.id); setOpen(true);
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    const { error } = await supabase.from("investimentos_financeiros").delete().eq("id", id);
    if (error) {
      logError("handleDelete:", error);
      toast({ title: "Não foi possível excluir o investimento", description: "Tente novamente.", variant: "destructive" });
      return;
    }
    fetchAll();
  }, [fetchAll, toast]);

  const handleDialogClose = useCallback((v: boolean) => {
    if (!v) { setEditingId(null); setForm(emptyForm); }
    setOpen(v);
  }, []);

  const totalAtual = useMemo(
    () => investimentos.reduce((s, i) => s + Number(i.valor_atual || 0), 0),
    [investimentos]
  );
  const totalAportado = useMemo(
    () => investimentos.reduce((s, i) => s + Number(i.total_aportado || 0), 0),
    [investimentos]
  );

  const value = useMemo<InvestimentosContextValue>(() => ({
    user,
    isAdmin,
    fmt,
    pct,
    loading,
    investimentos,
    proventos,
    indicadores,
    snapshots,
    aportes,
    transactions,
    quotes,
    quotesLoading,
    mediaDespesas,
    fiiReports,
    macroData,
    macroLoading,
    dividendForecast,
    dividendHistChart,
    nextExDates,
    expenseLinks,
    periodo,
    setPeriodo,
    dividendPreview,
    setDividendPreview,
    dividendPreviewOpen,
    setDividendPreviewOpen,
    confirmingDividends,
    loadingDividends,
    selectedProventoMes,
    setSelectedProventoMes,
    divRefreshRemaining,
    open,
    setOpen,
    editingId,
    setEditingId,
    form,
    setForm,
    isRendaVariavel,
    isRendaFixa,
    handleEdit,
    handleDelete,
    handleSave,
    handleDialogClose,
    totalAtual,
    totalAportado,
    fetchAll,
    fetchQuotes,
    fetchDividendsFromBrapi,
    confirmDividendImport,
    fetchFiiReports,
    fetchMacroData,
  }), [
    user, isAdmin, fmt, pct, loading, investimentos, proventos, indicadores, snapshots, aportes,
    transactions, quotes, quotesLoading, mediaDespesas, fiiReports, macroData, macroLoading,
    dividendForecast, dividendHistChart, nextExDates, expenseLinks, periodo, setPeriodo,
    dividendPreview, setDividendPreview, dividendPreviewOpen, setDividendPreviewOpen,
    confirmingDividends, loadingDividends, selectedProventoMes, setSelectedProventoMes,
    divRefreshRemaining, open, setOpen, editingId, setEditingId, form, setForm,
    isRendaVariavel, isRendaFixa, handleEdit, handleDelete, handleSave, handleDialogClose,
    totalAtual, totalAportado, fetchAll, fetchQuotes, fetchDividendsFromBrapi,
    confirmDividendImport, fetchFiiReports, fetchMacroData,
  ]);

  return (
    <InvestimentosContext.Provider value={value}>
      {children}
    </InvestimentosContext.Provider>
  );
}
