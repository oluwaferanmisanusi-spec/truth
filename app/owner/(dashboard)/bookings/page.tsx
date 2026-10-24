import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/owner/page-header";
import { BookingStatusBadge } from "@/components/status-badge";
import { buttonClass } from "@/components/ui";
import { formatDay, formatNaira, formatTime, shopToday, SHOP_TIME_ZONE_LABEL } from "@/lib/format";
import { Alert } from "@/components/alert";
import type { OutcomesDue } from "@api/owner";
import {
  getOutcomesDue,
  listBookings,
  listFilterOptions,
  parseFilters,
  type BookingFilters as Filters,
} from "@/lib/owner/bookings";
import { BookingFilters } from "./filters";
import { CancelBookingButton } from "./cancel-button";

export const metadata: Metadata = { title: "Bookings" };

// Figma 5.1 Bookings (7:3719), 5.1b filtered, 5.2 cancel, 5.3 no results.
export default function OwnerBookingsPage({ searchParams }: PageProps<"/owner/bookings">) {
  return (
    <>
      <PageHeader
        title="Bookings"
        description={`Every booking across all barbers. All times are West Africa Time (${SHOP_TIME_ZONE_LABEL}).`}
      />
      <Suspense fallback={<p className="text-small text-ink-muted">Loading bookings…</p>}>
        <BookingsResults searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function BookingsResults({ searchParams }: { searchParams: PageProps<"/owner/bookings">["searchParams"] }) {
  await connection(); // "today" depends on the clock, so this renders per request
  const filters = parseFilters(await searchParams);
  const today = shopToday();
  const [bookings, options, due] = await Promise.all([listBookings(filters), listFilterOptions(), getOutcomesDue()]);
  const isFiltered = Boolean(
    filters.barber || filters.service || filters.status || filters.from !== today || filters.to !== today,
  );

  return (
    <>
      {filters.status !== "needs_outcome" && <OutcomesReminder due={due} today={today} />}
      <div className="flex flex-col gap-4">
        <BookingFilters values={filters} today={today} options={options} isFiltered={isFiltered} />
        <p className="text-small text-ink-muted" aria-live="polite">
          {bookings.length === 1 ? "1 booking" : `${bookings.length} bookings`}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-40" />
            <col className="w-54" />
            <col className="w-44" />
            <col className="w-41.5" />
            <col className="w-29" />
            <col className="w-36.5" />
            <col />
          </colgroup>
          <thead className="bg-surface-muted text-caption font-medium text-ink-muted">
            <tr className="h-10 border-b border-border">
              <th scope="col" className="py-2 pr-2 pl-5 font-medium">When</th>
              <th scope="col" className="px-2 py-2 font-medium">Customer</th>
              <th scope="col" className="px-2 py-2 font-medium">Service</th>
              <th scope="col" className="px-2 py-2 font-medium">Barber</th>
              <th scope="col" className="px-2 py-2 text-right font-medium">Amount</th>
              <th scope="col" className="px-2 py-2 font-medium">Status</th>
              <th scope="col" className="py-2 pr-5 pl-2"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="text-small">
            {bookings.map((b) => {
              const day = formatDay(b.startsAt);
              const time = formatTime(b.startsAt);
              const barberName = b.barberName || "—";
              return (
                <tr key={b.id} className="h-18 border-b border-border last:border-b-0">
                  <td className="py-3 pr-2 pl-5 font-medium">
                    <span className="block">{day}</span>
                    <span className="block text-caption text-ink-muted">
                      {time} {SHOP_TIME_ZONE_LABEL}
                    </span>
                  </td>
                  <td className="px-2 py-3 font-medium">
                    <span className="block truncate">{b.customerName}</span>
                    <span className="block truncate text-caption text-ink-muted" title={b.customerEmail}>
                      {b.customerEmail}
                    </span>
                  </td>
                  <td className="px-2 py-3">{b.serviceName}</td>
                  <td className="px-2 py-3">{barberName}</td>
                  <td className="px-2 py-3 text-right font-medium tabular-nums">{formatNaira(b.priceKobo)}</td>
                  <td className="px-2 py-3">
                    <BookingStatusBadge status={b.status} />
                  </td>
                  <td className="py-3 pr-5 pl-2 text-right">
                    {b.cancellable && (
                      <CancelBookingButton
                        bookingId={b.id}
                        customerName={b.customerName}
                        serviceName={b.serviceName}
                        barberName={barberName}
                        day={day}
                        time={time}
                        amount={formatNaira(b.priceKobo)}
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {bookings.length === 0 && <NoResults filters={filters} />}
      </div>
    </>
  );
}

// Reminder to chase barbers for outcomes (decided with the shop on 2026-10-24; not in the
// Figma file, built from the Alert component).
function OutcomesReminder({ due, today }: { due: OutcomesDue; today: string }) {
  if (due.total === 0 || !due.oldest) return null;
  const who = due.barbers.map((b) => `${b.name} ${b.count}`).join(", ");
  const href = `/owner/bookings?status=needs_outcome&from=${shopToday(new Date(due.oldest))}&to=${today}`;
  return (
    <Alert variant="warning" title={`${due.total} past ${due.total === 1 ? "appointment has" : "appointments have"} no outcome`}>
      <p>
        Not yet marked as completed or no-show: {who}. Remind your barbers to record them, so your stats stay accurate.{" "}
        <a href={href} className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
          Show them
        </a>
      </p>
    </Alert>
  );
}

function NoResults({ filters }: { filters: Filters }) {
  const singleDay = filters.from === filters.to;
  return (
    <div className="mx-auto flex max-w-86 flex-col items-center gap-3 py-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary-tint text-primary">
        <Calendar aria-hidden size={24} />
      </div>
      <h2 className="text-h2 font-semibold">No bookings match these filters</h2>
      <p className="text-ink-muted">
        {singleDay
          ? "Try a wider date range, or clear the filters to see everything."
          : "Try different filters, or clear them to see today’s bookings."}
      </p>
      <a href="/owner/bookings" className={buttonClass.secondary}>
        Clear filters
      </a>
    </div>
  );
}
