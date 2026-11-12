// PROTOTYPE variant C: bell pinned top-right of the page, Inbox opens as a
// slide-over drawer, and there's also a full page ("both").
// Behaviour difference worth judging: opening the drawer clears the badge
// ("seen"), but items stay highlighted until each is clicked or ticked ("read").
import { useState } from "react";
import { Link } from "react-router";
import { Bell, Check, X, ArrowRight } from "lucide-react";
import { cn } from "~/lib/utils";
import { usePrototypeInbox } from "./inbox-context";
import { timeAgo } from "./mock-notifications";

export function VariantCBellAndDrawer() {
  const inbox = usePrototypeInbox();
  const [open, setOpen] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);
  if (!inbox?.enabled || inbox.variant !== "C") return null;

  const list = inbox.notifications.filter((n) => !onlyUnread || !n.read);

  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
          inbox.markAllSeen();
        }}
        title="Inbox"
        className="fixed right-4 top-3 z-30 flex size-10 items-center justify-center rounded-full border bg-background shadow-sm transition-colors hover:bg-accent"
      >
        <Bell className="size-5" />
        {inbox.unseenCount > 0 && (
          <span className="absolute right-1.5 top-1.5 size-2.5 rounded-full bg-red-600 ring-2 ring-background" />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setOpen(false)}
          />
          <aside className="relative flex h-full w-[420px] flex-col bg-background shadow-2xl">
            <header className="flex items-center gap-3 border-b px-5 py-4">
              <h2 className="text-lg font-semibold">Inbox</h2>
              <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={onlyUnread}
                  onChange={(e) => setOnlyUnread(e.target.checked)}
                />
                Unread only
              </label>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 hover:bg-accent"
              >
                <X className="size-4" />
              </button>
            </header>

            {list.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                <div className="text-4xl">🎉</div>
                <div className="font-medium">Nothing new</div>
                <div className="text-sm text-muted-foreground">
                  You've seen everything. We'll ring the bell when something
                  needs you.
                </div>
              </div>
            ) : (
              <ul className="flex-1 space-y-2 overflow-y-auto p-3">
                {list.map((n) => (
                  <li
                    key={n.id}
                    className={cn(
                      "flex gap-3 rounded-lg border p-3",
                      n.read
                        ? "border-transparent"
                        : "border-l-4 border-l-blue-600 bg-blue-50/50 dark:bg-blue-950/20"
                    )}
                  >
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {(n.actor ?? "C").slice(0, 1)}
                    </div>
                    <button
                      onClick={() => {
                        setOpen(false);
                        inbox.open(n);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className={cn("text-sm", !n.read && "font-semibold")}>
                        {n.title}
                      </div>
                      {n.body && (
                        <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {n.body}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-muted-foreground">
                        {n.kind} · {timeAgo(n.minutesAgo)}
                      </div>
                    </button>
                    {!n.read && (
                      <button
                        onClick={() => inbox.markRead(n.id)}
                        title="Mark read"
                        className="self-start rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Check className="size-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <footer className="flex items-center justify-between border-t px-5 py-3 text-sm">
              <button
                onClick={inbox.markAllRead}
                disabled={inbox.unreadCount === 0}
                className="font-medium text-muted-foreground hover:text-foreground disabled:opacity-40"
              >
                Mark all read
              </button>
              <Link
                to="/prototype/inbox?variant=C"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1 font-medium"
              >
                Open full Inbox <ArrowRight className="size-4" />
              </Link>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}
