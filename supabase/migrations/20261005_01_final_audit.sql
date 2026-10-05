-- ==========================================================================
-- 20261005_01 — Final audit fixes
--
-- 1. Disabled accounts no longer pass RLS. current_user_role() returned the
--    role of ANY profile row, active or not, and the only status check lived
--    in /api/auth/login. Someone signing in straight to Supabase with the
--    public anon key skipped it and RLS treated them as a full worker. The
--    20260927 migration made every former official a *disabled worker*
--    without banning their login, so this was reachable.
-- 2. Every disabled profile is banned at the auth layer too (same duration as
--    PATCH /api/users/[id] uses), so the account cannot mint a token at all.
-- 3. Users may only flip `read` on their own notifications, not rewrite the
--    title/message/type/pupil of an alert.
-- 4. updated_at is maintained by trigger on every table that has it; before
--    this, upserts left it at the creation time.
-- 5. Indexes for the parent_notes RLS/excuse-number lookups and the audit
--    log's newest-first listing; eccd_scores.evaluation_round gets the same
--    1..3 check as the other ECCD tables.
--
-- Safe to re-run.
-- ==========================================================================

BEGIN;

-- 1. Role helper fails closed for disabled accounts ---------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.users WHERE id = auth.uid() AND status = 'active'
$$;

REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM anon;

-- 2. Ban every disabled profile at the auth layer ----------------------------
UPDATE auth.users au
   SET banned_until = now() + INTERVAL '100 years'
  FROM public.users pu
 WHERE pu.id = au.id
   AND pu.status = 'disabled'
   AND (au.banned_until IS NULL OR au.banned_until < now());

-- 3. Notifications: only `read` is client-writable ---------------------------
REVOKE UPDATE ON public.notifications FROM authenticated;
GRANT UPDATE (read) ON public.notifications TO authenticated;

-- 4. updated_at maintenance --------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'center_settings', 'eccd_scores', 'child_backgrounds',
    'sociodemographic_profiles', 'eccd_evaluations', 'eccd_item_comments'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END;
$$;

-- 5. Indexes and checks --------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_parent_notes_user_id ON parent_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_parent_notes_pupil_id ON parent_notes(pupil_id, excuse_no);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

ALTER TABLE eccd_scores DROP CONSTRAINT IF EXISTS eccd_scores_round_check;
-- NOT VALID: enforced for every new or changed row without failing the
-- migration on a historic row; VALIDATE separately once confirmed clean.
ALTER TABLE eccd_scores ADD CONSTRAINT eccd_scores_round_check
  CHECK (evaluation_round BETWEEN 1 AND 3) NOT VALID;

COMMIT;
