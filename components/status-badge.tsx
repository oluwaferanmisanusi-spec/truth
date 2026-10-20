// Figma "Status badge" (2:327). The text always states the status; colour only supports it.

import type { Database } from "@/lib/supabase/database.types";

export type BookingStatus = Database["public"]["Enums"]["booking_status"];

const BOOKING_STATUS: Record<BookingStatus, { label: string; className: string }> = {
  pending_payment: { label: "Pending payment", className: "bg-warning-tint text-warning" },
  expired: { label: "Expired", className: "bg-neutral-tint text-ink-muted" },
  confirmed: { label: "Confirmed", className: "bg-primary-tint text-primary" },
  completed: { label: "Completed", className: "bg-success-tint text-success" },
  no_show: { label: "No-show", className: "bg-danger-tint text-danger" },
  cancelled: { label: "Cancelled", className: "bg-neutral-tint text-ink-muted" },
};

export const BOOKING_STATUS_LABELS = Object.fromEntries(
  Object.entries(BOOKING_STATUS).map(([status, { label }]) => [status, label]),
) as Record<BookingStatus, string>;

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const { label, className } = BOOKING_STATUS[status];
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-caption font-medium whitespace-nowrap ${className}`}>
      {label}
    </span>
  );
}
