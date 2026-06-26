import { useNavigate, useParams } from "react-router-dom";
import * as LucideIcons from "lucide-react";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  Clock,
  PlayCircle,
  Rocket,
  Sparkles,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PlanGate from "@/components/PlanGate";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { getCourseBySlug } from "@/lib/courses/data";
import { lessonNumberToUrl, totalDuration, totalLessons } from "@/lib/courses/helpers";
import { useCourseProgress } from "@/hooks/useCourseProgress";
import type { Module } from "@/lib/courses/types";

const PLAN_LABEL: Record<string, string> = {
  essencial: "Essencial",
  pro: "Pro",
  elite: "Elite",
};

const resolveIcon = (name: string | undefined, fallback: LucideIcon): LucideIcon => {
  if (!name) return fallback;
  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  return icons[name] ?? fallback;
};

const motivationalCopy = (pct: number, total: number): string => {
  if (total === 0) return "Conteúdo em preparação — novas aulas em breve.";
  if (pct === 0) return "Comece sua jornada — a primeira aula te espera.";
  if (pct === 100) return "Parabéns! Você completou todas as aulas.";
  return `${Math.round(pct)}% concluído — continue avançando!`;
};

const CursoDetalhe = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const course = slug ? getCourseBySlug(slug) : undefined;
  const { isComplete, totalCompleted } = useCourseProgress(slug ?? "");

  if (!course) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <p className="text-muted-foreground">Curso não encontrado.</p>
      </div>
    );
  }

  const HeroIcon = resolveIcon(course.iconName, BookOpen);
  const total = totalLessons(course);
  const duration = totalDuration(course);
  const progressPct = total > 0 ? (totalCompleted / total) * 100 : 0;
  const planLabel = PLAN_LABEL[course.requiredPlan] ?? course.requiredPlan;

  const firstModuleId = course.modules[0] ? `mod-${course.modules[0].number}` : undefined;

  const content = (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      {/* Hero */}
      <div className="text-center space-y-4 pt-2">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/5">
          <HeroIcon className={cn("h-10 w-10", course.accentColor || "text-primary")} />
        </div>
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/70 font-heading font-semibold">
            {course.subtitle}
          </p>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">{course.title}</h1>
        </div>
        <p className="text-sm text-muted-foreground font-body leading-relaxed max-w-xl mx-auto">
          {course.description}
        </p>
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <BookOpen className="h-3.5 w-3.5" />
            {course.modules.length} módulos
          </span>
          <span className="flex items-center gap-1">
            <PlayCircle className="h-3.5 w-3.5" />
            {total} aulas
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {duration} min
          </span>
        </div>
      </div>

      {/* Card de progresso */}
      <Card className="border-border/40 shadow-soft rounded-2xl bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              <h3 className="font-heading font-bold text-sm">Seu progresso</h3>
            </div>
            <span className="text-xs font-heading font-bold text-primary">
              {totalCompleted} de {total} aulas
            </span>
          </div>
          <Progress value={progressPct} className="h-2.5" />
          <p className="text-[11px] text-muted-foreground mt-2 font-body">
            {motivationalCopy(progressPct, total)}
          </p>
        </CardContent>
      </Card>

      {/* Estrutura do curso */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold px-1 flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5" /> Estrutura do curso
        </p>

        <Accordion
          type="multiple"
          defaultValue={firstModuleId ? [firstModuleId] : []}
          className="space-y-3"
        >
          {course.modules.map((mod) => (
            <ModuleCard
              key={mod.number}
              mod={mod}
              courseSlug={course.slug}
              isComplete={isComplete}
              onNavigate={navigate}
            />
          ))}
        </Accordion>
      </div>
    </div>
  );

  return (
    <PlanGate
      featureKey={course.featureKey}
      feature={{
        icon: HeroIcon,
        title: course.title,
        subtitle: `Disponível no ${planLabel}`,
        items: course.modules.slice(0, 4).map((m) => m.title),
      }}
    >
      {content}
    </PlanGate>
  );
};

interface ModuleCardProps {
  mod: Module;
  courseSlug: string;
  isComplete: (lessonNumber: string) => boolean;
  onNavigate: (path: string) => void;
}

const ModuleCard = ({ mod, courseSlug, isComplete, onNavigate }: ModuleCardProps) => {
  const ModIcon = resolveIcon(mod.iconName, BookOpen);
  const done = mod.lessons.filter((l) => isComplete(l.number)).length;
  const total = mod.lessons.length;
  const allDone = total > 0 && done === total;

  return (
    <AccordionItem
      value={`mod-${mod.number}`}
      className={cn(
        "border border-border/40 rounded-2xl bg-card transition-all hover:shadow-md overflow-hidden",
        allDone && "bg-success/5 border-success/20",
      )}
    >
      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/20 [&[data-state=open]]:border-b [&[data-state=open]]:border-border/40">
        <div className="flex items-center gap-4 flex-1 min-w-0 text-left">
          <div
            className={cn(
              "flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0",
              allDone ? "bg-success/10" : "bg-primary/10",
            )}
          >
            {allDone ? (
              <CheckCircle2 className="h-5 w-5 text-success" />
            ) : (
              <ModIcon className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                Módulo {mod.number}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {done}/{total} aulas
              </span>
            </div>
            <h3 className="font-heading font-semibold text-sm mt-0.5 truncate">{mod.title}</h3>
            {mod.subtitle && (
              <p className="text-xs text-muted-foreground font-body mt-0.5 line-clamp-1">
                {mod.subtitle}
              </p>
            )}
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pt-3 pb-5">
        <ul className="space-y-1.5">
          {mod.lessons.map((lesson) => {
            const done = isComplete(lesson.number);
            const available = !!lesson.videoUrl;
            return (
              <li
                key={lesson.number}
                onClick={() =>
                  available &&
                  onNavigate(
                    `/dashboard/cursos/${courseSlug}/aula/${lessonNumberToUrl(lesson.number)}`,
                  )
                }
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all",
                  available
                    ? done
                      ? "bg-success/5 border-success/20 cursor-pointer hover:bg-success/10"
                      : "bg-muted/30 border-border/30 cursor-pointer hover:bg-muted/50"
                    : "bg-muted/20 border-border/20 opacity-60 cursor-not-allowed",
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground font-mono flex-shrink-0">
                      {lesson.number}
                    </span>
                    <span
                      className={cn(
                        "text-sm font-body truncate",
                        done && "line-through text-muted-foreground",
                      )}
                    >
                      {lesson.title}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {lesson.hasExercise && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 hidden sm:inline-flex">
                      exercício
                    </Badge>
                  )}
                  <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {lesson.duration}min
                  </span>
                  {!available ? (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                      <Video className="h-3 w-3" />
                      em breve
                    </Badge>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 hidden sm:block" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </AccordionContent>
    </AccordionItem>
  );
};

export default CursoDetalhe;
