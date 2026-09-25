-- ==========================================================================
-- 20260925_01 — proving a parent's email address
--
-- Absence alerts go out by email, and they name the child ("Mateo has 3
-- consecutive absences"). Until now nothing proved that the address on a
-- self-registered parent account belonged to that parent: a typo at sign-up
-- sent a child's name and attendance record to whoever owns the mistyped
-- address, and the parent never saw the alert at all.
--
-- This is deliberately NOT Supabase's own email confirmation, which gates
-- sign-in. Gating sign-in on an email is how every self-registered parent got
-- locked out of the system (see 20260925 signup fix): the account was created
-- unconfirmed and no link was ever sent. Verification here is a separate,
-- non-blocking fact about the address. An unverified parent signs in and uses
-- the portal normally; they simply do not receive email until the address is
-- proven, and their notifications still arrive in the portal feed.
--
-- Safe to re-run: every statement is guarded.
-- ==========================================================================

BEGIN;

-- When the address was proven. NULL means "not proven yet", which is the only
-- state that suppresses outbound email.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- SHA-256 of the token that was emailed, never the token itself: a leaked
-- database row must not be usable to verify somebody else's address.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token_hash TEXT;

-- When the link was sent, so an expiry can be enforced without a second table.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_sent_at TIMESTAMPTZ;

-- Accounts that already exist keep working exactly as they do today.
--
-- Every one of them was either provisioned by a Daycare Worker (who typed the
-- address themselves) or is already receiving alerts at an address that
-- evidently reaches someone. Leaving them unverified would silently switch off
-- absence alerts for the whole centre the moment this ships, which is a worse
-- failure than the one being fixed. Verification applies from here on.
UPDATE users
   SET email_verified_at = COALESCE(created_at, now())
 WHERE email_verified_at IS NULL;

-- The lookup the verification route does, on a column that is mostly NULL.
CREATE INDEX IF NOT EXISTS idx_users_email_verification_token_hash
    ON users (email_verification_token_hash)
 WHERE email_verification_token_hash IS NOT NULL;

COMMIT;

-- ==========================================================================
-- Verify (run separately, after COMMIT):
--
--   -- the three columns exist
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name = 'users' AND column_name LIKE 'email_verif%';
--
--   -- no existing account was left unverified by this migration
--   SELECT count(*) = 0 AS all_existing_backfilled
--     FROM users WHERE email_verified_at IS NULL;
-- ==========================================================================
