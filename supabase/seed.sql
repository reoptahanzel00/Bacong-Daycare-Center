-- ==========================================================================
-- Barangay Bacong Daycare Center Tracker - Database Seed Script
-- Initial data for School Years, Domains, Demo Pupils, and Announcements
-- ==========================================================================

-- 1. Seed School Years (current year first; previous years kept for DSWD history)
UPDATE school_years SET is_current = false WHERE is_current = true;

INSERT INTO school_years (label, start_date, end_date, is_current) VALUES
  ('SY 2026-2027', '2026-06-01', '2027-03-31', true),
  ('SY 2025-2026', '2025-06-02', '2026-03-31', false)
ON CONFLICT (label) DO NOTHING;

-- Re-run safe: ensure exactly one current school year even on re-seeds
UPDATE school_years SET is_current = true WHERE label = 'SY 2026-2027';

-- 2. Seed Progress Domains
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

-- 3. Seed Initial Demo Pupils
INSERT INTO pupils (id, first_name, last_name, birth_date, sex, address, enrollment_status, enrollment_date, consecutive_absences) VALUES
  ('PUP-2026-001', 'Mateo', 'Santos', '2021-04-12', 'Male', 'Purok 1, Barangay Bacong', 'enrolled', '2025-06-02', 0),
  ('PUP-2026-002', 'Sophia', 'Reyes', '2021-09-25', 'Female', 'Purok 2, Barangay Bacong', 'enrolled', '2025-06-02', 3),
  ('PUP-2026-003', 'Gabriel', 'Dela Cruz', '2021-02-14', 'Male', 'Purok 3, Barangay Bacong', 'enrolled', '2025-06-02', 0),
  ('PUP-2026-004', 'Althea', 'Mendoza', '2021-11-03', 'Female', 'Purok 1, Barangay Bacong', 'enrolled', '2025-06-02', 0),
  ('PUP-2026-005', 'Lucas', 'Bautista', '2021-07-19', 'Male', 'Purok 4, Barangay Bacong', 'enrolled', '2025-06-02', 0),
  ('PUP-2026-006', 'Samantha', 'Villanueva', '2021-05-30', 'Female', 'Purok 2, Barangay Bacong', 'enrolled', '2025-06-02', 0)
ON CONFLICT (id) DO NOTHING;

-- 4. Seed Guardians
INSERT INTO guardians (pupil_id, full_name, relationship, phone, is_primary_contact) VALUES
  ('PUP-2026-001', 'Maria Santos', 'Mother', '0917-123-4567', true),
  ('PUP-2026-002', 'Juan Reyes', 'Father', '0918-987-6543', true),
  ('PUP-2026-003', 'Elena Dela Cruz', 'Mother', '0920-555-1234', true),
  ('PUP-2026-004', 'Carmela Mendoza', 'Grandmother', '0919-444-8899', true),
  ('PUP-2026-005', 'Roberto Bautista', 'Father', '0917-888-9900', true),
  ('PUP-2026-006', 'Patricia Villanueva', 'Mother', '0922-333-7711', true)
ON CONFLICT DO NOTHING;

-- 5. Seed Announcements (fixed IDs so re-runs are idempotent)
INSERT INTO announcements (id, title, body) VALUES
  ('a0000000-0000-0000-0000-000000000001', '📢 Nutrition Month Feeding Program', 'Barangay Nutrition Council feeding session on Friday, Aug 15. Please bring reusable food containers.'),
  ('a0000000-0000-0000-0000-000000000002', '🩺 Dengue Awareness & Clean-up Drive', 'Barangay Health Workers will conduct a fogging and clean-up activity on Saturday morning.')
ON CONFLICT (id) DO NOTHING;

-- 6. Seed Demo Attendance (recent school days so UAT dashboards/reports
--    show meaningful data). Most pupils are present; a few late/absent rows
--    demonstrate the consecutive-absences trigger and absence alerts.
INSERT INTO attendance (pupil_id, date, status)
SELECT p.id, d::date, 'present'
FROM pupils p
CROSS JOIN unnest(ARRAY[
  '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07',
  '2026-08-10', '2026-08-11'
]::date[]) AS d
ON CONFLICT (pupil_id, date) DO NOTHING;

INSERT INTO attendance (pupil_id, date, status) VALUES
  ('PUP-2026-001', '2026-08-04', 'late'),
  ('PUP-2026-003', '2026-08-06', 'absent'),
  ('PUP-2026-002', '2026-08-10', 'absent'),
  ('PUP-2026-002', '2026-08-11', 'absent')
ON CONFLICT (pupil_id, date) DO NOTHING;

-- 5. Centre settings (single row). Names are intentionally blank: an admin
-- fills them in from the Admin portal, and DSWD Form 1 reads them from there
-- rather than carrying hardcoded signatories.
INSERT INTO center_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
