// Rule numbers as words, e.g. 24 → "24 hours", 1 → "1 hour", 28 days → "4 weeks".

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

export const hoursText = (n: number) => plural(n, 'hour');
export const minutesText = (n: number) => plural(n, 'minute');
export const daysText = (n: number) =>
  n % 7 === 0 ? plural(n / 7, 'week') : plural(n, 'day');
