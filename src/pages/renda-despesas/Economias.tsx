import { useOutletContext } from "react-router-dom";
import TabEconomias from "@/components/organiza/TabEconomias";
import type { RendaDespesasContext } from "./RendaDespesasLayout";

const Economias = () => {
  const { org, mesAno } = useOutletContext<RendaDespesasContext>();
  return (
    <TabEconomias
      economias={org.economias} totalEconomias={org.totalEconomias}
      saldoDisponivel={org.saldoDisponivel} mesAno={mesAno}
      onAdd={org.addEconomia} onDelete={org.deleteEconomia}
      nomePessoa1={org.nomePessoa1} nomePessoa2={org.nomePessoa2}
      mediaDespesas={org.anuais.mediaDespesas}
      mediaEconomiasMensal={org.anuais.mediaEconomias}
    />
  );
};
export default Economias;
