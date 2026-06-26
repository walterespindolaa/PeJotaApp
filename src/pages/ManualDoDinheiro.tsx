import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useUserRole } from "@/hooks/useUserRole";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useState, useCallback } from "react";
import {
  BookOpen, Rocket, DollarSign, Target, CreditCard,
  Shield, TrendingUp, CheckCircle2, Lock, ChevronDown,
  PlayCircle, Gift, Sparkles, ArrowRight, Play, Clock,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { FEATURE_GATE_CONFIGS } from "@/lib/featureGateConfigs";

interface Lesson { id: string; title: string; videoUrl: string; duration?: string; }
interface CourseModule {
  id: string; label: string; title: string; description: string;
  icon: React.ElementType; lessons: Lesson[]; isBonus?: boolean;
}

const MODULES: CourseModule[] = [
  {
    id: "boas-vindas", label: "Boas-Vindas", title: "Apresentação do curso", description: "Conheça o que vem pela frente.", icon: Rocket,
    lessons: [
      { id: "bv-01", title: "Apresentação do curso", duration: "3:22", videoUrl: "https://iframe.mediadelivery.net/embed/651999/f23cfb08-c795-4340-a4c4-b45ac7e5894e" },
    ],
  },
  {
    id: "mod1", label: "Módulo 1", title: "A História do Dinheiro", description: "De onde veio o dinheiro e como chegamos no sistema atual.", icon: BookOpen,
    lessons: [
      { id: "m1-01", title: "O dinheiro já foi simples", duration: "1:58", videoUrl: "https://iframe.mediadelivery.net/embed/651999/ba7b0353-9bad-41d9-92da-72a6bbc783b2" },
      { id: "m1-02", title: "Quando o dinheiro virou confiança", duration: "2:01", videoUrl: "https://iframe.mediadelivery.net/embed/651999/fc62fa28-c5bc-4749-bf8b-e231acd94292" },
      { id: "m1-03", title: "O dia que mudou tudo", duration: "2:12", videoUrl: "https://iframe.mediadelivery.net/embed/651999/9516ecc9-51fa-4ec7-9829-2b16582eb197" },
      { id: "m1-04", title: "Por que o dólar manda no mundo", duration: "2:21", videoUrl: "https://iframe.mediadelivery.net/embed/651999/d0a5281c-e3ca-4826-8af2-580f07ce1aad" },
      { id: "m1-05", title: "O dinheiro hoje", duration: "2:12", videoUrl: "https://iframe.mediadelivery.net/embed/651999/a051c66a-9fa7-4a8f-a8d5-22380fe385f3" },
      { id: "m1-06", title: "O futuro do dinheiro", duration: "2:34", videoUrl: "https://iframe.mediadelivery.net/embed/651999/85ea2bc7-a4cd-40fb-b2e8-99893d6db025" },
    ],
  },
  {
    id: "mod2", label: "Módulo 2", title: "Como o sistema funciona", description: "Inflação, juros, Banco Central — descomplicado.", icon: DollarSign,
    lessons: [
      { id: "m2-01", title: "O que é inflação", duration: "2:30", videoUrl: "https://iframe.mediadelivery.net/embed/651999/3ebba188-b2f4-4b16-beea-5aa569906f52" },
      { id: "m2-02", title: "O que são juros", duration: "2:46", videoUrl: "https://iframe.mediadelivery.net/embed/651999/9b09b7b0-e17e-49f8-94d1-caaf57d81588" },
      { id: "m2-03", title: "Banco Central na prática", duration: "2:15", videoUrl: "https://iframe.mediadelivery.net/embed/651999/656de246-d8ef-450b-822f-256d3f29e330" },
      { id: "m2-04", title: "O efeito dominó da economia", duration: "2:11", videoUrl: "https://iframe.mediadelivery.net/embed/651999/a91105b0-3e41-4696-b946-1782ebe4a322" },
      { id: "m2-05", title: "O que acontece em crises", duration: "2:26", videoUrl: "https://iframe.mediadelivery.net/embed/651999/2162d36f-4b30-47eb-83ab-972a2f2752f4" },
      { id: "m2-06", title: "Como ler notícias econômicas", duration: "2:35", videoUrl: "https://iframe.mediadelivery.net/embed/651999/b6684f78-6fd1-49ee-a5c8-4335ef28d84f" },
    ],
  },
  {
    id: "mod3", label: "Módulo 3", title: "Como isso impacta na sua vida", description: "Sai da teoria. Aqui é o seu bolso.", icon: CreditCard,
    lessons: [
      { id: "m3-01", title: "Por que tudo está mais caro", duration: "2:20", videoUrl: "https://iframe.mediadelivery.net/embed/651999/59aa6b92-a306-4c99-a6f9-3e83744886a4" },
      { id: "m3-02", title: "Juros e dívidas", duration: "2:10", videoUrl: "https://iframe.mediadelivery.net/embed/651999/1fc477c0-c68c-4aa4-907c-c19253c36f11" },
      { id: "m3-03", title: "Por que guardar dinheiro te empobrece", duration: "1:51", videoUrl: "https://iframe.mediadelivery.net/embed/651999/b6775840-d43d-417e-a4b9-6a7159678bfe" },
      { id: "m3-04", title: "O erro da poupança", duration: "2:06", videoUrl: "https://iframe.mediadelivery.net/embed/651999/31c21984-e64b-45b3-b706-7f008e08e6b7" },
      { id: "m3-05", title: "O risco de não investir", duration: "2:15", videoUrl: "https://iframe.mediadelivery.net/embed/651999/ece3878e-cb75-43bd-a56f-0d03cdd641e2" },
      { id: "m3-06", title: "O maior erro das pessoas", duration: "2:31", videoUrl: "https://iframe.mediadelivery.net/embed/651999/2738809d-84cc-4689-98c1-1ac0888531ad" },
    ],
  },
  {
    id: "mod4", label: "Módulo 4", title: "Como usar isso à seu favor", description: "Mude a mentalidade. Comece a investir com clareza.", icon: TrendingUp,
    lessons: [
      { id: "m4-01", title: "Pensar como investidor", duration: "2:14", videoUrl: "https://iframe.mediadelivery.net/embed/651999/998ad650-280f-4c09-9ada-b91f28e18c8e" },
      { id: "m4-02", title: "O papel de cada investimento", duration: "2:38", videoUrl: "https://iframe.mediadelivery.net/embed/651999/b0af254b-2b81-4fb3-875c-2eed0be272b2" },
      { id: "m4-03", title: "Por que diversificar", duration: "2:39", videoUrl: "https://iframe.mediadelivery.net/embed/651999/de86e07d-6dce-4af5-9d31-7be9da75d7f8" },
      { id: "m4-04", title: "O básico de uma boa carteira", duration: "2:39", videoUrl: "https://iframe.mediadelivery.net/embed/651999/1c81c699-1e27-4211-860e-e56adce466d7" },
      { id: "m4-05", title: "Consistência > inteligência", duration: "2:06", videoUrl: "https://iframe.mediadelivery.net/embed/651999/98d4cd67-eb45-4425-99a6-014c54b254e0" },
      { id: "m4-06", title: "Seu próximo passo", duration: "2:48", videoUrl: "https://iframe.mediadelivery.net/embed/651999/558090ae-e553-4a70-a24e-ffb54bdec624" },
    ],
  },
  {
    id: "mod5", label: "Módulo 5", title: "Fechamento e Direção", description: "Revisão e o convite para a próxima jornada.", icon: Shield,
    lessons: [
      { id: "m5-01", title: "Revisão do Manual do Dinheiro", duration: "1:58", videoUrl: "https://iframe.mediadelivery.net/embed/651999/cb061cbe-dd9d-47b0-887e-d2ca94c786f1" },
      { id: "m5-02", title: "O próximo nível (Plano da Liberdade)", duration: "2:38", videoUrl: "https://iframe.mediadelivery.net/embed/651999/50798f9b-5731-46e1-8a1e-138b287ebb21" },
    ],
  },
];

const TOTAL_DURATION_MIN = Math.ceil(
  MODULES.flatMap(m => m.lessons).reduce((sum, l) => {
    if (!l.duration) return sum;
    const [min, sec] = l.duration.split(":").map(Number);
    return sum + min + (sec || 0) / 60;
  }, 0)
);

const STORAGE_KEY = "atlas_manual_dinheiro_completed";

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

// ─── Lock card (trial / grace period) ──────────────
function LockedScreen() {
  const navigate = useNavigate();
  const config = FEATURE_GATE_CONFIGS["manual_do_dinheiro"];

  return (
    <div className="relative animate-fade-in">
      {/* Blurred preview */}
      <div className="pointer-events-none select-none filter blur-[6px] opacity-40 max-h-[60vh] overflow-hidden" aria-hidden="true">
        <PreviewContent />
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-start justify-center pt-12 z-10">
        <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Lock className="h-7 w-7 text-primary" />
          </div>

          <h2 className="text-xl font-heading font-bold text-foreground mb-3">
            {config.moduleName}
          </h2>

          <div className="text-sm text-muted-foreground mb-5 text-left space-y-3">
            {config.moduleDescription.split("\n\n").map((p, i) => (
              <p key={i} className="leading-relaxed">{p}</p>
            ))}
          </div>

          <div className="text-left bg-muted/40 rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wider mb-3">
              Este módulo permite:
            </p>
            <ul className="space-y-2">
              {config.benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground mb-5">
            Disponível no plano <span className="font-semibold text-primary">PeJota Pro</span>.
          </p>

          <div className="flex flex-col gap-2.5">
            <Button className="w-full rounded-xl gap-2" onClick={() => navigate("/dashboard/planos")}>
              <Sparkles className="h-4 w-4" />
              Ver comparação de planos
            </Button>
            <Button variant="outline" className="w-full rounded-xl gap-2 text-muted-foreground" onClick={() => navigate("/dashboard")}>
              <ArrowRight className="h-4 w-4" />
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Minimal blurred content used as backdrop for LockedScreen ──
function PreviewContent() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
          <BookOpen className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold">Manual do Dinheiro</h1>
      </div>
      <div className="space-y-3">
        {MODULES.map(mod => (
          <div key={mod.id} className="rounded-2xl border border-border/40 bg-gradient-to-br from-primary/3 to-transparent p-5">
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10">
                <mod.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <Badge variant="outline" className="text-[10px] mb-1">{mod.label}</Badge>
                <h3 className="font-heading font-semibold text-sm">{mod.title}</h3>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
          <BookOpen className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 font-heading font-semibold">
            Educação PeJota
          </p>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Manual do Dinheiro</h1>
        </div>
        <p className="text-sm text-muted-foreground font-body leading-relaxed max-w-xl mx-auto">
          Guia completo para organizar, eliminar dívidas e começar a investir. Do diagnóstico financeiro ao seu primeiro investimento — passo a passo, sem enrolação.
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {mainModules.length} módulos</span>
          <span className="flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" /> {totalLessons} aulas</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {TOTAL_DURATION_MIN} min</span>
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

const GRACE_STATES = ["trial_expired", "cancelled_grace", "awaiting_payment"] as const;

// ─── Main page ────────────────────────────────
const ManualDoDinheiro = () => {
  const { isAdmin } = useUserRole();
  const { isTrialActive, accessState } = useFeatureAccess();
  const { completed, toggle } = useCompletedLessons();

  const isGracePeriod = (GRACE_STATES as readonly string[]).includes(accessState);

  if (!isAdmin && (isTrialActive || isGracePeriod)) return <LockedScreen />;
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
          <BookOpen className="h-10 w-10 text-primary" />
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 font-heading font-semibold">
            Educação PeJota
          </p>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Manual do Dinheiro</h1>
        </div>
        <p className="text-sm text-muted-foreground font-body leading-relaxed max-w-xl mx-auto">
          Guia completo para organizar, eliminar dívidas e começar a investir. Do diagnóstico financeiro ao seu primeiro investimento — passo a passo, sem enrolação.
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {mainModules.length} módulos</span>
          <span className="flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" /> {totalLessons} aulas</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {TOTAL_DURATION_MIN} min</span>
        </div>
      </div>

      <Card className="border-border/40 shadow-soft rounded-2xl bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /><h3 className="font-heading font-bold text-sm">Seu progresso</h3></div>
            <span className="text-xs font-heading font-bold text-primary">{completedCount} de {totalLessons} aulas</span>
          </div>
          <Progress value={pct} className="h-2.5" />
          <p className="text-[11px] text-muted-foreground mt-2 font-body">
            {pct === 0 ? "Comece sua jornada com o Manual do Dinheiro." : pct === 100 ? "Parabéns! Você completou todas as aulas." : `${pct.toFixed(0)}% concluído — continue avançando!`}
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

export default ManualDoDinheiro;
