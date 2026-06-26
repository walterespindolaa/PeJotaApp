import type { Course } from "./types";

export const CURSO_ORGANIZACAO: Course = {
  slug: "organizacao",
  title: "Organização na Prática",
  subtitle: "Organização Atlas",
  description:
    "Como usar o Atlas no dia a dia. Rituais diários, semanais e mensais que transformam o app em hábito e te dão clareza sobre pra onde vai o seu dinheiro. Em 30 dias seguindo o curso, você sai com controle real do seu mês.",
  requiredPlan: "essencial",
  featureKey: "curso_organizacao",
  iconName: "ListChecks",
  accentColor: "text-blue-600",
  modules: [
    {
      number: 0,
      title: "Antes de começar",
      subtitle: "A mentalidade certa pra não desistir na semana 2.",
      iconName: "Compass",
      lessons: [
        { number: "0.1", title: "Por que organizar antes de qualquer outra coisa", description: "O Atlas é um mapa, não um piloto automático. Quem organiza primeiro constrói a base pra tudo que vem depois.", duration: 3, format: "camera", hasExercise: false, videoUrl: "https://iframe.mediadelivery.net/embed/662798/69f0e92b-1c3a-4905-a0c3-34f3d0eb1d3e" },
        { number: "0.2", title: "O que você vai conseguir em 30 dias", description: "Semana a semana, o que muda quando você segue os rituais do curso.", duration: 2, format: "camera", hasExercise: false, videoUrl: "https://iframe.mediadelivery.net/embed/662798/f2de9d27-4a91-4fcb-ac43-afee044655b0" },
      ],
    },
    {
      number: 1,
      title: "Setup inicial",
      subtitle: "Da casa vazia à casa funcional em 30 minutos.",
      iconName: "Settings",
      lessons: [
        { number: "1.1", title: "Cadastrando você e seu casal (ou sozinho) no Atlas", description: "Como configurar a família pra que o Atlas mostre dados relevantes pro seu contexto.", duration: 2, format: "mix", hasExercise: true, videoUrl: "https://iframe.mediadelivery.net/embed/662798/3c6e7726-5bb3-4461-aa16-73c3ac516c06" },
        { number: "1.2", title: "As categorias padrão: use antes de customizar", description: "Por que começar com as 8 categorias padrão é melhor que inventar 40 no primeiro mês.", duration: 2, format: "mix", hasExercise: false, videoUrl: "https://iframe.mediadelivery.net/embed/662798/c490c5dc-1afe-4cf2-825f-9527595d4661" },
        { number: "1.3", title: "Importar extrato OFX ou lançar manual: como decidir", description: "Quando cada método funciona melhor. Spoiler: manual diário vence depois do setup.", duration: 3, format: "mix", hasExercise: true, videoUrl: "https://iframe.mediadelivery.net/embed/662798/4072ba59-19c5-42a7-9768-8a8d034ffbfd" },
        { number: "1.4", title: "Definindo seu primeiro orçamento sem chutar", description: "Método de 3 passos pra montar orçamento em dados reais, não em fantasia.", duration: 3, format: "mix", hasExercise: true, videoUrl: "https://iframe.mediadelivery.net/embed/662798/29efdd30-2181-4662-ac1e-645dc6958a40" },
      ],
    },
    {
      number: 2,
      title: "O ritual diário",
      subtitle: "90 segundos por dia. O hábito que mantém tudo em pé.",
      iconName: "Sun",
      lessons: [
        { number: "2.1", title: "90 segundos por dia: a rotina que mantém tudo em pé", description: "Gatilho fixo + lançamento no dia = hábito que dura. A mágica está em nunca reconstruir depois.", duration: 2, format: "mix", hasExercise: true, videoUrl: "https://iframe.mediadelivery.net/embed/662798/05662ead-1071-4dd4-b3be-22cd2e4bedf8" },
        { number: "2.2", title: "O que NÃO fazer (o erro do obsessivo)", description: "Organização financeira é maratona, não tiro. Excesso mata o hábito.", duration: 2, format: "camera", hasExercise: false, videoUrl: "https://iframe.mediadelivery.net/embed/662798/c1defcb5-f540-4f04-ad8f-0a216f5182db" },
        { number: "2.3", title: "Atlas Chat: quando pedir ajuda ao invés de pensar sozinho", description: "O chat é consultor dentro do app. Use pra dúvida rápida no meio do dia.", duration: 2, format: "mix", hasExercise: false, videoUrl: "https://iframe.mediadelivery.net/embed/662798/40f9e806-ff44-4289-a903-2528c2e335f1" },
      ],
    },
    {
      number: 3,
      title: "O ritual semanal",
      subtitle: "10 minutos no domingo. A diferença entre organizar e só lançar dados.",
      iconName: "CalendarDays",
      lessons: [
        { number: "3.1", title: "Revisão dominical de 10 minutos: o que olhar", description: "4 passos que transformam dado em decisão antes da segunda-feira começar.", duration: 3, format: "mix", hasExercise: true, videoUrl: "https://iframe.mediadelivery.net/embed/662798/495838c4-951a-409d-8fd1-ee988798f8cf" },
        { number: "3.2", title: "Lendo a aba Análises como um mapa, não como um boletim", description: "Como interpretar sem se culpar. A pergunta certa é sempre a que pede ação, não julgamento.", duration: 3, format: "mix", hasExercise: false, videoUrl: "https://iframe.mediadelivery.net/embed/662798/e7c9d0d3-7581-42fd-8d3d-ee6525abc423" },
      ],
    },
    {
      number: 4,
      title: "O ritual mensal",
      subtitle: "Onde a organização vira estratégia.",
      iconName: "CalendarRange",
      lessons: [
        { number: "4.1", title: "O fechamento do mês: checklist completo", description: "Checklist de 5 etapas pra fechar o mês em 15 minutos. Material complementar: PDF baixável.", duration: 3, format: "mix", hasExercise: true, videoUrl: "https://iframe.mediadelivery.net/embed/662798/43f09635-4169-463e-a7a7-dfa3d38b0923" },
        { number: "4.2", title: "Orçamento vs Realizado: por que estourou e o que fazer", description: "As 3 causas reais de estouro. Diagnóstico define remédio.", duration: 3, format: "mix", hasExercise: false, videoUrl: "https://iframe.mediadelivery.net/embed/662798/d8f9448d-6b04-4843-9f2e-bac51a2038ec" },
        { number: "4.3", title: "Ajustando o próximo mês com base no que aconteceu", description: "Regra do pequeno ajuste: mude 1 ou 2 valores por mês. Em 12 meses, orçamento cirurgicamente seu.", duration: 2, format: "mix", hasExercise: true, videoUrl: "https://iframe.mediadelivery.net/embed/662798/b576d669-1312-43a1-8d47-277840d408ab" },
      ],
    },
    {
      number: 5,
      title: "Casos reais",
      subtitle: "Três situações que acontecem com todo mundo. Como o Atlas ajuda.",
      iconName: "MessageSquare",
      lessons: [
        { number: "5.1", title: "Passei do orçamento no dia 15 do mês", description: "3 caminhos possíveis: apertar, realocar ou aceitar. Quando usar cada um.", duration: 2, format: "camera", hasExercise: false, videoUrl: "https://iframe.mediadelivery.net/embed/662798/da5d7c67-1e22-44bd-a1ad-400224502aa6" },
        { number: "5.2", title: "Chegou um dinheiro extra — o que fazer?", description: "A regra 50/30/20 do extra. Guardar, decidir, aliviar. Sem a gaveta pro futuro, extra vira lembrança.", duration: 2, format: "mix", hasExercise: false, videoUrl: "https://iframe.mediadelivery.net/embed/662798/d5868c79-38f2-4a6a-843d-38e5437a5746" },
        { number: "5.3", title: "Meu casal discorda sobre um gasto", description: "O Atlas não resolve, mas vira árbitro neutro. Ritual mensal de 30 minutos que muda a dinâmica.", duration: 3, format: "camera", hasExercise: false, videoUrl: "https://iframe.mediadelivery.net/embed/662798/5e738a11-4df0-4ec8-a4f9-a091a2910aab" },
      ],
    },
    {
      number: 6,
      title: "Atlas Negócios (para PJ)",
      subtitle: "Opcional. Pra quem tem PJ e quer separar de verdade.",
      iconName: "Briefcase",
      lessons: [
        { number: "6.1", title: "Quando separar PJ e PF no Atlas", description: "Se é MEI simples, você pode não precisar. Se tem movimentação real, separar é obrigatório.", duration: 2, format: "mix", hasExercise: false, videoUrl: "https://iframe.mediadelivery.net/embed/662798/6d6911d5-a766-47b6-9433-3cbe6bc90b73" },
        { number: "6.2", title: "Fechamento de mês da empresa: o que muda", description: "Receita prevista vs confirmada, timing diferente do pessoal, e a regra de nunca duplicar transferências.", duration: 3, format: "mix", hasExercise: true, videoUrl: "https://iframe.mediadelivery.net/embed/662798/31783b3b-ab9b-441b-b662-bf03a7dfbb3e" },
      ],
    },
  ],
};

export const CURSO_PLANEJAMENTO: Course = {
  slug: "planejamento",
  title: "Planejamento Financeiro",
  subtitle: "Planejamento Atlas",
  description:
    "Seu plano de década, escrito como um consultor escreveria. Diagnóstico, objetivos priorizados, reserva dimensionada, simulador de aposentadoria rodado, rituais de revisão agendados. Em 20 aulas você sai com plano executável e revisável.",
  requiredPlan: "pro",
  featureKey: "planejamento_financeiro_curso",
  iconName: "Compass",
  accentColor: "text-amber-600",
  modules: [
    {
      number: 0,
      title: "Mentalidade do Planejador",
      subtitle: "Orçamento é tático. Planejamento é estratégico.",
      iconName: "Brain",
      lessons: [
        { number: "0.1", title: "Diferença entre orçamento e planejamento", description: "Orçamento é o volante. Planejamento é o destino. Dirigir sem destino te faz rodar em círculo eficiente.", duration: 4, format: "camera", hasExercise: false, videoUrl: "" },
        { number: "0.2", title: "Por que a maioria erra no horizonte", description: "A regra dos 3 horizontes: curto (0-2 anos), médio (3-10), longo (10+). Ignorar um deles sabota os outros.", duration: 4, format: "camera", hasExercise: false, videoUrl: "" },
      ],
    },
    {
      number: 1,
      title: "Seu Diagnóstico Base",
      subtitle: "Antes de desenhar pra onde ir, entender de onde você está.",
      iconName: "SearchCheck",
      lessons: [
        { number: "1.1", title: "Lendo a Análise Atlas como um consultor lê", description: "A ordem certa de leitura: tendência, composição, alarmes. Uma pergunta no fim: o que destrava mais valor?", duration: 5, format: "mix", hasExercise: true, videoUrl: "" },
        { number: "1.2", title: "Identificando seus 3 gargalos principais", description: "Receita, despesa, alocação. Descobrir qual domina o seu caso é o insight central do curso inteiro.", duration: 5, format: "mix", hasExercise: true, videoUrl: "" },
        { number: "1.3", title: "Escrevendo sua foto do presente em uma página", description: "Template de 5 seções que um consultor usa. Uma página é a regra, não sugestão.", duration: 4, format: "camera", hasExercise: true, videoUrl: "" },
      ],
    },
    {
      number: 2,
      title: "Construindo Objetivos",
      subtitle: "Transformar sonho em plano. Com conta e priorização.",
      iconName: "Target",
      lessons: [
        { number: "2.1", title: "Curto, médio e longo prazo: como separar", description: "Cada horizonte pede estratégia diferente — liquidez, volatilidade tolerada, tipo de ativo.", duration: 4, format: "camera", hasExercise: false, videoUrl: "" },
        { number: "2.2", title: "Calculando aporte necessário (e sendo honesto)", description: "A conta que quase ninguém faz: valor-alvo × prazo × rentabilidade = aporte real. Soma tudo e compara com a sobra.", duration: 5, format: "mix", hasExercise: true, videoUrl: "" },
        { number: "2.3", title: "Priorização: quando você não pode ter tudo", description: "A hierarquia inevitável: reserva > longo > médio > curto. Prefira completar 3 a tentar 6 pela metade.", duration: 4, format: "camera", hasExercise: false, videoUrl: "" },
        { number: "2.4", title: "Registrando objetivos no Atlas sem furar depois", description: "As 3 armadilhas: dinheiro visível, valor-alvo redondo, objetivo sem data. Como configurar pra se defender de si mesmo.", duration: 5, format: "mix", hasExercise: true, videoUrl: "" },
      ],
    },
    {
      number: 3,
      title: "Reserva e Proteção",
      subtitle: "Proteger o presente antes de olhar pra frente.",
      iconName: "ShieldCheck",
      lessons: [
        { number: "3.1", title: "Quanto de reserva você precisa", description: "A regra dos 6 meses é simplificação. Seu múltiplo depende de custo essencial × estabilidade × estrutura familiar.", duration: 5, format: "camera", hasExercise: false, videoUrl: "" },
        { number: "3.2", title: "Onde guardar a reserva (e por que não é poupança)", description: "2 critérios não-negociáveis: liquidez alta, zero oscilação. Split sugerido em 2 blocos.", duration: 4, format: "mix", hasExercise: false, videoUrl: "" },
        { number: "3.3", title: "Seguros: só o essencial, sem venda", description: "Os 4 essenciais (saúde, vida, invalidez, residencial). O que corretor adora vender e você provavelmente não precisa.", duration: 4, format: "camera", hasExercise: true, videoUrl: "" },
      ],
    },
    {
      number: 4,
      title: "Aposentadoria no Atlas",
      subtitle: "Não é cálculo de milhões. É decisão de hoje sobre o futuro.",
      iconName: "Mountain",
      lessons: [
        { number: "4.1", title: "Quanto você precisa para se aposentar", description: "A regra dos 4%: custo anual × 25 = patrimônio necessário. Calibração realista em 70% do gasto atual.", duration: 5, format: "camera", hasExercise: false, videoUrl: "" },
        { number: "4.2", title: "Usando o simulador do Atlas sem se assustar", description: "Preencher com dados reais, ler os 3 cenários possíveis. O simulador não deprime — mostra onde você está.", duration: 5, format: "mix", hasExercise: true, videoUrl: "" },
        { number: "4.3", title: "Aporte mensal vs herança vs imóvel: cenários reais", description: "A verdade dura sobre as 3 narrativas que as pessoas usam pra fugir do aporte. Cada uma tem armadilha.", duration: 5, format: "camera", hasExercise: false, videoUrl: "" },
        { number: "4.4", title: "Revisando o plano quando a vida muda", description: "5 eventos que forçam revisão. 3 passos pra revisar sem entrar em crise.", duration: 4, format: "camera", hasExercise: false, videoUrl: "" },
      ],
    },
    {
      number: 5,
      title: "Rituais de Revisão",
      subtitle: "Plano sem revisão vira ficção.",
      iconName: "RefreshCw",
      lessons: [
        { number: "5.1", title: "Revisão trimestral: o que olhar e o que ignorar", description: "Checklist de 5 blocos em 90 minutos, 4 vezes por ano. Material complementar: PDF baixável.", duration: 5, format: "mix", hasExercise: true, videoUrl: "" },
        { number: "5.2", title: "Revisão anual: quando reescrever o plano", description: "Revisão anual não é ajuste, é reescrita. Refazer a foto do presente, redesenhar objetivos e aposentadoria.", duration: 5, format: "mix", hasExercise: false, videoUrl: "" },
        { number: "5.3", title: "Usando a Análise Atlas como agenda da revisão", description: "Os 6 blocos da Análise Atlas na ordem certa = roteiro pronto de revisão. Economia de tempo + qualidade.", duration: 4, format: "mix", hasExercise: false, videoUrl: "" },
      ],
    },
    {
      number: 6,
      title: "Quando procurar um consultor humano",
      subtitle: "Honestidade. Atlas resolve a maioria, mas não tudo.",
      iconName: "Users",
      lessons: [
        { number: "6.1", title: "Sinais de que você passou do que o Atlas resolve sozinho", description: "6 sinais concretos + o que não justifica consultor. Antes disso, 90 dias praticando os rituais.", duration: 5, format: "camera", hasExercise: false, videoUrl: "" },
      ],
    },
  ],
};

const COURSES_BY_SLUG: Record<string, Course> = {
  [CURSO_ORGANIZACAO.slug]: CURSO_ORGANIZACAO,
  [CURSO_PLANEJAMENTO.slug]: CURSO_PLANEJAMENTO,
};

export function getCourseBySlug(slug: string): Course | undefined {
  return COURSES_BY_SLUG[slug];
}
