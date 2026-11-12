// PROTOTYPE (bell + Inbox, wayfinder ticket #5). Mock Notifications per kind
// of person, built from the candidate events on "Which events send a
// Notification, to whom, and through which channels?". In memory only.
import type { PrototypeLinks } from "./links.server";

export type ProtoNotification = {
  id: string;
  kind: string; // which trigger event, shown so the reviewer can judge copy
  title: string;
  body?: string;
  href: string;
  minutesAgo: number;
  read: boolean;
  actor?: string;
};

type Role = "student" | "instructor" | "admin";

export function buildMockNotifications(
  role: Role | null,
  isTeamAdmin: boolean,
  links: PrototypeLinks
): ProtoNotification[] {
  const slug = links.course?.slug ?? "";
  const title = links.course?.title ?? "your course";
  const lessonHref =
    links.course && links.lessonId
      ? `/courses/${slug}/lessons/${links.lessonId}`
      : `/courses/${slug}`;
  const other = links.otherCourse;

  const list: Omit<ProtoNotification, "id">[] = [];

  if (role === "student") {
    list.push(
      {
        kind: "Question answered",
        title: `Your question on ${title} was answered`,
        body: "“Good catch. The JOIN order doesn't matter here because…”",
        href: lessonHref,
        minutesAgo: 4,
        read: false,
        actor: "Instructor",
      },
      {
        kind: "Comment reply",
        title: "Priya replied to your comment",
        body: "“Same issue for me, restarting the dev server fixed it.”",
        href: lessonHref,
        minutesAgo: 52,
        read: false,
        actor: "Priya",
      },
      {
        kind: "Refund Request decided",
        title: `Your Refund Request for ${other?.title ?? "a course"} was approved`,
        body: "The Refund is on its way to your card.",
        href: "/dashboard",
        minutesAgo: 60 * 26,
        read: false,
      },
      {
        kind: "Enrollment",
        title: `You're enrolled in ${title}`,
        href: `/courses/${slug}`,
        minutesAgo: 60 * 24 * 6,
        read: true,
      }
    );
  }

  if (role === "instructor") {
    list.push(
      {
        kind: "Question asked",
        title: `New question on ${title}`,
        body: "“Why does the migration fail when the column is NOT NULL?”",
        href: "/instructor/questions",
        minutesAgo: 2,
        read: false,
        actor: "Sam",
      },
      {
        kind: "Question asked",
        title: `New question on ${title}`,
        body: "“Is there a repo for module 3?”",
        href: "/instructor/questions",
        minutesAgo: 35,
        read: false,
        actor: "Ana",
      },
      {
        kind: "New Enrollment",
        title: `3 new Students enrolled in ${title}`,
        href: links.course ? `/instructor/${links.course.id}/students` : "/instructor",
        minutesAgo: 60 * 5,
        read: false,
      },
      {
        kind: "Comment reply",
        title: "Leo replied to your comment",
        body: "“Thanks, that cleared it up!”",
        href: lessonHref,
        minutesAgo: 60 * 30,
        read: true,
        actor: "Leo",
      }
    );
  }

  if (role === "admin") {
    list.push(
      {
        kind: "New Open Refund Request",
        title: "New Refund Request from Jordan",
        body: `${title}, “Not what I expected.”`,
        href: "/admin/refunds",
        minutesAgo: 9,
        read: false,
        actor: "Jordan",
      },
      {
        kind: "Refund failed",
        title: "A Refund failed to go through",
        body: "The card was declined by the bank. Needs a manual retry.",
        href: "/admin/refunds",
        minutesAgo: 60 * 3,
        read: false,
      },
      {
        kind: "Refund issued",
        title: "Refund issued to Mei",
        href: "/admin/refunds",
        minutesAgo: 60 * 28,
        read: true,
      }
    );
  }

  if (isTeamAdmin) {
    list.push(
      {
        kind: "Seat claimed",
        title: "Alex claimed a Seat on your team",
        body: "4 of 10 Seats now used.",
        href: "/team",
        minutesAgo: 18,
        read: false,
        actor: "Alex",
      },
      {
        kind: "Seat claimed",
        title: "Chris claimed a Seat on your team",
        href: "/team",
        minutesAgo: 60 * 50,
        read: true,
        actor: "Chris",
      }
    );
  }

  // Pad with older read items so the list has realistic density.
  for (let i = 0; i < 5; i++) {
    list.push({
      kind: "Older",
      title:
        role === "instructor"
          ? `New question on ${title}`
          : `Reply to your comment on ${title}`,
      href: role === "instructor" ? "/instructor/questions" : lessonHref,
      minutesAgo: 60 * 24 * (8 + i * 3),
      read: true,
    });
  }

  return list
    .sort((a, b) => a.minutesAgo - b.minutesAgo)
    .map((n, i) => ({ ...n, id: `n${i}` }));
}

let simCount = 0;
export function makeSimulatedNotification(
  role: Role | null,
  links: PrototypeLinks
): ProtoNotification {
  simCount++;
  const slug = links.course?.slug ?? "";
  const options: Omit<ProtoNotification, "id" | "minutesAgo" | "read">[] =
    role === "admin"
      ? [
          {
            kind: "New Open Refund Request",
            title: `New Refund Request #${simCount}`,
            href: "/admin/refunds",
          },
        ]
      : role === "instructor"
        ? [
            {
              kind: "Question asked",
              title: `New question #${simCount} on ${links.course?.title ?? "your course"}`,
              href: "/instructor/questions",
              actor: "Student",
            },
          ]
        : [
            {
              kind: "Comment reply",
              title: `New reply #${simCount} to your comment`,
              href: `/courses/${slug}`,
              actor: "Someone",
            },
          ];
  return { ...options[0], id: `sim${simCount}`, minutesAgo: 0, read: false };
}

export function timeAgo(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export function dayGroup(minutes: number): "Today" | "Yesterday" | "Earlier" {
  if (minutes < 60 * 24) return "Today";
  if (minutes < 60 * 48) return "Yesterday";
  return "Earlier";
}
