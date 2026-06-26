/**
 * Motor de Decisão Financeira do Atlas
 * Roteador central que despacha para o módulo correto por tipo de decisão.
 */

import type { DecisionContext, DecisionResult } from "./types";
import { calcularComprarImovel } from "./comprar_imovel";
import { calcularTrocarCarro } from "./trocar_carro";
import { calcularAumentoPadrao } from "./aumento_padrao";
import { calcularViagem } from "./viagem";
import { calcularNovoFilho } from "./novo_filho";
import { calcularAbrirNegocio } from "./abrir_negocio";
import { calcularReducaoRenda } from "./reducao_renda";
import { calcularAnteciparAposentadoria } from "./antecipar_aposentadoria";

export type { DecisionContext, DecisionResult };

export interface DecisionExtras {
  aporteMensal?: number;
}

export function runDecisionEngine(
  tipo: string,
  valor: number,
  prazo: number,
  ctx: DecisionContext,
  ctxExtra?: DecisionExtras,
): DecisionResult {
  switch (tipo) {
    case "comprar_imovel":
      return calcularComprarImovel(valor, prazo, ctx);
    case "trocar_carro":
      return calcularTrocarCarro(valor, prazo, ctx);
    case "aumentar_padrao":
      return calcularAumentoPadrao(valor, prazo, ctx);
    case "viagem":
      return calcularViagem(valor, prazo, ctx);
    case "novo_filho":
      return calcularNovoFilho(valor, prazo, ctx);
    case "empreender":
      return calcularAbrirNegocio(valor, prazo, ctx, ctxExtra?.aporteMensal ?? 0);
    case "reduzir_renda":
      return calcularReducaoRenda(valor, prazo, ctx);
    case "antecipar_aposentadoria":
      return calcularAnteciparAposentadoria(valor, prazo, ctx);
    default:
      return calcularAumentoPadrao(valor, prazo, ctx);
  }
}
