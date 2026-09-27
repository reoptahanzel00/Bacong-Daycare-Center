'use client';

import React from 'react';
import { HeartPulse, FileUp, MapPin } from 'lucide-react';
import { ENROLLMENT_AGE_LABEL } from '@/lib/enrollment';

/**
 * Fields shared by the parent's enrollment form (sign-up) and the resubmit
 * form a parent sees when the Daycare Worker returns an enrollment. Kept in one
 * place so the two can never ask different questions.
 */

const inputClass =
  'w-full px-3 py-2.5 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display';

/** The centre's own barangay; families from elsewhere choose "Other". */
export const HOME_ADDRESS = {
  barangay: 'Bacong',
  municipality: 'San Luis',
  province: 'Aurora',
  region: 'Region III (Central Luzon)',
} as const;

export interface HealthValue {
  hasIllness: boolean;
  healthConditions: string;
  hasSpecialNeeds: boolean;
  specialNeedsDetails: string;
}

export interface AddressValue {
  addressMode: 'home' | 'other';
  barangay: string;
  municipality: string;
  province: string;
  region: string;
}

function YesNo({
  labelId,
  value,
  onChange,
}: {
  labelId: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const btn = (active: boolean) =>
    `flex-1 px-3 py-2 rounded-2xl border text-[11px] font-bold transition-all cursor-pointer ${
      active ? 'border-primary-display bg-primary-light text-primary' : 'border-line bg-white text-ink-muted hover:border-ink-subtle'
    }`;
  return (
    <div className="flex gap-2" role="radiogroup" aria-labelledby={labelId}>
      <button type="button" role="radio" aria-checked={value} onClick={() => onChange(true)} className={btn(value)}>
        Yes
      </button>
      <button type="button" role="radio" aria-checked={!value} onClick={() => onChange(false)} className={btn(!value)}>
        No
      </button>
    </div>
  );
}

/** Health and special needs — asked FIRST, before anything else about the child. */
export function HealthFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: HealthValue;
  onChange: (patch: Partial<HealthValue>) => void;
}) {
  return (
    <div className="p-3 rounded-2xl border border-warn-border bg-warn-light space-y-3">
      <div className="flex items-center gap-2 text-[11px] font-extrabold text-ink">
        <HeartPulse size={14} className="text-danger" /> Child Health &amp; Special Needs
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <label id={`${idPrefix}-illness-label`} className="block text-[10px] font-bold text-ink">
            Does the child have any illness or medical condition? *
          </label>
          <YesNo
            labelId={`${idPrefix}-illness-label`}
            value={value.hasIllness}
            onChange={(v) => onChange({ hasIllness: v, healthConditions: v ? value.healthConditions : '' })}
          />
          {value.hasIllness && (
            <textarea
              aria-label="Illness or medical condition details"
              value={value.healthConditions}
              onChange={(e) => onChange({ healthConditions: e.target.value })}
              placeholder="e.g. Asthma, allergy to peanuts, maintenance medicine"
              rows={2}
              maxLength={500}
              className={inputClass}
            />
          )}
        </div>
        <div className="space-y-2">
          <label id={`${idPrefix}-sn-label`} className="block text-[10px] font-bold text-ink">
            Is the child a child with special needs? *
          </label>
          <YesNo
            labelId={`${idPrefix}-sn-label`}
            value={value.hasSpecialNeeds}
            onChange={(v) => onChange({ hasSpecialNeeds: v, specialNeedsDetails: v ? value.specialNeedsDetails : '' })}
          />
          {value.hasSpecialNeeds && (
            <textarea
              aria-label="Special needs details"
              value={value.specialNeedsDetails}
              onChange={(e) => onChange({ specialNeedsDetails: e.target.value })}
              placeholder="e.g. Speech delay, hearing impairment, autism"
              rows={2}
              maxLength={500}
              className={inputClass}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Address: Barangay Bacong by default, "Other" for families from elsewhere. */
export function AddressFields({
  idPrefix,
  value,
  onChange,
}: {
  idPrefix: string;
  value: AddressValue;
  onChange: (patch: Partial<AddressValue>) => void;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={`${idPrefix}-barangay`} className="flex items-center gap-1 text-[10px] font-bold text-ink">
        <MapPin size={12} /> Address *
      </label>
      <select
        id={`${idPrefix}-barangay`}
        value={value.addressMode}
        onChange={(e) =>
          onChange(
            e.target.value === 'home'
              ? { addressMode: 'home', ...HOME_ADDRESS }
              : { addressMode: 'other', barangay: '', municipality: '', province: '', region: '' }
          )
        }
        className={inputClass}
      >
        <option value="home">
          Brgy. {HOME_ADDRESS.barangay}, {HOME_ADDRESS.municipality}, {HOME_ADDRESS.province}
        </option>
        <option value="other">Other (from another place)</option>
      </select>
      {value.addressMode === 'other' && (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
          <input type="text" aria-label="Barangay" value={value.barangay} onChange={(e) => onChange({ barangay: e.target.value })} placeholder="Barangay" className={inputClass} />
          <input type="text" aria-label="Municipality or city" value={value.municipality} onChange={(e) => onChange({ municipality: e.target.value })} placeholder="Municipality / City" className={inputClass} />
          <input type="text" aria-label="Province" value={value.province} onChange={(e) => onChange({ province: e.target.value })} placeholder="Province" className={inputClass} />
          <input type="text" aria-label="Region" value={value.region} onChange={(e) => onChange({ region: e.target.value })} placeholder="Region" className={inputClass} />
        </div>
      )}
    </div>
  );
}

export const DOC_ACCEPT = 'application/pdf,image/jpeg,image/png';
export const MAX_DOC_BYTES = 5 * 1024 * 1024;

/** Null when the file is acceptable, otherwise the message to show. */
export function birthCertProblem(file: File | null): string | null {
  if (!file) return 'Please attach the child\'s birth certificate (PDF, JPG or PNG).';
  if (!DOC_ACCEPT.split(',').includes(file.type)) return 'The birth certificate must be a PDF, JPG or PNG file.';
  if (file.size > MAX_DOC_BYTES) return 'The birth certificate must be 5 MB or smaller.';
  return null;
}

/** Required birth certificate upload. */
export function BirthCertField({
  idPrefix,
  file,
  onChange,
  alreadyOnFile = false,
}: {
  idPrefix: string;
  file: File | null;
  onChange: (file: File | null) => void;
  alreadyOnFile?: boolean;
}) {
  return (
    <div>
      <label htmlFor={`${idPrefix}-birthcert`} className="flex items-center gap-1 text-[10px] font-bold text-ink mb-1">
        <FileUp size={12} /> Birth Certificate (PSA / Local Civil Registrar) {alreadyOnFile ? '' : '*'}
      </label>
      <input
        id={`${idPrefix}-birthcert`}
        type="file"
        accept={DOC_ACCEPT}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        className="w-full text-[11px] font-semibold file:mr-3 file:px-3 file:py-2 file:rounded-xl file:border-0 file:bg-primary-light file:text-primary file:font-bold"
      />
      <p className="text-[10px] text-ink-subtle font-semibold mt-1">
        {alreadyOnFile
          ? 'A birth certificate is already on file. Attach a new one only if the Daycare Worker asked for it.'
          : `PDF, JPG or PNG, up to 5 MB. Required to verify the child's age (${ENROLLMENT_AGE_LABEL}).`}
        {file ? ` Selected: ${file.name}` : ''}
      </p>
    </div>
  );
}
