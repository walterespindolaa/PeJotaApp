import type { Course, Lesson } from "./types";

export function totalLessons(course: Course): number {
  return course.modules.reduce((acc, m) => acc + m.lessons.length, 0);
}

export function totalDuration(course: Course): number {
  return course.modules.reduce(
    (acc, m) => acc + m.lessons.reduce((a, l) => a + l.duration, 0),
    0,
  );
}

export function findLesson(
  course: Course,
  lessonNumber: string,
): { lesson: Lesson; moduleNumber: number } | null {
  for (const mod of course.modules) {
    const lesson = mod.lessons.find((l) => l.number === lessonNumber);
    if (lesson) return { lesson, moduleNumber: mod.number };
  }
  return null;
}

export function getNextLesson(course: Course, currentNumber: string): Lesson | null {
  const all: Lesson[] = course.modules.flatMap((m) => m.lessons);
  const idx = all.findIndex((l) => l.number === currentNumber);
  if (idx === -1 || idx === all.length - 1) return null;
  return all[idx + 1];
}

export function getPrevLesson(course: Course, currentNumber: string): Lesson | null {
  const all: Lesson[] = course.modules.flatMap((m) => m.lessons);
  const idx = all.findIndex((l) => l.number === currentNumber);
  if (idx <= 0) return null;
  return all[idx - 1];
}

export function lessonNumberToUrl(num: string): string {
  return num.replace(".", "-");
}

export function lessonNumberFromUrl(urlNum: string): string {
  return urlNum.replace("-", ".");
}
