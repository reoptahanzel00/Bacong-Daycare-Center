-- ==========================================================================
-- Barangay Bacong Daycare Center Tracker - DEMO data
--
-- STAGING AND UAT ONLY. NEVER RUN THIS AGAINST PRODUCTION.
--
-- Six fictional children with fictional guardians and phone numbers, plus the
-- attendance rows that make the dashboards and the consecutive-absence trigger
-- show something during a walkthrough.
--
-- These records are indistinguishable from real ones once inserted: they carry
-- an 'enrolled' status, so they are counted by the roster, by the monthly
-- summary, and by DSWD Form 1 -- a document that is signed and submitted to a
-- national agency. An overstated enrolment return is a much worse problem than
-- an empty demo database, which is why this is a separate file.
--
-- Run supabase/seed.sql first; this depends on the school year and the
-- progress domains it creates.
-- ==========================================================================

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

