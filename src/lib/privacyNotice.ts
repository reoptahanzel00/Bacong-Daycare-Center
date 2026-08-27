/**
 * Version of the privacy notice currently published at /privacy.
 *
 * Stored against each account at signup, so a revised notice can require
 * re-consent rather than silently inheriting an agreement to older wording.
 * Bump this whenever the notice text changes materially.
 *
 * It lives here rather than in the page because the signup form is a client
 * component: importing it from the page would pull that server component into
 * the client bundle.
 */
export const PRIVACY_NOTICE_VERSION = 'draft-2026-08-28';
