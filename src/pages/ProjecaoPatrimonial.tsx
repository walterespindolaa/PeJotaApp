import { useState, useMemo, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Map, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  runLifeProjection,
  EVENT_TEMPLATES,
  type LifeEvent,
  type ProjectionInputs,
} from "@/lib/financial_engine/life_projection";

import ProjecaoKPIs from "@/components/projecao/ProjecaoKPIs";
import ProjecaoVariaveis from "@/components/projecao/ProjecaoVariaveis";
import ProjecaoChart from "@/components/projecao/ProjecaoChart";
import ProjecaoEventEditor from "@/components/projecao/ProjecaoEventEditor";
import ObjetivosIntegration from "@/components/projecao/ObjetivosIntegration";
import ProjecaoInsights from "@/components/projecao/ProjecaoInsights";
import ProjecaoExplainerCards from "@/components/projecao/ProjecaoExplainerCards";
import AIReportDisclaimer from "@/components/legal/AIReportDisclaimer";

const fmtFull = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

export default function ProjecaoPatrimonial() {
  const { user } = useAuth();

  const [idadeAtual, setIdadeAtual] = useState(30);
  const [idadeAposentadoria, setIdadeAposentadoria] = useState(60);
  const [expectativaVida, setExpectativaVida] = useState(90);
  const [patrimonioInicial, setPatrimonioInicial] = useState(100000);
  const [rendaMensal, setRendaMensal] = useState(10000);
  const [poupancaMensal, setPoupancaMensal] = useState(2000);
  // Track whether user manually set poupança (breaks auto-sync with renda)
  const [poupancaManual, setPoupancaManual] = useState(false);
  const [taxaPoupanca, setTaxaPoupanca] = useState(0.2); // ratio poupança/renda
  const [taxaRetorno, setTaxaRetorno] = useState(10);
  const [inflacao, setInflacao] = useState(5);
  const [events, setEvents] = useState<LifeEvent[]>([]);

  const [addEventOpen, setAddEventOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<LifeEvent | null>(null);
  const [enabledObjetivos, setEnabledObjetivos] = useState<Set<string>>(new Set());
  // When renda changes, auto-adjust poupança proportionally (unless manually set)
  const handleRendaChange = useCallback((novaRenda: number) => {
    setRendaMensal(novaRenda);
    if (!poupancaManual && novaRenda > 0) {
      setPoupancaMensal(Math.round(novaRenda * taxaPoupanca));
    }
  }, [poupancaManual, taxaPoupanca]);

  // When poupança is changed directly, mark as manual and update ratio
  const handlePoupancaChange = useCallback((novaPoupanca: number) => {
    setPoupancaManual(true);
    setPoupancaMensal(novaPoupanca);
    if (rendaMensal > 0) {
      setTaxaPoupanca(novaPoupanca / rendaMensal);
    }
  }, [rendaMensal]);


  useEffect(() => {
    if (!user) return;
    (async () => {
      const [aposRes, invRes] = await Promise.all([
        supabase.from("aposentadoria").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("investimentos_financeiros").select("valor_atual,valor").eq("user_id", user.id),
      ]);
      if (aposRes.data) {
        const a = aposRes.data;
        if (a.idade_atual) setIdadeAtual(a.idade_atual);
        if (a.idade_aposentadoria) setIdadeAposentadoria(a.idade_aposentadoria);
        if (a.expectativa_vida) setExpectativaVida(a.expectativa_vida);
        if (a.poupanca_mensal) {
          const p = Number(a.poupanca_mensal);
          setPoupancaMensal(p);
          // Initialize ratio from loaded data (renda defaults to 10000 if not loaded elsewhere)
          if (rendaMensal > 0) setTaxaPoupanca(p / rendaMensal);
        }
        if (a.taxa_nominal) setTaxaRetorno(Number(a.taxa_nominal) * 100);
        if (a.inflacao) setInflacao(Number(a.inflacao) * 100);
      }
      if (invRes.data) {
        const total = invRes.data.reduce((s: number, i: any) => s + Number(i.valor_atual || i.valor || 0), 0);
        if (total > 0) setPatrimonioInicial(total);
      }
    })();
  }, [user]);

  // Auto-sync aposentadoria event
  useEffect(() => {
    const anoAtual = new Date().getFullYear();
    const anoAposent = anoAtual + (idadeAposentadoria - idadeAtual);
    setEvents(prev => {
      const has = prev.some(e => e.type === "aposentadoria");
      if (has) return prev.map(e => e.type === "aposentadoria" ? { ...e, year: anoAposent } : e);
      return [...prev, { id: generateId(), name: "Aposentadoria", emoji: "🏖️", year: anoAposent, impactValue: 0, type: "aposentadoria" }];
    });
  }, [idadeAtual, idadeAposentadoria]);

  const inputs: ProjectionInputs = useMemo(() => ({
    patrimonioInicial, rendaMensal, poupancaMensal,
    taxaRetornoAnual: taxaRetorno / 100,
    inflacaoAnual: inflacao / 100,
    idadeAtual, idadeAposentadoria, expectativaVida, events,
  }), [patrimonioInicial, rendaMensal, poupancaMensal, taxaRetorno, inflacao, idadeAtual, idadeAposentadoria, expectativaVida, events]);

  const result = useMemo(() => runLifeProjection(inputs), [inputs]);

  const addEvent = useCallback((template: typeof EVENT_TEMPLATES[number]) => {
    const newEvent: LifeEvent = { ...template, id: generateId(), year: new Date().getFullYear() + 3 };
    setEditingEvent(newEvent);
    setAddEventOpen(false);
  }, []);

  const saveEvent = useCallback((ev: LifeEvent) => {
    setEvents(prev => {
      const idx = prev.findIndex(e => e.id === ev.id);
      if (idx >= 0) return prev.map((e, i) => i === idx ? ev : e);
      return [...prev, ev];
    });
    setEditingEvent(null);
  }, []);

  const removeEvent = useCallback((id: string) => {
    setEvents(prev => prev.filter(e => e.id !== id));
    if (id.startsWith("obj-")) {
      const objId = id.replace("obj-", "");
      setEnabledObjetivos(prev => { const n = new Set(prev); n.delete(objId); return n; });
    }
  }, []);

  const handleObjetivoToggle = useCallback((objId: string, enabled: boolean, lifeEvent: LifeEvent) => {
    if (enabled) {
      setEnabledObjetivos(prev => new Set(prev).add(objId));
      setEvents(prev => [...prev.filter(e => e.id !== lifeEvent.id), lifeEvent]);
    } else {
      setEnabledObjetivos(prev => { const n = new Set(prev); n.delete(objId); return n; });
      setEvents(prev => prev.filter(e => e.id !== lifeEvent.id));
    }
  }, []);

  const anoAtual = new Date().getFullYear();
  const anoFinal = anoAtual + (expectativaVida - idadeAtual);

  return (
    <div className="space-y-6">
      <AIReportDisclaimer />
      {/* Premium Header */}
      <div className="animate-fade-in">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-primary/20 flex items-center justify-center">
            <Map className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-bold flex items-center gap-2">
              Mapa do Futuro
              <Sparkles className="h-4 w-4 text-amber-500" />
            </h1>
            <p className="text-xs text-muted-foreground/70 font-medium">Vista da Montanha</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
          Visualize como seu patrimônio pode evoluir ao longo da vida e entenda como decisões, metas e eventos impactam sua trajetória financeira. Simule cenários, ajuste variáveis e veja em tempo real como seu futuro pode mudar.
        </p>
      </div>

      {/* KPIs */}
      <ProjecaoKPIs patrimonioInicial={patrimonioInicial} result={result} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 lg:items-stretch">
        {/* Variables Panel + Objectives */}
        <div className="lg:col-span-1 space-y-4">
          <ProjecaoVariaveis
            idadeAtual={idadeAtual} setIdadeAtual={setIdadeAtual}
            idadeAposentadoria={idadeAposentadoria} setIdadeAposentadoria={setIdadeAposentadoria}
            patrimonioInicial={patrimonioInicial} setPatrimonioInicial={setPatrimonioInicial}
            rendaMensal={rendaMensal} setRendaMensal={handleRendaChange}
            poupancaMensal={poupancaMensal} setPoupancaMensal={handlePoupancaChange}
            taxaRetorno={taxaRetorno} setTaxaRetorno={setTaxaRetorno}
            inflacao={inflacao} setInflacao={setInflacao}
          />

          <ObjetivosIntegration
            enabledIds={enabledObjetivos}
            onToggle={handleObjetivoToggle}
          />
        </div>

        {/* Chart */}
        <div className="lg:col-span-3 space-y-4">
          <ProjecaoChart
            chartData={result.series}
            events={events}
            onAddEvent={() => setAddEventOpen(true)}
            onEditEvent={setEditingEvent}
          />
        </div>
      </div>

      {/* Explainer Cards */}
      <ProjecaoExplainerCards />

      <ProjecaoInsights
        result={result}
        idadeAtual={idadeAtual}
        idadeAposentadoria={idadeAposentadoria}
        poupancaMensal={poupancaMensal}
        rendaMensal={rendaMensal}
        patrimonioInicial={patrimonioInicial}
      />

      {/* Add Event Dialog */}
      <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Adicionar Evento</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-4">
            {EVENT_TEMPLATES.map((t, i) => (
              <button
                key={i}
                onClick={() => addEvent(t)}
                className="flex items-center gap-2.5 p-3 rounded-xl border border-border/50 hover:bg-muted/50 hover:border-primary/30 transition-all text-left group"
              >
                <span className="text-xl group-hover:scale-110 transition-transform">{t.emoji}</span>
                <div>
                  <div className="text-sm font-medium">{t.name}</div>
                  {t.impactValue > 0 && (
                    <div className="text-[10px] text-muted-foreground">{fmtFull(t.impactValue)}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog */}
      {editingEvent && (
        <ProjecaoEventEditor
          event={editingEvent}
          minYear={anoAtual}
          maxYear={anoFinal}
          onSave={saveEvent}
          onRemove={removeEvent}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  );
}
