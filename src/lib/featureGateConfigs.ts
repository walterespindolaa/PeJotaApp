import { FeatureKey } from "@/hooks/useFeatureAccess";

export interface FeatureGateConfig {
  featureKey: FeatureKey;
  moduleName: string;
  moduleDescription: string;
  benefits: string[];
}

export const FEATURE_GATE_CONFIGS: Record<string, FeatureGateConfig> = {
  investimentos: {
    featureKey: "investimentos",
    moduleName: "Módulo Investimentos",
    moduleDescription: "Gerencie sua carteira de investimentos de forma integrada ao seu planejamento financeiro.",
    benefits: [
      "Acompanhar sua carteira de investimentos",
      "Visualizar alocação de ativos",
      "Monitorar rentabilidade e evolução",
      "Consolidar patrimônio financeiro",
    ],
  },
  bens_imoveis: {
    featureKey: "bens_imoveis",
    moduleName: "Módulo Bens e Imóveis",
    moduleDescription: "Controle completo dos seus bens não-financeiros e patrimônio imobiliário.",
    benefits: [
      "Registrar imóveis e bens de valor",
      "Acompanhar valorização patrimonial",
      "Consolidar patrimônio total",
      "Vincular dívidas a bens",
    ],
  },
  protecao_seguros: {
    featureKey: "protecao_seguros",
    moduleName: "Proteção & Seguros",
    moduleDescription: "Organize e monitore todas as suas apólices de seguro.",
    benefits: [
      "Registrar apólices de seguro",
      "Acompanhar coberturas e vencimentos",
      "Avaliar gaps de proteção",
      "Manter documentação organizada",
    ],
  },
  objetivos_de_vida: {
    featureKey: "objetivos_de_vida",
    moduleName: "Objetivos de Vida",
    moduleDescription: "Planeje e acompanhe seus objetivos financeiros de longo prazo.",
    benefits: [
      "Criar objetivos com metas e prazos",
      "Registrar aportes e evolução",
      "Visualizar projeções de alcance",
      "Acompanhar múltiplos objetivos simultaneamente",
    ],
  },
  aposentadoria: {
    featureKey: "aposentadoria",
    moduleName: "Planejamento de Aposentadoria",
    moduleDescription: "Planeje sua aposentadoria com simulações completas e cenários personalizados.",
    benefits: [
      "Simular cenários de aposentadoria",
      "Calcular renda necessária futura",
      "Acompanhar progresso de acumulação",
      "Ajustar premissas e inflação",
    ],
  },
  relatorio_atlas: {
    featureKey: "relatorio_atlas",
    moduleName: "Base da Montanha",
    moduleDescription: "Um raio-X completo da sua vida financeira atual.\n\nVocê vai enxergar onde está seu dinheiro hoje, como ele está distribuído e quais pontos estão desorganizados ou desalinhados.\n\nIsso te dá clareza total do ponto de partida, para parar de agir no escuro e começar a tomar decisões com base na realidade.",
    benefits: [
      "Visão completa de onde está seu dinheiro hoje",
      "Diagnóstico real do seu patrimônio e dívidas",
      "Quanto precisa acumular para independência financeira",
      "Quais pontos estão desalinhados na sua vida financeira",
      "Relatório gerado por inteligência artificial",
      "Exportável em PDF",
    ],
  },
  estrategia_subida: {
    featureKey: "relatorio_atlas",
    moduleName: "Estratégia de Subida",
    moduleDescription: "O planejamento do caminho que você precisa seguir para alcançar seus objetivos.\n\nVocê vai enxergar seus objetivos financeiros, o tempo necessário para alcançá-los e os ajustes necessários na sua rotina e nos seus investimentos.\n\nTransforma metas soltas em um plano concreto, mostrando exatamente o que precisa ser feito para evoluir.",
    benefits: [
      "Seus objetivos financeiros organizados e priorizados",
      "Tempo necessário para alcançar cada meta",
      "Ajustes necessários na rotina e nos investimentos",
      "Projeções de aposentadoria e independência",
      "Plano de ação gerado por inteligência artificial",
      "Exportável em PDF",
    ],
  },
  evolucao_patrimonial: {
    featureKey: "evolucao_patrimonial",
    moduleName: "Controle da Jornada",
    moduleDescription: "O acompanhamento contínuo da sua vida financeira ao longo do tempo.\n\nVocê vai enxergar se está evoluindo ou se desviando do plano, além de padrões de comportamento e oportunidades de melhoria.\n\nEvita que você perca o controle e permite ajustes rápidos antes que pequenos erros virem grandes problemas.",
    benefits: [
      "Acompanhamento da sua evolução mês a mês",
      "Identificação de padrões e desvios do plano",
      "Oportunidades de melhoria no seu comportamento financeiro",
      "Separação por classes de ativos",
      "Visão consolidada financeiro + imobiliário",
    ],
  },
  relatorio_controle: {
    featureKey: "relatorio_controle",
    moduleName: "Guia da Jornada",
    moduleDescription: "Um direcionamento prático com base na sua situação atual.\n\nVocê vai enxergar prioridades claras, próximos passos e recomendações objetivas para melhorar sua vida financeira.\n\nReduz a dúvida sobre o que fazer e te dá um plano de ação direto, sem complicação.",
    benefits: [
      "Prioridades claras para o próximo mês",
      "Próximos passos objetivos e sem complicação",
      "O que melhorou e o que precisa de atenção",
      "Recomendações práticas para melhorar sua vida financeira",
      "Relatório gerado por inteligência artificial",
    ],
  },
  atlas_negocios: {
    featureKey: "atlas_negocios",
    moduleName: "Atlas Negócios",
    moduleDescription: "Integre sua empresa ao seu planejamento patrimonial.\n\nO Atlas Negócios conecta o fluxo financeiro da sua empresa com sua vida financeira pessoal. Você passa a enxergar quanto sua empresa realmente gera de riqueza e como transformar lucro em construção de riqueza pessoal.\n\nEmpreender deixa de ser apenas gerar faturamento e passa a ser construir patrimônio.\n\nDisponível nos planos Pro e Elite.",
    benefits: [
      "Quanto sua empresa realmente gera de riqueza",
      "Quanto pode retirar com segurança",
      "Impacto da empresa no seu patrimônio pessoal",
      "Fluxo de caixa empresarial completo",
      "Como transformar lucro em construção de riqueza",
    ],
  },
  projecao_patrimonial: {
    featureKey: "projecao_patrimonial",
    moduleName: "Mapa do Futuro",
    moduleDescription: "A simulação visual da sua trajetória patrimonial.\n\nO Mapa do Futuro projeta diferentes cenários da sua vida financeira ao longo dos anos. Você consegue visualizar o crescimento do patrimônio, eventos importantes da vida e os caminhos possíveis até sua independência financeira.\n\nÉ a visão de longo prazo que transforma planejamento em estratégia.",
    benefits: [
      "Crescimento do patrimônio ao longo dos anos",
      "Eventos importantes da vida no gráfico",
      "Impacto de decisões financeiras nos cenários",
      "Caminhos possíveis até independência financeira",
      "Simulação de múltiplos cenários futuros",
    ],
  },
  plano_liberdade: {
    featureKey: "plano_liberdade",
    moduleName: "Plano da Liberdade",
    moduleDescription: "Um programa completo de educação financeira para transformar sua relação com o dinheiro.\n\nAulas e trilhas exclusivas que te guiam do controle básico até a independência financeira, com conteúdos criados especialmente para quem quer ir além do planejamento e construir riqueza de verdade.",
    benefits: [
      "Curso completo Plano da Liberdade",
      "Aulas e trilhas financeiras exclusivas",
      "Conteúdos premium do Atlas",
      "Do controle financeiro à independência",
      "Acesso vitalício ao conteúdo do plano",
    ],
  },
  manual_do_dinheiro: {
    featureKey: "manual_do_dinheiro",
    moduleName: "Manual do Dinheiro",
    moduleDescription: "Curso completo sobre a história, o funcionamento e os fundamentos do sistema financeiro — para você entender o dinheiro de verdade e usar isso a seu favor.",
    benefits: [
      "A história do dinheiro e como o sistema funciona",
      "Por que guardar dinheiro te empobrece",
      "O erro da poupança e o risco de não investir",
      "Como pensar como investidor",
      "Os fundamentos de uma boa carteira",
    ],
  },
  dominando_variavel: {
    featureKey: "plano_liberdade",
    moduleName: "Dominando o Variável",
    moduleDescription: "Curso exclusivo Elite sobre ETFs, ações e fundos imobiliários — disponível em breve.",
    benefits: [
      "Como analisar e investir em ETFs de forma estratégica",
      "Fundamentos de análise de ações",
      "Como funcionam os FIIs e como escolher os melhores",
      "Estratégias de diversificação em renda variável",
      "Gestão de risco e rebalanceamento",
    ],
  },
  planejamento_financeiro_curso: {
    featureKey: "plano_liberdade",
    moduleName: "Planejamento Financeiro",
    moduleDescription: "Curso exclusivo Elite do diagnóstico ao plano completo — disponível em breve.",
    benefits: [
      "Diagnóstico financeiro completo",
      "Planejamento de curto, médio e longo prazo",
      "Estratégias de proteção patrimonial",
      "Planejamento sucessório básico",
      "Organização financeira familiar",
      "Como criar e manter um plano financeiro vivo",
    ],
  },
  renda_passiva_fiis: {
    featureKey: "renda_passiva_fiis",
    moduleName: "Renda Passiva com FIIs",
    moduleDescription: "Aprenda a construir renda passiva com Fundos Imobiliários.",
    benefits: ["Análise de FIIs", "Carteira de renda passiva", "Plano de substituição de renda"],
  },
  financas_casal: {
    featureKey: "financas_casal",
    moduleName: "Finanças do Casal",
    moduleDescription: "Construa uma vida financeira a dois sem conflito.",
    benefits: ["Modelos de divisão", "Orçamento do casal", "Investindo a dois"],
  },
  planejamento_tributario: {
    featureKey: "planejamento_tributario",
    moduleName: "Planejamento Tributário",
    moduleDescription: "Pague menos imposto usando o que a lei já permite.",
    benefits: ["IR na prática", "PGBL vs VGBL", "PJ vs CLT"],
  },
  novo_mapa_dinheiro: {
    featureKey: "novo_mapa_dinheiro",
    moduleName: "O Novo Mapa do Dinheiro",
    moduleDescription: "Tese macro 2024-2030 de um assessor de investimentos.",
    benefits: ["Visão macro global", "Método ARCA", "Anomalia Brasil"],
  },
};
