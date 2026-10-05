-- ==========================================================================
-- 20261006_01 — current_user_role() is callable only by signed-in users
--
-- 20261005_01 revoked EXECUTE from anon, but Postgres grants EXECUTE on new
-- functions to PUBLIC, and anon inherits it from there, so the anon key could
-- still call it through /rest/v1/rpc. Harmless (it returns NULL without a
-- session) but not what was intended. RLS policies evaluate it as the
-- `authenticated` role, which keeps its grant.
--
-- Safe to re-run.
-- ==========================================================================

BEGIN;

REVOKE EXECUTE ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;

COMMIT;

-- Verification (run separately; each should return the shown value):
--   SELECT has_function_privilege('anon', 'public.current_user_role()', 'EXECUTE');           -- false
--   SELECT has_function_privilege('authenticated', 'public.current_user_role()', 'EXECUTE');  -- true
--   SELECT pg_get_functiondef('public.current_user_role()'::regprocedure) LIKE '%status = ''active''%';  -- true
--   SELECT has_column_privilege('authenticated', 'public.notifications', 'title', 'UPDATE');  -- false
--   SELECT has_column_privilege('authenticated', 'public.notifications', 'read', 'UPDATE');   -- true
