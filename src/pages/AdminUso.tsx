import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Gauge, Users, Building2, Receipt, FileText, Cpu, ExternalLink, DollarSign } from "lucide-react";

interface Overview {
  users: number; paying: number; active_access: number; companies: number; transactions: number;
  clients: number; proposals: number; company_members: number; paid_seats: number;
  ai_calls_month: number; ai_by_feature: Record<string, number>;
}

// Custo bruto estimado por chamada de IA (mistura chat barato + relatório caro). Ajuste quando instrumentar tokens.
const CUSTO_IA_POR_CHAMADA = 0.04; // R$
const FIXO_SUPABASE = 135;         // R$/mês (Pro)
const FIXO_RESEND = 108;           // R$/mês (após ~375 contas)
const FIXO_BRAPI = 120;            // R$/mês (quando precisar)

function GaugeArc({ value, max, label, sub, color }: { value: number; max: number; label: string; sub?: string; color: string }) {
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const r = 64, cx = 80, cy = 80;
  const len = Math.PI * r;
  const path = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 160 96" className="w-44">
        <path d={path} fill="none" stroke="var(--muted, #e5e5e5)" strokeWidth="12" strokeLinecap="round" style={{ stroke: "hsl(var(--muted))" }} />
        <path d={path} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={`${pct * len} ${len}`} />
        <text x="80" y="72" textAnchor="middle" className="font-heading" style={{ fill: "hsl(var(--foreground))", fontSize: "22px", fontWeight: 700 }}>{value.toLocaleString("pt-BR")}</text>
      </svg>
      <p className="text-sm font-medium -mt-1">{label}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

const FEATURE_LABEL: Record<string, string> = {
  chat: "Chat", categorize: "Categorização", extract: "Extração", report: "Relatórios",
  financial_report: "Relatório financeiro", life_report: "Relatório de vida", decision: "Simulador",
};

export default function AdminUso() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc("admin_usage_overview" as any).then(({ data: d }) => {
      const res = d as any;
      if (res && !res.error) setData(res as Overview);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">Carregando uso…</div>;
  if (!data) return <div className="py-10 text-center text-sm text-muted-foreground">Sem acesso ou sem dados.</div>;

  const custoIA = data.ai_calls_month * CUSTO_IA_POR_CHAMADA;
  const custoResend = data.users > 375 ? FIXO_RESEND : 0;
  const custoTotal = custoIA + FIXO_SUPABASE + custoResend + FIXO_BRAPI;
  const featureRows = Object.entries(data.ai_by_feature || {}).sort((a, b) => b[1] - a[1]);
  const featMax = Math.max(1, ...featureRows.map(([, v]) => v));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2"><Gauge className="h-6 w-6 text-primary" />Uso & Custos</h1>
        <p className="text-muted-foreground text-sm mt-1">Monitoramento de consumo da plataforma (IA, banco, crescimento). Egress/compute reais ficam no painel do Supabase.</p>
      </div>

      {/* Velocímetros */}
      <Card className="shadow-soft">
        <CardContent className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <GaugeArc value={data.ai_calls_month} max={50000} label="Chamadas de IA / mês" sub="ref. 50k" color="hsl(var(--primary))" />
          <GaugeArc value={Math.round(custoTotal)} max={2000} label="Custo estimado / mês (R$)" sub="IA + fixos" color="#BA7517" />
          <GaugeArc value={data.paying} max={Math.max(50, data.users)} label="Pagantes (Stripe)" sub={`${(data.active_access ?? 0).toLocaleString("pt-BR")} acessos ativos`} color="#1D9E75" />
        </CardContent>
      </Card>

      {/* Custo estimado — quebra */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3"><CardTitle className="text-base font-heading flex items-center gap-2"><DollarSign className="h-4 w-4 text-primary" />Custo estimado do mês</CardTitle></CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">IA (OpenAI: 4o-mini operacional / 4o relatórios) — {data.ai_calls_month.toLocaleString("pt-BR")} chamadas</span><span className="font-medium">R$ {custoIA.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Supabase (Pro, fixo)</span><span className="font-medium">R$ {FIXO_SUPABASE.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Resend (após ~375 contas)</span><span className="font-medium">R$ {custoResend.toFixed(2)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Brapi (quando o volume pedir)</span><span className="font-medium">R$ {FIXO_BRAPI.toFixed(2)}</span></div>
          <div className="flex justify-between pt-2 border-t border-border/50"><span className="font-heading font-bold">Total estimado</span><span className="font-heading font-bold">R$ {custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span></div>
          <p className="text-[11px] text-muted-foreground pt-1">Estimativa: R$ {CUSTO_IA_POR_CHAMADA.toFixed(2)}/chamada × chamadas reais. A IA roda direto na <strong>sua API da OpenAI</strong> (gpt-4o-mini no operacional, gpt-4o nos relatórios), então o <strong>custo exato fica no painel da OpenAI</strong>.</p>
        </CardContent>
      </Card>

      {/* Crescimento / tamanho */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Users, label: "Contas", v: data.users },
          { icon: DollarSign, label: "Pagantes (Stripe)", v: data.paying },
          { icon: Users, label: "Acessos ativos", v: data.active_access ?? 0 },
          { icon: Building2, label: "Empresas", v: data.companies },
          { icon: Receipt, label: "Lançamentos", v: data.transactions },
          { icon: Users, label: "Clientes (CRM)", v: data.clients },
          { icon: FileText, label: "Propostas", v: data.proposals },
          { icon: Users, label: "Membros (equipe)", v: data.company_members },
          { icon: DollarSign, label: "Assentos pagos", v: data.paid_seats },
        ].map((c, i) => (
          <div key={i} className="rounded-xl bg-muted/40 p-3">
            <p className="text-[11px] text-muted-foreground flex items-center gap-1"><c.icon className="h-3 w-3" />{c.label}</p>
            <p className="text-xl font-heading font-bold">{c.v.toLocaleString("pt-BR")}</p>
          </div>
        ))}
      </div>

      {/* IA por feature */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3"><CardTitle className="text-base font-heading flex items-center gap-2"><Cpu className="h-4 w-4 text-primary" />IA por recurso (mês)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {featureRows.length === 0 ? <p className="text-sm text-muted-foreground">Sem uso de IA neste mês.</p> : featureRows.map(([f, v]) => (
            <div key={f} className="space-y-1">
              <div className="flex justify-between text-sm"><span>{FEATURE_LABEL[f] || f}</span><span className="text-muted-foreground">{v.toLocaleString("pt-BR")}</span></div>
              <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${(v / featMax) * 100}%` }} /></div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Links pros números reais */}
      <Card className="shadow-soft">
        <CardContent className="p-4 text-sm space-y-1.5">
          <p className="text-muted-foreground">Egress, compute e tokens reais ficam nos painéis das plataformas:</p>
          <div className="flex flex-wrap gap-3">
            <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Supabase (banco/rede) <ExternalLink className="h-3 w-3" /></a>
            <a href="https://platform.openai.com/usage" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">OpenAI (custo real da IA) <ExternalLink className="h-3 w-3" /></a>
            <a href="https://brapi.dev/dashboard" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">Brapi (requisições) <ExternalLink className="h-3 w-3" /></a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
