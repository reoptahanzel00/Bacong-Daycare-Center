-- ==========================================================================
-- Barangay Bacong Daycare Center Tracker - Database Seed Script
-- Initial data for School Years, Domains, Demo Pupils, and Announcements
-- ==========================================================================

-- 1. Seed Current School Year
INSERT INTO school_years (label, start_date, end_date, is_current)
VALUES ('SY 2025-2026', '2025-06-02', '2026-03-31', true)
ON CONFLICT (label) DO NOTHING;

-- 2. Seed Progress Domains
INSERT INTO progress_domains (id, name, description) VALUES
  ('motor', 'Motor Skills (Fine & Gross)', 'Physical balance, hop, pincer grip, crayon drawing'),
  ('language', 'Language & Communication', 'Storytelling, Tagalog vocabulary, listening skills'),
  ('socio-emotional', 'Socio-Emotional Development', 'Sharing toys, group interaction, emotional control'),
  ('self-help', 'Self-Help & Cognitive', 'Hygiene routines, handwashing, problem solving')
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

-- 5. Seed Announcements
INSERT INTO announcements (title, body) VALUES
  ('📢 Nutrition Month Feeding Program', 'Barangay Nutrition Council feeding session on Friday, Aug 15. Please bring reusable food containers.'),
  ('🩺 Dengue Awareness & Clean-up Drive', 'Barangay Health Workers will conduct a fogging and clean-up activity on Saturday morning.')
ON CONFLICT DO NOTHING;
