-- ==========================================================================
-- 20261006_02 — Birth certificates up to 15 MB
--
-- Parents photograph the certificate on a phone; a full-resolution photo or a
-- scanned PDF often passes 5 MB. Files go straight from the browser to this
-- private bucket through a signed upload URL, so the bucket's own limit is
-- what Storage enforces. The form checks the same number first
-- (MAX_DOC_MB in src/components/EnrollmentFields.tsx).
--
-- Safe to re-run.
-- ==========================================================================

UPDATE storage.buckets
   SET file_size_limit = 15728640  -- 15 MB
 WHERE id = 'enrollment-docs';

-- Verification: should return 15728640
--   SELECT file_size_limit FROM storage.buckets WHERE id = 'enrollment-docs';
