import PejotaModuleShell from "./PejotaModuleShell";
import { Download } from "lucide-react";

export default function Exportacoes() {
  return (
    <PejotaModuleShell
      title="Exportações"
      description="Exporte relatórios e lançamentos em PDF e Excel."
      reuse="Reaproveita a infra de export do Atlas (jsPDF + XLSX já instalados)."
      status="reaproveitado"
      icon={Download}
    />
  );
}
