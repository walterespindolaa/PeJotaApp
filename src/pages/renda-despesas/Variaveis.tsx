import { useOutletContext } from "react-router-dom";
import TabVariaveis from "@/components/organiza/TabVariaveis";
import type { RendaDespesasContext } from "./RendaDespesasLayout";

const Variaveis = () => {
  const { org, mesAno, investimentos } = useOutletContext<RendaDespesasContext>();
  return (
    <TabVariaveis
      variaveis={org.variaveis} totalVariaveis={org.totalVariaveis}
      totalFixas={org.totalFixas} mesAno={mesAno}
      onAdd={org.addDespesa} onUpdate={org.updateDespesa} onDelete={org.deleteDespesa}
      nomePessoa1={org.nomePessoa1} nomePessoa2={org.nomePessoa2}
      investimentos={investimentos}
    />
  );
};
export default Variaveis;
