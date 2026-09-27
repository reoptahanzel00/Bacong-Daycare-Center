'use client';

import React, { useEffect, useState } from 'react';
import { RotateCcw, AlertCircle } from 'lucide-react';
import type { MockPupil } from '@/contexts/DaycareContext';
import { createClient } from '@/lib/supabase/client';
import { enrollmentAgeError, ENROLLMENT_AGE_LABEL } from '@/lib/enrollment';
import { todayLocalISO } from '@/lib/dates';
import { errorText } from '@/lib/apiError';
import {
  HealthFields,
  AddressFields,
  BirthCertField,
  birthCertProblem,
  HOME_ADDRESS,
  type AddressValue,
} from '@/components/EnrollmentFields';

const inputClass =
  'w-full px-3 py-2.5 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display';

function initialAddress(child: MockPupil): AddressValue {
  const s = child.sociodemographic;
  const isHome =
    !s?.barangay ||
    (s.barangay === HOME_ADDRESS.barangay && s.municipality === HOME_ADDRESS.municipality);
  return isHome
    ? { addressMode: 'home', ...HOME_ADDRESS }
    : {
        addressMode: 'other',
        barangay: s?.barangay || '',
        municipality: s?.municipality || '',
        province: s?.province || '',
        region: s?.region || '',
      };
}

/**
 * Shown to a parent whose enrollment the Daycare Worker returned. The account
 * stays active; the parent corrects what was asked and sends it back, and the
 * child returns to the worker's queue as pending.
 */
export default function ResubmitEnrollment({
  child,
  onResubmitted,
}: {
  child: MockPupil;
  onResubmitted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCert, setHasCert] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState(() => ({
    hasIllness: Boolean(child.healthConditions),
    healthConditions: child.healthConditions || '',
    hasSpecialNeeds: Boolean(child.hasSpecialNeeds),
    specialNeedsDetails: child.specialNeedsDetails || '',
    firstName: child.firstName,
    middleName: child.middleName || '',
    lastName: child.lastName,
    birthDate: child.birthDate,
    sex: (child.sex === 'Female' ? 'Female' : 'Male') as 'Male' | 'Female',
    ...initialAddress(child),
  }));

  // Whether a birth certificate is already on file decides if one is required.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/pupils/documents?pupil_id=${encodeURIComponent(child.id)}`, { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) setHasCert(Boolean(data.hasBirthCert));
      } catch {
        if (!cancelled) setHasCert(false);
      }
    })();
    return () => { cancelled = true; };
  }, [child.id]);

  const patch = (p: Partial<typeof form>) => setForm((f) => ({ ...f, ...p }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const ageProblem = enrollmentAgeError(form.birthDate, todayLocalISO());
    if (ageProblem) return setError(ageProblem);
    if (!form.firstName.trim() || !form.lastName.trim()) return setError("Please enter the child's first and last name.");
    if (!form.barangay.trim() || !form.municipality.trim() || !form.province.trim() || !form.region.trim()) {
      return setError('Please complete the address.');
    }
    if ((form.hasIllness && !form.healthConditions.trim()) || (form.hasSpecialNeeds && !form.specialNeedsDetails.trim())) {
      return setError('Please describe the illness or special needs you marked Yes.');
    }
    if (!hasCert || file) {
      const docProblem = birthCertProblem(file);
      if (docProblem) return setError(docProblem);
    }

    setSaving(true);
    try {
      // Upload the birth certificate first, so the worker never sees the
      // enrollment back in the queue without the document it was returned for.
      if (file) {
        const tokenRes = await fetch('/api/pupils/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pupil_id: child.id }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(errorText(tokenData.error, 'Could not prepare the upload.'));
        const { error: upErr } = await createClient()
          .storage.from('enrollment-docs')
          .uploadToSignedUrl(tokenData.path, tokenData.token, file, { contentType: file.type, upsert: true });
        if (upErr) throw new Error('The birth certificate could not be uploaded. Please try again.');
      }

      const res = await fetch('/api/pupils/resubmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pupil_id: child.id,
          firstName: form.firstName.trim(),
          middleName: form.middleName.trim() || null,
          lastName: form.lastName.trim(),
          birthDate: form.birthDate,
          sex: form.sex,
          healthConditions: form.hasIllness ? form.healthConditions.trim() : null,
          hasSpecialNeeds: form.hasSpecialNeeds,
          specialNeedsDetails: form.hasSpecialNeeds ? form.specialNeedsDetails.trim() : null,
          barangay: form.barangay.trim(),
          municipality: form.municipality.trim(),
          province: form.province.trim(),
          region: form.region.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(errorText(data.error, 'Could not resubmit. Please try again.'));
      setOpen(false);
      onResubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resubmit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary btn-sm">
        <RotateCcw size={14} />
        <span>Correct &amp; Resubmit Enrollment</span>
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-2 p-4 rounded-2xl border border-line bg-canvas space-y-3">
      {error && (
        <div role="alert" className="p-3 bg-danger-light border border-danger-border rounded-2xl flex items-center gap-2 text-xs text-danger font-semibold">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <HealthFields idPrefix={`resubmit-${child.id}`} value={form} onChange={patch} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="resubmit-first" className="block text-[10px] font-bold text-ink mb-1">First Name *</label>
          <input id="resubmit-first" className={inputClass} value={form.firstName} onChange={(e) => patch({ firstName: e.target.value })} />
        </div>
        <div>
          <label htmlFor="resubmit-middle" className="block text-[10px] font-bold text-ink mb-1">Middle Name</label>
          <input id="resubmit-middle" className={inputClass} value={form.middleName} onChange={(e) => patch({ middleName: e.target.value })} />
        </div>
        <div>
          <label htmlFor="resubmit-last" className="block text-[10px] font-bold text-ink mb-1">Last Name *</label>
          <input id="resubmit-last" className={inputClass} value={form.lastName} onChange={(e) => patch({ lastName: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="resubmit-dob" className="block text-[10px] font-bold text-ink mb-1">Date of Birth *</label>
          <input id="resubmit-dob" type="date" max={todayLocalISO()} className={inputClass} value={form.birthDate} onChange={(e) => patch({ birthDate: e.target.value })} />
          <p className={`text-[10px] font-semibold mt-1 ${form.birthDate && enrollmentAgeError(form.birthDate, todayLocalISO()) ? 'text-danger' : 'text-ink-subtle'}`}>
            {(form.birthDate && enrollmentAgeError(form.birthDate, todayLocalISO())) || `Ages ${ENROLLMENT_AGE_LABEL}.`}
          </p>
        </div>
        <div>
          <label htmlFor="resubmit-sex" className="block text-[10px] font-bold text-ink mb-1">Sex *</label>
          <select id="resubmit-sex" className={inputClass} value={form.sex} onChange={(e) => patch({ sex: e.target.value as 'Male' | 'Female' })}>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
      </div>

      <AddressFields idPrefix={`resubmit-${child.id}`} value={form} onChange={patch} />

      <BirthCertField idPrefix={`resubmit-${child.id}`} file={file} onChange={setFile} alreadyOnFile={Boolean(hasCert)} />

      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={() => setOpen(false)} className="btn btn-secondary btn-sm" disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={saving || hasCert === null}>
          <RotateCcw size={14} />
          <span>{saving ? 'Resubmitting…' : 'Resubmit for Verification'}</span>
        </button>
      </div>
    </form>
  );
}

/**
 * For a pending enrollment whose birth certificate never arrived (for example
 * the upload failed at sign-up): lets the parent attach it without waiting for
 * the Daycare Worker to return the enrollment.
 */
export function AttachBirthCert({ pupilId }: { pupilId: string }) {
  const [hasCert, setHasCert] = useState<boolean | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/pupils/documents?pupil_id=${encodeURIComponent(pupilId)}`, { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled) setHasCert(Boolean(data.hasBirthCert));
      } catch {
        if (!cancelled) setHasCert(null);
      }
    })();
    return () => { cancelled = true; };
  }, [pupilId]);

  if (hasCert !== false) return null;

  const upload = async () => {
    const problem = birthCertProblem(file);
    if (problem || !file) return setStatus(problem);
    setSaving(true);
    setStatus(null);
    try {
      const tokenRes = await fetch('/api/pupils/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pupil_id: pupilId }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(errorText(tokenData.error, 'Could not prepare the upload.'));
      const { error } = await createClient()
        .storage.from('enrollment-docs')
        .uploadToSignedUrl(tokenData.path, tokenData.token, file, { contentType: file.type, upsert: true });
      if (error) throw new Error('The birth certificate could not be uploaded. Please try again.');
      setHasCert(true);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 p-3 rounded-2xl border border-warn-border bg-warn-light space-y-2">
      <p className="text-xs font-bold text-warn m-0">Birth certificate missing: please attach it so the Daycare Worker can verify the enrollment.</p>
      <BirthCertField idPrefix={`attach-${pupilId}`} file={file} onChange={setFile} />
      {status && <p role="alert" className="text-[11px] font-semibold text-danger m-0">{status}</p>}
      <button type="button" className="btn btn-primary btn-sm" onClick={upload} disabled={saving}>
        {saving ? 'Uploading…' : 'Upload Birth Certificate'}
      </button>
    </div>
  );
}
