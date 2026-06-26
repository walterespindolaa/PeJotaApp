import { Card, CardContent } from "@/components/ui/card";
import {
  Wallet, PlayCircle, ChevronDown, BarChart3, CalendarDays,
  TrendingUp, Target, Mountain, Users, Sparkles, Building2, GraduationCap,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface GuideSection {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  topics: string[];
  videoCount?: number;
  badge?: string;
}

const TUTORIAL_LIBRARY = "679064";

const VIDEO_GUIDS: Record<string, string> = {
  "boas-vindas": "465ac468-9dc9-4111-b9f7-bc751b17bf43",
  "configuracao": "e20aab5c-865c-4d4e-a6ab-10f85475282c",
  "lancamentos": "7ede0cd6-e090-4ebc-b6b3-7e3493b7580b",
  "calendario-fluxo": "5f6e7658-c626-44fb-8330-efd9a08fff3a",
  "analises-chat": "2bd4927a-ed2a-4d38-a8ba-036b9b8b97fc",
  "planejamento-estrategico": "a0838180-c05c-44d9-91b9-4c9b5ebf7fd0",
  "planejamento-financeiro": "895f0df6-99e4-4d2f-acba-daa0946308a5",
  "metodo-atlas": "b1527fb0-25ee-4f34-ba40-801c57a10f81",
  "negocios": "22071d36-42e8-49cd-8ce1-16f48a19f4da",
  "educacao": "c9b64647-c3e9-4d1f-9123-dcc6a9f420ba",
};

function tutorialEmbed(id: string): string | undefined {
  const guid = VIDEO_GUIDS[id];
  return guid ? `https://iframe.mediadelivery.net/embed/${TUTORIAL_LIBRARY}/${guid}` : undefined;
}

const SECTIONS: GuideSection[] = [
  {
    id: "boas-vindas",
    title: "Bem-vindo ao PeJota",
    icon: Sparkles,
    description: "O que é o PeJota — seu segundo cérebro financeiro — e como aproveitar o tutorial.",
    topics: ["O que o PeJota resolve", "Os três planos: Essencial, Pro e Elite", "Por onde começar"],
  },
  {
    id: "configuracao",
    title: "Configurando sua família",
    icon: Users,
    description: "Cadastre as pessoas da casa e use o seletor de visão Pessoa 1 / Pessoa 2 / Casal.",
    topics: ["Menu Família → Membros", "Seletor Pessoa 1 / Pessoa 2 / Casal", "Família → Tema (claro/escuro)"],
  },
  {
    id: "lancamentos",
    title: "Lançando o dia a dia",
    icon: Wallet,
    description: "As 8 abas do Planejamento e Controle e como registrar tudo do mês.",
    topics: ["Geral, Orçamento, Receitas, Fixas, Variáveis, Parcelas, Dívidas, Economias", "Campo Responsável", "FAB Lançamento rápido"],
  },
  {
    id: "calendario-fluxo",
    title: "Calendário e Fluxo de Caixa",
    icon: CalendarDays,
    description: "Veja o mês organizado no tempo e importe extratos OFX.",
    topics: ["Calendário de Pagamentos", "Fluxo de Caixa: Lançamentos · Bancos & Extratos · Importação", "Import de OFX"],
    badge: "Fluxo = Pro",
  },
  {
    id: "analises-chat",
    title: "Análises e PeJota Chat",
    icon: BarChart3,
    description: "PeJota Score, a tela de Análises e o assistente que conhece seus dados.",
    topics: ["PeJota Score (7 pilares)", "Análises: KPIs, Diagnóstico, Para Onde Vai…", "PeJota Chat"],
  },
  {
    id: "planejamento-estrategico",
    title: "Planejamento Estratégico",
    icon: Target,
    description: "Teste decisões grandes antes de tomá-las.",
    topics: ["Simulador de Decisão (8 cenários) + análise por IA", "Consórcio x Financiamento", "Express Aposentadoria/Objetivos (Pro)"],
  },
  {
    id: "planejamento-financeiro",
    title: "Planejamento Financeiro",
    icon: TrendingUp,
    description: "Aposentadoria, Objetivos, Investimentos, Bens, Seguros e a Análise PeJota.",
    topics: ["Aposentadoria (3 cenários)", "Objetivos de Vida", "Investimentos", "Bens e Imóveis", "Proteção e Seguros", "Análise PeJota"],
    badge: "Pro",
  },
  {
    id: "metodo-atlas",
    title: "Método PeJota",
    icon: Mountain,
    description: "Os 5 relatórios estratégicos — 4 gerados por IA sobre seus dados.",
    topics: ["Vista da Montanha", "Base da Montanha", "Estratégia de Subida", "Controle da Jornada", "Guia da Jornada"],
    badge: "Pro",
  },
  {
    id: "negocios",
    title: "PeJota Negócios",
    icon: Building2,
    description: "Financeiro PJ separado e conectado ao pessoal.",
    topics: ["Múltiplas empresas", "Regras de alocação", "Previsão de caixa e simulador", "Clientes: Receita Prevista vs Confirmada", "Histórico PJ→PF", "Score de saúde da empresa"],
    badge: "Pro",
  },
  {
    id: "educacao",
    title: "Educação e fechamento",
    icon: GraduationCap,
    description: "Os cursos dentro do PeJota e por onde começar.",
    topics: ["Grupo Educação no menu", "Comece pelo Organização na Prática", "A estante cresce conforme o plano"],
  },
];

function VideoPlaceholder({ label }: { label?: string }) {
  return (
    <div className="relative w-full aspect-video rounded-xl bg-muted/80 flex items-center justify-center border border-border/30">
      <div className="text-center">
        <PlayCircle className="h-12 w-12 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground font-body">{label || "Vídeo em breve"}</p>
      </div>
    </div>
  );
}

function SectionCard({ section, index }: { section: GuideSection; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const videoSrc = tutorialEmbed(section.id);

  return (
    <Card className="border-border/40 rounded-2xl shadow-soft hover:shadow-md transition-all">
      <CardContent className="p-0">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center gap-4 p-5 text-left"
        >
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 flex-shrink-0">
            <section.icon className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-heading font-semibold">{index + 1}.</span>
              <h3 className="font-heading font-semibold text-sm">{section.title}</h3>
              {section.badge && (
                <span className="ml-2 text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                  {section.badge}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-body mt-0.5">{section.description}</p>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform flex-shrink-0", expanded && "rotate-180")} />
        </button>

        {expanded && (
          <div className="px-5 pb-5 space-y-3 animate-fade-in">
            {/* iframe montado só no card ativo (dentro do bloco expanded) — autoplay=false e lazy para não carregar 10 players juntos */}
            {videoSrc ? (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border/30 bg-black">
                <iframe
                  src={videoSrc + "?autoplay=false&loop=false&muted=false&preload=true&responsive=true&defaultQuality=720p"}
                  loading="lazy"
                  className="w-full h-full border-0"
                  allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;"
                  allowFullScreen
                  title={section.title}
                />
              </div>
            ) : (
              <VideoPlaceholder />
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-heading font-semibold mb-2">Tópicos abordados</p>
              <div className="flex flex-wrap gap-2">
                {section.topics.map((topic, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full bg-muted text-xs font-body text-muted-foreground">
                    {topic}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const ComecarPorAqui = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center space-y-4 pt-2">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
          <PlayCircle className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 font-heading font-semibold">
            Guia do PeJota
          </p>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Comece por aqui</h1>
        </div>
        <p className="text-sm text-muted-foreground font-body leading-relaxed max-w-xl mx-auto">
          Aqui você encontra vídeos curtos explicando como utilizar cada parte da plataforma. Se você está começando agora, recomendamos assistir os conteúdos em ordem.
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" /> {SECTIONS.length} aulas</span>
        </div>
      </div>

      <div className="space-y-3">
        {SECTIONS.map((section, i) => (
          <SectionCard key={section.id} section={section} index={i} />
        ))}
      </div>
    </div>
  );
};

export default ComecarPorAqui;
