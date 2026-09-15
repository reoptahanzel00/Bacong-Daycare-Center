-- ==========================================================================
-- 20260916_02 — Barangay officials see summarized figures only
--
-- The capstone paper defines the Barangay Official's use of the system as
-- viewing "summarized enrollment and attendance reports" on a dashboard of
-- "high-level graphical summaries and enrollment metrics". Until now the
-- SELECT policies below also let an official read every child's record
-- directly — names, addresses, guardian phones, parents' occupations, health
-- and absence notes, and the ECCD family-background notes (audit finding B2).
--
-- Officials now get their figures from /api/reports/summary, which counts
-- with the service role and returns no child-level data. These policies drop
-- 'official' so the database, not only the API, keeps child rows away from
-- that role — including through PostgREST with the public anon key.
--
-- Safe to re-run: each policy is dropped and recreated.
-- ==========================================================================

BEGIN;

DROP POLICY IF EXISTS "Pupils SELECT Policy" ON pupils;
CREATE POLICY "Pupils SELECT Policy" ON pupils
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT pupil_id FROM guardians WHERE user_id = auth.uid())
    OR public.current_user_role() IN ('worker', 'barangay_admin')
  );

DROP POLICY IF EXISTS "Guardians SELECT Policy" ON guardians;
CREATE POLICY "Guardians SELECT Policy" ON guardians
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.current_user_role() IN ('worker', 'barangay_admin')
  );

DROP POLICY IF EXISTS "Sociodemographic SELECT Policy" ON sociodemographic_profiles;
CREATE POLICY "Sociodemographic SELECT Policy" ON sociodemographic_profiles
  FOR SELECT TO authenticated
  USING (
    pupil_id IN (SELECT pupil_id FROM guardians WHERE user_id = auth.uid())
    OR public.current_user_role() IN ('worker', 'barangay_admin')
  );

DROP POLICY IF EXISTS "Attendance SELECT Policy" ON attendance;
CREATE POLICY "Attendance SELECT Policy" ON attendance
  FOR SELECT TO authenticated
  USING (
    pupil_id IN (SELECT pupil_id FROM guardians WHERE user_id = auth.uid())
    OR public.current_user_role() IN ('worker', 'barangay_admin')
  );

DROP POLICY IF EXISTS "Parent Notes SELECT Staff" ON parent_notes;
CREATE POLICY "Parent Notes SELECT Staff" ON parent_notes
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('worker', 'barangay_admin'));

DROP POLICY IF EXISTS "Child Backgrounds SELECT Staff" ON child_backgrounds;
CREATE POLICY "Child Backgrounds SELECT Staff" ON child_backgrounds
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('worker', 'barangay_admin'));

DROP POLICY IF EXISTS "ECCD Scores SELECT Staff" ON eccd_scores;
CREATE POLICY "ECCD Scores SELECT Staff" ON eccd_scores
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('worker', 'barangay_admin'));

DROP POLICY IF EXISTS "ECCD Evaluations SELECT Staff" ON eccd_evaluations;
CREATE POLICY "ECCD Evaluations SELECT Staff" ON eccd_evaluations
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('worker', 'barangay_admin'));

DROP POLICY IF EXISTS "ECCD Item Comments SELECT Staff" ON eccd_item_comments;
CREATE POLICY "ECCD Item Comments SELECT Staff" ON eccd_item_comments
  FOR SELECT TO authenticated
  USING (public.current_user_role() IN ('worker', 'barangay_admin'));

COMMIT;

-- ==========================================================================
-- Verify (run separately, after COMMIT): expect zero rows — no policy on a
-- child-data table still names the official role.
--
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public' AND qual ILIKE '%official%';
-- ==========================================================================
