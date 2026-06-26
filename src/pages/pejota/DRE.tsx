import PejotaModuleShell from "./PejotaModuleShell";
import { FileText } from "lucide-react";

export default function DRE() {
  return (
    <PejotaModuleShell
      title="DRE gerencial"
      description="Demonstrativo de resultado: receita bruta, deduções, custos, despesas e lucro líquido."
      reuse="Novo (PeJota) — consolida o realizado (business_transactions) por grupo de categoria, no padrão Kamino/Controlle."
      status="planejado"
      icon={FileText}
    />
  );
}
