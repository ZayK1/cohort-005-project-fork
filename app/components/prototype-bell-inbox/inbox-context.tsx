// PROTOTYPE (bell + Inbox, wayfinder ticket #5). Plan: three variants of the
// bell + Inbox mounted in the real app layout, switchable via `?variant=`:
//   A  Sidebar bell → dropdown only
//   B  "Inbox" sidebar item → full page only (no bell)
//   C  Top-right bell → slide-over drawer, plus a full page (both)
// All state is in memory; reload resets it.
import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { PrototypeLinks } from "./links.server";
import {
  buildMockNotifications,
  makeSimulatedNotification,
  type ProtoNotification,
} from "./mock-notifications";

export const VARIANTS = [
  { key: "A", name: "Sidebar bell + dropdown" },
  { key: "B", name: "Inbox page, no bell" },
  { key: "C", name: "Top bell + drawer + page" },
] as const;
export type VariantKey = (typeof VARIANTS)[number]["key"];

type Ctx = {
  enabled: boolean;
  variant: VariantKey;
  setVariant: (v: VariantKey) => void;
  notifications: ProtoNotification[];
  unreadCount: number;
  unseenCount: number; // only variant C uses "seen" separately from "read"
  markRead: (id: string) => void;
  markUnread: (id: string) => void;
  markAllRead: () => void;
  markAllSeen: () => void;
  open: (n: ProtoNotification) => void;
  simulateNew: () => void;
  empty: boolean;
  setEmpty: (v: boolean) => void;
  reset: () => void;
  lastAction: string;
};

const InboxCtx = createContext<Ctx | null>(null);

export function usePrototypeInbox() {
  return useContext(InboxCtx);
}

export function PrototypeInboxProvider({
  role,
  isTeamAdmin,
  links,
  children,
}: {
  role: "student" | "instructor" | "admin" | null;
  isTeamAdmin: boolean;
  links: PrototypeLinks;
  children: React.ReactNode;
}) {
  const enabled = import.meta.env.DEV && role !== null;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlVariant = searchParams.get("variant") as VariantKey | null;
  const [variant, setVariantState] = useState<VariantKey>(
    urlVariant && VARIANTS.some((v) => v.key === urlVariant) ? urlVariant : "A"
  );
  const seed = () => buildMockNotifications(role, isTeamAdmin, links);
  const [notifications, setNotifications] = useState(seed);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const [empty, setEmpty] = useState(false);
  const [lastAction, setLastAction] = useState("loaded mock Inbox");

  // Re-seed when the DevUI switches user.
  useEffect(() => {
    setNotifications(seed());
    setSeenIds(new Set());
    setLastAction(`switched to ${role}${isTeamAdmin ? " + Team Admin" : ""}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, isTeamAdmin, links.course?.id]);

  useEffect(() => {
    if (urlVariant && urlVariant !== variant && VARIANTS.some((v) => v.key === urlVariant)) {
      setVariantState(urlVariant);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlVariant]);

  const visible = empty ? [] : notifications;
  const unreadCount = visible.filter((n) => !n.read).length;
  const unseenCount = visible.filter((n) => !n.read && !seenIds.has(n.id)).length;

  function update(id: string, read: boolean, label: string) {
    setNotifications((ns) => ns.map((n) => (n.id === id ? { ...n, read } : n)));
    setLastAction(label);
  }

  const ctx: Ctx = {
    enabled,
    variant,
    setVariant: (v) => {
      setVariantState(v);
      const next = new URLSearchParams(searchParams);
      next.set("variant", v);
      setSearchParams(next, { replace: true });
      setLastAction(`switched to variant ${v}`);
    },
    notifications: visible,
    unreadCount,
    unseenCount,
    markRead: (id) => update(id, true, `marked ${id} read`),
    markUnread: (id) => update(id, false, `marked ${id} unread`),
    markAllRead: () => {
      setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
      setLastAction("marked all read");
    },
    markAllSeen: () => {
      setSeenIds(new Set(notifications.map((n) => n.id)));
      setLastAction("opened bell: badge cleared (seen), items still unread");
    },
    open: (n) => {
      update(n.id, true, `opened ${n.id} → ${n.href}`);
      navigate(`${n.href}${n.href.includes("?") ? "&" : "?"}variant=${variant}`);
    },
    simulateNew: () => {
      setNotifications((ns) => [makeSimulatedNotification(role, links), ...ns]);
      setLastAction("a new Notification arrived");
    },
    empty,
    setEmpty: (v) => {
      setEmpty(v);
      setLastAction(v ? "showing empty Inbox" : "restored Notifications");
    },
    reset: () => {
      setNotifications(seed());
      setSeenIds(new Set());
      setEmpty(false);
      setLastAction("reset");
    },
    lastAction,
  };

  return <InboxCtx.Provider value={ctx}>{children}</InboxCtx.Provider>;
}
