import type { FeatureKey } from "@/hooks/useFeatureAccess";

export type LessonFormat = "camera" | "screencast" | "mix";
export type PlanTier = "essencial" | "pro" | "elite";

export interface Lesson {
  number: string;
  title: string;
  description: string;
  duration: number;
  format: LessonFormat;
  hasExercise: boolean;
  videoUrl: string;
}

export interface Module {
  number: number;
  title: string;
  subtitle: string;
  iconName?: string;
  lessons: Lesson[];
}

export interface Course {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  requiredPlan: PlanTier;
  featureKey: FeatureKey;
  iconName: string;
  accentColor: string;
  modules: Module[];
}
