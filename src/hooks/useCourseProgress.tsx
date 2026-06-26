import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logError } from "@/lib/log";

export function useCourseProgress(courseSlug: string) {
  const { user } = useAuth();
  const [completedLessons, setCompletedLessons] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const fetchProgress = useCallback(async () => {
    if (!user?.id || !courseSlug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("user_course_progress")
        .select("lesson_number")
        .eq("user_id", user.id)
        .eq("course_slug", courseSlug);

      if (error) throw error;
      setCompletedLessons(new Set((data ?? []).map((r: any) => r.lesson_number as string)));
    } catch (err) {
      logError("[useCourseProgress] fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, courseSlug]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const markComplete = useCallback(
    async (lessonNumber: string) => {
      if (!user?.id) return;
      try {
        const { error } = await (supabase as any)
          .from("user_course_progress")
          .upsert(
            { user_id: user.id, course_slug: courseSlug, lesson_number: lessonNumber },
            { onConflict: "user_id,course_slug,lesson_number" },
          );
        if (error) throw error;
        setCompletedLessons((prev) => {
          const next = new Set(prev);
          next.add(lessonNumber);
          return next;
        });
      } catch (err) {
        logError("[useCourseProgress] mark error:", err);
      }
    },
    [user?.id, courseSlug],
  );

  const markIncomplete = useCallback(
    async (lessonNumber: string) => {
      if (!user?.id) return;
      try {
        const { error } = await (supabase as any)
          .from("user_course_progress")
          .delete()
          .eq("user_id", user.id)
          .eq("course_slug", courseSlug)
          .eq("lesson_number", lessonNumber);
        if (error) throw error;
        setCompletedLessons((prev) => {
          const next = new Set(prev);
          next.delete(lessonNumber);
          return next;
        });
      } catch (err) {
        logError("[useCourseProgress] unmark error:", err);
      }
    },
    [user?.id, courseSlug],
  );

  const isComplete = useCallback(
    (lessonNumber: string) => completedLessons.has(lessonNumber),
    [completedLessons],
  );

  return {
    completedLessons,
    isComplete,
    markComplete,
    markIncomplete,
    loading,
    totalCompleted: completedLessons.size,
  };
}
