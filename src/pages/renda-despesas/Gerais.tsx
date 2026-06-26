import { useOutletContext, useNavigate } from "react-router-dom";
import TabGerais from "@/components/organiza/TabGerais";
import type { RendaDespesasContext } from "./RendaDespesasLayout";

const TAB_TO_PATH: Record<string, string> = {
  gerais: "gerais", orcamento: "orcamento", ganhos: "ganhos", fixas: "fixas",
  variaveis: "variaveis", parcelas: "parcelas", dividas: "dividas", economias: "economias",
};

const Gerais = () => {
  const { org, mesAno, periodo } = useOutletContext<RendaDespesasContext>();
  const navigate = useNavigate();
  return (
    <TabGerais
      totalGanhos={org.totalGanhos} ganhosRecebidos={org.ganhosRecebidos}
      totalFixas={org.totalFixas} totalVariaveis={org.totalVariaveis}
      totalParcelas={org.totalParcelas} totalDespesas={org.totalDespesas}
      totalEconomias={org.totalEconomias} economiasPlanejadas={org.economiasPlanejadas}
      totalDividas={org.totalDividas}
      totalDividasRestante={org.totalDividasRestante}
      saldoDisponivel={org.saldoDisponivel}
      saldoReal={org.saldoReal} saldoPrevisto={org.saldoPrevisto}
      despesasPagas={org.despesasPagas}
      despesaCorrente={org.despesaCorrente}
      despesaCorrentePaga={org.despesaCorrentePaga}
      taxaPoupanca={org.taxaPoupanca}
      taxaPoupancaReal={org.taxaPoupancaReal}
      grauCompromisso={org.grauCompromisso}
      grauCompromissoReal={org.grauCompromissoReal}
      grauCompromissoPrev={org.grauCompromissoPrev}
      mesAno={mesAno} historico={org.historico} despesas={org.despesas}
      receitas={org.receitas}
      anuais={org.anuais}
      orcamentoPorCategoria={org.orcamentoPorCategoria}
      projecaoParcelas={org.projecaoParcelas}
      mesesAteZerarParcelas={org.mesesAteZerarParcelas}
      planejadoTotal={org.planejadoTotal}
      dentroDoPlanejado={org.dentroDoPlanejado}
      periodo={periodo}
      onUpsertOrcamento={org.upsertOrcamento}
      onNavigateTab={(tab) => navigate(`/dashboard/renda-despesas/${TAB_TO_PATH[tab] || "gerais"}`)}
    />
  );
};
export default Gerais;
