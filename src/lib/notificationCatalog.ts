/**
 * PeJota Notification Engine — Central Catalog
 *
 * Each entry defines a notification type that the engine can evaluate and send.
 * The catalog is code-based for type-safety and easy versioning.
 * The DB stores history + preferences only.
 */

export type NotificationBlock =
  | "onboarding"
  | "habito"
  | "alerta"
  | "reativacao"
  | "insight";

export type NotificationPriority = "low" | "medium" | "high" | "critical";

export type NotificationChannel = "push";

export interface NotificationDefinition {
  /** Unique slug — used as foreign key in history */
  slug: string;
  name: string;
  block: NotificationBlock;
  description: string;
  priority: NotificationPriority;
  /** Push title */
  title: string;
  /** Push body — may contain {placeholders} replaced at evaluation time */
  message: string;
  /** Route the user lands on when tapping the notification */
  route: string;
  /** Tag for push grouping (collapses same-tag notifications) */
  tag: string;
  channel: NotificationChannel;
  /** Is the rule active? Allows disabling without removing code */
  active: boolean;

  // ── Frequency limits ──
  /** Minimum hours between two sends of this slug per user */
  cooldownHours: number;
  /** Max lifetime sends per user (null = unlimited) */
  maxLifetimeSends: number | null;

  // ── Preferred send window (hour of day, 0-23) ──
  preferredHourStart: number;
  preferredHourEnd: number;

  // ── Day-of-week filter (0=Sun … 6=Sat). null = any day ──
  allowedDaysOfWeek: number[] | null;

  /** Preference category the user can toggle in the future */
  preferenceCategory: string;
}

// ─────────────────────────────────────────────
// BLOCO 1 — ONBOARDING
// ─────────────────────────────────────────────

const onboarding: NotificationDefinition[] = [
  {
    slug: "onboarding_base_incompleta",
    name: "Base incompleta",
    block: "onboarding",
    description: "Usuário criou conta mas não cadastrou receita, despesas ou patrimônio após 24h.",
    priority: "medium",
    title: "Falta pouco pra concluir 🚧",
    message: "Mais alguns minutos no setup e seu PeJota começa a trabalhar pra você de verdade.",
    route: "/comece-por-aqui",
    tag: "onboarding",
    channel: "push",
    active: true,
    cooldownHours: 24 * 30,
    maxLifetimeSends: 1,
    preferredHourStart: 10,
    preferredHourEnd: 20,
    allowedDaysOfWeek: null,
    preferenceCategory: "onboarding",
  },
  {
    slug: "onboarding_objetivos",
    name: "Objetivos não definidos",
    block: "onboarding",
    description: "Usuário acessou 2+ vezes mas ainda não criou metas ou objetivos.",
    priority: "medium",
    title: "Cadê seus objetivos? 🎯",
    message: "Sem destino, todo caminho serve. Define os seus no PeJota.",
    route: "/dashboard/objetivos-de-vida",
    tag: "onboarding",
    channel: "push",
    active: true,
    cooldownHours: 24 * 7,
    maxLifetimeSends: 2,
    preferredHourStart: 10,
    preferredHourEnd: 20,
    allowedDaysOfWeek: null,
    preferenceCategory: "onboarding",
  },
];

// ─────────────────────────────────────────────
// BLOCO 2 — HÁBITO
// ─────────────────────────────────────────────

const habito: NotificationDefinition[] = [
  {
    slug: "habito_revisao_semanal",
    name: "Revisão semanal domingo",
    block: "habito",
    description: "Domingo à noite: convida usuário ativo a revisar suas finanças.",
    priority: "low",
    title: "Bora revisar a semana? 📋",
    message: "2 minutos no PeJota e domingo de noite vira clareza pra próxima semana.",
    route: "/dashboard",
    tag: "habito-semanal",
    channel: "push",
    active: true,
    cooldownHours: 24 * 6,
    maxLifetimeSends: null,
    preferredHourStart: 19,
    preferredHourEnd: 20,
    allowedDaysOfWeek: [0],
    preferenceCategory: "lembretes",
  },
  {
    slug: "habito_pos_salario",
    name: "Pós-salário",
    block: "habito",
    description: "Receita relevante identificada — incentiva organização imediata.",
    priority: "medium",
    title: "Salário caiu 💰",
    message: "Hora de decidir o destino. Abre o PeJota antes de gastar no automático.",
    route: "/dashboard/renda-despesas",
    tag: "habito-salario",
    channel: "push",
    active: true,
    cooldownHours: 24 * 25,
    maxLifetimeSends: null,
    preferredHourStart: 18,
    preferredHourEnd: 20,
    allowedDaysOfWeek: null,
    preferenceCategory: "lembretes",
  },
  {
    slug: "habito_sem_gastos",
    name: "Sem registrar gastos",
    block: "habito",
    description: "Usuário ativo ficou 3+ dias sem lançar despesas.",
    priority: "low",
    title: "Faltam lançamentos da semana 📝",
    message: "Sem registrar, sem controle. 2 minutos no PeJota e tá feito.",
    route: "/dashboard/renda-despesas",
    tag: "habito-gastos",
    channel: "push",
    active: true,
    cooldownHours: 24 * 5,
    maxLifetimeSends: null,
    preferredHourStart: 19,
    preferredHourEnd: 20,
    allowedDaysOfWeek: null,
    preferenceCategory: "lembretes",
  },
  {
    slug: "habito_vencimento_fixa",
    name: "Vencimento de despesa fixa",
    block: "habito",
    description: "Despesa fixa com alerta ativado vence em breve.",
    priority: "high",
    title: "{descricao} vence em {dias} dias 📅",
    message: "Antes do vencimento, dá uma olhada e garante que tá tudo certo.",
    route: "/dashboard/renda-despesas",
    tag: "habito-vencimento",
    channel: "push",
    active: true,
    cooldownHours: 24,
    maxLifetimeSends: null,
    preferredHourStart: 8,
    preferredHourEnd: 20,
    allowedDaysOfWeek: null,
    preferenceCategory: "vencimentos",
  },
  {
    slug: "habito_inicio_mes",
    name: "Início do mês",
    block: "habito",
    description: "Entre dia 1-3 do mês: incentiva atualização do PeJota.",
    priority: "medium",
    title: "Mês novo, vida organizada 🗓️",
    message: "Antes da rotina pegar, atualiza o PeJota. 5 minutos e o mês começa redondo.",
    route: "/dashboard",
    tag: "habito-mes",
    channel: "push",
    active: true,
    cooldownHours: 24 * 28,
    maxLifetimeSends: null,
    preferredHourStart: 8,
    preferredHourEnd: 19,
    allowedDaysOfWeek: null,
    preferenceCategory: "lembretes",
  },
];

// ─────────────────────────────────────────────
// BLOCO 3 — ALERTAS
// ─────────────────────────────────────────────

const alertas: NotificationDefinition[] = [
  {
    slug: "alerta_orcamento_limite",
    name: "Orçamento próximo do limite",
    block: "alerta",
    description: "Gasto acima de 80% do orçamento definido no mês.",
    priority: "high",
    title: "Orçamento apertando ⚠️",
    message: "Você tá chegando no limite do mês. Vale revisar antes que estoure.",
    route: "/dashboard/renda-despesas",
    tag: "alerta-orcamento",
    channel: "push",
    active: true,
    cooldownHours: 24 * 7,
    maxLifetimeSends: null,
    preferredHourStart: 10,
    preferredHourEnd: 20,
    allowedDaysOfWeek: null,
    preferenceCategory: "alertas",
  },
  {
    slug: "alerta_categoria_fora_padrao",
    name: "Categoria fora do padrão",
    block: "alerta",
    description: "Categoria com gasto 30% maior que a média dos últimos 3 meses.",
    priority: "medium",
    title: "Categoria fora do padrão 📊",
    message: "Seus gastos com {categoria} ficaram bem acima da média esse mês. Vale revisar.",
    route: "/dashboard/analises",
    tag: "alerta-categoria",
    channel: "push",
    active: true,
    cooldownHours: 24 * 28,
    maxLifetimeSends: null,
    preferredHourStart: 10,
    preferredHourEnd: 20,
    allowedDaysOfWeek: null,
    preferenceCategory: "alertas",
  },
  {
    slug: "alerta_planejamento_desatualizado",
    name: "Planejamento desatualizado",
    block: "alerta",
    description: "Dados principais sem atualização há 7+ dias.",
    priority: "medium",
    title: "Plano envelheceu? 🔄",
    message: "Tá um tempo sem atualizar. Dá uma olhada se ainda reflete sua vida.",
    route: "/dashboard",
    tag: "alerta-desatualizado",
    channel: "push",
    active: true,
    cooldownHours: 24 * 7,
    maxLifetimeSends: null,
    preferredHourStart: 10,
    preferredHourEnd: 20,
    allowedDaysOfWeek: null,
    preferenceCategory: "alertas",
  },
  {
    slug: "alerta_saldo_negativo",
    name: "Saldo negativo previsto",
    block: "alerta",
    description: "Projeção do mês indica saldo negativo ou insuficiência.",
    priority: "high",
    title: "Saldo apertando ⚠️",
    message: "Continuando assim, o mês pode fechar negativo. Vale uma olhada agora.",
    route: "/dashboard/controledajornada",
    tag: "alerta-saldo",
    channel: "push",
    active: true,
    cooldownHours: 24 * 7,
    maxLifetimeSends: null,
    preferredHourStart: 10,
    preferredHourEnd: 20,
    allowedDaysOfWeek: null,
    preferenceCategory: "alertas",
  },
  {
    slug: "alerta_conta_importante",
    name: "Conta importante próxima",
    block: "alerta",
    description: "Despesa relevante por valor com vencimento próximo.",
    priority: "high",
    title: "Conta grande no caminho 💸",
    message: "Tem uma despesa relevante chegando. Pode valer organizar o caixa antes.",
    route: "/dashboard/renda-despesas",
    tag: "alerta-conta-importante",
    channel: "push",
    active: true,
    cooldownHours: 24 * 7,
    maxLifetimeSends: null,
    preferredHourStart: 10,
    preferredHourEnd: 20,
    allowedDaysOfWeek: null,
    preferenceCategory: "alertas",
  },
  {
    slug: "alerta_reserva_baixa",
    name: "Reserva de emergência baixa",
    block: "alerta",
    description: "Reserva cobre menos de 3 meses de despesas.",
    priority: "medium",
    title: "Reserva precisa de reforço 💰",
    message: "Sua emergência tá abaixo do recomendado. Vale pensar em subir os aportes.",
    route: "/dashboard/investimentos",
    tag: "alerta-reserva",
    channel: "push",
    active: true,
    cooldownHours: 24 * 30,
    maxLifetimeSends: null,
    preferredHourStart: 10,
    preferredHourEnd: 20,
    allowedDaysOfWeek: null,
    preferenceCategory: "alertas",
  },
];

// ─────────────────────────────────────────────
// BLOCO 4 — REATIVAÇÃO
// ─────────────────────────────────────────────

const reativacao: NotificationDefinition[] = [
  {
    slug: "reativacao_3_dias",
    name: "Inativo 3 dias",
    block: "reativacao",
    description: "Usuário não acessou o PeJota nos últimos 3 dias.",
    priority: "low",
    title: "3 dias sem dar oi 👀",
    message: "Seu PeJota tá esperando. 5 minutos resolve a saudade.",
    route: "/dashboard",
    tag: "reativacao",
    channel: "push",
    active: true,
    cooldownHours: 24 * 14,
    maxLifetimeSends: 1,
    preferredHourStart: 10,
    preferredHourEnd: 19,
    allowedDaysOfWeek: null,
    preferenceCategory: "novidades",
  },
  {
    slug: "reativacao_7_dias",
    name: "Inativo 7 dias",
    block: "reativacao",
    description: "Usuário não acessou o PeJota nos últimos 7 dias.",
    priority: "medium",
    title: "Uma semana sem você 👋",
    message: "Plano só funciona com acompanhamento. Bora retomar?",
    route: "/dashboard",
    tag: "reativacao",
    channel: "push",
    active: true,
    cooldownHours: 24 * 14,
    maxLifetimeSends: 1,
    preferredHourStart: 10,
    preferredHourEnd: 19,
    allowedDaysOfWeek: null,
    preferenceCategory: "novidades",
  },
  {
    slug: "reativacao_14_dias",
    name: "Inativo 14 dias",
    block: "reativacao",
    description: "Usuário não acessou o PeJota nos últimos 14 dias.",
    priority: "medium",
    title: "Tá ficando longe... ⌛",
    message: "Cada semana sem dar uma olhada, mais difícil retomar. 5 minutos hoje resolve.",
    route: "/dashboard",
    tag: "reativacao",
    channel: "push",
    active: true,
    cooldownHours: 24 * 21,
    maxLifetimeSends: 1,
    preferredHourStart: 10,
    preferredHourEnd: 19,
    allowedDaysOfWeek: null,
    preferenceCategory: "novidades",
  },
  {
    slug: "reativacao_30_dias",
    name: "Inativo 30 dias",
    block: "reativacao",
    description: "Usuário não acessou o PeJota nos últimos 30 dias.",
    priority: "low",
    title: "Seu PeJota continua aqui ⏳",
    message: "Um mês fora, mas seus dados tão prontos. 5 minutos e você retoma.",
    route: "/dashboard",
    tag: "reativacao",
    channel: "push",
    active: true,
    cooldownHours: 24 * 30,
    maxLifetimeSends: 2,
    preferredHourStart: 10,
    preferredHourEnd: 19,
    allowedDaysOfWeek: null,
    preferenceCategory: "novidades",
  },
  {
    slug: "reativacao_engajado",
    name: "Usuário engajado esfriou",
    block: "reativacao",
    description: "Usuário que tinha boa frequência e ficou inativo.",
    priority: "medium",
    title: "Você tava em ritmo 🚀",
    message: "Pena perder o ritmo agora. Bora retomar de onde parou?",
    route: "/dashboard",
    tag: "reativacao-engajado",
    channel: "push",
    active: true,
    cooldownHours: 24 * 30,
    maxLifetimeSends: 1,
    preferredHourStart: 10,
    preferredHourEnd: 19,
    allowedDaysOfWeek: null,
    preferenceCategory: "novidades",
  },
];

// ─────────────────────────────────────────────
// BLOCO 5 — VALOR / INSIGHTS
// ─────────────────────────────────────────────

const insights: NotificationDefinition[] = [
  {
    slug: "insight_score_subiu",
    name: "PeJota Score subiu",
    block: "insight",
    description: "Score do PeJota subiu em relação ao mês anterior.",
    priority: "low",
    title: "Score subiu! 🏆",
    message: "Seu PeJota Score melhorou esse mês. Mantém o ritmo que os objetivos vêm.",
    route: "/dashboard",
    tag: "insight-score",
    channel: "push",
    active: true,
    cooldownHours: 24 * 28,
    maxLifetimeSends: null,
    preferredHourStart: 10,
    preferredHourEnd: 19,
    allowedDaysOfWeek: null,
    preferenceCategory: "insights",
  },
  {
    slug: "insight_economia_boa",
    name: "Taxa de poupança boa",
    block: "insight",
    description: "Usuário poupou 20%+ da renda no mês.",
    priority: "low",
    title: "Disciplina top 🎉",
    message: "Você poupou mais de 20% da renda esse mês. Tá no caminho da liberdade.",
    route: "/dashboard/analises",
    tag: "insight-poupanca",
    channel: "push",
    active: true,
    cooldownHours: 24 * 28,
    maxLifetimeSends: null,
    preferredHourStart: 10,
    preferredHourEnd: 19,
    allowedDaysOfWeek: null,
    preferenceCategory: "insights",
  },
  {
    slug: "insight_relatorio_pronto",
    name: "Relatório pronto",
    block: "insight",
    description: "Resumo financeiro disponível para visualização.",
    priority: "low",
    title: "Resumo do mês saiu 📋",
    message: "Seu resumo financeiro tá pronto. Pode ter insight importante esperando.",
    route: "/dashboard/guiadajornada",
    tag: "insight-relatorio",
    channel: "push",
    active: true,
    cooldownHours: 24 * 28,
    maxLifetimeSends: null,
    preferredHourStart: 10,
    preferredHourEnd: 19,
    allowedDaysOfWeek: null,
    preferenceCategory: "insights",
  },
  {
    slug: "insight_atualizar_relatorios",
    name: "Atualizar relatórios",
    block: "insight",
    description: "Dados mudaram e relatórios precisam ser atualizados.",
    priority: "low",
    title: "Hora dos relatórios 📊",
    message: "Atualiza no PeJota e vê o impacto real das suas decisões esse mês.",
    route: "/dashboard/guiadajornada",
    tag: "insight-atualizar",
    channel: "push",
    active: true,
    cooldownHours: 24 * 7,
    maxLifetimeSends: null,
    preferredHourStart: 10,
    preferredHourEnd: 19,
    allowedDaysOfWeek: null,
    preferenceCategory: "insights",
  },
  {
    slug: "insight_dica_util",
    name: "Insight útil",
    block: "insight",
    description: "Dado consolidado ou mudança importante detectada.",
    priority: "low",
    title: "Dica rápida do PeJota 💡",
    message: "Pequenos ajustes hoje evitam dor de cabeça grande depois.",
    route: "/dashboard/analises",
    tag: "insight-dica",
    channel: "push",
    active: true,
    cooldownHours: 24 * 14,
    maxLifetimeSends: null,
    preferredHourStart: 10,
    preferredHourEnd: 19,
    allowedDaysOfWeek: null,
    preferenceCategory: "insights",
  },
  {
    slug: "insight_novidade_produto",
    name: "Novidade do produto",
    block: "insight",
    description: "Nova funcionalidade relevante disponibilizada.",
    priority: "low",
    title: "Novidade no PeJota ✨",
    message: "Tem feature nova que pode mudar como você organiza. Dá uma olhada.",
    route: "/dashboard",
    tag: "insight-novidade",
    channel: "push",
    active: false, // only activated manually when there's a real release
    cooldownHours: 24 * 30,
    maxLifetimeSends: null,
    preferredHourStart: 10,
    preferredHourEnd: 19,
    allowedDaysOfWeek: null,
    preferenceCategory: "novidades",
  },
];

// ─────────────────────────────────────────────
// FULL CATALOG
// ─────────────────────────────────────────────

export const NOTIFICATION_CATALOG: NotificationDefinition[] = [
  ...onboarding,
  ...habito,
  ...alertas,
  ...reativacao,
  ...insights,
];

/** Quick lookup by slug */
export const NOTIFICATION_MAP = new Map(
  NOTIFICATION_CATALOG.map((n) => [n.slug, n])
);

/** All preference categories used in the catalog */
export const PREFERENCE_CATEGORIES = [
  { key: "onboarding", label: "Onboarding e primeiros passos" },
  { key: "lembretes", label: "Lembretes financeiros" },
  { key: "vencimentos", label: "Vencimentos de contas" },
  { key: "alertas", label: "Alertas e avisos" },
  { key: "novidades", label: "Novidades e reativação" },
  { key: "insights", label: "Insights e conquistas" },
] as const;
