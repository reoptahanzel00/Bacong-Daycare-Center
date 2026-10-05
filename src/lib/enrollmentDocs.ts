import 'server-only';
import type { createAdminClient } from '@/lib/supabase/admin';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Birth certificates submitted with an enrollment.
 *
 * One file per child at `enrollment-docs/<pupil_id>/birth-certificate`, in a
 * private bucket with no client policies. The browser never holds a storage
 * credential: the server checks the guardian link or worker role, then hands
 * out a single-use signed upload URL or a short-lived signed download URL.
 * Uploading straight to Storage also keeps a 5 MB scan clear of the 4.5 MB
 * function body limit. Storage itself is the record of whether the document
 * was submitted, so there is no table row to drift out of step with it.
 */
export const ENROLLMENT_DOCS_BUCKET = 'enrollment-docs';
export const BIRTH_CERT_FILE = 'birth-certificate';
export const MAX_DOC_BYTES = 5 * 1024 * 1024;

export function birthCertPath(pupilId: string): string {
  return `${pupilId}/${BIRTH_CERT_FILE}`;
}

/** A signed URL the client can PUT the file to once. Overwrites on re-upload. */
export async function createBirthCertUploadUrl(admin: AdminClient, pupilId: string) {
  const path = birthCertPath(pupilId);
  const { data, error } = await admin.storage
    .from(ENROLLMENT_DOCS_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error || !data) return null;
  return { path, token: data.token };
}

/** Pupil IDs (from the given set) that have a birth certificate on file. */
export async function pupilsWithBirthCert(admin: AdminClient, pupilIds: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  if (pupilIds.length === 0) return found;
  // Top-level entries in the bucket are the pupil-id folders.
  const { data, error } = await admin.storage
    .from(ENROLLMENT_DOCS_BUCKET)
    .list('', { limit: 1000 });
  if (error || !data) return found;
  const wanted = new Set(pupilIds);
  for (const entry of data) if (wanted.has(entry.name)) found.add(entry.name);
  return found;
}

/** A 10-minute download link for the pupil's birth certificate, or null. */
export async function birthCertDownloadUrl(admin: AdminClient, pupilId: string): Promise<string | null> {
  const { data, error } = await admin.storage
    .from(ENROLLMENT_DOCS_BUCKET)
    .createSignedUrl(birthCertPath(pupilId), 600);
  if (error || !data) return null;
  return data.signedUrl;
}
