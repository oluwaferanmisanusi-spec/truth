// The invite email for a new barber (Figma 5.9). Same style as the other emails.
import { composeEmail } from '../email/compose.js';

export function barberInviteEmail(email: string, url: string) {
  return composeEmail(
    email,
    'You’re invited to join Truth as a barber',
    [
      'The shop has invited you to join Truth as a barber. Open the link below to set up your account. It works for 7 days.',
      'Once you’ve joined, you can see your schedule, record how each appointment went, and block time for breaks or leave.',
      'If you weren’t expecting this, you can ignore this email.',
    ],
    [],
    { label: 'Accept the invite', url },
  );
}
