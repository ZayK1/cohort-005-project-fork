// PROTOTYPE variant B: no bell. "Inbox" is a sidebar nav item with an unread
// count, and the Inbox is a full page: All/Unread tabs, grouped by day,
// checkboxes for bulk "mark read", per-row read/unread toggle on hover.
import { useState } from "react";
import { NavLink, Link } from "react-router";
import { Inbox, Check, Mail, MailOpen } from "lucide-react";
import { cn } from "~/lib/utils";
import { usePrototypeInbox } from "./inbox-context";
import { dayGroup, timeAgo } from "./mock-notifications";

export function VariantBNavItem() {
  const inbox = usePrototypeInbox();
  if (!inbox?.enabled || inbox.variant !== "B") return null;
  return (
    <NavLink
      to="/prototype/inbox?variant=B"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        )
      }
    >
      <Inbox className="size-4" />
      Inbox
      {inbox.unreadCount > 0 && (
        <span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
          {inbox.unreadCount}
        </span>
      )}
    </NavLink>
  );
}

export function VariantBPage() {
  const inbox = usePrototypeInbox();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  if (!inbox) return null;

  const list = inbox.notifications.filter((n) => tab === "all" || !n.read);
  const groups = (["Today", "Yesterday", "Earlier"] as const)
    .map((g) => ({ g, items: list.filter((n) => dayGroup(n.minutesAgo) === g) }))
    .filter((x) => x.items.length > 0);

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            {inbox.unreadCount} unread
          </p>
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <button
              onClick={() => {
                selected.forEach((id) => inbox.markRead(id));
                setSelected(new Set());
              }}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-accent"
            >
              Mark {selected.size} read
            </button>
          )}
          <button
            onClick={inbox.markAllRead}
            disabled={inbox.unreadCount === 0}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className="mb-4 flex gap-1 border-b">
        {(["all", "unread"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize",
              tab === t
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
            {t === "unread" && inbox.unreadCount > 0 && ` (${inbox.unreadCount})`}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <Check className="mx-auto mb-3 size-10 text-muted-foreground/40" />
          <div className="font-medium">
            {tab === "unread" ? "No unread Notifications" : "Your Inbox is empty"}
          </div>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            When something on Cadence needs you, like a reply to your question
            or a decided Refund Request, it lands here.
          </p>
          <Link
            to="/settings"
            className="mt-4 inline-block text-sm font-medium underline underline-offset-4"
          >
            Notification settings
          </Link>
        </div>
      ) : (
        groups.map(({ g, items }) => (
          <section key={g} className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {g}
            </h2>
            <ul className="overflow-hidden rounded-lg border">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "group flex items-center gap-3 border-b px-4 py-3 last:border-b-0",
                    !n.read && "bg-accent/50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(n.id)}
                    onChange={() => toggle(n.id)}
                    className="size-4"
                  />
                  <button
                    onClick={() => inbox.open(n)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {n.kind}
                      </span>
                      <span
                        className={cn(
                          "truncate text-sm",
                          n.read ? "text-muted-foreground" : "font-semibold"
                        )}
                      >
                        {n.title}
                      </span>
                    </div>
                    {n.body && (
                      <div className="mt-1 truncate text-sm text-muted-foreground">
                        {n.body}
                      </div>
                    )}
                  </button>
                  <span className="w-10 shrink-0 text-right text-xs text-muted-foreground group-hover:hidden">
                    {timeAgo(n.minutesAgo)}
                  </span>
                  <button
                    onClick={() =>
                      n.read ? inbox.markUnread(n.id) : inbox.markRead(n.id)
                    }
                    title={n.read ? "Mark unread" : "Mark read"}
                    className="hidden w-10 shrink-0 justify-end text-muted-foreground hover:text-foreground group-hover:flex"
                  >
                    {n.read ? (
                      <Mail className="size-4" />
                    ) : (
                      <MailOpen className="size-4" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
