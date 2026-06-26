import { useOutletContext } from "react-router-dom";
import TabParcelas from "@/components/organiza/TabParcelas";
import type { RendaDespesasContext } from "./RendaDespesasLayout";

const Parcelas = () => {
  const { org, mesAno } = useOutletContext<RendaDespesasContext>();
  return (
    <TabParcelas
      parcelas={org.parcelas} totalParcelas={org.totalParcelas} mesAno={mesAno}
      onAdd={org.addDespesa} onUpdate={org.updateDespesa} onDelete={org.deleteDespesa}
      onUpdateInstanceStatus={org.updateInstanceStatus}
      mesFechado={false}
      nomePessoa1={org.nomePessoa1} nomePessoa2={org.nomePessoa2}
    />
  );
};
export default Parcelas;
