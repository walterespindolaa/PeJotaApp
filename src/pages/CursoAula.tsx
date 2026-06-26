import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as LucideIcons from "lucide-react";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PlanGate from "@/components/PlanGate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCourseBySlug } from "@/lib/courses/data";
import {
  findLesson,
  getNextLesson,
  getPrevLesson,
  lessonNumberFromUrl,
  lessonNumberToUrl,
} from "@/lib/courses/helpers";
import { useCourseProgress } from "@/hooks/useCourseProgress";

const PLAN_LABEL: Record<string, string> = {
  essencial: "Essencial",
  pro: "Pro",
  elite: "Elite",
};

const resolveIcon = (name: string): LucideIcon => {
  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  return icons[name] ?? BookOpen;
};

const CursoAula = () => {
  const { slug, lessonId } = useParams();
  const navigate = useNavigate();
  const course = slug ? getCourseBySlug(slug) : undefined;
  const lessonNumber = lessonId ? lessonNumberFromUrl(lessonId) : "";
  const found = course ? findLesson(course, lessonNumber) : null;
  const { isComplete, markComplete, markIncomplete } = useCourseProgress(slug ?? "");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [lessonId]);

  if (!course || !found) {
    return (
      <div className="max-w-3xl mx-auto p-6 text-center">
        <p className="text-muted-foreground">Aula não encontrada.</p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => navigate(`/dashboard/cursos/${slug}`)}
        >
          Voltar ao curso
        </Button>
      </div>
    );
  }

  const { lesson, moduleNumber } = found;
  const Icon = resolveIcon(course.iconName);
  const done = isComplete(lesson.number);
  const next = getNextLesson(course, lesson.number);
  const prev = getPrevLesson(course, lesson.number);

  const content = (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      <button
        onClick={() => navigate(`/dashboard/cursos/${course.slug}`)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        {course.title}
      </button>

      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
          <span className="uppercase tracking-[0.15em] font-heading font-bold">
            Módulo {moduleNumber}
          </span>
          <span>·</span>
          <span>Aula {lesson.number}</span>
          <span>·</span>
          <span>{lesson.duration} min</span>
          {lesson.hasExercise && (
            <>
              <span>·</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                exercício
              </Badge>
            </>
          )}
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-2">
          {lesson.title}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">{lesson.description}</p>
      </div>

      <div className="rounded-2xl overflow-hidden bg-muted/40 border border-border/60 aspect-video">
        {lesson.videoUrl ? (
          <iframe
            src={lesson.videoUrl + "?autoplay=true&loop=false&muted=false&preload=true&responsive=true&defaultQuality=720p"}
            loading="lazy"
            className="w-full h-full border-0"
            allow="accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture;"
            allowFullScreen
            title={lesson.title}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-center p-6">
            <Video className="h-10 w-10 text-muted-foreground/60" />
            <p className="text-base font-medium text-foreground">Aula em breve.</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              O vídeo será publicado em alguns dias.
            </p>
          </div>
        )}
      </div>

      {lesson.videoUrl && (
        <div className="flex items-center justify-end">
          {done ? (
            <Button
              variant="outline"
              onClick={() => markIncomplete(lesson.number)}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4 text-success" />
              Aula concluída
            </Button>
          ) : (
            <Button onClick={() => markComplete(lesson.number)} className="gap-2">
              Marcar como concluída
            </Button>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-border/40">
        {prev ? (
          <Button
            variant="ghost"
            onClick={() =>
              navigate(`/dashboard/cursos/${course.slug}/aula/${lessonNumberToUrl(prev.number)}`)
            }
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior: {prev.number}
          </Button>
        ) : (
          <span />
        )}

        {next ? (
          <Button
            variant="ghost"
            onClick={() =>
              navigate(`/dashboard/cursos/${course.slug}/aula/${lessonNumberToUrl(next.number)}`)
            }
            className="gap-1"
          >
            Próxima: {next.number}
            <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );

  return (
    <PlanGate
      featureKey={course.featureKey}
      feature={{
        icon: Icon,
        title: course.title,
        subtitle: `Disponível no ${PLAN_LABEL[course.requiredPlan] ?? course.requiredPlan}`,
        items: course.modules.slice(0, 4).map((m) => m.title),
      }}
    >
      {content}
    </PlanGate>
  );
};

export default CursoAula;
