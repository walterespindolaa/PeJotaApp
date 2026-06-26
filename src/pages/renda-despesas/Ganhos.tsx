import { useOutletContext } from "react-router-dom";
import TabGanhos from "@/components/organiza/TabGanhos";
import type { RendaDespesasContext } from "./RendaDespesasLayout";

const Ganhos = () => {
  const { org, mesAno } = useOutletContext<RendaDespesasContext>();
  return (
    <TabGanhos
      receitas={org.receitas} totalGanhos={org.totalGanhos}
      ganhosRecebidos={org.ganhosRecebidos} mesAno={mesAno}
      mesFechado={false}
      onAdd={org.addReceita} onUpdate={org.updateReceita} onDelete={org.deleteReceita}
      onAddEconomia={org.addEconomia}
      nomePessoa1={org.nomePessoa1} nomePessoa2={org.nomePessoa2}
    />
  );
};
export default Ganhos;
