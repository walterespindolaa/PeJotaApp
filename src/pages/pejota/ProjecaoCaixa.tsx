import PejotaModuleShell from "./PejotaModuleShell";
import { CalendarRange } from "lucide-react";

export default function ProjecaoCaixa() {
  return (
    <PejotaModuleShell
      title="Projeção de caixa"
      description="Eventos e custos futuros previstos para validar o caixa antes de assumir compromissos."
      reuse="Transplante do Zephyr (planned_events → business_planned_events). Passa a alimentar o CashFlowSimulator do PeJota (substitui a premissa fixa 'caixa = lucro × 3')."
      status="planejado"
      icon={CalendarRange}
    />
  );
}
