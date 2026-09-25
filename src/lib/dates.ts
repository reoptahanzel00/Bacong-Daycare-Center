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

/**
 * The current year at the centre, as `YYYY`.
 *
 * Student IDs are minted as `PUP-<year>-<suffix>`, and the year came from
 * `new Date().getFullYear()` — the *server's* year. Vercel functions run in
 * UTC, so for the eight hours between midnight and 08:00 Manila on the 1st of
 * January every child enrolled was issued an ID stamped with the year that had
 * just ended. That ID is the child's sign-in identifier and it is printed on
 * their forms, so it is not something to re-issue later.
 */
export function currentYearLocal(): string {
  return todayLocalISO().slice(0, 4);
}

/**
 * An instant as `YYYY-MM-DD HH:MM:SS` at the centre.
 *
 * Audit entries, absence notes and background edits record when something
 * happened at the daycare. Rendered with the reader's own zone — which is what
 * `toLocaleString` does by default — two people looking at the same audit entry
 * describe it as having happened at different times, and a parent abroad reads
 * their note as sent on a different day than the worker filed it under.
 *
 * `sv` is used for its format alone: it is the one common locale that spells a
 * date and time as `YYYY-MM-DD HH:MM:SS`.
 */
export function formatLocalTimestamp(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('sv', { timeZone: CENTER_TIMEZONE }).replace('T', ' ');
}
