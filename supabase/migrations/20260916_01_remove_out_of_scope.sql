-- ==========================================================================
-- 20260916_01 — Remove features the capstone paper does not include
--
-- The system is required to follow the manuscript (Barangay Bacong Daycare
-- Center Student Progress and Enrollment Tracker). Its scope is enrollment,
-- daily attendance and developmental progress; it has no announcement board
-- and no nutrition / growth log. Both features are removed from the app in the
-- same change, so their tables go too.
--
-- Both tables are empty: the go-live reset on 2026-09-15 cleared them, and a
-- JSON backup of every row they ever held was taken then.
--
-- Safe to re-run: every statement is guarded.
-- ==========================================================================

BEGIN;

DROP TABLE IF EXISTS health_logs;
DROP TABLE IF EXISTS announcements;

COMMIT;

-- ==========================================================================
-- Verify (run separately, after COMMIT): expect zero rows.
--
--   SELECT tablename FROM pg_tables
--   WHERE schemaname = 'public' AND tablename IN ('health_logs', 'announcements');
-- ==========================================================================
