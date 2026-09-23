/**
 * The consecutive-absence rule, in one place.
 *
 * The threshold lived in three: the attendance API hardcoded `>= 3` when
 * deciding whether to alert a guardian, the officials' summary counted
 * "frequent" absences with its own constant, and the parent portal's advisory
 * banner used a different number again — against a different quantity. A parent
 * could therefore be shown an alert the worker's dashboard did not count and
 * the notification never fired for.
 *
 * `consecutive_absences` is maintained by the database trigger in schema.sql;
 * it is an unbroken run of 'absent' days ending at the pupil's most recent
 * record, not a total of absences over the year.
 */

/** Consecutive absent days at which a pupil is flagged and guardians alerted. */
export const ABSENCE_ALERT_THRESHOLD = 3;
