/**
 * Dates in the centre's timezone.
 *
 * The app previously derived "today" with `new Date().toISOString()` sliced at
 * the `T`, in fourteen places. That renders UTC, and the Philippines is UTC+8,
 * so between midnight and 08:00 local that expression returns *yesterday*. A
 * worker opening the attendance register at 07:30 got the previous day
 * pre-filled and upserted the morning's register over yesterday's rows --
 * during exactly the hour the register is taken. Server-side it is worse:
 * Vercel functions run in UTC, so every API default was wrong for those eight
 * hours regardless of who called.
 *
 * The centre is in San Luis, Aurora and does not move, so the zone is fixed
 * rather than read from the browser: a parent checking attendance while abroad
 * should still see the school day the record belongs to.
 */

/** IANA zone for the daycare centre. The Philippines has no DST. */
export const CENTER_TIMEZONE = 'Asia/Manila';

/**
 * Today's date at the centre, as `YYYY-MM-DD`.
 *
 * `en-CA` formats dates as YYYY-MM-DD, so this needs no string surgery and no
 * manual offset arithmetic.
 */
export function todayLocalISO(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CENTER_TIMEZONE }).format(new Date());
}

/** The centre-local date of a given instant, as `YYYY-MM-DD`. */
export function toLocalISODate(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CENTER_TIMEZONE }).format(date);
}
