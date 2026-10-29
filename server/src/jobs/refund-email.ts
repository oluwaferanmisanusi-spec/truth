// To the owner when a refund still hasn't gone through after a day of tries (decided
// 2026-10-27): refund it in Paystack, then mark it refunded on the Bookings page.
import { formatDay, formatNaira } from '../common/format.js';
import { composeEmail } from '../email/compose.js';

type FailedRefund = {
  amountKobo: number;
  reference: string;
  customerName: string;
  startsAt: string;
};

export function refundsFailedEmail(
  to: string,
  refunds: FailedRefund[],
  bookingsUrl: string,
) {
  const count = refunds.length === 1 ? 'A refund' : `${refunds.length} refunds`;
  return composeEmail(
    to,
    `${count} didn’t go through`,
    [
      `${count} to ${refunds.length === 1 ? 'a customer' : 'customers'} still ${refunds.length === 1 ? 'hasn’t' : 'haven’t'} gone through after a day of trying. Paystack didn’t accept ${refunds.length === 1 ? 'it' : 'them'}:`,
      'Refund each one from your Paystack dashboard (Transactions, then Refund), then open Bookings and choose “Mark as refunded”, so the customer’s booking shows it.',
    ],
    refunds.map((r) => [
      `${r.customerName} (${r.reference})`,
      `${formatNaira(r.amountKobo)}, booked for ${formatDay(r.startsAt)}`,
    ]),
    { label: 'Open Bookings', url: bookingsUrl },
  );
}
