import PejotaModuleShell from "./PejotaModuleShell";
import { UserCog } from "lucide-react";

export default function Colaboradores() {
  return (
    <PejotaModuleShell
      title="Colaboradores e folha"
      description="Fechamento mensal por colaborador, comissões, piso mínimo e repasses."
      reuse="Transplante do Zephyr (collaborator_payouts → business_payroll_runs + business_payouts). Folha entra no fluxo de caixa como grupo 'Folha'. Import por CSV reusa o CsvImportDialog."
      status="planejado"
      icon={UserCog}
    />
  );
}
