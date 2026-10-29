import { daysText, hoursText, minutesText } from '../common/rules-text.js';
import { composeEmail, renderEmail } from './compose.js';

const shop = { name: 'Truth', address: '14 Example Street, Lekki, Lagos' };

describe('renderEmail', () => {
  const draft = composeEmail(
    'ada@example.com',
    'You’re booked',
    ['Hi <Ada>, you’re booked.', 'See you soon.'],
    [['Service', 'Skin fade, 45 min']],
    { label: 'Manage your booking', url: 'https://example.com/b?x=1&y=2' },
  );
  const email = renderEmail(draft, shop);

  it('signs off with the shop’s name and address from settings', () => {
    expect(email.html).toContain('Truth · 14 Example Street, Lekki, Lagos');
    expect(email.text.endsWith('Truth · 14 Example Street, Lekki, Lagos')).toBe(
      true,
    );
    expect(
      renderEmail(draft, { name: 'Truth', address: '2 New Road, Ikeja' }).text,
    ).toContain('2 New Road, Ikeja');
  });

  it('escapes what customers typed, so a name can’t inject HTML', () => {
    expect(email.html).toContain('Hi &lt;Ada&gt;');
    expect(email.html).not.toContain('<Ada>');
    expect(email.html).toContain('x=1&amp;y=2');
  });

  it('has a plain-text version with the table and button link', () => {
    expect(email.text).toContain('Service: Skin fade, 45 min');
    expect(email.text).toContain(
      'Manage your booking: https://example.com/b?x=1&y=2',
    );
  });
});

describe('rule wording', () => {
  it('turns rule numbers into words', () => {
    expect(hoursText(24)).toBe('24 hours');
    expect(hoursText(1)).toBe('1 hour');
    expect(minutesText(15)).toBe('15 minutes');
    expect(daysText(28)).toBe('4 weeks');
    expect(daysText(7)).toBe('1 week');
    expect(daysText(30)).toBe('30 days');
  });
});
