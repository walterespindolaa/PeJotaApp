import { useOutletContext } from "react-router-dom";
import TabFixas from "@/components/organiza/TabFixas";
import type { RendaDespesasContext } from "./RendaDespesasLayout";

const Fixas = () => {
  const { org, mesAno, investimentos } = useOutletContext<RendaDespesasContext>();
  return (
    <TabFixas
      fixas={org.fixas} totalFixas={org.totalFixas} mesAno={mesAno}
      mesFechado={false}
      onAdd={org.addDespesa} onUpdate={org.updateDespesa} onDelete={org.deleteDespesa}
      nomePessoa1={org.nomePessoa1} nomePessoa2={org.nomePessoa2}
      investimentos={investimentos}
    />
  );
};
export default Fixas;
