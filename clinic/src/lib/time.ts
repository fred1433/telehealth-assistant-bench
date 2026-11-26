/** UTC calendar day as YYYY-MM-DD. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Start and end (exclusive) of a UTC day, as Date objects. */
export function utcDayBounds(day: string): { start: Date; end: Date } {
  const start = new Date(`${day}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}
