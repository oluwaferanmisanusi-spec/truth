// The 19:00 reminder for barbers with appointments still to record (decided 2026-10-24).
import { formatDay, formatTime } from '../common/format.js';
import { composeEmail } from '../email/compose.js';

type Due = { customer_name: string; starts_at: string };

export function outcomeReminderEmail(
  barber: { full_name: string; email: string },
  due: Due[],
  scheduleUrl: string,
) {
  const first = barber.full_name.trim().split(/\s+/)[0];
  const count =
    due.length === 1 ? '1 appointment' : `${due.length} appointments`;
  return composeEmail(
    barber.email,
    `${count} still ${due.length === 1 ? 'needs' : 'need'} an outcome`,
    [
      `Hi ${first}, ${count} on your schedule ${due.length === 1 ? 'has' : 'have'} started but ${due.length === 1 ? 'doesn’t' : 'don’t'} have an outcome yet:`,
      'Open your schedule and mark each one as completed or a no-show, so the shop’s records and stats are right.',
    ],
    due.map((d) => [
      d.customer_name,
      `${formatDay(d.starts_at)}, ${formatTime(d.starts_at)}`,
    ]),
    { label: 'Open my schedule', url: scheduleUrl },
  );
}
