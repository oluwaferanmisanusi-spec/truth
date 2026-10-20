import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/owner";

// Every page in this group is owner-only. The proxy redirects logged-out visitors early;
// OwnerGate is the authoritative check (it also turns away logged-in customers and barbers).
// The session read sits behind Suspense, as Cache Components requires.
export default function OwnerDashboardLayout({ children }: LayoutProps<"/owner">) {
  return (
    <Suspense fallback={<p className="p-10 text-ink-muted">Loading…</p>}>
      <OwnerGate>{children}</OwnerGate>
    </Suspense>
  );
}

async function OwnerGate({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return children;
}
