-- ==========================================================================
-- Barangay Bacong Daycare Center Tracker - Production Supabase SQL Schema
-- Complete Postgres Schema, Check Constraints, Composite Indexes & RLS Policies
-- ==========================================================================

-- 1. School Years Table (Crucial for DSWD Annual Reporting)
CREATE TABLE IF NOT EXISTS school_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE, -- e.g. 'SY 2025-2026'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. System Users Table (Extends Supabase Auth users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('worker', 'official', 'barangay_admin', 'parent')),
  phone TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Pupils Registry Table
CREATE TABLE IF NOT EXISTS pupils (
  id TEXT PRIMARY KEY, -- e.g. 'PUP-2026-001'
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('Male', 'Female')),
  address TEXT NOT NULL,
  enrollment_status TEXT NOT NULL DEFAULT 'enrolled' CHECK (enrollment_status IN ('pending', 'enrolled', 'rejected', 'archived')),
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  archive_reason TEXT CHECK (archive_reason IN ('Graduated', 'Transferred', 'Dropped Out', 'Other')),
  rejection_reason TEXT,
  avatar_url TEXT,
  consecutive_absences INT DEFAULT 0,
  school_year_id UUID REFERENCES school_years(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  archived_at TIMESTAMPTZ
);

-- 4. Guardians Join Table (Supports Siblings & Multiple Guardians)
CREATE TABLE IF NOT EXISTS guardians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_id TEXT NOT NULL REFERENCES pupils(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Nullable if parent account not yet created
  full_name TEXT NOT NULL,
  relationship TEXT NOT NULL CHECK (relationship IN ('Mother', 'Father', 'Grandmother', 'Grandfather', 'Legal Guardian')),
  phone TEXT NOT NULL,
  is_primary_contact BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pupil_id, phone)
);

-- 5. Daily Attendance Register Table
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_id TEXT NOT NULL REFERENCES pupils(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  notes TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (pupil_id, date)
);

-- 6. Progress Domains Lookup Table
CREATE TABLE IF NOT EXISTS progress_domains (
  id TEXT PRIMARY KEY, -- 'motor', 'language', 'socio-emotional', 'self-help'
  name TEXT NOT NULL,
  description TEXT
);

INSERT INTO progress_domains (id, name, description) VALUES
  ('motor', 'Motor Skills (Fine & Gross)', 'Physical balance, hop, pincer grip, crayon drawing'),
  ('language', 'Language & Communication', 'Storytelling, Tagalog vocabulary, listening skills'),
  ('socio-emotional', 'Socio-Emotional Development', 'Sharing toys, group interaction, emotional control'),
  ('self-help', 'Self-Help & Cognitive', 'Hygiene routines, handwashing, problem solving'),
  -- 109-Item DepEd ECCD checklist domains (used by the evaluation tool)
  ('gross_motor', 'Gross Motor', 'Climbing, running, jumping, balance and body movement'),
  ('fine_motor', 'Fine Motor', 'Hand-eye coordination, drawing, grip and manipulation'),
  ('self_help', 'Self-Help', 'Feeding, dressing, toileting and hygiene independence'),
  ('receptive_language', 'Receptive Language', 'Following instructions, pointing, listening comprehension'),
  ('expressive_language', 'Expressive Language', 'Vocabulary, sentence formation, asking questions'),
  ('cognitive', 'Cognitive', 'Problem solving, matching, sorting, memory and reasoning'),
  ('socio_emotional', 'Socio-Emotional', 'Social interaction, emotional regulation, sharing and cooperation')
ON CONFLICT (id) DO NOTHING;

-- 7. Developmental Observations Table (4-Domain ECCD Checklist)
CREATE TABLE IF NOT EXISTS progress_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_id TEXT NOT NULL REFERENCES pupils(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL REFERENCES progress_domains(id),
  milestone_code TEXT, -- e.g. 'GM-01'
  title TEXT NOT NULL,
  note TEXT NOT NULL,
  observation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status_rating TEXT CHECK (status_rating IN ('Present', 'In_Progress', 'Not_Yet_Observed')),
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. Announcements Stream Table
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  posted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. System Audit Log Table (Immutable RA 10173 Audit Trail)
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  user_name TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. Notifications Table (per-user in-app feed)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pupil_id TEXT REFERENCES pupils(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('consecutive_absences', 'announcement', 'milestone', 'enrollment')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'PORTAL' CHECK (channel IN ('PORTAL', 'EMAIL', 'SMS')),
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('high', 'medium', 'info')),
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read
  ON notifications(recipient_user_id, read, created_at DESC);

-- 11. Parent Absence Notes (parent -> worker communication)
CREATE TABLE IF NOT EXISTS parent_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_id TEXT NOT NULL REFERENCES pupils(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  note_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reason TEXT NOT NULL,
  notes TEXT NOT NULL,
  phone TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acknowledged')),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parent_notes_status ON parent_notes(status, submitted_at DESC);

-- 12. Health / Nutrition Logs (weight & height per pupil per day)
CREATE TABLE IF NOT EXISTS health_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_id TEXT NOT NULL REFERENCES pupils(id) ON DELETE CASCADE,
  weight_kg TEXT,
  height_cm TEXT,
  recorded_at DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pupil_id, recorded_at)
);

-- 13. ECCD evaluation rounds (official checklist is administered up to 3x/year)
ALTER TABLE progress_observations
  ADD COLUMN IF NOT EXISTS evaluation_round SMALLINT NOT NULL DEFAULT 1;

-- 14. ECCD per-domain raw/scaled scores per round
CREATE TABLE IF NOT EXISTS eccd_scores (
  pupil_id TEXT NOT NULL REFERENCES pupils(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL REFERENCES progress_domains(id) ON DELETE CASCADE,
  evaluation_round SMALLINT NOT NULL DEFAULT 1,
  raw_score INT NOT NULL DEFAULT 0,
  scaled_score INT,
  evaluation_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (pupil_id, domain_id, evaluation_round)
);

-- 15. ECCD Child & Family Background (ECCD Form Section 2)
-- One record per pupil; parents maintain their child's info, workers review
-- it before administering the checklist.
CREATE TABLE IF NOT EXISTS child_backgrounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_id TEXT NOT NULL REFERENCES pupils(id) ON DELETE CASCADE,
  child_background TEXT,
  family_environment TEXT,
  stimulating_activities TEXT,
  home_environment TEXT,
  others TEXT,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pupil_id)
);

-- 16. ECCD Sociodemographic Profile (ECCD Form Section 1)
-- Submitted by the parent at account creation; reviewed by a Daycare Worker
-- before the pupil's enrollment is approved. One record per pupil.
CREATE TABLE IF NOT EXISTS sociodemographic_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pupil_id TEXT NOT NULL REFERENCES pupils(id) ON DELETE CASCADE,
  handedness TEXT CHECK (handedness IN ('right', 'left', 'both', 'not_yet_established')),
  currently_studying BOOLEAN NOT NULL DEFAULT false,
  school_name TEXT,
  barangay TEXT,
  municipality TEXT,
  province TEXT,
  region TEXT,
  father_name TEXT,
  father_age INT,
  father_occupation TEXT,
  father_education TEXT,
  mother_name TEXT,
  mother_age INT,
  mother_occupation TEXT,
  mother_education TEXT,
  siblings_count INT,
  birth_order TEXT,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pupil_id)
);

-- ==========================================================================
-- COMPOSITE INDEXES FOR HIGH-FREQUENCY QUERIES
-- ==========================================================================
CREATE INDEX IF NOT EXISTS idx_pupils_school_year ON pupils(school_year_id);
CREATE INDEX IF NOT EXISTS idx_pupils_enrollment_status ON pupils(enrollment_status, created_at);
CREATE INDEX IF NOT EXISTS idx_attendance_pupil_date ON attendance(pupil_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date_status ON attendance(date, status);
CREATE INDEX IF NOT EXISTS idx_guardians_user_id ON guardians(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_pupil_domain ON progress_observations(pupil_id, domain_id);

-- ==========================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- Enforces Data Privacy & Eliminates IDOR Leaks at Database Layer
-- ==========================================================================

-- Helper: returns the current user's role, executed as the table owner so RLS
-- policies can check roles WITHOUT recursive policy evaluation on `users`.
-- The `users` table is the single source of truth for roles; user_metadata is
-- user-editable and must never be trusted for authorization.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pupils ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE eccd_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_backgrounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE sociodemographic_profiles ENABLE ROW LEVEL SECURITY;

-- Users RLS: each user reads their own profile; admins read all profiles.
-- Provisioning/updates go through the admin API (service role, bypasses RLS),
-- so no client INSERT/UPDATE/DELETE policies are defined.
CREATE POLICY "Users SELECT Own Policy" ON users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users Admin SELECT Policy" ON users
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'barangay_admin');

-- Pupil RLS: Parents see linked children only; Staff sees all enrolled pupils.
-- No DELETE policy: records are soft-archived via enrollment_status.
CREATE POLICY "Pupils SELECT Policy" ON pupils
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT pupil_id FROM guardians WHERE user_id = auth.uid())
    OR public.current_user_role() IN ('worker', 'official', 'barangay_admin')
  );

CREATE POLICY "Pupils INSERT Policy" ON pupils
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('worker', 'barangay_admin'));

CREATE POLICY "Pupils UPDATE Policy" ON pupils
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('worker', 'barangay_admin'))
  WITH CHECK (public.current_user_role() IN ('worker', 'barangay_admin'));

-- Guardians RLS: parents see their own guardianship rows; staff sees all.
-- (This also lets the pupils/attendance JOINs resolve linked children.)
CREATE POLICY "Guardians SELECT Policy" ON guardians
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.current_user_role() IN ('worker', 'official', 'barangay_admin')
  );

CREATE POLICY "Guardians INSERT Policy" ON guardians
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('worker', 'barangay_admin'));

CREATE POLICY "Guardians UPDATE Policy" ON guardians
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('worker', 'barangay_admin'))
  WITH CHECK (public.current_user_role() IN ('worker', 'barangay_admin'));

-- Attendance RLS: Parents view attendance of linked children only.
-- UPDATE exists so workers/admins can correct registers; matching the API.
CREATE POLICY "Attendance SELECT Policy" ON attendance
  FOR SELECT TO authenticated
  USING (
    pupil_id IN (SELECT pupil_id FROM guardians WHERE user_id = auth.uid())
    OR public.current_user_role() IN ('worker', 'official', 'barangay_admin')
  );

CREATE POLICY "Attendance INSERT Policy" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('worker', 'barangay_admin'));

CREATE POLICY "Attendance UPDATE Policy" ON attendance
  FOR UPDATE TO authenticated
  USING (public.current_user_role() IN ('worker', 'barangay_admin'))
  WITH CHECK (public.current_user_role() IN ('worker', 'barangay_admin'));

-- Progress Observations RLS: Exclude non-staff officials from individual private notes per RA 10173
CREATE POLICY "Progress SELECT Policy" ON progress_observations
  FOR SELECT TO authenticated
  USING (
    pupil_id IN (SELECT pupil_id FROM guardians WHERE user_id = auth.uid())
    OR public.current_user_role() IN ('worker', 'barangay_admin')
  );

CREATE POLICY "Progress INSERT Policy" ON progress_observations
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() IN ('worker', 'barangay_admin'));

-- Audit Log RLS: Immutable. Writes happen ONLY through the server API
-- (/api/audit-log) using the service-role key, so there is deliberately NO
-- client INSERT policy — authenticated users cannot forge audit entries.
CREATE POLICY "Audit Log SELECT Policy" ON audit_log
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'barangay_admin');

-- Notifications RLS: each user reads/updates their own feed. Inserts happen
-- ONLY through the server API (service role), so no client INSERT policy.
CREATE POLICY "Notifications SELECT Own" ON notifications
  FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid());

CREATE POLICY "Notifications UPDATE Own" ON notifications
  FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

-- Parent notes, health logs, ECCD scores, child backgrounds & sociodemographic
-- profiles: NO client policies — all access goes through the server API
-- (service role) with session-derived identities, so direct client writes/reads
-- are denied by default.

-- ==========================================================================
-- AUTOMATIC CONSECUTIVE ABSENCES TRIGGER FUNCTION
-- Automatically computes streak of consecutive 'absent' days for pupils
-- ==========================================================================

CREATE OR REPLACE FUNCTION calculate_consecutive_absences()
RETURNS TRIGGER AS $$
DECLARE
  streak INT := 0;
  rec RECORD;
BEGIN
  -- Count consecutive absences backwards from most recent entry for the pupil
  FOR rec IN 
    SELECT status FROM attendance 
    WHERE pupil_id = NEW.pupil_id 
    ORDER BY date DESC 
  LOOP
    IF rec.status = 'absent' THEN
      streak := streak + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;

  UPDATE pupils SET consecutive_absences = streak WHERE id = NEW.pupil_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_consecutive_absences ON attendance;
CREATE TRIGGER trg_calculate_consecutive_absences
AFTER INSERT OR UPDATE ON attendance
FOR EACH ROW
EXECUTE FUNCTION calculate_consecutive_absences();
