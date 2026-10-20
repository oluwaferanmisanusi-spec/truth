import { Suspense } from "react";
import { requireOwner } from "@/lib/auth/owner";
import { OwnerSidebar } from "@/components/owner/sidebar";

// Every page in this group is owner-only. The proxy redirects logged-out visitors early;
// OwnerShell is the authoritative check (it also turns away logged-in customers and barbers).
// The session read sits behind Suspense, as Cache Components requires.
export default function OwnerDashboardLayout({ children }: LayoutProps<"/owner">) {
  return (
    <Suspense fallback={<p className="p-10 text-ink-muted">Loading…</p>}>
      <OwnerShell>{children}</OwnerShell>
    </Suspense>
  );
}

async function OwnerShell({ children }: { children: React.ReactNode }) {
  const owner = await requireOwner();
  return (
    <div className="flex min-h-screen">
      <OwnerSidebar name={owner.full_name || "Shop owner"} email={owner.email} />
      <main className="flex min-w-0 flex-1 flex-col gap-8 p-10">{children}</main>
    </div>
  );
}
