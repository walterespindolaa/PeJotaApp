import { useState, useEffect, Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { usePlan } from "@/hooks/usePlan";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown, Sparkles, Zap, Settings } from "lucide-react";
import { STRIPE_ESSENCIAL_URL, STRIPE_PRO_URL, STRIPE_ELITE_URL } from "@/lib/checkout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logError } from "@/lib/log";

export interface PlanFeatureItem {
  label: string;
  essencial: boolean;
  pro: boolean;
  elite: boolean;
}

export interface PlanFeatureGroup {
  group: string;
  items: PlanFeatureItem[];
}

export const PLAN_FEATURES: PlanFeatureGroup[] = [
  { group: "Controle Financeiro", items: [
    { label: "Planejamento e Controle", essencial: true, pro: true, elite: true },
    { label: "Lançamentos", essencial: true, pro: true, elite: true },
    { label: "Calendário de Pagamentos", essencial: true, pro: true, elite: true },
    { label: "Análises", essencial: true, pro: true, elite: true },
    { label: "Assistente PeJota (IA)", essencial: true, pro: true, elite: true },
  ]},
  { group: "Automação Financeira", items: [
    { label: "Fatura do Cartão", essencial: false, pro: true, elite: true },
    { label: "Importar Extrato Bancário", essencial: false, pro: true, elite: true },
    { label: "Importar OFX", essencial: false, pro: true, elite: true },
    { label: "Importar Planilha", essencial: false, pro: true, elite: true },
  ]},
  { group: "Planejamento Estratégico", items: [
    { label: "Planejamento de Vida", essencial: false, pro: true, elite: true },
    { label: "Simulação de Objetivos", essencial: false, pro: true, elite: true },
    { label: "Projeções Financeiras", essencial: false, pro: true, elite: true },
    { label: "Planejamento de Aposentadoria", essencial: false, pro: true, elite: true },
    { label: "Simulador de Decisão", essencial: false, pro: true, elite: true },
    { label: "Simulador de Financiamento", essencial: false, pro: true, elite: true },
  ]},
  { group: "Planejamento de Futuro", items: [
    { label: "Mapa do Futuro", essencial: false, pro: true, elite: true },
    { label: "Vista da Montanha", essencial: false, pro: true, elite: true },
    { label: "Eventos da Vida na linha do tempo", essencial: false, pro: true, elite: true },
    { label: "Simulação de cenários patrimoniais", essencial: false, pro: true, elite: true },
  ]},
  { group: "Patrimônio e Investimentos", items: [
    { label: "Controle Patrimonial", essencial: false, pro: true, elite: true },
    { label: "Controle de Investimentos", essencial: false, pro: true, elite: true },
    { label: "Evolução Patrimonial", essencial: false, pro: true, elite: true },
    { label: "Proteção & Seguros", essencial: false, pro: true, elite: true },
    { label: "Bens e Imóveis", essencial: false, pro: true, elite: true },
    { label: "Renda Passiva com FIIs (em breve)", essencial: false, pro: false, elite: true },
  ]},
  { group: "PeJota Negócios", items: [
    { label: "Controle Financeiro Empresarial", essencial: false, pro: true, elite: true },
    { label: "Fluxo de Caixa Empresarial", essencial: false, pro: true, elite: true },
    { label: "Análise Financeira do Negócio", essencial: false, pro: true, elite: true },
  ]},
  { group: "Relatórios Inteligentes", items: [
    { label: "Relatório de Vida Financeira", essencial: false, pro: true, elite: true },
  ]},
  { group: "Educação Financeira", items: [
    { label: "Organização na Prática", essencial: true, pro: true, elite: true },
    { label: "Manual do Dinheiro", essencial: false, pro: true, elite: true },
    { label: "Planejamento Financeiro (curso)", essencial: false, pro: true, elite: true },
    { label: "Plano da Liberdade", essencial: false, pro: false, elite: true },
    { label: "Conteúdos exclusivos (em breve)", essencial: false, pro: false, elite: true },
  ]},
];

const plans = [
  { slug: "essencial", name: "PeJota Essencial", price: "R$ 15,90", icon: Zap, color: "text-success", desc: "Controle financeiro e organização da vida financeira.", url: STRIPE_ESSENCIAL_URL },
  { slug: "pro", name: "PeJota Pro", price: "R$ 24,90", icon: Sparkles, color: "text-primary", desc: "Planejamento financeiro completo + automações + PeJota Negócios + Mapa do Futuro.", url: STRIPE_PRO_URL },
  { slug: "elite", name: "PeJota Elite", price: "R$ 32,90", icon: Crown, color: "text-amber-500", desc: "Tudo do Pro + educação financeira premium e conteúdos exclusivos.", highlight: "Inclui acesso ao Plano da Liberdade e conteúdos educacionais exclusivos", url: STRIPE_ELITE_URL },
];

const PlanoComparacao = () => {
  const { userPlan } = useFeatureAccess();
  const { accessState, isFull } = usePlan();
  const navigate = useNavigate();
  const { toast } = useToast();
  // Only mark a card as current when user has an active paid subscription
  const currentSlug = (accessState === "active_paid" && isFull) ? (userPlan?.slug || "") : "";
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-portal-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ return_url: "https://app.useatlasapp.com/dashboard/planos" }),
        }
      );

      const data = await res.json();

      if (res.status === 404 || !data.url) {
        toast({
          title: "Nenhuma assinatura ativa encontrada",
          description: "Você ainda não tem uma assinatura paga vinculada. Assine um plano pela página de comparação.",
          variant: "default",
        });
        return;
      }

      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }

      toast({
        title: "Erro ao abrir portal",
        description: `Código ${res.status}. Tente novamente em alguns minutos.`,
        variant: "destructive",
      });
    } catch (e) {
      logError("Portal error:", e);
    } finally {
      setLoadingPortal(false);
    }
  };

  const CellIcon = ({ ok }: { ok: boolean }) =>
    ok ? <Check className="h-4 w-4 text-success mx-auto" /> : <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />;

  const isPaidPlan = accessState === "active_paid";

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <h1 className="text-2xl font-heading font-bold">Comparação de Planos</h1>
        <p className="text-muted-foreground text-sm mt-1">Escolha o plano ideal para o seu momento financeiro.</p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map(p => {
          const isCurrent = currentSlug === `atlas_${p.slug}`;
          return (
            <Card key={p.slug} className={`relative overflow-hidden transition-all ${isCurrent ? "border-primary ring-2 ring-primary/20" : "border-border/60"}`}>
              {isCurrent && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
              )}
              <CardContent className="p-5 text-center">
                <p.icon className={`h-8 w-8 mx-auto mb-3 ${p.color}`} />
                <h3 className="font-heading font-bold text-base">{p.name}</h3>
                <p className="text-2xl font-heading font-bold mt-1">{p.price}<span className="text-xs text-muted-foreground font-normal">/mês</span></p>
                <p className="text-xs text-muted-foreground mt-1 mb-1">{p.desc}</p>
                {"highlight" in p && p.highlight && (
                  <p className="text-[11px] text-amber-500 font-medium mb-3 flex items-center justify-center gap-1">
                    <Crown className="h-3 w-3" /> {p.highlight}
                  </p>
                )}
                {!("highlight" in p && p.highlight) && <div className="mb-3" />}
                {isCurrent ? (
                  <Badge variant="secondary" className="rounded-full">Seu plano atual</Badge>
                ) : isPaidPlan ? (
                  <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1" onClick={handleManageSubscription} disabled={loadingPortal}>
                    <Sparkles className="h-3 w-3" /> {loadingPortal ? "Abrindo..." : "Fazer upgrade"}
                  </Button>
                ) : (
                  <a href={userId ? `${p.url}?client_reference_id=${userId}` : p.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1">
                      <Sparkles className="h-3 w-3" /> Ativar
                    </Button>
                  </a>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Manage subscription button */}
      {isPaidPlan && (
        <Card className="border-border/60">
          <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-heading font-semibold text-sm">Gerenciar assinatura</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Faça upgrade, cancele, atualize seu cartão ou veja suas faturas.</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-2 shrink-0"
              onClick={handleManageSubscription}
              disabled={loadingPortal}
            >
              <Settings className="h-3.5 w-3.5" />
              {loadingPortal ? "Abrindo..." : "Gerenciar assinatura"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Feature comparison table */}
      <Card className="border-border/60 overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30">
                  <th className="text-left p-3 pl-5 font-heading font-semibold text-foreground/80 w-2/5">Funcionalidade</th>
                  {plans.map(p => (
                    <th key={p.slug} className="p-3 text-center font-heading font-semibold text-foreground/80 w-1/5">
                      <span className="hidden sm:inline">{p.name}</span>
                      <span className="sm:hidden text-xs">{p.name.replace("PeJota ", "")}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PLAN_FEATURES.map((group) => (
                  <Fragment key={group.group}>
                    <tr>
                      <td colSpan={4} className="px-5 pt-4 pb-1.5 text-[10px] uppercase tracking-[0.15em] font-heading font-semibold text-muted-foreground/60">
                        {group.group}
                      </td>
                    </tr>
                    {group.items.map(item => (
                      <tr key={item.label} className="border-t border-border/20 hover:bg-muted/20 transition-colors">
                        <td className="p-3 pl-5 text-foreground/70">{item.label}</td>
                        <td className="p-3"><CellIcon ok={item.essencial} /></td>
                        <td className="p-3"><CellIcon ok={item.pro} /></td>
                        <td className="p-3"><CellIcon ok={item.elite} /></td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="text-center pb-6">
        <Button variant="outline" className="rounded-xl" onClick={() => navigate("/dashboard")}>
          Voltar ao Dashboard
        </Button>
      </div>
    </div>
  );
};

export default PlanoComparacao;
