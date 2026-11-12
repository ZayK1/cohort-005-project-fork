// PROTOTYPE: floating variant switcher + state readout. Dev only.
import { useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePrototypeInbox, VARIANTS } from "./inbox-context";

export function PrototypeSwitcher() {
  const inbox = usePrototypeInbox();

  const idx = inbox ? VARIANTS.findIndex((v) => v.key === inbox.variant) : 0;
  function cycle(delta: number) {
    if (!inbox) return;
    const next = VARIANTS[(idx + delta + VARIANTS.length) % VARIANTS.length];
    inbox.setVariant(next.key);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      if (e.key === "ArrowLeft") cycle(-1);
      if (e.key === "ArrowRight") cycle(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!inbox?.enabled) return null;
  const current = VARIANTS[idx];

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-zinc-900 px-3 py-2 text-xs text-white shadow-2xl ring-1 ring-white/10">
      <div className="flex items-center gap-2">
        <button onClick={() => cycle(-1)} className="rounded-full p-1 hover:bg-white/15">
          <ChevronLeft className="size-4" />
        </button>
        <span className="min-w-48 text-center font-semibold">
          {current.key} ({current.name})
        </span>
        <button onClick={() => cycle(1)} className="rounded-full p-1 hover:bg-white/15">
          <ChevronRight className="size-4" />
        </button>
        <span className="mx-1 h-4 w-px bg-white/20" />
        <button onClick={inbox.simulateNew} className="rounded-md px-2 py-1 hover:bg-white/15">
          + New Notification
        </button>
        <label className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-white/15">
          <input
            type="checkbox"
            checked={inbox.empty}
            onChange={(e) => inbox.setEmpty(e.target.checked)}
          />
          Empty Inbox
        </label>
        <button onClick={inbox.reset} className="rounded-md px-2 py-1 hover:bg-white/15">
          Reset
        </button>
      </div>
      <div className="mt-1 text-center font-mono text-[10px] text-white/60">
        unread {inbox.unreadCount} · unseen {inbox.unseenCount} · total{" "}
        {inbox.notifications.length} · last: {inbox.lastAction}
      </div>
    </div>
  );
}
