-- ==========================================================================
-- 20260916_03 — Three roles, as the capstone paper defines
--
-- The paper's Role-Based Access Control has three roles: Daycare Worker,
-- Barangay Official and Parent/Guardian. The system had a fourth, Barangay
-- Admin, which created accounts and read the audit trail. Those duties move to
-- the Daycare Worker:
--
--   1. Every barangay_admin account becomes a worker account.
--   2. users.role no longer allows 'barangay_admin'.
--   3. Every policy that named barangay_admin now names worker; the user
--      directory and audit trail policies are the worker's.
--
-- Nothing else about access changes: officials stay on summaries only
-- (20260916_02) and parents on their own children.
--
-- Safe to re-run: the update is idempotent, the constraint is dropped before it
-- is re-added, and each policy is dropped and recreated.
-- ==========================================================================

BEGIN;

UPDATE users SET role = 'worker', updated_at = now() WHERE role = 'barangay_admin';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('worker', 'official', 'parent'));

-- Renamed: the directory policy no longer belongs to an admin role.
DROP POLICY IF EXISTS "Users Admin SELECT Policy" ON users;

DROP POLICY IF EXISTS "Users Worker SELECT Policy" ON users;
CREATE POLICY "Users Worker SELECT Policy" ON users
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'worker');

DROP POLICY IF EXISTS "Pupils SELECT Policy" ON pupils;
CREATE POLICY "Pupils SELECT Policy" ON pupils
  FOR SELECT TO authenticated
  USING (
    id IN (SELECT pupil_id FROM guardians WHERE user_id = auth.uid())
    OR public.current_user_role() = 'worker'
  );

DROP POLICY IF EXISTS "Pupils INSERT Policy" ON pupils;
CREATE POLICY "Pupils INSERT Policy" ON pupils
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'worker');

DROP POLICY IF EXISTS "Pupils UPDATE Policy" ON pupils;
CREATE POLICY "Pupils UPDATE Policy" ON pupils
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'worker')
  WITH CHECK (public.current_user_role() = 'worker');

DROP POLICY IF EXISTS "Guardians SELECT Policy" ON guardians;
CREATE POLICY "Guardians SELECT Policy" ON guardians
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.current_user_role() = 'worker'
  );

DROP POLICY IF EXISTS "Guardians INSERT Policy" ON guardians;
CREATE POLICY "Guardians INSERT Policy" ON guardians
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'worker');

DROP POLICY IF EXISTS "Guardians UPDATE Policy" ON guardians;
CREATE POLICY "Guardians UPDATE Policy" ON guardians
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'worker')
  WITH CHECK (public.current_user_role() = 'worker');

DROP POLICY IF EXISTS "Sociodemographic SELECT Policy" ON sociodemographic_profiles;
CREATE POLICY "Sociodemographic SELECT Policy" ON sociodemographic_profiles
  FOR SELECT TO authenticated
  USING (
    pupil_id IN (SELECT pupil_id FROM guardians WHERE user_id = auth.uid())
    OR public.current_user_role() = 'worker'
  );

DROP POLICY IF EXISTS "Parent Notes SELECT Staff" ON parent_notes;
CREATE POLICY "Parent Notes SELECT Staff" ON parent_notes
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'worker');

DROP POLICY IF EXISTS "ECCD Scores SELECT Staff" ON eccd_scores;
CREATE POLICY "ECCD Scores SELECT Staff" ON eccd_scores
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'worker');

DROP POLICY IF EXISTS "ECCD Evaluations SELECT Staff" ON eccd_evaluations;
CREATE POLICY "ECCD Evaluations SELECT Staff" ON eccd_evaluations
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'worker');

DROP POLICY IF EXISTS "ECCD Item Comments SELECT Staff" ON eccd_item_comments;
CREATE POLICY "ECCD Item Comments SELECT Staff" ON eccd_item_comments
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'worker');

DROP POLICY IF EXISTS "Child Backgrounds SELECT Staff" ON child_backgrounds;
CREATE POLICY "Child Backgrounds SELECT Staff" ON child_backgrounds
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'worker');

DROP POLICY IF EXISTS "Attendance SELECT Policy" ON attendance;
CREATE POLICY "Attendance SELECT Policy" ON attendance
  FOR SELECT TO authenticated
  USING (
    pupil_id IN (SELECT pupil_id FROM guardians WHERE user_id = auth.uid())
    OR public.current_user_role() = 'worker'
  );

DROP POLICY IF EXISTS "Attendance INSERT Policy" ON attendance;
CREATE POLICY "Attendance INSERT Policy" ON attendance
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'worker');

DROP POLICY IF EXISTS "Attendance UPDATE Policy" ON attendance;
CREATE POLICY "Attendance UPDATE Policy" ON attendance
  FOR UPDATE TO authenticated
  USING (public.current_user_role() = 'worker')
  WITH CHECK (public.current_user_role() = 'worker');

DROP POLICY IF EXISTS "Progress SELECT Policy" ON progress_observations;
CREATE POLICY "Progress SELECT Policy" ON progress_observations
  FOR SELECT TO authenticated
  USING (
    pupil_id IN (SELECT pupil_id FROM guardians WHERE user_id = auth.uid())
    OR public.current_user_role() = 'worker'
  );

DROP POLICY IF EXISTS "Progress INSERT Policy" ON progress_observations;
CREATE POLICY "Progress INSERT Policy" ON progress_observations
  FOR INSERT TO authenticated
  WITH CHECK (public.current_user_role() = 'worker');

DROP POLICY IF EXISTS "Audit Log SELECT Policy" ON audit_log;
CREATE POLICY "Audit Log SELECT Policy" ON audit_log
  FOR SELECT TO authenticated
  USING (public.current_user_role() = 'worker');

COMMIT;

-- ==========================================================================
-- Verify (run separately, after COMMIT): both expect zero rows.
--
--   SELECT id, email FROM users WHERE role = 'barangay_admin';
--
--   SELECT tablename, policyname FROM pg_policies
--   WHERE schemaname = 'public' AND (qual ILIKE '%barangay_admin%' OR with_check ILIKE '%barangay_admin%');
-- ==========================================================================
