// Customer emails about a booking. Each returns both HTML and plain text.
import {
  formatDay,
  formatNaira,
  formatTime,
  SHOP_TIME_ZONE_LABEL,
} from '../common/format.js';
import { hoursText, minutesText } from '../common/rules-text.js';
import type { Rules } from '../contracts/shop.js';
import { composeEmail as build } from '../email/compose.js';

const firstName = (name: string) => name.trim().split(/\s+/)[0];
const when = (b: EmailBooking) =>
  `${formatDay(b.starts_at)}, ${formatTime(b.starts_at)} ${SHOP_TIME_ZONE_LABEL}`;

export type EmailBooking = {
  reference: string;
  customer_name: string;
  customer_email: string;
  service_name: string;
  duration_minutes: number;
  price_kobo: number;
  starts_at: string;
  any_barber: boolean;
  barber_name: string;
};

export function bookingConfirmedEmail(
  b: EmailBooking,
  manageUrl: string,
  rules: Rules,
) {
  return build(
    b.customer_email,
    `You’re booked: ${b.service_name} on ${formatDay(b.starts_at)} at ${formatTime(b.starts_at)}`,
    [
      `Hi ${firstName(b.customer_name)}, you’re booked at Truth.`,
      ...(b.any_barber
        ? [
            `You chose any available barber, so we matched you with ${firstName(b.barber_name)}.`,
          ]
        : []),
      `Arrive within ${minutesText(rules.noShowGraceMinutes)} of your start time, or it counts as a no-show. To cancel or reschedule, use the link below up to ${hoursText(rules.refundWindowHours)} before for a full refund.`,
    ],
    [
      ['Service', `${b.service_name}, ${b.duration_minutes} min`],
      ['Barber', b.barber_name],
      ['Date and time', when(b)],
      ['Paid', formatNaira(b.price_kobo)],
      ['Reference', b.reference],
    ],
    { label: 'Manage your booking', url: manageUrl },
  );
}

export function latePaymentRefundEmail(b: EmailBooking, bookAgainUrl: string) {
  return build(
    b.customer_email,
    `Your payment for ${b.service_name} has been refunded`,
    [
      `Hi ${firstName(b.customer_name)}, your payment came through after we’d stopped holding ${formatTime(b.starts_at)} on ${formatDay(b.starts_at)}, and someone else booked that time in the meantime.`,
      `Your booking wasn’t made, so we’ve refunded the full ${formatNaira(b.price_kobo)}. It can take a few working days to show in your account.`,
    ],
    [
      ['Service', `${b.service_name}, ${b.duration_minutes} min`],
      ['Time you chose', when(b)],
      ['Refund', formatNaira(b.price_kobo)],
      ['Reference', b.reference],
    ],
    { label: 'Choose another time', url: bookAgainUrl },
  );
}

export function cancelledByCustomerEmail(
  b: EmailBooking,
  refunded: boolean,
  bookAgainUrl: string,
  rules: Rules,
) {
  return build(
    b.customer_email,
    `Your booking on ${formatDay(b.starts_at)} is cancelled`,
    [
      `Hi ${firstName(b.customer_name)}, your booking is cancelled.`,
      refunded
        ? `Your ${formatNaira(b.price_kobo)} refund is on its way to the card you paid with. It can take a few working days to show in your account.`
        : `It was less than ${hoursText(rules.refundWindowHours)} away, so there’s no refund.`,
    ],
    [
      ['Service', `${b.service_name}, ${b.duration_minutes} min`],
      ['Barber', b.barber_name],
      ['Date and time', when(b)],
      ['Reference', b.reference],
    ],
    { label: 'Book another time', url: bookAgainUrl },
  );
}

export function bookingMovedEmail(
  b: EmailBooking,
  previousStartsAt: string,
  rules: Rules,
) {
  return build(
    b.customer_email,
    `Booking moved: ${b.service_name} on ${formatDay(b.starts_at)} at ${formatTime(b.starts_at)}`,
    [
      `Hi ${firstName(b.customer_name)}, your booking has moved to ${formatDay(b.starts_at)} at ${formatTime(b.starts_at)}.`,
      `Your payment moved with it, so there’s nothing more to pay. To cancel or move it again, use the link in your confirmation email or your Truth account, up to ${hoursText(rules.refundWindowHours)} before.`,
    ],
    [
      ['Service', `${b.service_name}, ${b.duration_minutes} min`],
      ['Barber', b.barber_name],
      [
        'Was',
        `${formatDay(previousStartsAt)}, ${formatTime(previousStartsAt)}`,
      ],
      ['Now', when(b)],
      ['Reference', b.reference],
    ],
  );
}

export function cancelledByShopEmail(b: EmailBooking, bookAgainUrl: string) {
  return build(
    b.customer_email,
    `Your booking on ${formatDay(b.starts_at)} has been cancelled`,
    [
      `Hi ${firstName(b.customer_name)}, we’re sorry: Truth has had to cancel your booking.`,
      `You’ll get a full refund of ${formatNaira(b.price_kobo)}. It can take a few working days to show in your account.`,
    ],
    [
      ['Service', `${b.service_name}, ${b.duration_minutes} min`],
      ['Barber', b.barber_name],
      ['Date and time', when(b)],
      ['Reference', b.reference],
    ],
    { label: 'Book another time', url: bookAgainUrl },
  );
}
