// The invite email for a new manager. Same style as the other emails.
import { composeEmail } from '../email/compose.js';

export function managerInviteEmail(email: string, url: string) {
  return composeEmail(
    email,
    'You’re invited to help manage Truth',
    [
      'The shop owner has invited you to help manage Truth. Open the link below to set a password. It works for 7 days.',
      'As a manager you can see and cancel bookings, check the stats, and change services, barbers and shop settings.',
      'If you weren’t expecting this, you can ignore this email.',
    ],
    [],
    { label: 'Accept the invite', url },
  );
}
