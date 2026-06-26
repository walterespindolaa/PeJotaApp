import PejotaModuleShell from "./PejotaModuleShell";
import { Receipt } from "lucide-react";

export default function Impostos() {
  return (
    <PejotaModuleShell
      title="Impostos"
      description="Controle de impostos a pagar e pagos (DAS, ISSQN, IRPJ, CSLL) com vencimento e baixa."
      reuse="Transplante do Zephyr (tabela taxes → business_taxes com company_id). Conecta com Planejamento tributário e gera lançamento no caixa quando pago."
      status="planejado"
      icon={Receipt}
    />
  );
}
