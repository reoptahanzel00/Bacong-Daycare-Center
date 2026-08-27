-- ==========================================================================
-- 20260828_01 — deployment readiness
--
-- Apply to a database that already holds records. schema.sql builds a project
-- from empty; this is the reviewed delta between what that file says today and
-- what a live project provisioned earlier actually has.
--
-- Safe to re-run: every statement is guarded.
-- ==========================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- 1. Consecutive-absence streak: bounded, set-based
--
-- The previous version looped row by row over a pupil's entire attendance
-- history, and the trigger fires once per row of a bulk register — so saving a
-- morning register for 40 children ran 40 full-history scans, growing with
-- every school day. This counts the unbroken run of absences ending at the
-- most recent record, in one pass, over the last 120 days. A streak longer
-- than that is not a streak; it is a pupil who should have been archived.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_consecutive_absences()
RETURNS TRIGGER AS $$
DECLARE
  streak INT := 0;
BEGIN
  SELECT COUNT(*) INTO streak
  FROM (
    SELECT status,
           SUM(CASE WHEN status <> 'absent' THEN 1 ELSE 0 END)
             OVER (ORDER BY date DESC ROWS UNBOUNDED PRECEDING) AS breaks
    FROM attendance
    WHERE pupil_id = NEW.pupil_id
      AND date >= CURRENT_DATE - INTERVAL '120 days'
  ) ranked
  WHERE breaks = 0 AND status = 'absent';

  UPDATE pupils SET consecutive_absences = streak WHERE id = NEW.pupil_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- The scan above reads a pupil's rows newest-first, so the index should too.
DROP INDEX IF EXISTS idx_attendance_pupil_date;
CREATE INDEX IF NOT EXISTS idx_attendance_pupil_date ON attendance(pupil_id, date DESC);

-- --------------------------------------------------------------------------
-- 2. Centre settings
--
-- DSWD Form 1 is signed and submitted, and it previously carried the same two
-- hardcoded names on every copy. The barangay captain changes with elections,
-- so this belongs in a row an admin can edit rather than in a deploy.
--
-- One row only: the boolean primary key with a CHECK makes a second row
-- impossible rather than merely discouraged.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS center_settings (
  id BOOLEAN PRIMARY KEY DEFAULT true CHECK (id),
  center_name TEXT NOT NULL DEFAULT 'Barangay Bacong Daycare Center',
  daycare_worker_name TEXT NOT NULL DEFAULT '',
  barangay_captain_name TEXT NOT NULL DEFAULT '',
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO center_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE center_settings ENABLE ROW LEVEL SECURITY;

-- Readable by everyone signed in — the report needs it. Writes go through the
-- server API on the service role, matching how the other admin-owned tables
-- are handled, so there is deliberately no client INSERT/UPDATE policy.
DROP POLICY IF EXISTS "Center Settings SELECT Auth Policy" ON center_settings;
CREATE POLICY "Center Settings SELECT Auth Policy" ON center_settings
  FOR SELECT TO authenticated
  USING (true);

-- --------------------------------------------------------------------------
-- 3. Privacy consent (RA 10173)
--
-- Recorded per account so consent is provable, and versioned so a changed
-- notice can require re-consent instead of silently inheriting the old one.
-- --------------------------------------------------------------------------
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_consent_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_consent_version TEXT;

COMMIT;

-- ==========================================================================
-- Verify (run separately, after COMMIT):
--
--   -- the trigger is the windowed version, not the old row-by-row loop
--   SELECT pg_get_functiondef('calculate_consecutive_absences()'::regprocedure)
--          LIKE '%ROWS UNBOUNDED PRECEDING%' AS trigger_is_current;
--
--   -- exactly one settings row, and it is readable
--   SELECT count(*) = 1 AS one_settings_row FROM center_settings;
--
--   -- consent columns exist
--   SELECT count(*) = 2 AS consent_columns FROM information_schema.columns
--    WHERE table_name = 'users'
--      AND column_name IN ('privacy_consent_at', 'privacy_consent_version');
-- ==========================================================================
