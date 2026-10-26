import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Calendar } from "lucide-react";
import { PageHeader } from "@/components/owner/page-header";
import { BookingStatusBadge } from "@/components/status-badge";
import { buttonClass } from "@/components/ui";
import { formatDay, formatNaira, formatTime, shopToday, SHOP_TIME_ZONE_LABEL } from "@/lib/format";
import { Alert } from "@/components/alert";
import type { OutcomesDue, RefundProblems } from "@api/owner";
import {
  getOutcomesDue,
  getRefundProblems,
  listBookings,
  listFilterOptions,
  parseFilters,
  type BookingFilters as Filters,
} from "@/lib/owner/bookings";
import { BookingFilters } from "./filters";
import { CancelBookingButton } from "./cancel-button";
import { MarkRefundedButton } from "./mark-refunded-button";

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
  const [bookings, options, due, refunds] = await Promise.all([
    listBookings(filters),
    listFilterOptions(),
    getOutcomesDue(),
    getRefundProblems(),
  ]);
  const isFiltered = Boolean(
    filters.barber || filters.service || filters.status || filters.from !== today || filters.to !== today,
  );

  return (
    <>
      {!showsAllRefunds(filters, refunds) && <RefundsReminder refunds={refunds} />}
      {!showsAllDue(filters, due, today) && <OutcomesReminder due={due} today={today} />}
      <div className="flex flex-col gap-4">
        <BookingFilters values={filters} today={today} options={options} isFiltered={isFiltered} />
        <p className="text-small text-ink-muted" aria-live="polite">
          {bookings.length === 1 ? "1 booking" : `${bookings.length} bookings`}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full table-fixed border-collapse text-left">
          {/* Customer takes what's left (it truncates), so the actions keep their room. */}
          <colgroup>
            <col className="w-40" />
            <col />
            <col className="w-40" />
            <col className="w-36" />
            <col className="w-29" />
            <col className="w-36.5" />
            <col className="w-40" />
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
                    <span className="flex flex-col items-start gap-1">
                      <BookingStatusBadge status={b.status} />
                      {b.rescheduleAsked && (
                        <span className="inline-flex rounded-full bg-warning-tint px-2 py-1 text-caption font-medium whitespace-nowrap text-warning">
                          Reschedule asked
                        </span>
                      )}
                      {b.refundFailed && (
                        <span className="inline-flex rounded-full bg-danger-tint px-2 py-1 text-caption font-medium whitespace-nowrap text-danger">
                          Refund failed
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="py-3 pr-5 pl-2 text-right">
                    {b.refundFailed && (
                      <MarkRefundedButton refundId={b.refundFailed.refundId} customerName={b.customerName}
                        amount={formatNaira(b.refundFailed.amountKobo)} />
                    )}
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

// Refunds that didn't go through (decided 2026-10-27): stays until each is refunded or marked
// refunded, and steps aside while the list already shows them all.
function showsAllRefunds(filters: Filters, refunds: RefundProblems) {
  if (filters.status !== "refund_failed" || filters.barber || filters.service || !refunds.oldest || !refunds.newest) return false;
  return filters.from <= shopToday(new Date(refunds.oldest)) && filters.to >= shopToday(new Date(refunds.newest));
}

function RefundsReminder({ refunds }: { refunds: RefundProblems }) {
  if (refunds.total === 0 || !refunds.oldest || !refunds.newest) return null;
  const href = `/owner/bookings?status=refund_failed&from=${shopToday(new Date(refunds.oldest))}&to=${shopToday(new Date(refunds.newest))}`;
  const one = refunds.total === 1;
  return (
    <Alert variant="danger" role="alert" title={`${one ? "A refund" : `${refunds.total} refunds`} didn’t go through`}>
      <p>
        Paystack didn’t accept {one ? "it" : "them"}, so {one ? "the customer hasn’t" : "the customers haven’t"} been refunded
        yet. We try again for a day. You can also refund from your Paystack dashboard, then choose “Mark as refunded” on
        the booking.{" "}
        <a href={href} className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
          Show {one ? "it" : "them"}
        </a>
      </p>
    </Alert>
  );
}

// The reminder steps aside only while the list already shows every appointment it's about
// (its own "Show them" link); a view of one barber's, or of fewer days, keeps it.
function showsAllDue(filters: Filters, due: OutcomesDue, today: string) {
  if (filters.status !== "needs_outcome" || filters.barber || filters.service || !due.oldest) return false;
  return filters.from <= shopToday(new Date(due.oldest)) && filters.to >= today;
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
