-- ==========================================================================
-- 20260927_01 — Capstone panel revisions
--
-- 1. Two roles. The panel dropped the Barangay Official. Existing official
--    accounts become DISABLED worker accounts (they cannot sign in); converting
--    rather than deleting keeps audit_log.user_id intact.
-- 2. Split names. users and guardians gain last/first/middle name columns;
--    full_name stays as the display value so every existing read still works.
--    pupils gain middle_name.
-- 3. Health first. pupils record illness/medical conditions and whether the
--    child has special needs, asked before anything else at enrollment.
-- 4. Enrollment timeline. submitted_at (date AND time the parent enrolled),
--    verified_at, and resubmission_count so a returned enrollment can be
--    corrected and sent back instead of dying at "rejected".
-- 5. Enrollment documents. A birth certificate per child, stored in a private
--    Storage bucket. Uploads use signed upload URLs the server issues after
--    checking the guardian link; reads use short-lived signed URLs. The bucket
--    has no client policies at all.
-- 6. Excuse letters. parent_notes are approved or declined (not merely
--    acknowledged) and numbered per child: Excuse 1, Excuse 2, ...
--
-- Safe to re-run.
-- ==========================================================================

BEGIN;

-- 1. Roles ------------------------------------------------------------------
UPDATE users SET role = 'worker', status = 'disabled', updated_at = now()
 WHERE role = 'official';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('worker', 'parent'));

-- 2. Split names ------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE guardians ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE guardians ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE guardians ADD COLUMN IF NOT EXISTS middle_name TEXT;
ALTER TABLE pupils ADD COLUMN IF NOT EXISTS middle_name TEXT;

-- Best-effort backfill of existing single-field names: last word is the
-- surname, the rest the given name. The worker can correct any that split
-- wrongly; new sign-ups fill the columns directly.
UPDATE users
   SET last_name = regexp_replace(trim(full_name), '^.*\s', ''),
       first_name = NULLIF(trim(regexp_replace(trim(full_name), '\s*\S+$', '')), '')
 WHERE last_name IS NULL;
UPDATE guardians
   SET last_name = regexp_replace(trim(full_name), '^.*\s', ''),
       first_name = NULLIF(trim(regexp_replace(trim(full_name), '\s*\S+$', '')), '')
 WHERE last_name IS NULL;

-- 3. Health & special needs --------------------------------------------------
ALTER TABLE pupils ADD COLUMN IF NOT EXISTS health_conditions TEXT;
ALTER TABLE pupils ADD COLUMN IF NOT EXISTS has_special_needs BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pupils ADD COLUMN IF NOT EXISTS special_needs_details TEXT;

-- 4. Enrollment timeline ------------------------------------------------------
ALTER TABLE pupils ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE pupils ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE pupils ADD COLUMN IF NOT EXISTS resubmission_count INT NOT NULL DEFAULT 0;
UPDATE pupils SET submitted_at = created_at WHERE submitted_at IS NULL OR submitted_at > created_at;

-- 5. Enrollment documents -----------------------------------------------------
-- One file per child at enrollment-docs/<pupil_id>/birth-certificate. Storage
-- is the record of whether it was submitted: no table to drift from it.
-- Private bucket; no storage.objects policies, so only the service role
-- (the server API) can read or write it.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('enrollment-docs', 'enrollment-docs', false, 5242880,
        ARRAY['application/pdf', 'image/jpeg', 'image/png'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 6. Excuse letters -----------------------------------------------------------
ALTER TABLE parent_notes DROP CONSTRAINT IF EXISTS parent_notes_status_check;
UPDATE parent_notes SET status = 'approved' WHERE status = 'acknowledged';
ALTER TABLE parent_notes ADD CONSTRAINT parent_notes_status_check
  CHECK (status IN ('pending', 'approved', 'declined'));
ALTER TABLE parent_notes ADD COLUMN IF NOT EXISTS excuse_no INT;
ALTER TABLE parent_notes ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

UPDATE parent_notes n
   SET excuse_no = numbered.rn
  FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY pupil_id ORDER BY submitted_at, id) AS rn
      FROM parent_notes
  ) numbered
 WHERE n.id = numbered.id AND n.excuse_no IS NULL;

CREATE OR REPLACE FUNCTION assign_excuse_no()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.excuse_no IS NULL THEN
    -- Serialise per pupil so two notes filed at once cannot share a number.
    PERFORM pg_advisory_xact_lock(hashtext('excuse_no:' || NEW.pupil_id));
    SELECT COALESCE(MAX(excuse_no), 0) + 1 INTO NEW.excuse_no
      FROM parent_notes WHERE pupil_id = NEW.pupil_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_excuse_no ON parent_notes;
CREATE TRIGGER trg_assign_excuse_no
BEFORE INSERT ON parent_notes
FOR EACH ROW
EXECUTE FUNCTION assign_excuse_no();

COMMIT;
