import PejotaModuleShell from "./PejotaModuleShell";
import { ArrowUpCircle } from "lucide-react";

export default function ContasReceber() {
  return (
    <PejotaModuleShell
      title="Contas a receber"
      description="Cobranças por cliente, identificação de pagamento e baixa automática no caixa."
      reuse="Novo (PeJota) — integra emissão de boleto/PIX via Asaas na Fase 3. Fecha o ciclo: proposta aceita → recebível → caixa."
      status="planejado"
      icon={ArrowUpCircle}
    />
  );
}
