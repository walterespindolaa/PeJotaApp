export type Investimento = {
  id: string; user_id: string; nome: string; tipo: string; classe: string;
  instituicao: string; valor: number; valor_atual: number; total_aportado: number;
  quantidade: number; preco_medio: number; indexador: string; taxa_contratada: number;
  vencimento_data: string | null; liquidez: string; perfil_risco: string;
  rentabilidade_estimada: number | null; created_at: string; updated_at: string;
  is_reserva_emergencia: boolean;
  ticker?: string;
  recebe_proventos: boolean; frequencia_proventos: string; meses_proventos: string;
  categoria_titulo?: string | null;
};

export type Provento = {
  id: string; user_id: string; investimento_id: string;
  tipo_provento: string; valor: number; mes_referencia: string;
  observacao: string | null; created_at: string;
  ex_date: string | null;
};

export type Indicador = {
  indicador: string; valor: number; data_referencia: string; updated_at: string;
};

export type Snapshot = {
  month_ref: string; total_value: number; total_contributions: number;
};

export type Aporte = {
  data: string; valor: number; investimento_id: string; observacao: string | null;
};

export type FiiReport = {
  ticker: string;
  informe: {
    referenceDate: string | null;
    monthlyDividendYield: number | null;
    monthlyReturn: number | null;
    navPerShare: number | null;
    equity: number | null;
    totalAssets: number | null;
    totalInvestors: number | null;
    composition: {
      cri: number | null;
      lci: number | null;
      governmentBonds: number | null;
      cash: number | null;
      realEstateAssets: number | null;
      other: number | null;
    };
  };
};

export type MacroData = {
  selic: { date: string; value: number }[];
  ipca: { date: string; value: number }[];
};

export type DividendForecastPoint = { mes: string; total: number; estimado?: boolean };
export type DividendHistPoint = { mes: string; total: number };
