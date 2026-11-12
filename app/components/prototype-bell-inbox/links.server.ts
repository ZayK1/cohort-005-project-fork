// PROTOTYPE (bell + Inbox, wayfinder ticket #5). Throwaway: lives on the
// prototype/bell-inbox branch only. Finds real course/lesson ids so the mock
// Notifications link to pages that actually exist.
import { asc, eq } from "drizzle-orm";
import { db } from "~/db";
import { courses, lessons, modules, UserRole } from "~/db/schema";

export type PrototypeLinks = {
  course: { id: number; slug: string; title: string } | null;
  lessonId: number | null;
  otherCourse: { slug: string; title: string } | null;
};

export function getPrototypeLinks(
  userId: number | null,
  role: UserRole | null
): PrototypeLinks {
  const all = db
    .select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      instructorId: courses.instructorId,
    })
    .from(courses)
    .orderBy(asc(courses.id))
    .all();

  const course =
    (role === UserRole.Instructor &&
      all.find((c) => c.instructorId === userId)) ||
    all[0] ||
    null;
  const otherCourse = all.find((c) => c.id !== course?.id) ?? null;

  const lesson = course
    ? db
        .select({ id: lessons.id })
        .from(lessons)
        .innerJoin(modules, eq(lessons.moduleId, modules.id))
        .where(eq(modules.courseId, course.id))
        .orderBy(asc(modules.position), asc(lessons.position))
        .get()
    : undefined;

  return {
    course: course
      ? { id: course.id, slug: course.slug, title: course.title }
      : null,
    lessonId: lesson?.id ?? null,
    otherCourse: otherCourse
      ? { slug: otherCourse.slug, title: otherCourse.title }
      : null,
  };
}
