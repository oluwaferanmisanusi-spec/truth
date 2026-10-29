// Account emails, in the same style as the booking emails.
import { composeEmail } from '../email/compose.js';

type Person = { full_name: string; email: string };
const hi = (p: Person) =>
  p.full_name.trim() ? `Hi ${p.full_name.trim().split(/\s+/)[0]},` : 'Hi,';

export function verifyEmailEmail(person: Person, url: string) {
  return composeEmail(
    person.email,
    'Verify your email for Truth',
    [
      `${hi(person)} open the link below to finish setting up your Truth account. It works for 24 hours.`,
      'Once you verify, bookings you made as a guest with this email will show up in your account.',
      'If you didn’t create an account, you can ignore this email.',
    ],
    [],
    { label: 'Verify my email', url },
  );
}

export function resetPasswordEmail(person: Person, url: string) {
  return composeEmail(
    person.email,
    'Reset your Truth password',
    [
      `${hi(person)} use the link below to set a new password. It works for 1 hour.`,
      'If you didn’t ask to reset your password, you can ignore this email. Your password won’t change.',
    ],
    [],
    { label: 'Set a new password', url },
  );
}
