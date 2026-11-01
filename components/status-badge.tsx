// Figma "Status badge" (2:327). The text always states the status; colour only supports it.

import type { Database } from "@/lib/supabase/database.types";

export type BookingStatus = Database["public"]["Enums"]["booking_status"];

/** What a booking is shown as: its stored status, or one of three that depend on its state (2026-11-01). */
export type DisplayStatus = BookingStatus | "needs_outcome" | "reschedule_asked" | "refund_failed";

const BOOKING_STATUS: Record<DisplayStatus, { label: string; className: string }> = {
  pending_payment: { label: "Pending payment", className: "bg-warning-tint text-warning" },
  expired: { label: "Expired", className: "bg-neutral-tint text-ink-muted" },
  confirmed: { label: "Booked", className: "bg-primary-tint text-primary" },
  completed: { label: "Completed", className: "bg-success-tint text-success" },
  no_show: { label: "No-show", className: "bg-danger-tint text-danger" },
  cancelled: { label: "Cancelled", className: "bg-neutral-tint text-ink-muted" },
  needs_outcome: { label: "Needs outcome", className: "bg-warning-tint text-warning" },
  reschedule_asked: { label: "Reschedule asked", className: "bg-warning-tint text-warning" },
  refund_failed: { label: "Refund failed", className: "bg-danger-tint text-danger" },
};

export const BOOKING_STATUS_LABELS = Object.fromEntries(
  Object.entries(BOOKING_STATUS).map(([status, { label }]) => [status, label]),
) as Record<DisplayStatus, string>;

/**
 * One status per booking, the most pressing first: a refund that didn't go through, an
 * appointment that has started without an outcome (pass `startsAt`; customers don't see this
 * one), the shop having asked to reschedule, then the stored status.
 */
export function displayStatus({ status, startsAt, rescheduleAsked, refundFailed }: {
  status: BookingStatus;
  startsAt?: string;
  rescheduleAsked?: boolean;
  refundFailed?: boolean;
}): DisplayStatus {
  if (refundFailed) return "refund_failed";
  if (status === "confirmed") {
    if (startsAt && Date.parse(startsAt) <= Date.now()) return "needs_outcome";
    if (rescheduleAsked) return "reschedule_asked";
  }
  return status;
}

export function BookingStatusBadge(booking: Parameters<typeof displayStatus>[0]) {
  const { label, className } = BOOKING_STATUS[displayStatus(booking)];
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-caption font-medium whitespace-nowrap ${className}`}>
      {label}
    </span>
  );
}

// Record status for services and barbers.
const RECORD_STATUS = {
  active: { label: "Active", className: "bg-success-tint text-success" },
  inactive: { label: "Inactive", className: "bg-neutral-tint text-ink-muted" },
  invited: { label: "Invited", className: "bg-warning-tint text-warning" },
} as const;

export function RecordStatusBadge({ status }: { status: keyof typeof RECORD_STATUS }) {
  const { label, className } = RECORD_STATUS[status];
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-caption font-medium whitespace-nowrap ${className}`}>
      {label}
    </span>
  );
}
