import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useOrganiza, VisaoPessoa } from "@/hooks/useOrganiza";
import { useHouseholdLabels } from "@/hooks/useHouseholdLabels";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { useHouseholdView } from "@/contexts/HouseholdViewContext";
import PlanejamentoUpsell from "@/components/PlanejamentoUpsell";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useI18n } from "@/contexts/I18nContext";

const now = new Date();
const currentMesAno = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

function shiftMonth(mesAno: string, delta: number): string {
  const [y, m] = mesAno.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(mesAno: string): string {
  const [y, m] = mesAno.split("-").map(Number);
  const d = new Date(y, m - 1);
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const PERIOD_OPTIONS = [
  { value: "mes", label: "org.per_mes" },
  { value: "3m", label: "org.per_3m" },
  { value: "6m", label: "org.per_6m" },
  { value: "12m", label: "org.per_12m" },
  { value: "24m", label: "org.per_24m" },
  { value: "all", label: "org.per_all" },
];

const TABS = [
  { value: "gerais", label: "org.tab_gerais", path: "gerais" },
  { value: "orcamento", label: "org.tab_orcamento", path: "orcamento" },
  { value: "ganhos", label: "org.tab_ganhos", path: "ganhos" },
  { value: "fixas", label: "org.tab_fixas", path: "fixas" },
  { value: "variaveis", label: "org.tab_variaveis", path: "variaveis" },
  { value: "parcelas", label: "org.tab_parcelas", path: "parcelas" },
  { value: "dividas", label: "org.tab_dividas", path: "dividas" },
  { value: "economias", label: "org.tab_economias", path: "economias" },
];

export type InvBasic = { id: string; nome: string; instituicao: string; recebe_proventos: boolean; frequencia_proventos: string };

export type RendaDespesasContext = {
  org: ReturnType<typeof useOrganiza>;
  mesAno: string;
  setMesAno: (m: string) => void;
  periodo: string;
  setPeriodo: (p: string) => void;
  investimentos: InvBasic[];
};

const RendaDespesasLayout = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mesAno, setMesAno] = useState(currentMesAno);
  const { view: householdView } = useHouseholdView();
  const visaoPessoa: VisaoPessoa = householdView as VisaoPessoa;
  const [periodo, setPeriodo] = useState("mes");
  const [investimentos, setInvestimentos] = useState<InvBasic[]>([]);
  const org = useOrganiza(mesAno, visaoPessoa);
  useHouseholdLabels(org.nomePessoa1, org.nomePessoa2);
  const { isPrivate } = usePrivacyMode();
  const { t } = useI18n();

  const activeTab = TABS.find(t => location.pathname.endsWith(`/${t.path}`))?.value || "gerais";

  useEffect(() => {
    if (!user) return;
    supabase.from("investimentos_financeiros")
      .select("id,nome,instituicao,recebe_proventos,frequencia_proventos")
      .eq("user_id", user.id)
      .then(({ data }) => setInvestimentos((data as InvBasic[]) || []));
  }, [user]);

  if (org.loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (org.error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-4">
        <p className="text-muted-foreground font-body">{org.error}</p>
        <Button variant="outline" onClick={() => org.refetch()}>
          {t("dh.tentar")}
        </Button>
      </div>
    );
  }

  const saldoColor = org.saldoPrevisto >= 0 ? "text-success" : "text-destructive";

  const ctx: RendaDespesasContext = {
    org, mesAno, setMesAno, periodo, setPeriodo, investimentos,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PlanejamentoUpsell />
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-heading font-bold tracking-tight">
            Atlas <span className="text-muted-foreground font-normal">|</span> {t("org.titulo")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t("org.subtitulo")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={periodo} onValueChange={setPeriodo}>
            <SelectTrigger className="w-[170px]">
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{t(p.label)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Month Navigator + Balance */}
      <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3 shadow-soft">
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Mês anterior" onClick={() => setMesAno(shiftMonth(mesAno, -1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <p className="text-base font-heading font-bold">{formatMonthLabel(mesAno)}</p>
          <p className="text-xs text-muted-foreground">
            {t("org.saldo_mes")} <span className={`font-semibold ${saldoColor}`}>
              {isPrivate ? "•••••" : `R$ ${org.saldoPrevisto.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
            </span>
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Próximo mês" onClick={() => setMesAno(shiftMonth(mesAno, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Sub-menu de tabs (visual idêntico ao anterior, mas troca URL) */}
      <div className="relative">
        <div className="overflow-x-auto -mx-1 px-1 scrollbar-hide">
          <div className="inline-flex h-12 items-center justify-center bg-transparent border-b border-border rounded-none p-0 gap-0 w-max min-w-full">
            {TABS.map(tab => {
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => navigate(`/dashboard/renda-despesas/${tab.path}`)}
                  className={`flex-shrink-0 rounded-none border-b-2 transition-all text-xs sm:text-sm font-medium whitespace-nowrap px-3 sm:px-4 py-3 ${
                    isActive
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(tab.label)}
                </button>
              );
            })}
          </div>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden" />
      </div>

      <Outlet context={ctx} />
    </div>
  );
};

export default RendaDespesasLayout;
