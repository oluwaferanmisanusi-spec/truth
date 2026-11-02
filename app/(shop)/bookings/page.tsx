// My bookings (Figma 3.7 upcoming, 3.8 past, 3.9 empty, 3.23 not verified, 3.24 guest bookings added).
import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ChevronRight, UserRound } from "lucide-react";
import { StepBar, BottomBar } from "@/components/shop/bars";
import { LogoutButton } from "@/components/shop/logout-button";
import { BookingStatusBadge } from "@/components/status-badge";
import { Toast } from "@/components/toast";
import { renderId } from "@/lib/notice";
import { buttonClass } from "@/components/ui";
import { requireAccount } from "@/lib/auth/customer";
import type { MyBookings } from "@api/booking";
import { api } from "@/lib/api/client";
import { formatDay, formatNaira, formatTime, SHOP_TIME_ZONE_LABEL } from "@/lib/format";
import { logOut, resendVerification } from "../(auth)/actions";
import { VerifyBanner } from "../(auth)/resend";

type Props = PageProps<"/bookings">;

export default function MyBookingsPage({ searchParams }: Props) {
  return (
    <>
      <StepBar title="My bookings" back="/" />
      <Suspense fallback={<p className="px-4 py-6 text-ink-muted">Loading…</p>}>
        <MyBookings searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function MyBookings({ searchParams }: Pick<Props, "searchParams">) {
  const [account, query] = await Promise.all([requireAccount("/bookings"), searchParams]);
  // Staff logins don't book: their own area instead.
  if (account.role === "barber") redirect("/barber");
  if (account.role === "owner" || account.role === "manager") redirect("/owner/bookings");
  const { upcoming, past } = await api<MyBookings>("/me/bookings");
  const tab = query.tab === "past" ? "past" : "upcoming";
  const list = tab === "past" ? past : upcoming;
  const added = Number(query.added);

  return (
    <main className="flex flex-1 flex-col">
      <div className="flex flex-col gap-6 px-4 py-6">
        {!account.verified && <VerifyBanner email={account.email} action={resendVerification} />}
        {account.verified && added > 0 && (
          <Toast variant="success" title={`We added ${added} ${added === 1 ? "booking" : "bookings"} you made as a guest`} trigger={renderId()}>
            They were booked with {account.email} before you had an account.
          </Toast>
        )}

        <nav aria-label="Bookings" className="grid grid-cols-2 gap-1 rounded-md bg-surface-muted p-1">
          {(["upcoming", "past"] as const).map((t) => (
            <Link
              key={t}
              href={t === "past" ? "/bookings?tab=past" : "/bookings"}
              aria-current={t === tab ? "page" : undefined}
              className={`flex h-10 items-center justify-center rounded-sm text-small font-medium focus-visible:outline-3 focus-visible:outline-focus ${
                t === tab ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"
              }`}
            >
              {t === "past" ? "Past" : "Upcoming"}
            </Link>
          ))}
        </nav>

        {list.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {list.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/bookings/${b.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 hover:border-border-input focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="font-sans text-h3 font-semibold tracking-normal">{b.serviceName}</h2>
                      <BookingStatusBadge status={b.status} rescheduleAsked={b.rescheduleAsked} />
                    </div>
                    <p className="flex items-center gap-2 text-small text-ink-muted">
                      <CalendarDays aria-hidden size={16} className="shrink-0" />
                      {formatDay(b.startsAt)}, {formatTime(b.startsAt)} {SHOP_TIME_ZONE_LABEL}
                    </p>
                    <p className="flex items-center gap-2 text-small text-ink-muted">
                      <UserRound aria-hidden size={16} className="shrink-0" />
                      with {b.barberName}
                    </p>
                    <p className="text-small font-semibold">{formatNaira(b.priceKobo)}</p>
                  </div>
                  <ChevronRight aria-hidden size={20} className="shrink-0 text-ink-muted" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <span className="mb-1 flex size-14 items-center justify-center rounded-full bg-primary-tint text-primary">
              <CalendarDays aria-hidden size={24} />
            </span>
            <h2 className="text-h2">{tab === "past" ? "No past bookings" : "No upcoming bookings"}</h2>
            <p className="text-ink-muted">
              {tab === "past" ? "Bookings you’ve had show up here." : "When you book, your appointments show up here."}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2 text-small text-ink-muted">
          <span className="min-w-0 truncate">Signed in as {account.email}</span>
          <LogoutButton action={logOut.bind(null, "/")} message="You’ll need to log in again to see your bookings." />
        </div>
      </div>
      <div className="mt-auto">
        <BottomBar>
          <Link href="/" className={`${buttonClass.primary} w-full`}>Book an appointment</Link>
        </BottomBar>
      </div>
    </main>
  );
}
