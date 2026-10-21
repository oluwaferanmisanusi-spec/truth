// Pieces shared by the account and guest-link booking screens.
import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, type LucideIcon } from "lucide-react";
import { BrandBar, BottomBar } from "@/components/shop/bars";
import { StatusHero } from "@/components/shop/status-hero";
import { buttonClass } from "@/components/ui";
import { resolveBooking, type Access, type Managed } from "@/lib/booking/manage";

/** Resolves access inside Suspense, then renders; 404 if not theirs, 3.19 if the link ran out. */
export function WithBooking({ access, children }: { access: Promise<Access>; children: (m: Managed) => Promise<ReactNode> | ReactNode }) {
  return (
    <Suspense fallback={<BrandBar />}>
      <Resolve access={access}>{children}</Resolve>
    </Suspense>
  );
}

async function Resolve({ access, children }: { access: Promise<Access>; children: (m: Managed) => Promise<ReactNode> | ReactNode }) {
  const managed = await resolveBooking(await access);
  if (!managed) notFound();
  if (managed.expired) return <GuestLinkExpired />;
  return children(managed);
}

// Figma 3.19
function GuestLinkExpired() {
  return (
    <ResultScreen icon={Clock} title="This link has expired" action={{ label: "Book an appointment", href: "/" }}>
      Booking links stop working once the appointment time has passed. You can still book a new appointment.
    </ResultScreen>
  );
}

/** Wordmark bar, centred status, optional content, one main action at the bottom. */
export function ResultScreen({ title, children, extra, action, icon, tone = "warning" }: {
  title: string;
  children: ReactNode;
  extra?: ReactNode;
  action: { label: string; href: string };
  icon: LucideIcon;
  tone?: "warning" | "success";
}) {
  return (
    <>
      <BrandBar />
      <main className="flex flex-1 flex-col">
        <div className="flex flex-col gap-6 px-4 pt-10 pb-6">
          <StatusHero icon={icon} tone={tone} title={title}>{children}</StatusHero>
          {extra}
        </div>
        <div className="mt-auto">
          <BottomBar>
            <Link href={action.href} className={`${buttonClass.primary} w-full`}>{action.label}</Link>
          </BottomBar>
        </div>
      </main>
    </>
  );
}

/** Where "back to my bookings" goes: the list for accounts, the booking itself for guests. */
export const homeFor = (m: Managed) =>
  m.access.kind === "account"
    ? { label: "Back to my bookings", href: "/bookings" }
    : { label: "Back to your booking", href: m.base };
