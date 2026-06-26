import PejotaModuleShell from "./PejotaModuleShell";
import { Target } from "lucide-react";

export default function MetasVendas() {
  return (
    <PejotaModuleShell
      title="Metas de vendas"
      description="Metas mensais de receita, resultado e vendas, comparadas com o realizado."
      reuse="Adapta a tela Metas do PeJota + transplante do Zephyr (monthly_goals → business_goals). Compara target × realizado do fluxo de caixa."
      status="planejado"
      icon={Target}
    />
  );
}
