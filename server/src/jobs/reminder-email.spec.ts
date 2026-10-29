import { renderEmail } from '../email/compose.js';
import { outcomeReminderEmail } from './reminder-email.js';

const shop = { name: 'Truth', address: '14 Example Street, Lekki, Lagos' };
const barber = { full_name: 'Kemi Bello', email: 'kemi.bello@example.com' };

describe('outcomeReminderEmail', () => {
  it('lists each appointment still to record, with a link to the schedule', () => {
    const due = [
      { customer_name: 'Ada Obi', starts_at: '2026-10-21T09:30:00Z' },
      { customer_name: 'Musa Ibrahim', starts_at: '2026-10-24T12:30:00Z' },
    ];
    const draft = outcomeReminderEmail(
      barber,
      due,
      'https://truth.example/barber',
    );
    const email = renderEmail(draft, shop);
    expect(email.to).toBe('kemi.bello@example.com');
    expect(email.subject).toBe('2 appointments still need an outcome');
    expect(email.text).toContain('Hi Kemi, 2 appointments');
    expect(email.text).toContain('Ada Obi');
    expect(email.text).toContain('Wed 21 Oct, 10:30');
    expect(email.text).toContain('Sat 24 Oct, 13:30');
    expect(email.html).toContain('https://truth.example/barber');
  });

  it('reads naturally for one appointment', () => {
    const draft = outcomeReminderEmail(
      barber,
      [{ customer_name: 'Ada Obi', starts_at: '2026-10-21T09:30:00Z' }],
      'https://truth.example/barber',
    );
    expect(draft.subject).toBe('1 appointment still needs an outcome');
    expect(draft.paragraphs[0]).toContain('has started but doesn’t have');
  });
});
