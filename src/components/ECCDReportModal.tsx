'use client';

import React, { useEffect, useState } from 'react';
import { X, Download, ShieldCheck, FileText, Loader2, AlertTriangle } from 'lucide-react';
import { ECCD_DOMAINS } from '@/data/eccdChecklist';
import { downloadEccdRecord, fetchEccdRecord } from '@/services/eccdService';
import {
  BACKGROUND_FIELDS,
  ECCD_ROUNDS,
  ROUND_ORDINAL,
  computeAgeYMD,
  formAddress,
  formatAge,
  formatFormDate,
  interpretStandardScore,
  itemComments,
  itemMark,
  latestGradedRound,
  rawScore,
  recordFileName,
  splitISODate,
  sumOfScaledScores,
  type EccdRecord,
} from '@/lib/eccdRecord';
import type { MockPupil } from '@/contexts/DaycareContext';
import { useModalA11y } from '@/hooks/useModalA11y';

interface ECCDReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  pupil: MockPupil | null;
}

const HANDEDNESS_LABELS: Record<string, string> = {
  right: 'Right',
  left: 'Left',
  both: 'Both',
  not_yet_established: 'Not yet established',
};

/**
 * Preview of the pupil's ECCD Checklist, Child's Record 2, and the download of
 * the centre's own Word form filled with the same record (all three rounds).
 * The preview and the file are built from one server-side record, so what the
 * examiner checks here is what the form says.
 */
export default function ECCDReportModal({ isOpen, onClose, pupil }: ECCDReportModalProps) {
  const pupilId = pupil?.id;
  const [record, setRecord] = useState<EccdRecord | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const isLoading = isOpen && !!pupilId && loadedFor !== pupilId;

  useEffect(() => {
    if (!isOpen || !pupilId) return;
    let cancelled = false;
    (async () => {
      const res = await fetchEccdRecord(pupilId);
      if (cancelled) return;
      setDownloadError(null);
      setRecord(res.record);
      setLoadError(res.ok ? null : res.error ?? 'Could not load the record.');
      setLoadedFor(pupilId);
    })();
    return () => {
      cancelled = true;
      // Reload on every open so a round saved moments ago is in the preview.
      setLoadedFor(null);
    };
  }, [isOpen, pupilId]);

  const dialogProps = useModalA11y(isOpen, onClose);

  if (!isOpen || !pupil) return null;

  const handleDownload = async () => {
    if (!record) return;
    setIsDownloading(true);
    setDownloadError(null);
    const res = await downloadEccdRecord(pupil.id, recordFileName(record));
    if (!res.ok) setDownloadError(res.error ?? 'Could not generate the record.');
    setIsDownloading(false);
  };

  return (
    <div {...dialogProps}
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn"
      suppressHydrationWarning
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-line w-full max-w-5xl p-6 space-y-5 animate-scaleUp max-h-[90vh] flex flex-col">

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-light text-primary flex items-center justify-center font-bold shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-ink m-0">
                ECCD Pupil Evaluation Report
              </h3>
              <p className="text-xs text-ink-muted m-0">
                {pupil.firstName} {pupil.lastName} ({pupil.id}) &bull; Official Child&apos;s Record 2
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full bg-primary-light text-primary text-xs font-bold">
              1st &ndash; 3rd Assessment
            </span>
            <button
              aria-label="Close"
              onClick={onClose}
              className="p-2 rounded-full text-ink-subtle hover:bg-canvas hover:text-ink border-none bg-transparent cursor-pointer transition-all"
              suppressHydrationWarning
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Report Preview Body */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-primary">
              <Loader2 size={22} className="animate-spin" />
              <span className="text-xs font-bold">Loading evaluation records...</span>
            </div>
          ) : !record ? (
            <div role="alert" className="flex items-center justify-center gap-2 py-20 text-danger">
              <AlertTriangle size={20} />
              <span className="text-xs font-bold">{loadError || 'Could not load the record.'}</span>
            </div>
          ) : (
            <RecordPreview record={record} />
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-line flex flex-wrap items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-ink-muted font-semibold flex items-center gap-1">
            <ShieldCheck size={16} className="text-primary" />
            {downloadError ? (
              <span role="alert" className="text-danger">{downloadError}</span>
            ) : (
              <>Official ECCD Child&apos;s Record 2 &mdash; Word form, filled from saved evaluations</>
            )}
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-ink-muted hover:bg-canvas transition-all cursor-pointer border-none bg-transparent"
              suppressHydrationWarning
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              disabled={isDownloading || isLoading || !record}
              className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-primary hover:bg-primary-hover transition-all flex items-center gap-2 shadow-md cursor-pointer border-none disabled:opacity-50"
              suppressHydrationWarning
            >
              <Download size={16} />
              <span>{isDownloading ? 'Preparing record...' : 'Download ECCD Record (.docx)'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

function RecordPreview({ record }: { record: EccdRecord }) {
  const { pupil, profile } = record;
  const dob = splitISODate(pupil.birthDate);
  const latest = latestGradedRound(record);
  const backgroundRows = BACKGROUND_FIELDS.map((f) => ({
    label: f.heading,
    value: record.background?.[f.key]?.trim() || '',
  })).filter((r) => r.value);

  return (
    <div className="bg-white p-6 rounded-2xl border border-line space-y-8 text-ink font-sans">

      <div className="text-center border-b-2 border-primary-display pb-4 space-y-1">
        <h2 className="text-lg font-black text-primary-hover tracking-tight m-0">
          Early Childhood Care and Development (ECCD) Checklist
        </h2>
        <div className="text-[11px] text-ink-muted">
          Child&apos;s Record 2 &mdash; Ages 3 years 1 month to 5 years &bull; {record.centerName}
        </div>
      </div>

      {/* Sociodemographic Profile */}
      <section className="space-y-3">
        <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider m-0">
          Sociodemographic Profile
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs">
          <Field label="Child's Name" value={`${pupil.lastName}, ${pupil.firstName}`} />
          <Field label="Sex" value={pupil.sex} />
          <Field label="Date of Birth (month/day/year)" value={formatFormDate(pupil.birthDate)} />
          <Field label="Address" value={formAddress(record)} />
          <Field label="Handedness" value={profile?.handedness ? HANDEDNESS_LABELS[profile.handedness] : ''} />
          <Field label="Presently studying?" value={profile ? (profile.currentlyStudying ? 'Yes' : 'No') : ''} />
          <Field label="School / Learning Center" value={profile?.currentlyStudying ? profile.schoolName : ''} />
          <Field label="No. of Siblings / Birth Order" value={profile ? [profile.siblingsCount ?? '', profile.birthOrder].filter((v) => v !== '').join(' / ') : ''} />
          <Field label="Father's Name / Age" value={profile ? [profile.fatherName, profile.fatherAge ?? ''].filter((v) => v !== '').join(' / ') : ''} />
          <Field label="Mother's Name / Age" value={profile ? [profile.motherName, profile.motherAge ?? ''].filter((v) => v !== '').join(' / ') : ''} />
          <Field label="Father's Occupation / Education" value={profile ? [profile.fatherOccupation, profile.fatherEducation].filter(Boolean).join(' / ') : ''} />
          <Field label="Mother's Occupation / Education" value={profile ? [profile.motherOccupation, profile.motherEducation].filter(Boolean).join(' / ') : ''} />
        </div>
      </section>

      {/* Computation of the Child's Age */}
      <section className="space-y-3">
        <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider m-0">
          Computation of the Child&apos;s Age
        </h4>
        <p className="text-[10px] text-ink-subtle m-0">
          Each month is composed of 30 days. Do not round off the months or years.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-primary-light text-primary-hover">
                <th className="p-2 border border-line text-left">Assessment</th>
                <th className="p-2 border border-line text-center">Date Tested</th>
                <th className="p-2 border border-line text-center">Date of Birth</th>
                <th className="p-2 border border-line text-center">Child&apos;s Age (Y / M / D)</th>
                <th className="p-2 border border-line text-left">Examiner&apos;s Name</th>
              </tr>
            </thead>
            <tbody>
              {record.rounds.map((round) => {
                const tested = splitISODate(round.testedOn);
                const age = round.testedOn ? computeAgeYMD(pupil.birthDate, round.testedOn) : null;
                return (
                  <tr key={round.round}>
                    <td className="p-2 border border-line font-semibold">{ROUND_ORDINAL[round.round]} assessment</td>
                    <td className="p-2 border border-line text-center">{round.graded && tested.y ? `${tested.y}-${tested.m}-${tested.d}` : '—'}</td>
                    <td className="p-2 border border-line text-center">{round.graded ? `${dob.y}-${dob.m}-${dob.d}` : '—'}</td>
                    <td className="p-2 border border-line text-center font-bold text-primary">{age ? `${age.y} / ${age.m} / ${age.d}` : '—'}</td>
                    <td className="p-2 border border-line">{round.examinerName || ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Checklist per domain */}
      {ECCD_DOMAINS.map((dom) => (
        <section key={dom.id} className="space-y-3">
          <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider m-0">
            {dom.label} ({dom.items.length} items)
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="bg-primary-light text-primary-hover">
                  <th className="p-2 border border-line text-left w-[5%]">#</th>
                  <th className="p-2 border border-line text-left">Item</th>
                  {ECCD_ROUNDS.map((r) => (
                    <th key={r} className="p-2 border border-line text-center w-[7%]">{ROUND_ORDINAL[r]} Eval</th>
                  ))}
                  <th className="p-2 border border-line text-left w-[28%]">Comments</th>
                </tr>
              </thead>
              <tbody>
                {dom.items.map((item) => (
                  <tr key={item.id}>
                    <td className="p-2 border border-line font-bold text-ink-subtle">{item.number}</td>
                    <td className="p-2 border border-line font-medium" title={item.procedure}>{item.description}</td>
                    {record.rounds.map((round) => {
                      const mark = itemMark(round, item.id);
                      return (
                        <td key={round.round} className="p-2 border border-line text-center">
                          {mark === '✔' ? (
                            <span className="inline-flex w-5 h-5 rounded items-center justify-center text-[10px] font-extrabold bg-emerald-600 text-white">✓</span>
                          ) : (
                            <span className="text-ink-subtle font-bold">{mark}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-2 border border-line text-ink-muted whitespace-pre-line">
                      {itemComments(record, item.id).join('\n')}
                    </td>
                  </tr>
                ))}
                <tr className="bg-canvas">
                  <td className="p-2 border border-line"></td>
                  <td className="p-2 border border-line font-extrabold">TOTAL SCORE</td>
                  {record.rounds.map((round) => (
                    <td key={round.round} className="p-2 border border-line text-center font-extrabold text-primary">
                      {round.graded ? rawScore(round, dom.id) : ''}
                    </td>
                  ))}
                  <td className="p-2 border border-line"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ))}

      {/* Summary of Scores */}
      <section className="space-y-3">
        <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider m-0">
          Summary of Scores
        </h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-primary-light text-primary-hover">
                <th className="p-2 border border-line text-left" rowSpan={2}>Domain</th>
                {record.rounds.map((round) => {
                  const age = round.testedOn ? computeAgeYMD(pupil.birthDate, round.testedOn) : null;
                  return (
                    <th key={round.round} colSpan={2} className="p-2 border border-line text-center">
                      {ROUND_ORDINAL[round.round]} Evaluation
                      {round.graded && (
                        <div className="text-[10px] font-semibold text-ink-muted">
                          {formatFormDate(round.testedOn)} &bull; {formatAge(age)}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
              <tr className="bg-primary-light text-primary-hover">
                {ECCD_ROUNDS.map((r) => (
                  <React.Fragment key={r}>
                    <th className="p-1.5 border border-line text-center text-[10px]">Raw</th>
                    <th className="p-1.5 border border-line text-center text-[10px]">Scaled</th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {ECCD_DOMAINS.map((dom) => (
                <tr key={dom.id}>
                  <td className="p-2 border border-line font-bold">{dom.shortLabel}</td>
                  {record.rounds.map((round) => (
                    <React.Fragment key={round.round}>
                      <td className="p-2 border border-line text-center font-bold text-primary">
                        {round.graded ? rawScore(round, dom.id) : ''}
                      </td>
                      <td className="p-2 border border-line text-center font-bold">
                        {round.graded ? round.scaled[dom.id] ?? '—' : ''}
                      </td>
                    </React.Fragment>
                  ))}
                </tr>
              ))}
              <tr className="bg-[#F0F9F8]">
                <td className="p-2 border border-line font-extrabold text-primary-hover">Sum of Scaled Scores</td>
                {record.rounds.map((round) => (
                  <td key={round.round} colSpan={2} className="p-2 border border-line text-center font-extrabold text-primary-hover">
                    {round.graded ? sumOfScaledScores(round) ?? '—' : ''}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-2 border border-line font-extrabold">Standard Score</td>
                {record.rounds.map((round) => (
                  <td key={round.round} colSpan={2} className="p-2 border border-line text-center font-extrabold">
                    {round.standardScore ?? ''}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-2 border border-line font-extrabold">Interpretation</td>
                {record.rounds.map((round) => (
                  <td key={round.round} colSpan={2} className="p-2 border border-line text-center text-[11px] text-ink-muted">
                    {interpretStandardScore(round.standardScore)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Examiner's Notes */}
      <section className="space-y-3">
        <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider m-0">
          Examiner&apos;s Notes
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-2 text-xs">
          <Field label="Name of examiner" value={latest?.examinerName || ''} />
          <Field label="Date administered" value={formatFormDate(latest?.testedOn)} />
          <Field label="Place" value={record.centerName} />
        </div>
        {backgroundRows.length > 0 ? (
          <div className="space-y-2">
            {backgroundRows.map((row) => (
              <div key={row.label} className="p-2.5 rounded-2xl bg-canvas border border-line">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-primary mb-0.5">
                  {row.label}
                </div>
                <p className="text-[11px] text-ink-soft leading-relaxed m-0 whitespace-pre-wrap">{row.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-ink-subtle italic m-0">No background information recorded.</p>
        )}
      </section>
    </div>
  );
}

/** Small label/value field with a dotted underline, form-style. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-extrabold uppercase tracking-wider text-primary mb-0.5">
        {label}
      </div>
      <div className="border-b border-dotted border-[#B9B4AA] text-ink min-h-[1.3em]">
        {value || '\u00A0'}
      </div>
    </div>
  );
}
