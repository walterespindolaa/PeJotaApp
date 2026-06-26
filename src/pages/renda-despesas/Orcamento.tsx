import { useOutletContext } from "react-router-dom";
import TabOrcamento from "@/components/organiza/TabOrcamento";
import { useOrganiza, VisaoPessoa } from "@/hooks/useOrganiza";
import { useHouseholdView } from "@/contexts/HouseholdViewContext";
import type { RendaDespesasContext } from "./RendaDespesasLayout";

const Orcamento = () => {
  const { mesAno } = useOutletContext<RendaDespesasContext>();
  const { view: householdView } = useHouseholdView();
  const visaoPessoa: VisaoPessoa = householdView as VisaoPessoa;
  // Instância dedicada com herança: TabGerais e Análises continuam usando o `org` do layout (sem herança).
  const org = useOrganiza(mesAno, visaoPessoa, true);

  return (
    <TabOrcamento
      orcamentoPorCategoria={org.orcamentoPorCategoria}
      onUpsertOrcamento={org.upsertOrcamento}
      mesAno={mesAno}
      inheritanceState={org.orcamentoInheritanceState}
      onConfirmInheritance={org.confirmarOrcamentoHerdado}
    />
  );
};
export default Orcamento;
