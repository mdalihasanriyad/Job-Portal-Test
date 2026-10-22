export const NOT_SPECIFIED = 'উল্লেখ নেই';

const dateFormatter = new Intl.DateTimeFormat('bn-BD', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Asia/Dhaka',
});

const numberFormatter = new Intl.NumberFormat('bn-BD');

export function formatDate(iso?: string): string {
  if (!iso) return NOT_SPECIFIED;
  const date = new Date(`${iso}T00:00:00+06:00`);
  if (Number.isNaN(date.getTime())) return NOT_SPECIFIED;
  return dateFormatter.format(date);
}

export function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

/** Allow only http(s) URLs to be rendered as links. */
export function isSafeHttpUrl(value?: string): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}
