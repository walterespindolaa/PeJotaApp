import { useOutletContext } from "react-router-dom";
import TabDividas from "@/components/organiza/TabDividas";
import type { RendaDespesasContext } from "./RendaDespesasLayout";

const Dividas = () => {
  const { org, mesAno } = useOutletContext<RendaDespesasContext>();
  return (
    <TabDividas
      fixas={org.fixas} dividas={org.dividas} mesAno={mesAno}
      mesFechado={false}
      onAdd={org.addDespesa} onUpdate={org.updateDespesa} onDelete={org.deleteDespesa}
      onUpdateInstanceStatus={org.updateInstanceStatus}
      nomePessoa1={org.nomePessoa1} nomePessoa2={org.nomePessoa2}
    />
  );
};
export default Dividas;
