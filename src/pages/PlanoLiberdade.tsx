import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUserRole } from "@/hooks/useUserRole";
import { useState, useCallback } from "react";
import {
  Compass, Rocket, BookOpen, Target, TrendingUp, Shield, Landmark,
  PiggyBank, CheckCircle2, Lock, ChevronDown, PlayCircle, Globe,
  Gift, Sparkles, Play, X,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Lesson { id: string; title: string; videoUrl: string; }
interface CourseModule {
  id: string; label: string; title: string; description: string;
  icon: React.ElementType; lessons: Lesson[]; isBonus?: boolean;
}

const MODULES: CourseModule[] = [
  {
    id: "mod0", label: "Módulo 0", title: "Boas-vindas", description: "Conheça o curso e como aproveitar ao máximo cada módulo.", icon: Rocket,
    lessons: [
      { id: "0-1", title: "Boas-vindas", videoUrl: "https://iframe.mediadelivery.net/embed/635986/18dcde28-0ba7-4f05-b9f7-bff3961f840a" },
    ],
  },
  {
    id: "mod1", label: "Módulo 1", title: "Mentalidade do Investidor Inteligente", description: "Por que a mentalidade vem antes da técnica e como evitar os vieses que sabotam seus resultados.", icon: BookOpen,
    lessons: [
      { id: "1-1", title: "Por que a maioria nunca enriquece", videoUrl: "https://iframe.mediadelivery.net/embed/635986/da199084-352d-45a2-a996-9c09cf8621a9" },
      { id: "1-2", title: "O cérebro que sabota seus investimentos", videoUrl: "https://iframe.mediadelivery.net/embed/635986/65a296a3-9b36-4ef8-ae95-dba1ae6e494e" },
      { id: "1-3", title: "O efeito manada e a coragem de ser diferente", videoUrl: "https://iframe.mediadelivery.net/embed/635986/d89f80b3-61c5-4195-89e7-2d68533cdd0d" },
      { id: "1-4", title: "O custo afundado", videoUrl: "https://iframe.mediadelivery.net/embed/635986/08405e0a-3a11-4dc9-ba3a-401e68117ab4" },
    ],
  },
  {
    id: "mod2", label: "Módulo 2", title: "Fundamentos da Liberdade Financeira", description: "Orçamento, reserva de emergência, previdência e o caminho para o primeiro milhão.", icon: Target,
    lessons: [
      { id: "2-1", title: "Orçamento sem complicação", videoUrl: "https://iframe.mediadelivery.net/embed/635986/c8f47f8d-049f-4b90-bbcd-972ba13dd62e" },
      { id: "2-2", title: "Reserva de emergência", videoUrl: "https://iframe.mediadelivery.net/embed/635986/cc914b32-4351-4145-98d2-ef103e51a20f" },
      { id: "2-3", title: "Previdência privada e financiamentos", videoUrl: "https://iframe.mediadelivery.net/embed/635986/c3651465-d80c-4ae2-9a2d-9aebce38b3da" },
      { id: "2-4", title: "Como chegar ao primeiro milhão", videoUrl: "https://iframe.mediadelivery.net/embed/635986/e5133fe3-e45c-4f20-8006-74d9deacdfaf" },
    ],
  },
  {
    id: "mod3", label: "Módulo 3", title: "Renda Fixa Descomplicada", description: "Tesouro Direto, CDB, LCI, LCA, fundos e como montar sua carteira de renda fixa.", icon: Landmark,
    lessons: [
      { id: "3-1", title: "O que é renda fixa", videoUrl: "https://iframe.mediadelivery.net/embed/635986/98dfd7cb-2651-4ebe-9ce1-c91c1e4d2c49" },
      { id: "3-2", title: "Tesouro Direto", videoUrl: "https://iframe.mediadelivery.net/embed/635986/74f85d18-7f04-4a44-b72b-b9cf292cf3ff" },
      { id: "3-3", title: "CDB, LCI, LCA e Fundos de Renda Fixa", videoUrl: "https://iframe.mediadelivery.net/embed/635986/b8f44df6-097c-42c4-b8cc-97786edc5dfd" },
      { id: "3-4", title: "O viés da ancoragem", videoUrl: "https://iframe.mediadelivery.net/embed/635986/f8f8fac6-bef5-4067-8857-8654b2a9595c" },
      { id: "3-5", title: "Como montar uma carteira de Renda Fixa", videoUrl: "https://iframe.mediadelivery.net/embed/635986/d169cd4b-d7f7-45d5-894f-6d286692821a" },
    ],
  },
  {
    id: "mod4", label: "Módulo 4", title: "ETFs e Fundos: o Método da Indexação Inteligente", description: "ETFs brasileiros e americanos, fundos tradicionais, infraestrutura e estratégia Core-Satellite.", icon: TrendingUp,
    lessons: [
      { id: "4-1", title: "O que é um ETF", videoUrl: "https://iframe.mediadelivery.net/embed/635986/6167819d-9fed-4cdb-a20d-82bffcf9c37a" },
      { id: "4-2", title: "Principais ETFs (Brasil e EUA)", videoUrl: "https://iframe.mediadelivery.net/embed/635986/6956821b-a7b4-4171-92f5-a35f621ea2bf" },
      { id: "4-3", title: "Fundos de Investimento Tradicionais", videoUrl: "https://iframe.mediadelivery.net/embed/635986/03218951-e6cf-4763-991f-51f8bc89c8d1" },
      { id: "4-4", title: "Fundos de Infraestrutura", videoUrl: "https://iframe.mediadelivery.net/embed/635986/71632a58-a8f7-413f-bfdf-a94e17b24635" },
      { id: "4-5", title: "Estratégia Core-Satellite com ETFs", videoUrl: "https://iframe.mediadelivery.net/embed/635986/e0bf4571-d36e-42a1-87d7-0ffbf38ec0a9" },
      { id: "4-6", title: "O viés de ação", videoUrl: "https://iframe.mediadelivery.net/embed/635986/d6e31edd-d1e0-455d-ac9d-4d2666707d31" },
    ],
  },
  {
    id: "mod5", label: "Módulo 5", title: "Alocação e Gestão de Carteira", description: "Estratégia de alocação, primeira carteira indexada, rotina mensal e portfólio permanente.", icon: PiggyBank,
    lessons: [
      { id: "5-1", title: "Estratégia de alocação de ativos", videoUrl: "https://iframe.mediadelivery.net/embed/635986/d1036268-8f03-4440-9ba5-11370e29622e" },
      { id: "5-2", title: "Primeira carteira indexada", videoUrl: "https://iframe.mediadelivery.net/embed/635986/fabe6053-9bc1-4d4a-829f-1a7f1becb9ec" },
      { id: "5-3", title: "Rotina mensal do investidor", videoUrl: "https://iframe.mediadelivery.net/embed/635986/c585d805-8d64-4d77-8613-8f59c05c245f" },
      { id: "5-4", title: "O portfólio permanente", videoUrl: "https://iframe.mediadelivery.net/embed/635986/5adc1f3f-f0a3-4f1a-926c-66d980ab2322" },
    ],
  },
  {
    id: "mod6", label: "Módulo 6", title: "Investindo no Exterior", description: "Por que e como investir fora do Brasil via ETFs, REITs, stocks e corretoras internacionais.", icon: Globe,
    lessons: [
      { id: "6-1", title: "Por que investir fora", videoUrl: "https://iframe.mediadelivery.net/embed/635986/cc9b9888-86c1-476a-ba45-995b1a82a2c2" },
      { id: "6-2", title: "ETFs, REITs e Stocks", videoUrl: "https://iframe.mediadelivery.net/embed/635986/a944bdea-ed6a-47a7-9e73-a0cbca12fb39" },
      { id: "6-3", title: "Como investir via corretora", videoUrl: "https://iframe.mediadelivery.net/embed/635986/f1daa084-9bab-48a3-a3f6-f0108abc8230" },
      { id: "6-4", title: "O cisne negro", videoUrl: "https://iframe.mediadelivery.net/embed/635986/b9df8b48-2ba7-41a1-92b7-6c545847a6df" },
    ],
  },
  {
    id: "mod7", label: "Módulo 7", title: "Plano de Ação e Consistência", description: "Checklist final, rebalanceamento, carteiras-modelo e por que a consistência vence a inteligência.", icon: Shield,
    lessons: [
      { id: "7-1", title: "Checklist final", videoUrl: "https://iframe.mediadelivery.net/embed/635986/3be1119e-cac3-46da-a5f1-e148ff8db417" },
      { id: "7-2", title: "O PeJota na sua jornada", videoUrl: "https://iframe.mediadelivery.net/embed/635986/0ddaaa55-e892-4128-8d4c-0b46e3914a4b" },
      { id: "7-3", title: "Rebalanceamento prático", videoUrl: "https://iframe.mediadelivery.net/embed/635986/a00110c1-7f9a-4613-94ca-168cc1c755dd" },
      { id: "7-4", title: "Carteiras-modelo", videoUrl: "https://iframe.mediadelivery.net/embed/635986/97b50251-687c-480d-afec-58a31b6e012c" },
      { id: "7-5", title: "Como o pessimismo empobrece", videoUrl: "https://iframe.mediadelivery.net/embed/635986/5646f53e-3cef-406b-89de-f5228764e407" },
    ],
  },
];

const STORAGE_KEY = "atlas_plano_liberdade_completed";

function useCompletedLessons() {
  const [completed, setCompleted] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });
  const toggle = useCallback((lessonId: string) => {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId); else next.add(lessonId);
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);
  return { completed, toggle };
}

// ─── Pre-launch module preview card ─────────────────
function PreviewModuleCard({ mod }: { mod: CourseModule }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className={cn(
      "rounded-2xl border-border/40 transition-all hover:shadow-md overflow-hidden",
      mod.isBonus && "border-accent/30 bg-gradient-to-br from-accent/3 to-transparent",
      !mod.isBonus && "bg-gradient-to-br from-primary/3 to-transparent",
    )}>
      <CardContent className="p-0">
        <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-4 p-5 text-left">
          <div className={cn(
            "flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0",
            mod.isBonus ? "bg-accent/10" : "bg-primary/10",
          )}>
            <mod.icon className={cn("h-5 w-5", mod.isBonus ? "text-accent" : "text-primary")} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Badge variant="outline" className={cn("text-[10px]", mod.isBonus && "border-accent/30 text-accent")}>{mod.label}</Badge>
              <span className="text-[10px] text-muted-foreground">{mod.lessons.length} aulas</span>
            </div>
            <h3 className="font-heading font-semibold text-sm">{mod.title}</h3>
            <p className="text-xs text-muted-foreground font-body mt-0.5 line-clamp-2">{mod.description}</p>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform flex-shrink-0", expanded && "rotate-180")} />
        </button>
        {expanded && (
          <div className="px-5 pb-5 space-y-1 animate-fade-in">
            {mod.lessons.map(lesson => (
              <div key={lesson.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/30 text-xs">
                <PlayCircle className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                <span className="font-body text-muted-foreground">{lesson.title}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Pre-launch screen ────────────────────────
function PreLaunchScreen() {
  const totalLessons = MODULES.flatMap(m => m.lessons).length;
  const mainModules = MODULES.filter(m => !m.isBonus);
  const bonusModules = MODULES.filter(m => m.isBonus);

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 animate-fade-in space-y-8">
      {/* Hero */}
      <div className="text-center space-y-4 pt-2">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
          <Compass className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 font-heading font-semibold">
            Investimentos PeJota
          </p>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Plano da Liberdade</h1>
        </div>
        <p className="text-sm text-muted-foreground font-body leading-relaxed max-w-xl mx-auto">
          O método completo para construir liberdade financeira. Mentalidade, renda fixa, ETFs, fundos, alocação de carteira e investimento internacional — tudo que você precisa pra investir com consistência.
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {MODULES.length - 1} módulos</span>
          <span className="flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" /> {totalLessons} aulas</span>
          <span className="flex items-center gap-1"><Gift className="h-3.5 w-3.5" /> Conteúdos bônus</span>
        </div>
      </div>

      {/* Estrutura do Curso */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold px-1 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" /> Estrutura do Curso
        </p>
        {mainModules.map(mod => (
          <PreviewModuleCard key={mod.id} mod={mod} />
        ))}
      </div>

      {bonusModules.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold px-1 flex items-center gap-2">
            <Gift className="h-3.5 w-3.5" /> Conteúdos bônus
          </p>
          {bonusModules.map(mod => (
            <PreviewModuleCard key={mod.id} mod={mod} />
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="text-center pt-4">
        <Button disabled size="lg" className="rounded-full gap-2 opacity-80">
          <Lock className="h-4 w-4" />
          Conteúdo disponível em breve
        </Button>
      </div>
    </div>
  );
}

// ─── Video player dialog ─────────────────
function VideoDialog({ lesson, open, onOpenChange }: { lesson: Lesson | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  if (!lesson) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden gap-0">
        <DialogHeader className="px-5 py-3 border-b border-border/40">
          <DialogTitle className="text-base font-heading font-semibold pr-8">{lesson.title}</DialogTitle>
        </DialogHeader>
        <div className="aspect-video bg-black">
          {lesson.videoUrl ? (
            <iframe
              src={lesson.videoUrl + "?autoplay=true&loop=false&muted=false&preload=true&responsive=true&defaultQuality=720p"}
              loading="lazy"
              className="w-full h-full border-0"
              allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;"
              allowFullScreen
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/60">
              <p className="text-sm">Vídeo em breve.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Active module card (admin) ─────────────────
function ModuleCard({ mod, completed, onToggle }: { mod: CourseModule; completed: Set<string>; onToggle: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const done = mod.lessons.filter(l => completed.has(l.id)).length;
  const total = mod.lessons.length;
  const allDone = done === total;

  return (
    <Card className={cn(
      "border-border/40 rounded-2xl transition-all hover:shadow-md",
      allDone && "bg-success/5 border-success/20",
      mod.isBonus && "border-accent/30",
    )}>
      <CardContent className="p-0">
        <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-4 p-5 text-left">
          <div className={cn(
            "flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0",
            allDone ? "bg-success/10" : mod.isBonus ? "bg-accent/10" : "bg-primary/10",
          )}>
            {allDone ? <CheckCircle2 className="h-5 w-5 text-success" /> : <mod.icon className={cn("h-5 w-5", mod.isBonus ? "text-accent" : "text-primary")} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("text-[10px]", mod.isBonus && "border-accent/30 text-accent")}>{mod.label}</Badge>
              <span className="text-[10px] text-muted-foreground">{done}/{total} aulas</span>
            </div>
            <h3 className="font-heading font-semibold text-sm mt-0.5">{mod.title}</h3>
          </div>
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform flex-shrink-0", expanded && "rotate-180")} />
        </button>
        {expanded && (
          <div className="px-5 pb-5 space-y-1.5 animate-fade-in">
            {mod.lessons.map(lesson => {
              const isDone = completed.has(lesson.id);
              const hasVideo = !!lesson.videoUrl;
              return (
                <div key={lesson.id} className={cn(
                  "flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all",
                  isDone ? "bg-success/5 border-success/20" : "bg-muted/30 border-border/30",
                )}>
                  <PlayCircle className={cn("h-4 w-4 flex-shrink-0", isDone ? "text-success" : "text-muted-foreground/50")} />
                  <span className={cn("text-sm font-body flex-1 min-w-0 truncate", isDone && "line-through text-muted-foreground")}>{lesson.title}</span>
                  {hasVideo && (
                    <Button
                      size="sm"
                      variant="default"
                      className="h-7 text-[11px] rounded-lg flex-shrink-0 gap-1"
                      onClick={e => { e.stopPropagation(); setActiveLesson(lesson); }}
                    >
                      <Play className="h-3 w-3" /> Assistir
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={isDone ? "ghost" : "outline"}
                    className={cn("h-7 text-[11px] rounded-lg flex-shrink-0", isDone && "text-success hover:text-success")}
                    onClick={e => { e.stopPropagation(); onToggle(lesson.id); }}
                  >
                    {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : "Concluída?"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <VideoDialog
        lesson={activeLesson}
        open={!!activeLesson}
        onOpenChange={(open) => { if (!open) setActiveLesson(null); }}
      />
    </Card>
  );
}

// ─── Main page ────────────────────────────────
const PlanoLiberdade = () => {
  const { isAdmin } = useUserRole();
  const { completed, toggle } = useCompletedLessons();

  if (!isAdmin) return <PreLaunchScreen />;

  const allLessons = MODULES.flatMap(m => m.lessons);
  const totalLessons = allLessons.length;
  const completedCount = allLessons.filter(l => completed.has(l.id)).length;
  const pct = totalLessons > 0 ? (completedCount / totalLessons) * 100 : 0;
  const mainModules = MODULES.filter(m => !m.isBonus);
  const bonusModules = MODULES.filter(m => m.isBonus);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center space-y-4 pt-2">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
          <Compass className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 font-heading font-semibold">
            Investimentos PeJota
          </p>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Plano da Liberdade</h1>
        </div>
        <p className="text-sm text-muted-foreground font-body leading-relaxed max-w-xl mx-auto">
          O método completo para construir liberdade financeira. Mentalidade, renda fixa, ETFs, fundos, alocação de carteira e investimento internacional — tudo que você precisa pra investir com consistência.
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {mainModules.length} módulos</span>
          <span className="flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" /> {totalLessons} aulas</span>
          <span className="flex items-center gap-1"><Gift className="h-3.5 w-3.5" /> Conteúdos bônus</span>
        </div>
      </div>

      <Card className="border-border/40 shadow-soft rounded-2xl bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Rocket className="h-5 w-5 text-primary" /><h3 className="font-heading font-bold text-sm">Seu progresso</h3></div>
            <span className="text-xs font-heading font-bold text-primary">{completedCount} de {totalLessons} aulas</span>
          </div>
          <Progress value={pct} className="h-2.5" />
          <p className="text-[11px] text-muted-foreground mt-2 font-body">
            {pct === 0 ? "Comece sua jornada rumo à liberdade financeira." : pct === 100 ? "Parabéns! Você completou todas as aulas." : `${pct.toFixed(0)}% concluído — continue avançando!`}
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {mainModules.map(mod => <ModuleCard key={mod.id} mod={mod} completed={completed} onToggle={toggle} />)}
      </div>

      {bonusModules.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold px-1 flex items-center gap-2">
            <Gift className="h-3.5 w-3.5" /> Conteúdos bônus
          </p>
          {bonusModules.map(mod => <ModuleCard key={mod.id} mod={mod} completed={completed} onToggle={toggle} />)}
        </div>
      )}
    </div>
  );
};

export default PlanoLiberdade;
