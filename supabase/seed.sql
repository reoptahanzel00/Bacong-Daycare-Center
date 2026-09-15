-- ==========================================================================
-- Barangay Bacong Daycare Center Tracker - Database Seed Script
--
-- REFERENCE DATA ONLY. Everything here is data the application needs in order
-- to function at all: the school years the DSWD annual report keys on, the
-- ECCD domains that progress_observations.domain_id points at, and the single
-- centre-settings row an admin then fills in.
--
-- Safe to run against production. It is meant to be.
--
-- Demo pupils, guardians, announcements and attendance used to live in this
-- file, and DEPLOYMENT.md tells you to run it as part of the production setup
-- -- so following the documentation put six fictional children into the live
-- roster, where they flowed into the enrolment counts on a DSWD Form 1 that
-- the barangay captain signs. They now live in seed.demo.sql, which is for
-- staging and UAT only.
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


-- 3. Centre settings (single row). Names are intentionally blank: an admin
-- fills them in from the Admin portal, and DSWD Form 1 reads them from there
-- rather than carrying hardcoded signatories.
INSERT INTO center_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
