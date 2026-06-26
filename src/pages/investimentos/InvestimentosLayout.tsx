import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, CalendarClock, FileDown, RefreshCw, Calculator, ChevronRight } from "lucide-react";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { inferFromName } from "@/lib/investimento-inference";
import AdvisoryInviteCard from "@/components/investimentos/AdvisoryInviteCard";
import { useInvestimentos } from "@/contexts/InvestimentosContext";
import RecalcAcrualDialog from "@/components/investimentos/RecalcAcrualDialog";
import {
  TIPOS, CLASSES, INSTITUICOES, INDEXADORES, CATEGORIAS_TITULO, RISCOS,
  FREQ_PROVENTOS, PERIOD_OPTIONS, PDF_TAB_OPTIONS,
  TAB_TO_PATH, PATH_TO_TAB,
} from "@/lib/investimentos/constants";

export default function InvestimentosLayout() {
  const ctx = useInvestimentos();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Primeiro nome do usuário (pro nome do arquivo PDF)
  const [userNamePdf, setUserNamePdf] = useState("");
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, nome_pessoa1").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        const n = (((data as any)?.full_name || (data as any)?.nome_pessoa1 || "") as string).trim();
        if (n) setUserNamePdf(n.split(/\s+/)[0]);
      });
  }, [user]);

  // Affordance de rolagem horizontal das abas (degradê + chevron à direita)
  const tabsListRef = useRef<HTMLDivElement>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const updateTabsScroll = useCallback(() => {
    const el = tabsListRef.current;
    if (!el) return;
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);
  useEffect(() => {
    updateTabsScroll();
    const el = tabsListRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateTabsScroll, { passive: true });
    window.addEventListener("resize", updateTabsScroll);
    return () => {
      el.removeEventListener("scroll", updateTabsScroll);
      window.removeEventListener("resize", updateTabsScroll);
    };
  }, [updateTabsScroll]);
  const pathSegment = location.pathname.split("/").filter(Boolean).pop() || "";
  const activeMainTab = PATH_TO_TAB[pathSegment] || "visao-geral";
  const setActiveMainTab = (newTab: string) => {
    const path = TAB_TO_PATH[newTab] || "visao-geral";
    navigate(`/dashboard/investimentos/${path}`);
  };

  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfSelectedTabs, setPdfSelectedTabs] = useState<string[]>([
    "visao-geral", "renda-variavel", "resultado-ir", "proventos",
  ]);
  const [exporting, setExporting] = useState(false);

  const {
    fmt, loading, periodo, setPeriodo,
    open, editingId, form, setForm, isRendaVariavel, isRendaFixa,
    handleSave, handleDialogClose,
    quotes, quotesLoading,
    loadingDividends, divRefreshRemaining, fetchDividendsFromBrapi,
    dividendPreview, dividendPreviewOpen, setDividendPreviewOpen,
    confirmingDividends, confirmDividendImport,
    totalAtual, macroData,
  } = ctx;

  const [recalcOpen, setRecalcOpen] = useState(false);

  const handleExportPDF = async () => {
    setPdfModalOpen(false);
    setExporting(true);
    try {
      // html2canvas é pesado: carrega sob demanda só ao exportar (mesmo padrão de useReportPersistence).
      const { default: html2canvas } = await import("html2canvas");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const contentW = pageW - margin * 2;
      const now = new Date();
      const periodoLabel = PERIOD_OPTIONS.find(p => p.value === periodo)?.label || periodo;

      // Capa do relatório de investimentos (página 1)
      try {
        const coverImg = new Image();
        coverImg.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          coverImg.onload = () => resolve();
          coverImg.onerror = () => reject();
          coverImg.src = "/images/capa-investimentos.jpg";
        });
        const imgRatio = coverImg.naturalWidth / coverImg.naturalHeight;
        const pageRatio = pageW / pageH;
        let dW = pageW, dH = pageH, dX = 0, dY = 0;
        if (imgRatio > pageRatio) { dH = pageW / imgRatio; dY = (pageH - dH) / 2; }
        else { dW = pageH * imgRatio; dX = (pageW - dW) / 2; }
        pdf.addImage(coverImg, "JPEG", dX, dY, dW, dH);
        pdf.addPage();
      } catch {
        // sem capa: segue direto pro conteúdo
      }

      pdf.setFontSize(16); pdf.setFont("helvetica", "bold");
      pdf.text("PeJota", margin, 18);
      pdf.setFontSize(10); pdf.setFont("helvetica", "normal");
      pdf.text(`Relatório de Investimentos — ${periodoLabel}`, margin, 25);
      pdf.text(`Gerado em: ${now.toLocaleString("pt-BR")}`, margin, 31);
      pdf.line(margin, 34, pageW - margin, 34);

      let firstPage = true;

      for (const tabValue of pdfSelectedTabs) {
        setActiveMainTab(tabValue);
        await new Promise(r => setTimeout(r, 600));

        const el = document.getElementById("investimentos-content");
        if (!el) continue;

        let currentY: number;
        if (!firstPage) {
          pdf.addPage();
          const label = PDF_TAB_OPTIONS.find(t => t.value === tabValue)?.label || tabValue;
          pdf.setFontSize(12); pdf.setFont("helvetica", "bold");
          pdf.text(label, margin, 14);
          pdf.line(margin, 17, pageW - margin, 17);
          currentY = 22;
        } else {
          currentY = 38;
        }

        // Pagina card a card (descendo em wrappers altos) pra não cortar bloco no meio.
        const pageBottom = pageH - margin;
        const usableH = pageBottom - margin;
        const NO_SPLIT = /^(TABLE|THEAD|TBODY|TR|TD|TH|SVG|CANVAS|IMG)$/;
        const buildBlocks = (parent: HTMLElement, depth: number): HTMLElement[] => {
          const out: HTMLElement[] = [];
          for (const child of Array.from(parent.children) as HTMLElement[]) {
            if (child.offsetHeight === 0) continue;
            const childMm = (child.offsetHeight * contentW) / (child.offsetWidth || 1);
            if (depth < 5 && childMm > usableH - 6 && child.children.length >= 1 && !NO_SPLIT.test(child.tagName)) {
              const sub = buildBlocks(child, depth + 1);
              if (sub.length > 1 || (sub.length === 1 && sub[0] !== child)) { out.push(...sub); continue; }
            }
            out.push(child);
          }
          return out;
        };
        const built = buildBlocks(el, 0);
        const renderList = built.length ? built : [el];

        let isFirstBlockOfTab = true;
        for (const block of renderList) {
          const canvas = await html2canvas(block, { scale: 1.5, useCORS: true, backgroundColor: "#ffffff" });
          const imgH = (canvas.height * contentW) / canvas.width;

          // Quebra só se não couber E não for o 1º bloco da aba (evita cabeçalho órfão).
          if (imgH > (pageBottom - currentY) && !isFirstBlockOfTab) {
            pdf.addPage();
            currentY = margin;
          }

          const availNow = pageBottom - currentY;
          if (imgH <= availNow) {
            pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, currentY, contentW, imgH);
            currentY += imgH + 3;
          } else {
            // Bloco maior que o espaço: fatia (1ª fatia no espaço atual, resto em páginas novas).
            const pxPerMm = canvas.width / contentW;
            let srcY = 0;
            let firstSlice = true;
            while (srcY < canvas.height) {
              if (!firstSlice) { pdf.addPage(); currentY = margin; }
              const sliceMm = pageBottom - currentY;
              const slicePx = Math.min(Math.floor(sliceMm * pxPerMm), canvas.height - srcY);
              const sc = document.createElement("canvas");
              sc.width = canvas.width; sc.height = slicePx;
              const cctx = sc.getContext("2d")!;
              cctx.fillStyle = "#ffffff"; cctx.fillRect(0, 0, sc.width, sc.height);
              cctx.drawImage(canvas, 0, srcY, canvas.width, slicePx, 0, 0, canvas.width, slicePx);
              pdf.addImage(sc.toDataURL("image/png"), "PNG", margin, currentY, contentW, slicePx / pxPerMm);
              currentY += slicePx / pxPerMm + 2;
              srcY += slicePx;
              firstSlice = false;
            }
          }
          isFirstBlockOfTab = false;
        }

        firstPage = false;
      }

      const _dd = String(now.getDate()).padStart(2, "0");
      const _mm = String(now.getMonth() + 1).padStart(2, "0");
      const _fileName = ["Relatório de Investimentos", userNamePdf, `${_dd}-${_mm}`].filter(Boolean).join(" - ");
      pdf.save(`${_fileName}.pdf`);
      setActiveMainTab("visao-geral");
    } catch (e) {
      console.error("PDF export error:", e);
    }
    setExporting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Investimentos</h1>
          <p className="text-muted-foreground text-sm mt-1">Carteira de ativos financeiros — base do Planejamento 360.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-auto shrink-0 whitespace-nowrap rounded-xl gap-1.5">
              <CalendarClock className="h-3.5 w-3.5 flex-shrink-0" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 ml-auto sm:ml-0">
            <button
              onClick={async () => {
                if (divRefreshRemaining === 0) {
                  toast({ title: "Limite de 2 atualizações/dia via BRAPI atingido.", variant: "destructive" });
                  return;
                }
                await fetchDividendsFromBrapi();
              }}
              disabled={loadingDividends || divRefreshRemaining === 0}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card text-xs font-medium whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted transition-colors"
              title={divRefreshRemaining === 0 ? "Limite de 2 atualizações/dia atingido" : `Buscar cotações e dividendos via BRAPI (${divRefreshRemaining} restante${divRefreshRemaining !== 1 ? "s" : ""} hoje)`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingDividends || quotesLoading ? "animate-spin" : ""}`} />
              {loadingDividends ? (
                "Buscando..."
              ) : (
                <>
                  <span className="hidden sm:inline">Atualizar carteira</span>
                  <span className="sm:hidden">Atualizar</span>
                </>
              )}
            </button>
            <Button variant="outline" className="rounded-xl gap-2 whitespace-nowrap" onClick={() => setPdfModalOpen(true)} disabled={exporting}>
              <FileDown className="h-4 w-4" />
              {exporting ? (
                "Exportando..."
              ) : (
                <>
                  <span className="hidden sm:inline">Baixar PDF</span>
                  <span className="sm:hidden">PDF</span>
                </>
              )}
            </Button>
          </div>
          <Dialog open={open} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button className="rounded-xl gap-2 w-full sm:w-auto"><Plus className="h-4 w-4" /> Novo Investimento</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
              <DialogHeader>
                <DialogTitle className="font-heading">{editingId ? "Editar Investimento" : "Adicionar Investimento"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3">
                <div>
                  <Label>Tipo de ativo</Label>
                  <Select value={form.tipo} onValueChange={v => {
                    const variaveis = ["Ação", "FII", "ETF", "Cripto", "Exterior", "BDR"];
                    const isVar = variaveis.includes(v);
                    setForm({
                      ...form,
                      tipo: v,
                      classe: v === "Exterior" ? "Internacional" : v === "Cripto" ? "Alternativo" : isVar ? "Variável" : "Renda Fixa",
                      perfil_risco: isVar ? "Arrojado" : "Conservador",
                      indexador: isVar ? "" : form.indexador,
                      taxa_contratada: isVar ? 0 : form.taxa_contratada,
                      vencimento_data: isVar ? "" : form.vencimento_data,
                    });
                  }}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                {isRendaVariavel && (
                  <div>
                    <Label>Ticker <span className="text-destructive">*</span></Label>
                    <Input
                      value={(form as any).ticker || ""}
                      onChange={e => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                      placeholder={form.tipo === "Cripto" ? "Ex: BTC, ETH, SOL" : form.tipo === "Exterior" ? "Ex: IVVB11, VOO, AAPL" : "Ex: PETR4, MXRF11, BOVA11"}
                      className="rounded-xl font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Código do ativo. Usado para atualizar cotação automaticamente.</p>
                  </div>
                )}

                {form.tipo === "Cripto" && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground font-medium">Criptomoedas comuns:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {["BTC", "ETH", "SOL", "ADA", "XRP", "DOT", "MATIC", "AVAX", "LINK", "UNI", "BNB", "DOGE"].map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setForm({ ...form, ticker: c })}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border transition-colors ${
                            (form as any).ticker === c
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border/60 hover:bg-muted text-muted-foreground"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Use apenas o símbolo da moeda: <span className="font-mono font-medium">BTC</span>, <span className="font-mono font-medium">ETH</span>, <span className="font-mono font-medium">SOL</span>. Não use pares como BTC/BRL ou BTC-USD — o sistema detecta automaticamente que é criptomoeda pelo tipo selecionado.
                    </p>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Label>{isRendaVariavel ? "Nome (opcional)" : "Nome"}</Label>
                    {isRendaFixa && form.nome && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!form.nome) return;
                          const inf = inferFromName(form.nome);
                          setForm(f => ({
                            ...f,
                            categoria_titulo: f.categoria_titulo || inf.categoria_titulo || "",
                            indexador: f.indexador || inf.indexador || "",
                            taxa_contratada: f.taxa_contratada || inf.taxa_contratada || 0,
                          }));
                          toast({ title: "Inferência aplicada", description: "Campos vazios foram preenchidos com base no nome." });
                        }}
                        className="text-[10px] px-2 py-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition whitespace-nowrap"
                        title="Tentar preencher automaticamente categoria, indexador e taxa a partir do nome"
                      >
                        🪄 Auto-classificar
                      </button>
                    )}
                  </div>
                  <Input
                    value={form.nome}
                    onChange={e => setForm({ ...form, nome: e.target.value })}
                    placeholder={isRendaVariavel ? "Ex: Petróleo Brasileiro (preenchido auto)" : "Ex: Tesouro IPCA+ 2029"}
                    className="rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Classe</Label>
                    <Select value={form.classe} onValueChange={v => setForm({ ...form, classe: v })}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Corretora</Label>
                    <Select value={form.instituicao} onValueChange={v => setForm({ ...form, instituicao: v })}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>{INSTITUICOES.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>

                {isRendaFixa && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Valor Atual (R$)</Label>
                      <Input type="number" min={0} value={form.valor_atual || ""} onChange={e => setForm({ ...form, valor_atual: Math.max(0, +e.target.value) })} className="rounded-xl" />
                    </div>
                    <div>
                      <Label>Total Aportado (R$)</Label>
                      <Input type="number" min={0} value={form.total_aportado || ""} onChange={e => setForm({ ...form, total_aportado: Math.max(0, +e.target.value) })} className="rounded-xl" />
                    </div>
                  </div>
                )}

                {isRendaVariavel && form.quantidade > 0 && form.preco_medio > 0 && (
                  <div className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Posição calculada</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] text-muted-foreground">Total aportado</p>
                        <p className="text-sm font-heading font-bold">
                          R$ {(form.quantidade * form.preco_medio).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{form.quantidade} × R$ {Number(form.preco_medio).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Valor atual</p>
                        {(() => {
                          const ticker = (form as any).ticker?.toUpperCase();
                          const q = ticker ? quotes[ticker] : null;
                          if (q?.preco_atual) {
                            const valorAtual = form.quantidade * q.preco_atual;
                            const lucro = valorAtual - (form.quantidade * form.preco_medio);
                            const lucroP = lucro / (form.quantidade * form.preco_medio) * 100;
                            return (
                              <div>
                                <p className="text-sm font-heading font-bold">
                                  R$ {valorAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                                </p>
                                <p className={`text-[10px] font-medium ${lucro >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                                  {lucro >= 0 ? "+" : ""}{lucroP.toFixed(2)}% · cotação BRAPI
                                </p>
                              </div>
                            );
                          }
                          return <p className="text-xs text-muted-foreground">Puxado via cotação após salvar</p>;
                        })()}
                      </div>
                    </div>
                  </div>
                )}

                {isRendaVariavel && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Quantidade</Label>
                      <Input type="number" min={0} value={form.quantidade || ""} onChange={e => setForm({ ...form, quantidade: Math.max(0, +e.target.value) })} className="rounded-xl" />
                    </div>
                    <div>
                      <Label>Preço Médio (R$)</Label>
                      <Input type="number" min={0} step="0.01" value={form.preco_medio || ""} onChange={e => setForm({ ...form, preco_medio: Math.max(0, +e.target.value) })} className="rounded-xl" />
                      {form.quantidade > 0 && form.preco_medio > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Total: R$ {(form.quantidade * form.preco_medio).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {["FII", "Ação", "ETF", "Exterior", "Renda Fixa"].includes(form.tipo) && (
                  <div>
                    <Label className="text-xs">Data de compra (opcional)</Label>
                    <Input
                      type="date"
                      value={(form as any).data_compra || ""}
                      onChange={e => setForm({ ...form, data_compra: e.target.value })}
                      className="rounded-xl"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                      {form.tipo === "Renda Fixa"
                        ? "Necessária para calcular acrual de juros via SELIC/IPCA. Sem ela, o botão Recalcular não funciona."
                        : "Se informada, o sistema filtra dividendos BRAPI a partir desta data, evitando histórico anterior à sua compra. Opcional — sem data, busca últimos 24 meses."}
                    </p>
                  </div>
                )}

                {isRendaFixa && (
                  <div>
                    <Label>Categoria do título</Label>
                    <Select
                      value={form.categoria_titulo || "none"}
                      onValueChange={v => setForm({ ...form, categoria_titulo: v === "none" ? "" : v })}
                    >
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Não classificado</SelectItem>
                        {CATEGORIAS_TITULO.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Bancário (CDB/LCI/LCA), Crédito Privado (CRA/CRI/Debênture), Tesouro Direto (NTN/LFT/LTN)...
                    </p>
                  </div>
                )}

                {isRendaFixa && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Indexador</Label>
                      <Select value={form.indexador || "none"} onValueChange={v => setForm({ ...form, indexador: v === "none" ? "" : v })}>
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Nenhum</SelectItem>
                          {INDEXADORES.filter(Boolean).map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Taxa (%)</Label>
                      <Input type="number" min={0} step="0.01" value={form.taxa_contratada || ""} onChange={e => setForm({ ...form, taxa_contratada: Math.max(0, +e.target.value) })} className="rounded-xl" />
                    </div>
                  </div>
                )}

                {isRendaFixa && editingId && (
                  <button
                    type="button"
                    onClick={() => setRecalcOpen(true)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition w-full flex items-center justify-center gap-1.5"
                    title="Estima o valor inicial de aplicação usando o histórico SELIC/IPCA e a taxa contratada"
                  >
                    <Calculator className="h-3.5 w-3.5" />
                    Recalcular Total Aportado via acrual de juros
                  </button>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {isRendaFixa && (
                    <div>
                      <Label>Vencimento</Label>
                      <Input type="date" value={form.vencimento_data} onChange={e => setForm({ ...form, vencimento_data: e.target.value })} className="rounded-xl" />
                    </div>
                  )}
                  <div className={isRendaFixa ? "" : "col-span-2"}>
                    <Label>Liquidez</Label>
                    <Select value={form.liquidez || "D+2"} onValueChange={v => setForm({ ...form, liquidez: v })}>
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {isRendaVariavel ? (
                          <>
                            <SelectItem value="D+0">D+0 — Mesmo dia</SelectItem>
                            <SelectItem value="D+1">D+1 — 1 dia útil</SelectItem>
                            <SelectItem value="D+2">D+2 — 2 dias úteis (padrão B3)</SelectItem>
                            <SelectItem value="D+3">D+3 — 3 dias úteis</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="D+0">D+0 — Imediato</SelectItem>
                            <SelectItem value="D+1">D+1 — 1 dia útil</SelectItem>
                            <SelectItem value="D+2">D+2 — 2 dias úteis</SelectItem>
                            <SelectItem value="D+30">D+30</SelectItem>
                            <SelectItem value="No vencimento">No vencimento</SelectItem>
                            <SelectItem value="Bloqueado">Bloqueado</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Perfil de Risco</Label>
                  <Select value={form.perfil_risco} onValueChange={v => setForm({ ...form, perfil_risco: v })}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{RISCOS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-3 py-1">
                  <Switch checked={form.is_reserva_emergencia} onCheckedChange={v => setForm({ ...form, is_reserva_emergencia: v })} />
                  <Label className="text-sm cursor-pointer">Este ativo faz parte da minha reserva de emergência</Label>
                </div>

                {["FII", "Ação"].includes(form.tipo) && (
                  <div className="space-y-2 p-3 rounded-xl bg-muted/20 border border-border/40">
                    <div className="flex items-center gap-3">
                      <Switch checked={form.recebe_proventos} onCheckedChange={v => setForm({ ...form, recebe_proventos: v })} />
                      <Label className="text-sm cursor-pointer">Recebe proventos (dividendos / rendimentos)</Label>
                    </div>
                    {form.recebe_proventos && (
                      <div className="grid grid-cols-2 gap-3 mt-2">
                        <div>
                          <Label className="text-xs">Frequência</Label>
                          <Select value={form.frequencia_proventos} onValueChange={v => setForm({ ...form, frequencia_proventos: v })}>
                            <SelectTrigger className="rounded-xl h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{FREQ_PROVENTOS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs">Meses (ex: 3,6,9,12)</Label>
                          <Input value={form.meses_proventos} onChange={e => setForm({ ...form, meses_proventos: e.target.value })} placeholder="Opcional" className="rounded-xl h-8 text-xs" />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Button onClick={handleSave} className="rounded-xl w-full">
                  {editingId ? "Salvar Alterações" : "Adicionar Investimento"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
        <div className="relative">
          <TabsList ref={tabsListRef} className="w-full justify-start h-10 mb-2 overflow-x-auto">
            <TabsTrigger value="visao-geral" className="text-xs">Visão Geral</TabsTrigger>
            <TabsTrigger value="renda-variavel" className="text-xs">Renda Variável</TabsTrigger>
            <TabsTrigger value="historico" className="text-xs">Histórico</TabsTrigger>
            <TabsTrigger value="resultado-ir" className="text-xs">Resultado & IR</TabsTrigger>
            <TabsTrigger value="proventos" className="text-xs">Proventos</TabsTrigger>
            <TabsTrigger value="stock-guide" className="text-xs">Stock Guide</TabsTrigger>
            <TabsTrigger value="rebalanceamento" className="text-xs">Rebalanceamento</TabsTrigger>
            <TabsTrigger value="importacao-b3" className="text-xs">Importação</TabsTrigger>
          </TabsList>
          {canScrollRight && (
            <div className="pointer-events-none absolute inset-y-0 right-0 w-8 mb-2 flex items-center justify-end bg-gradient-to-l from-background to-transparent">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
        </div>
      </Tabs>

      <div id="investimentos-content" className="space-y-6">
        <Outlet />
        <AdvisoryInviteCard totalPatrimonio={totalAtual} />
      </div>

      <Dialog open={pdfModalOpen} onOpenChange={setPdfModalOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Exportar PDF</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Selecione as seções que deseja incluir no relatório:</p>
            {[
              { value: "visao-geral", label: "Visão Geral" },
              { value: "renda-variavel", label: "Renda Variável" },
              { value: "historico", label: "Histórico" },
              { value: "resultado-ir", label: "Resultado & IR" },
              { value: "proventos", label: "Proventos" },
            ].map(tab => (
              <div key={tab.value} className="flex items-center gap-3 p-3 rounded-xl border border-border/40 hover:bg-muted/20 cursor-pointer"
                onClick={() => setPdfSelectedTabs(prev =>
                  prev.includes(tab.value) ? prev.filter(t => t !== tab.value) : [...prev, tab.value]
                )}
              >
                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  pdfSelectedTabs.includes(tab.value) ? "bg-primary border-primary" : "border-muted-foreground"
                }`}>
                  {pdfSelectedTabs.includes(tab.value) && (
                    <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-sm">{tab.label}</span>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setPdfModalOpen(false)}>Cancelar</Button>
              <Button
                className="flex-1 rounded-xl gap-2"
                disabled={pdfSelectedTabs.length === 0}
                onClick={handleExportPDF}
              >
                <FileDown className="h-4 w-4" />
                Exportar {pdfSelectedTabs.length > 0 ? `(${pdfSelectedTabs.length})` : ""}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dividendPreviewOpen} onOpenChange={setDividendPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">Dividendos encontrados via BRAPI</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {dividendPreview.length} evento(s) nos últimos 12 meses. Revise e confirme para salvar em Proventos.
            </p>

            {dividendPreview.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Mês Ref.</TableHead>
                      <TableHead>R$/cota</TableHead>
                      <TableHead>Qtd</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Data EX</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dividendPreview.map((div, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs font-mono font-bold">{div.ticker}</TableCell>
                        <TableCell className="text-xs">{div.label}</TableCell>
                        <TableCell className="text-xs">{div.mes_referencia}</TableCell>
                        <TableCell className="text-xs">R$ {Number(div.rate).toFixed(4)}</TableCell>
                        <TableCell className="text-xs">{div.quantidade}</TableCell>
                        <TableCell className="text-xs font-semibold text-emerald-600">{fmt(div.valor_total)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {div.ex_date ? new Date(div.ex_date).toLocaleDateString("pt-BR") : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum dividendo encontrado nos últimos 12 meses para os ativos cadastrados.</p>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setDividendPreviewOpen(false)}>Cancelar</Button>
              <Button
                className="flex-1 rounded-xl"
                disabled={dividendPreview.length === 0 || confirmingDividends}
                onClick={confirmDividendImport}
              >
                {confirmingDividends ? "Salvando..." : `Confirmar e Salvar (${dividendPreview.length})`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <RecalcAcrualDialog
        open={recalcOpen}
        onOpenChange={setRecalcOpen}
        initialDataCompra={(form as any).data_compra || ""}
        valorAtual={form.valor_atual || 0}
        initialIndexador={form.indexador || ""}
        initialTaxa={form.taxa_contratada || 0}
        macroData={macroData}
        onConfirm={({ totalAportado, indexador, taxa, dataCompra }) => {
          setForm({
            ...form,
            total_aportado: totalAportado,
            indexador,
            taxa_contratada: taxa,
            data_compra: dataCompra,
          } as any);
          toast({
            title: "Valor recalculado",
            description: "Indexador, taxa e data de compra atualizados no formulário. Clique em Salvar Alterações.",
          });
        }}
      />
    </div>
  );
}
