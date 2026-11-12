// PROTOTYPE (bell + Inbox, wayfinder ticket #5): throwaway full-page Inbox,
// used by variant B (page only) and variant C (drawer + page).
import { Link } from "react-router";
import { usePrototypeInbox } from "~/components/prototype-bell-inbox/inbox-context";
import { VariantBPage } from "~/components/prototype-bell-inbox/variant-b-page";

export default function PrototypeInboxPage() {
  const inbox = usePrototypeInbox();
  if (!inbox?.enabled) {
    return <div className="p-8">Pick a user in the DevUI panel (dev only).</div>;
  }
  if (inbox.variant === "A") {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Variant A has no Inbox page: the dropdown under the sidebar bell is the
        whole Inbox. <Link to="/courses?variant=A" className="underline">Back</Link>
      </div>
    );
  }
  return <VariantBPage />;
}
