-- ==========================================================================
-- 20260905_01 — Row Level Security on the two reference tables
--
-- school_years and progress_domains were the only tables in the public schema
-- left without RLS. Supabase grants anon and authenticated full DML on public
-- tables by default and RLS is the only thing that takes it back, so with it
-- off these two were readable AND writable by anyone holding the anon key --
-- which ships in the browser bundle by design and is therefore public.
--
-- progress_observations.domain_id is a foreign key into progress_domains, so
-- an anonymous DELETE against it takes the whole ECCD progress system with it.
-- school_years is what the DSWD annual report keys on.
--
-- Read-only for signed-in users, writes through the service role: the same
-- shape center_settings and announcements already use.
--
-- Safe to re-run: every statement is guarded.
-- ==========================================================================

BEGIN;

ALTER TABLE school_years ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "School Years SELECT Auth Policy" ON school_years;
CREATE POLICY "School Years SELECT Auth Policy" ON school_years
  FOR SELECT TO authenticated
  USING (true);

ALTER TABLE progress_domains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Progress Domains SELECT Auth Policy" ON progress_domains;
CREATE POLICY "Progress Domains SELECT Auth Policy" ON progress_domains
  FOR SELECT TO authenticated
  USING (true);

COMMIT;

-- ==========================================================================
-- Verify (run separately, after COMMIT):
--
--   -- every table in the public schema now has RLS on; expect zero rows
--   SELECT relname FROM pg_class
--    WHERE relnamespace = 'public'::regnamespace
--      AND relkind = 'r'
--      AND NOT relrowsecurity;
--
--   -- and each of these two has exactly one policy
--   SELECT tablename, count(*) FROM pg_policies
--    WHERE schemaname = 'public'
--      AND tablename IN ('school_years', 'progress_domains')
--    GROUP BY tablename;
-- ==========================================================================
