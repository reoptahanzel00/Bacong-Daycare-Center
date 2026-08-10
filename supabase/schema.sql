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
  enrollment_status TEXT NOT NULL DEFAULT 'enrolled' CHECK (enrollment_status IN ('enrolled', 'archived')),
  enrollment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  archive_reason TEXT CHECK (archive_reason IN ('Graduated', 'Transferred', 'Dropped Out', 'Other')),
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
  ('self-help', 'Self-Help & Cognitive', 'Hygiene routines, handwashing, problem solving')
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

-- ==========================================================================
-- COMPOSITE INDEXES FOR HIGH-FREQUENCY QUERIES
-- ==========================================================================
CREATE INDEX IF NOT EXISTS idx_pupils_school_year ON pupils(school_year_id);
CREATE INDEX IF NOT EXISTS idx_attendance_pupil_date ON attendance(pupil_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date_status ON attendance(date, status);
CREATE INDEX IF NOT EXISTS idx_guardians_user_id ON guardians(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_pupil_domain ON progress_observations(pupil_id, domain_id);

-- ==========================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- Enforces Data Privacy & Eliminates IDOR Leaks at Database Layer
-- ==========================================================================

ALTER TABLE pupils ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Pupil RLS: Parents see linked children only; Staff sees all enrolled pupils
CREATE POLICY "Pupils SELECT Policy" ON pupils
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT pupil_id FROM guardians WHERE user_id = auth.uid())
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('worker', 'official', 'barangay_admin')
  );

CREATE POLICY "Pupils INSERT/UPDATE Policy" ON pupils
  FOR ALL TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) IN ('worker', 'barangay_admin'));

-- Attendance RLS: Parents view attendance of linked children only
CREATE POLICY "Attendance SELECT Policy" ON attendance
  FOR SELECT TO authenticated
  USING (
    pupil_id IN (SELECT pupil_id FROM guardians WHERE user_id = auth.uid())
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('worker', 'official', 'barangay_admin')
  );

CREATE POLICY "Attendance INSERT/UPDATE Policy" ON attendance
  FOR ALL TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'worker');

-- Progress Observations RLS: Exclude non-staff officials from individual private notes per RA 10173
CREATE POLICY "Progress SELECT Policy" ON progress_observations
  FOR SELECT TO authenticated
  USING (
    pupil_id IN (SELECT pupil_id FROM guardians WHERE user_id = auth.uid())
    OR (SELECT role FROM users WHERE id = auth.uid()) IN ('worker', 'barangay_admin')
  );

CREATE POLICY "Progress INSERT Policy" ON progress_observations
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT role FROM users WHERE id = auth.uid()) = 'worker');

-- Audit Log RLS: Immutable (Insert Only, No Updates/Deletes)
CREATE POLICY "Audit Log INSERT Policy" ON audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Audit Log SELECT Policy" ON audit_log
  FOR SELECT TO authenticated
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'barangay_admin');

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
