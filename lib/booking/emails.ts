// Customer emails about a booking. Each returns both HTML and plain text.
import "server-only";
import { formatDay, formatNaira, formatTime, SHOP_TIME_ZONE_LABEL } from "@/lib/format";
import { siteUrl } from "@/lib/invites";

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

const SHOP_ADDRESS = "14 Example Street, Lekki, Lagos";

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const firstName = (name: string) => name.trim().split(/\s+/)[0];
const when = (b: EmailBooking) => `${formatDay(b.starts_at)}, ${formatTime(b.starts_at)} ${SHOP_TIME_ZONE_LABEL}`;

function layout(paragraphs: string[], rows: [string, string][], button?: { label: string; url: string }) {
  const p = (t: string) => `<p style="margin:0 0 16px">${t}</p>`;
  const table = rows
    .map(([k, v]) =>
      `<tr><td style="padding:6px 16px 6px 0;color:#5a6070">${escape(k)}</td><td style="padding:6px 0">${escape(v)}</td></tr>`)
    .join("");
  const btn = button
    ? `<p style="margin:24px 0"><a href="${button.url}" style="display:inline-block;background:#1e3a5f;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">${escape(button.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#faf8f4;font-family:Inter,Arial,sans-serif;color:#15181e;font-size:16px;line-height:24px">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
<p style="margin:0 0 24px;font-family:Georgia,serif;font-size:22px;font-weight:600;color:#1e3a5f">Truth</p>
${paragraphs.slice(0, 1).map(p).join("")}
<table style="border-collapse:collapse;margin:0 0 16px">${table}</table>
${paragraphs.slice(1).map(p).join("")}
${btn}
<p style="margin:32px 0 0;color:#5a6070;font-size:14px">Truth · ${SHOP_ADDRESS}</p>
</div></body></html>`;
}

function plain(paragraphs: string[], rows: [string, string][], button?: { label: string; url: string }) {
  return [
    paragraphs[0],
    rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
    ...paragraphs.slice(1),
    button ? `${button.label}: ${button.url}` : "",
    `Truth · ${SHOP_ADDRESS}`,
  ].filter(Boolean).join("\n\n");
}

function build(to: string, subject: string, paragraphs: string[], rows: [string, string][], button?: { label: string; url: string }) {
  const safe = paragraphs.map(escape);
  return { to, subject, html: layout(safe, rows, button), text: plain(paragraphs, rows, button) };
}

export function bookingConfirmedEmail(b: EmailBooking, manageUrl: string) {
  return build(
    b.customer_email,
    `You’re booked: ${b.service_name} on ${formatDay(b.starts_at)} at ${formatTime(b.starts_at)}`,
    [
      `Hi ${firstName(b.customer_name)}, you’re booked at Truth.`,
      ...(b.any_barber ? [`You chose any available barber, so we matched you with ${firstName(b.barber_name)}.`] : []),
      "Arrive within 15 minutes of your start time, or it counts as a no-show. To cancel or reschedule, use the link below up to 24 hours before for a full refund.",
    ],
    [
      ["Service", `${b.service_name}, ${b.duration_minutes} min`],
      ["Barber", b.barber_name],
      ["Date and time", when(b)],
      ["Paid", formatNaira(b.price_kobo)],
      ["Reference", b.reference],
    ],
    { label: "Manage your booking", url: manageUrl },
  );
}

export function latePaymentRefundEmail(b: EmailBooking) {
  return build(
    b.customer_email,
    `Your payment for ${b.service_name} has been refunded`,
    [
      `Hi ${firstName(b.customer_name)}, your payment came through after we’d stopped holding ${formatTime(b.starts_at)} on ${formatDay(b.starts_at)}, and someone else booked that time in the meantime.`,
      `Your booking wasn’t made, so we’ve refunded the full ${formatNaira(b.price_kobo)}. It can take a few working days to show in your account.`,
    ],
    [
      ["Service", `${b.service_name}, ${b.duration_minutes} min`],
      ["Time you chose", when(b)],
      ["Refund", formatNaira(b.price_kobo)],
      ["Reference", b.reference],
    ],
    { label: "Choose another time", url: siteUrl("/") },
  );
}

export function cancelledByShopEmail(b: EmailBooking) {
  return build(
    b.customer_email,
    `Your booking on ${formatDay(b.starts_at)} has been cancelled`,
    [
      `Hi ${firstName(b.customer_name)}, we’re sorry: Truth has had to cancel your booking.`,
      `You’ll get a full refund of ${formatNaira(b.price_kobo)}. It can take a few working days to show in your account.`,
    ],
    [
      ["Service", `${b.service_name}, ${b.duration_minutes} min`],
      ["Barber", b.barber_name],
      ["Date and time", when(b)],
      ["Reference", b.reference],
    ],
    { label: "Book another time", url: siteUrl("/") },
  );
}
