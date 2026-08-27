'use client';

import React, { useEffect, useRef, useState } from 'react';
import { X, Download, Printer, ShieldCheck, FileText, Loader2 } from 'lucide-react';
import { ECCD_DOMAINS } from '@/data/eccdChecklist';
import {
  fetchEccdRatings,
  fetchEccdScores,
  fetchChildBackground,
  type ChildBackground,
  type EccdRound,
} from '@/services/eccdService';
import type { jsPDF } from 'jspdf';
import type { CellHookData } from 'jspdf-autotable';
import type { MockPupil } from '@/contexts/DaycareContext';

interface ECCDReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  pupil: MockPupil | null;
}

type RatingsMap = Record<string, boolean>;
type DomainScore = { raw: number; scaled?: string | number | null };
type ScoresMap = Record<string, DomainScore>;
export type RatingsByRound = Record<EccdRound, RatingsMap>;
export type ScoresByRound = Record<EccdRound, ScoresMap>;

const ROUNDS: EccdRound[] = [1, 2, 3];
const ROUND_LABELS: Record<EccdRound, string> = {
  1: '1st Assessment',
  2: '2nd Assessment',
  3: '3rd Assessment',
};

const INTERPRETATIONS: Array<{ min: number; max: number; meaning: string }> = [
  { min: 1, max: 3, meaning: 'Development must be monitored after 3 months' },
  { min: 4, max: 6, meaning: 'Development must be monitored after 6 months' },
  { min: 7, max: 13, meaning: 'Average overall development' },
  { min: 14, max: 16, meaning: 'Slightly advanced development' },
  { min: 17, max: 19, meaning: 'Highly advanced development' },
];

const STANDARD_BANDS: Array<{ min: number; label: string }> = [
  { min: 131, label: 'Advanced development' },
  { min: 116, label: 'Suggest development' },
  { min: 85, label: 'Average development' },
  { min: 0, label: 'Re-test after 3 to 6 months' },
];

const BACKGROUND_FIELDS: Array<{ label: string; key: keyof ChildBackground }> = [
  { label: "Child's background", key: 'child_background' },
  { label: 'Family environment', key: 'family_environment' },
  { label: "Parents' stimulating activities", key: 'stimulating_activities' },
  { label: 'Home environment', key: 'home_environment' },
  { label: 'Others', key: 'others' },
];

function roundLabel(round: EccdRound): string {
  return ROUND_LABELS[round];
}

function scaledValue(scaled?: string | number | null): string | null {
  if (scaled === null || scaled === undefined || scaled === '') return null;
  const str = String(scaled).trim();
  return str === '' ? null : str;
}

function scaledNumber(scaled?: string | number | null): number | null {
  const v = scaledValue(scaled);
  if (v === null) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function splitYMD(dateStr?: string): { y: string; m: string; d: string } {
  if (!dateStr) return { y: '', m: '', d: '' };
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return { y: '', m: '', d: '' };
  return {
    y: String(d.getFullYear()),
    m: String(d.getMonth() + 1).padStart(2, '0'),
    d: String(d.getDate()).padStart(2, '0'),
  };
}

/** Age in years/months/days per the official DepEd form: 1 month = 30 days borrowing rule. */
function computeAgeYMD(birthDate: string, asOf: Date): { y: number; m: number; d: number } {
  const dob = new Date(birthDate);
  if (Number.isNaN(dob.getTime())) return { y: 0, m: 0, d: 0 };

  let dTested = asOf.getDate();
  let mTested = asOf.getMonth() + 1;
  let yTested = asOf.getFullYear();

  const dBirth = dob.getDate();
  const mBirth = dob.getMonth() + 1;
  const yBirth = dob.getFullYear();

  if (dTested < dBirth) {
    dTested += 30;
    mTested -= 1;
  }
  if (mTested < mBirth) {
    mTested += 12;
    yTested -= 1;
  }

  const d = Math.max(0, dTested - dBirth);
  const m = Math.max(0, mTested - mBirth);
  const y = Math.max(0, yTested - yBirth);

  return { y, m, d };
}

function fmtDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function rawFor(domainId: string, round: EccdRound, ratings: RatingsMap, scores: ScoresMap): number {
  const dom = ECCD_DOMAINS.find((d) => d.id === domainId);
  if (!dom) return 0;
  const count = dom.items.filter((i) => ratings[i.id]).length;
  if (count > 0) return count;
  return scores[domainId]?.raw ?? 0;
}

function sumScaled(round: EccdRound, scoresByRound: ScoresByRound): number | null {
  let sum = 0;
  let any = false;
  for (const dom of ECCD_DOMAINS) {
    const n = scaledNumber(scoresByRound[round]?.[dom.id]?.scaled);
    if (n !== null) {
      sum += n;
      any = true;
    }
  }
  return any ? sum : null;
}

export default function ECCDReportModal({ isOpen, onClose, pupil }: ECCDReportModalProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const pupilId = pupil?.id;
  const [isExporting, setIsExporting] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [schoolYear, setSchoolYear] = useState('SY 2026-2027');
  const [ratingsByRound, setRatingsByRound] = useState<RatingsByRound>({ 1: {}, 2: {}, 3: {} });
  const [scoresByRound, setScoresByRound] = useState<ScoresByRound>({ 1: {}, 2: {}, 3: {} });
  const [background, setBackground] = useState<ChildBackground | null>(null);
  const isLoading = isOpen && !!pupilId && loadedFor !== pupilId;

  // Load all three evaluation rounds + the child background whenever the
  // modal opens, so the official 1st/2nd/3rd column layout can be filled.
  useEffect(() => {
    if (!isOpen || !pupilId) return;
    let cancelled = false;
    (async () => {
      const [r1, r2, r3, s1, s2, s3, bg] = await Promise.all([
        fetchEccdRatings(1),
        fetchEccdRatings(2),
        fetchEccdRatings(3),
        fetchEccdScores(1),
        fetchEccdScores(2),
        fetchEccdScores(3),
        fetchChildBackground(pupilId),
      ]);
      if (cancelled) return;

      const buildRatings = (res: {
        ok: boolean;
        ratings: Array<{ pupil_id: string; milestone_code: string; status_rating: string }>;
      }): RatingsMap => {
        const map: RatingsMap = {};
        if (res.ok) {
          for (const row of res.ratings) {
            if (row.pupil_id === pupilId && row.status_rating === 'Present' && row.milestone_code) {
              map[row.milestone_code] = true;
            }
          }
        }
        return map;
      };

      const buildScores = (res: {
        ok: boolean;
        scores: Array<{ pupil_id: string; domain_id: string; raw_score: number; scaled_score?: number | null }>;
      }): ScoresMap => {
        const map: ScoresMap = {};
        if (res.ok) {
          for (const row of res.scores) {
            if (row.pupil_id === pupilId) {
              map[row.domain_id] = {
                raw: row.raw_score,
                scaled: row.scaled_score != null ? String(row.scaled_score) : undefined,
              };
            }
          }
        }
        return map;
      };

      setRatingsByRound({ 1: buildRatings(r1), 2: buildRatings(r2), 3: buildRatings(r3) });
      setScoresByRound({ 1: buildScores(s1), 2: buildScores(s2), 3: buildScores(s3) });
      if (bg.ok) setBackground(bg.background);
      if (!cancelled) setLoadedFor(pupilId);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, pupilId]);

  if (!isOpen || !pupil) return null;

  const today = new Date();
  const dob = splitYMD(pupil.birthDate);
  const age = computeAgeYMD(pupil.birthDate, today);
  const td = splitYMD(fmtDate(today));

  const backgroundRows = BACKGROUND_FIELDS.map((f) => ({
    label: f.label,
    value: background?.[f.key] as string | undefined,
  }));
  const hasBackground = backgroundRows.some((r) => r.value?.trim());

  const handleExportPDF = async () => {
    if (!pupil) return;
    setIsExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      buildRecordPdf(doc, autoTable, {
        pupil,
        ratingsByRound,
        scoresByRound,
        background,
        schoolYear,
        today,
      });
      const safeName = `${pupil.lastName}_${pupil.firstName}`.replace(/\s+/g, '_');
      doc.save(`ECCD_Record2_${safeName}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate PDF. Printing the report instead.');
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn print:static print:block print:bg-white print:backdrop-blur-0 print:p-0 print:overflow-visible"
      suppressHydrationWarning
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E6E4DF] w-full max-w-5xl p-6 space-y-5 animate-scaleUp max-h-[90vh] flex flex-col print:max-w-none print:max-h-none print:rounded-none print:shadow-none print:border-none print:p-0 print:overflow-visible print:block">

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-[#E6E4DF] pb-4 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EBF5F4] text-[#247571] flex items-center justify-center font-bold shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#2B2B2B] m-0">
                ECCD Pupil Evaluation Report
              </h3>
              <p className="text-xs text-[#6B6B6B] m-0">
                {pupil.firstName} {pupil.lastName} ({pupil.id}) &bull; Official Child&apos;s Record 2
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full bg-[#EBF5F4] text-[#247571] text-xs font-bold">
              1st &ndash; 3rd Assessment
            </span>
            <select
              value={schoolYear}
              onChange={(e) => setSchoolYear(e.target.value)}
              className="px-3 py-1.5 rounded-full border border-[#E6E4DF] text-xs font-semibold bg-[#FAF8F5] focus:outline-none"
              suppressHydrationWarning
            >
              <option value="SY 2026-2027">SY 2026-2027</option>
              <option value="SY 2025-2026">SY 2025-2026</option>
              <option value="SY 2024-2025">SY 2024-2025</option>
            </select>

            <button
              onClick={onClose}
              className="p-2 rounded-full text-[#707070] hover:bg-[#FAF8F5] hover:text-[#2B2B2B] border-none bg-transparent cursor-pointer transition-all"
              suppressHydrationWarning
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Report Preview Body */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4 print:overflow-visible print:pr-0 print:flex-none">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-20 text-[#247571]">
              <Loader2 size={22} className="animate-spin" />
              <span className="text-xs font-bold">Loading evaluation records...</span>
            </div>
          ) : (
            <div ref={reportRef} className="bg-white p-6 rounded-2xl border border-[#E6E4DF] space-y-8 text-[#2B2B2B] font-sans print:p-0 print:border-0 print:rounded-none">

              {/* Government Header */}
              <div className="text-center border-b-2 border-[#2F8F8A] pb-4 space-y-1">
                <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider">
                  Republic of the Philippines &bull; Region V &bull; Province of Albay
                </div>
                <h2 className="text-lg font-black text-[#1D605D] uppercase tracking-tight m-0">
                  BARANGAY BACONG DAYCARE CENTER
                </h2>
                <h4 className="text-xs font-extrabold text-[#247571] uppercase tracking-wider m-0">
                  ECCD Checklist, Child&apos;s Record 2
                </h4>
                <div className="text-[11px] text-[#6B6B6B]">
                  Pupil Evaluation Report &bull; School Year: <strong>{schoolYear}</strong> &bull; Report Date:{' '}
                  <strong>{fmtDate(today)}</strong>
                </div>
              </div>

              {/* Section 1 — Sociodemographic Profile */}
              <section className="space-y-3">
                <h4 className="text-xs font-extrabold text-[#247571] uppercase tracking-wider m-0">
                  Section 1: Sociodemographic Profile
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                  <Field label="Child's Name" value={`${pupil.lastName}, ${pupil.firstName}`} />
                  <Field label="Sex" value={pupil.sex} />
                  <Field label="Date of Birth" value={`${dob.y}-${dob.m}-${dob.d}`} />
                  <Field label="Address" value={pupil.address || ''} />
                  <Field label="Barangay" value="Bacong" />
                  <Field label="Municipality / City" value="" />
                  <Field label="Province" value="Albay" />
                  <Field label="Region" value="V" />
                  <Field label="Handedness" value="Right [ ]   Left [ ]   Both [ ]   Not yet established [ ]" />
                  <Field label="Is the child presently studying?" value="Yes [ ]   No [ ]" />
                  <Field label="School / Learning Center" value="" />
                  <Field label="No. of Siblings" value="" />
                  <Field label="Birth Order" value="" />
                  <Field label="Guardian" value={pupil.guardian?.fullName || ''} />
                  <Field label="Relationship" value={pupil.guardian?.relationship || ''} />
                  <Field label="Guardian Contact" value={pupil.guardian?.phone || ''} />
                  <Field label="Father's Name / Age" value="" />
                  <Field label="Mother's Name / Age" value="" />
                  <Field label="Father's Occupation / Education" value="" />
                  <Field label="Mother's Occupation / Education" value="" />
                </div>
              </section>

              {/* Section 2 — Computation of the Child's Age */}
              <section className="space-y-3 print:break-before-page">
                <h4 className="text-xs font-extrabold text-[#247571] uppercase tracking-wider m-0">
                  Section 2: Computation of the Child&apos;s Age
                </h4>
                <p className="text-[10px] text-[#707070] m-0">
                  It is recommended that the Checklist be administered to the child once a year.
                  Each month is composed of 30 days. Do not round off the months or years.
                </p>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#EBF5F4] text-[#1D605D]">
                      <th className="p-2 border border-[#E6E4DF] text-left w-1/3"></th>
                      <th className="p-2 border border-[#E6E4DF] text-center">Year</th>
                      <th className="p-2 border border-[#E6E4DF] text-center">Month</th>
                      <th className="p-2 border border-[#E6E4DF] text-center">Day</th>
                      <th className="p-2 border border-[#E6E4DF] text-center">Examiner&apos;s Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROUNDS.map((r) => (
                      <React.Fragment key={r}>
                        <tr className="bg-[#FAF8F5]">
                          <td colSpan={5} className="p-1.5 border border-[#E6E4DF] font-extrabold text-[#247571] text-[11px]">
                            {roundLabel(r)}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-2 border border-[#E6E4DF] font-semibold">Date Tested</td>
                          <td className="p-2 border border-[#E6E4DF] text-center">{td.y}</td>
                          <td className="p-2 border border-[#E6E4DF] text-center">{td.m}</td>
                          <td className="p-2 border border-[#E6E4DF] text-center">{td.d}</td>
                          <td className="p-2 border border-[#E6E4DF]"></td>
                        </tr>
                        <tr>
                          <td className="p-2 border border-[#E6E4DF] font-semibold">Child&apos;s Date of Birth</td>
                          <td className="p-2 border border-[#E6E4DF] text-center">{dob.y}</td>
                          <td className="p-2 border border-[#E6E4DF] text-center">{dob.m}</td>
                          <td className="p-2 border border-[#E6E4DF] text-center">{dob.d}</td>
                          <td className="p-2 border border-[#E6E4DF]"></td>
                        </tr>
                        <tr>
                          <td className="p-2 border border-[#E6E4DF] font-semibold">Child&apos;s Age</td>
                          <td className="p-2 border border-[#E6E4DF] text-center font-bold text-[#247571]">{age.y}</td>
                          <td className="p-2 border border-[#E6E4DF] text-center font-bold text-[#247571]">{age.m}</td>
                          <td className="p-2 border border-[#E6E4DF] text-center font-bold text-[#247571]">{age.d}</td>
                          <td className="p-2 border border-[#E6E4DF]"></td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </section>

              {/* Sections 3–9 — Checklist per domain */}
              {ECCD_DOMAINS.map((dom, i) => (
                <section key={dom.id} className="space-y-3 print:break-before-page">
                  <h4 className="text-xs font-extrabold text-[#247571] uppercase tracking-wider m-0">
                    Section {3 + i}: {dom.label} ({dom.items.length} items)
                  </h4>
                  <table className="w-full text-[11px] border-collapse">
                    <colgroup>
                      <col className="w-[5%]" />
                      <col className="w-[33%]" />
                      <col className="w-[30%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[6%]" />
                      <col className="w-[14%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-[#EBF5F4] text-[#1D605D]">
                        <th className="p-2 border border-[#E6E4DF] text-left">#</th>
                        <th className="p-2 border border-[#E6E4DF] text-left">Item / Milestone</th>
                        <th className="p-2 border border-[#E6E4DF] text-left">Material / Procedure</th>
                        <th className="p-2 border border-[#E6E4DF] text-center">1st Eval</th>
                        <th className="p-2 border border-[#E6E4DF] text-center">2nd Eval</th>
                        <th className="p-2 border border-[#E6E4DF] text-center">3rd Eval</th>
                        <th className="p-2 border border-[#E6E4DF] text-left">Comments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dom.items.map((item) => (
                        <tr key={item.id} className="print:break-inside-avoid">
                          <td className="p-2 border border-[#E6E4DF] font-bold text-[#707070]">{item.number}</td>
                          <td className="p-2 border border-[#E6E4DF] font-medium">{item.description}</td>
                          <td className="p-2 border border-[#E6E4DF] text-[#6B6B6B]">{item.procedure || ''}</td>
                          {ROUNDS.map((r) => (
                            <td key={r} className="p-2 border border-[#E6E4DF] text-center">
                              <span
                                className={`inline-flex w-5 h-5 rounded items-center justify-center text-[10px] font-extrabold ${
                                  ratingsByRound[r]?.[item.id]
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-100 text-gray-400'
                                }`}
                              >
                                {ratingsByRound[r]?.[item.id] ? '✓' : '–'}
                              </span>
                            </td>
                          ))}
                          <td className="p-2 border border-[#E6E4DF]"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              ))}

              {/* Section 10 — Examiner & Background Notes */}
              <section className="space-y-3 print:break-before-page">
                <h4 className="text-xs font-extrabold text-[#247571] uppercase tracking-wider m-0">
                  Section 10: Examiner &amp; Background Notes
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-xs">
                  <Field label="Name of Examiner" value="" />
                  <Field label="Date Administered" value={fmtDate(today)} />
                  <Field label="Place" value="Barangay Bacong Daycare Center, Barangay Bacong, Albay" />
                </div>
                <div className="text-xs font-bold text-[#2B2B2B] pt-1">
                  Notes, descriptions and observations:
                </div>
                {hasBackground ? (
                  <div className="space-y-2">
                    {backgroundRows.filter((r) => r.value?.trim()).map((row) => (
                      <div key={row.label} className="p-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E6E4DF]">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#247571] mb-0.5">
                          {row.label}
                        </div>
                        <p className="text-[11px] text-[#4A4A4A] leading-relaxed m-0 whitespace-pre-wrap">
                          {row.value}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[#707070] italic m-0">
                    No background information recorded.
                  </p>
                )}
              </section>

              {/* Section 11 — Raw & Scaled Scores */}
              <section className="space-y-3 print:break-before-page">
                <h4 className="text-xs font-extrabold text-[#247571] uppercase tracking-wider m-0">
                  Section 11: Raw &amp; Scaled Scores
                </h4>
                <p className="text-[10px] text-[#707070] m-0">
                  Raw Score = number of ✓ items per domain. Scaled Scores are entered from the
                  official raw-to-scaled conversion tables (age-based).
                </p>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#EBF5F4] text-[#1D605D]">
                      <th className="p-2 border border-[#E6E4DF] text-left">Domain</th>
                      {ROUNDS.map((r) => (
                        <React.Fragment key={r}>
                          <th className="p-2 border border-[#E6E4DF] text-center">{roundLabel(r)} Raw</th>
                          <th className="p-2 border border-[#E6E4DF] text-center">{roundLabel(r)} Scaled</th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ECCD_DOMAINS.map((dom) => (
                      <tr key={dom.id} className="border-b border-[#E6E4DF]">
                        <td className="p-2 font-bold border border-[#E6E4DF]">{dom.label}</td>
                        {ROUNDS.map((r) => {
                          const raw = rawFor(dom.id, r, ratingsByRound[r], scoresByRound[r]);
                          const scaled = scaledValue(scoresByRound[r]?.[dom.id]?.scaled);
                          return (
                            <React.Fragment key={r}>
                              <td className="p-2 border border-[#E6E4DF] text-center font-bold text-[#247571]">
                                {raw}
                              </td>
                              <td className="p-2 border border-[#E6E4DF] text-center font-bold">
                                {scaled ?? '—'}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="bg-[#F0F9F8]">
                      <td className="p-2 border border-[#E6E4DF] font-extrabold text-[#1D605D]">
                        Sum of Scaled Scores
                      </td>
                      {ROUNDS.map((r) => {
                        const sum = sumScaled(r, scoresByRound);
                        return (
                          <React.Fragment key={r}>
                            <td className="p-2 border border-[#E6E4DF]"></td>
                            <td className="p-2 border border-[#E6E4DF] text-center font-extrabold text-[#1D605D]">
                              {sum ?? '—'}
                            </td>
                          </React.Fragment>
                        );
                      })}
                    </tr>
                    <tr>
                      <td className="p-2 border border-[#E6E4DF] font-extrabold">Standard Score</td>
                      <td colSpan={6} className="p-2 border border-[#E6E4DF] text-[#707070] text-[10px]">
                        Leave blank &mdash; computed from the official Sum-of-Scaled-Scores
                        conversion table (hand-written on the printed form).
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="p-4 rounded-2xl bg-[#FEF8EC] border border-[#F5DAA0] text-[11px] space-y-2">
                  <div className="font-bold text-[#8A5D00]">Official Interpretation of Scaled Scores</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {INTERPRETATIONS.map((r) => (
                      <div key={r.min} className="flex items-center justify-between gap-2 rounded-xl bg-white border border-[#F5DAA0] px-3 py-1.5">
                        <span className="font-extrabold text-[#8A5D00]">{r.min}&ndash;{r.max}</span>
                        <span className="text-[#6B6B6B]">{r.meaning}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              {/* Section 12 — Scaled Scores Profile */}
              <section className="space-y-3 print:break-before-page">
                <h4 className="text-xs font-extrabold text-[#247571] uppercase tracking-wider m-0">
                  Section 12: Scaled Scores Profile
                </h4>
                <p className="text-[10px] text-[#707070] m-0">
                  Scaled score per domain for each assessment (X marks, connected per round).
                </p>
                <div className="rounded-2xl border border-[#E6E4DF] p-4">
                  <div className="flex items-end gap-2 h-32">
                    {ECCD_DOMAINS.map((dom) => (
                      <div key={dom.id} className="flex-1 flex flex-col items-center gap-1.5 h-full">
                        <div className="flex items-end gap-1 h-24 w-full justify-center border-b border-[#E6E4DF]">
                          {ROUNDS.map((r) => {
                            const s = scaledNumber(scoresByRound[r]?.[dom.id]?.scaled);
                            const pct = s !== null ? Math.max(4, Math.round((s / 19) * 100)) : 2;
                            const colors = ['bg-[#247571]', 'bg-[#2B6CB0]', 'bg-[#F5B942]'];
                            return (
                              <div
                                key={r}
                                className={`w-2.5 rounded-t ${s !== null ? colors[r - 1] : 'bg-gray-200'}`}
                                style={{ height: `${pct}%` }}
                                title={`${roundLabel(r)}: ${s ?? 'not entered'}`}
                              />
                            );
                          })}
                        </div>
                        <span className="text-[9px] text-center text-[#6B6B6B] font-semibold leading-tight">
                          {dom.shortLabel}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 pt-2 text-[10px] text-[#6B6B6B] font-semibold">
                    {ROUNDS.map((r) => (
                      <span key={r} className="flex items-center gap-1.5">
                        <span className={`w-2.5 h-2.5 rounded-sm ${['bg-[#247571]', 'bg-[#2B6CB0]', 'bg-[#F5B942]'][r - 1]}`} />
                        {roundLabel(r)}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              {/* Section 13 — Standard Scores chart */}
              <section className="space-y-3 print:break-before-page">
                <h4 className="text-xs font-extrabold text-[#247571] uppercase tracking-wider m-0">
                  Section 13: Standard Scores
                </h4>
                <p className="text-[10px] text-[#707070] m-0">
                  Mark an x on the corresponding standard score for each test administration and
                  connect the x&apos;s. Write the date for each test administration.
                </p>
                <div className="rounded-2xl border border-[#E6E4DF] overflow-hidden text-[10px]">
                  <div className="grid grid-cols-12 bg-[#EBF5F4] text-[#1D605D] font-bold text-center">
                    <div className="col-span-3 p-2 border-r border-[#E6E4DF] text-left">AGES</div>
                    {[160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60, 50].map((s) => (
                      <div key={s} className="p-1.5 border-r border-[#E6E4DF] last:border-r-0">{s}</div>
                    ))}
                  </div>
                  {['3 years & 1 month', '4 years', '5 years'].map((age) => (
                    <div key={age} className="grid grid-cols-12 border-t border-[#E6E4DF]">
                      <div className="col-span-3 p-2 border-r border-[#E6E4DF] font-semibold">{age}</div>
                      {Array.from({ length: 12 }).map((_, i) => (
                        <div key={i} className="border-r border-[#E6E4DF] last:border-r-0 h-8"></div>
                      ))}
                    </div>
                  ))}
                  <div className="grid grid-cols-2 border-t border-[#E6E4DF] text-[#6B6B6B]">
                    {STANDARD_BANDS.map((b) => (
                      <div key={b.min} className="p-1.5 border-b border-r border-[#E6E4DF] last:border-r-0">
                        <strong className="text-[#8A5D00]">&ge; {b.min}</strong> &mdash; {b.label}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-[#707070] m-0">
                  Standard Score is computed from the official conversion table; X marks are
                  hand-written on the printed form.
                </p>
              </section>

              {/* Signatory Block */}
              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-[#E6E4DF] text-xs print:break-before-page">
                <div className="text-center space-y-6">
                  <div className="text-[10px] text-[#6B6B6B]">Prepared &amp; Certified By:</div>
                  <div className="border-b border-[#2B2B2B] font-bold pb-1 text-[#2B2B2B]">
                    TEACHER TERESA CRUZ
                  </div>
                  <div className="text-[10px] text-[#6B6B6B]">Lead Daycare Worker &bull; Barangay Bacong</div>
                </div>
                <div className="text-center space-y-6">
                  <div className="text-[10px] text-[#6B6B6B]">Approved &amp; Noted By:</div>
                  <div className="border-b border-[#2B2B2B] font-bold pb-1 text-[#2B2B2B]">
                    HON. RAMON SANTOS
                  </div>
                  <div className="text-[10px] text-[#6B6B6B]">Barangay Captain / Official Oversight</div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-[#E6E4DF] flex items-center justify-between shrink-0 print:hidden">
          <span className="text-xs text-[#6B6B6B] font-semibold flex items-center gap-1">
            <ShieldCheck size={16} className="text-[#247571]" /> Official ECCD Record 2 &mdash; PDF / Print Ready
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-[#6B6B6B] hover:bg-[#FAF8F5] transition-all cursor-pointer border-none bg-transparent"
              suppressHydrationWarning
            >
              Cancel
            </button>
            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-[#247571] border border-[#2F8F8A]/30 hover:bg-[#EBF5F4] transition-all flex items-center gap-2 cursor-pointer bg-transparent"
              suppressHydrationWarning
            >
              <Printer size={16} />
              Print
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExporting || isLoading}
              className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#247571] hover:bg-[#1D605D] transition-all flex items-center gap-2 shadow-md cursor-pointer border-none disabled:opacity-50"
              suppressHydrationWarning
            >
              <Download size={16} />
              <span>{isExporting ? 'Generating PDF...' : 'Download ECCD Report PDF'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

/** Small label/value field with a dotted underline, form-style. */
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-extrabold uppercase tracking-wider text-[#247571] mb-0.5">
        {label}
      </div>
      <div className="border-b border-dotted border-[#B9B4AA] text-[#2B2B2B] min-h-[1.3em]">
        {value || '\u00A0'}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PDF generation — official multi-page layout via jsPDF + autotable   */
/* ------------------------------------------------------------------ */

const PDF_MARGIN = 14;
const PDF_W = 210;
const PDF_H = 297;
const PDF_CONTENT_W = PDF_W - PDF_MARGIN * 2;
const TEAL: [number, number, number] = [47, 143, 138];
const DARK_TEAL: [number, number, number] = [29, 96, 93];
const GRAY: [number, number, number] = [107, 107, 107];
const INK: [number, number, number] = [43, 43, 43];
const LIGHT_FILL: [number, number, number] = [247, 250, 249];
const ROUND_COLORS: Array<[number, number, number]> = [
  [47, 143, 138],
  [43, 108, 176],
  [198, 146, 20],
];

interface PdfContext {
  pupil: MockPupil;
  ratingsByRound: RatingsByRound;
  scoresByRound: ScoresByRound;
  background: ChildBackground | null;
  schoolYear: string;
  today: Date;
}

type AutoTableFn = typeof import('jspdf-autotable').autoTable;

function lastTableFinalY(doc: jsPDF): number {
  const last = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  return last?.finalY ?? 0;
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.text(text, PDF_MARGIN, y);
  return y + 6.5;
}

function runTable(
  doc: jsPDF,
  autoTable: AutoTableFn,
  head: string[],
  body: Array<Array<string | number>>,
  startY: number,
  opts: {
    columnStyles?: Record<number, Record<string, unknown>>;
    didParseCell?: (data: CellHookData) => void;
  } = {}
): number {
  autoTable(doc, {
    startY: Math.max(startY, 27),
    margin: { left: PDF_MARGIN, right: PDF_MARGIN, top: 25, bottom: 18 },
    head: [head],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 1.5,
      textColor: INK,
      lineColor: [214, 214, 214],
      lineWidth: 0.15,
      valign: 'top',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: TEAL,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: LIGHT_FILL },
    columnStyles: opts.columnStyles || {},
    didParseCell: opts.didParseCell,
  });
  return lastTableFinalY(doc) || startY;
}

function buildRecordPdf(
  doc: jsPDF,
  autoTable: AutoTableFn,
  ctx: PdfContext
): void {
  const { pupil, ratingsByRound, scoresByRound, background, schoolYear, today } = ctx;
  const todayStr = fmtDate(today);
  const dob = splitYMD(pupil.birthDate);
  const age = computeAgeYMD(pupil.birthDate, today);
  const td = splitYMD(todayStr);
  let y = 20;

  /* ---------- Page 1: header + Sociodemographic Profile ---------- */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text('Republic of the Philippines • Region V • Province of Albay', PDF_W / 2, y, { align: 'center' });
  y += 5;
  doc.setFontSize(14);
  doc.setTextColor(DARK_TEAL[0], DARK_TEAL[1], DARK_TEAL[2]);
  doc.text('BARANGAY BACONG DAYCARE CENTER', PDF_W / 2, y, { align: 'center' });
  y += 6.5;
  doc.setFontSize(11);
  doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.text("ECCD CHECKLIST, CHILD'S RECORD 2", PDF_W / 2, y, { align: 'center' });
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text(
    `Pupil Evaluation Report • School Year: ${schoolYear} • Report Date: ${todayStr}`,
    PDF_W / 2,
    y,
    { align: 'center' }
  );
  y += 2.5;
  doc.setDrawColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.setLineWidth(0.5);
  doc.line(PDF_MARGIN, y, PDF_W - PDF_MARGIN, y);
  y += 6;

  y = sectionTitle(doc, 'Section 1: Sociodemographic Profile', y);
  const socioBody = [
    ["Child's Name", `${pupil.lastName}, ${pupil.firstName}`, 'Sex', pupil.sex],
    ['Date of Birth', `${dob.y}-${dob.m}-${dob.d}`, 'Address', pupil.address || ''],
    ['Barangay', 'Bacong', 'Municipality / City', ''],
    ['Province', 'Albay', 'Region', 'V'],
    ['Handedness', 'Right [ ]  Left [ ]  Both [ ]  Not yet established [ ]', 'Presently studying?', 'Yes [ ]  No [ ]'],
    ['School / Learning Center', '', 'No. of Siblings', ''],
    ['Birth Order', '', 'Guardian', pupil.guardian?.fullName || ''],
    ['Relationship', pupil.guardian?.relationship || '', 'Guardian Contact', pupil.guardian?.phone || ''],
    ["Father's Name / Age", '', "Mother's Name / Age", ''],
    ["Father's Occupation / Education", '', "Mother's Occupation / Education", ''],
  ];
  runTable(doc, autoTable, ['Field', 'Value', 'Field', 'Value'], socioBody, y, {
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold' },
      1: { cellWidth: 53 },
      2: { cellWidth: 38, fontStyle: 'bold' },
      3: { cellWidth: 53 },
    },
  });

  /* ---------- Page 2: Computation of the Child's Age ---------- */
  doc.addPage();
  y = 20;
  y = sectionTitle(doc, "Section 2: Computation of the Child's Age", y);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text(
    "It is recommended that the Checklist be administered to the child once a year. Each month is composed of 30 days. Do not round off the months or years.",
    PDF_MARGIN,
    y,
    { maxWidth: PDF_CONTENT_W }
  );
  y += 5;

  const ageBody: Array<Array<string | number>> = [];
  for (const r of ROUNDS) {
    ageBody.push([roundLabel(r), '', '', '', '']);
    ageBody.push(['  Date Tested', td.y, td.m, td.d, '']);
    ageBody.push(["  Child's Date of Birth", dob.y, dob.m, dob.d, '']);
    ageBody.push(["  Child's Age", age.y, age.m, age.d, '']);
  }
  runTable(
    doc,
    autoTable,
    ['', 'Year', 'Month', 'Day', "Examiner's Name"],
    ageBody,
    y,
    {
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 33, halign: 'center' },
        2: { cellWidth: 33, halign: 'center' },
        3: { cellWidth: 33, halign: 'center' },
        4: { cellWidth: 33 },
      },
      didParseCell: (data: CellHookData) => {
        if (data.column.index === 0 && data.row.index % 4 === 0) {
          data.cell.styles.fillColor = LIGHT_FILL;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = TEAL;
        }
      },
    }
  );

  /* ---------- Sections 3-9: checklist per domain ---------- */
  ECCD_DOMAINS.forEach((dom, i) => {
    doc.addPage();
    y = 20;
    y = sectionTitle(doc, `Section ${3 + i}: ${dom.label} (${dom.items.length} items)`, y);
    const body = dom.items.map((item) => {
      const marks = ROUNDS.map((r) =>
        ratingsByRound[r]?.[item.id] ? '[X]' : '[ ]'
      );
      return [
        String(item.number),
        item.description,
        item.procedure || '',
        marks[0],
        marks[1],
        marks[2],
        '',
      ];
    });
    runTable(
      doc,
      autoTable,
      ['#', 'Item / Milestone', 'Material / Procedure', '1st Eval', '2nd Eval', '3rd Eval', 'Comments'],
      body,
      y,
      {
        columnStyles: {
          0: { cellWidth: 7, halign: 'center', fontStyle: 'bold', textColor: GRAY },
          1: { cellWidth: 62 },
          2: { cellWidth: 52 },
          3: { cellWidth: 10, halign: 'center' },
          4: { cellWidth: 10, halign: 'center' },
          5: { cellWidth: 10, halign: 'center' },
          6: { cellWidth: 31 },
        },
        didParseCell: (data: CellHookData) => {
          if (typeof data.column.dataKey === 'number' && [3, 4, 5].includes(data.column.dataKey)) {
            data.cell.styles.halign = 'center';
            if (data.cell.raw === '[X]') {
              data.cell.styles.textColor = [16, 122, 87];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [150, 150, 150];
            }
          }
        },
      }
    );
  });

  /* ---------- Section 10: Examiner & Background Notes ---------- */
  doc.addPage();
  y = 20;
  y = sectionTitle(doc, 'Section 10: Examiner & Background Notes', y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text('Name of Examiner: _______________________________________', PDF_MARGIN, y);
  y += 6;
  doc.text(`Date Administered: ${todayStr}`, PDF_MARGIN, y);
  y += 6;
  doc.text('Place: Barangay Bacong Daycare Center, Barangay Bacong, Albay', PDF_MARGIN, y);
  y += 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.text('Notes, descriptions and observations:', PDF_MARGIN, y);
  y += 6;

  const filledBg = BACKGROUND_FIELDS.map((f) => ({
    label: f.label,
    value: (background?.[f.key] as string | undefined) || '',
  })).filter((r) => r.value.trim());

  if (filledBg.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8.5);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text('No background information recorded.', PDF_MARGIN, y);
  } else {
    for (const row of filledBg) {
      if (y > PDF_H - 40) {
        doc.addPage();
        y = 25;
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(DARK_TEAL[0], DARK_TEAL[1], DARK_TEAL[2]);
      doc.text(row.label, PDF_MARGIN, y);
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(INK[0], INK[1], INK[2]);
      const lines = doc.splitTextToSize(row.value, PDF_CONTENT_W);
      for (const line of lines) {
        if (y > PDF_H - 25) {
          doc.addPage();
          y = 25;
        }
        doc.text(line, PDF_MARGIN, y);
        y += 4.2;
      }
      y += 3;
    }
  }

  /* ---------- Section 11: Raw & Scaled Scores ---------- */
  doc.addPage();
  y = 20;
  y = sectionTitle(doc, 'Section 11: Raw & Scaled Scores', y);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text(
    'Raw Score = number of present (✓) items per domain. Scaled Scores are entered from the official raw-to-scaled conversion tables (age-based). Sum of Scaled Scores is the total across all domains.',
    PDF_MARGIN,
    y,
    { maxWidth: PDF_CONTENT_W }
  );
  y += 5;

  const scoreBody: Array<Array<string | number>> = ECCD_DOMAINS.map((dom) => {
    const cells: Array<string | number> = [dom.label];
    for (const r of ROUNDS) {
      const raw = rawFor(dom.id, r, ratingsByRound[r], scoresByRound[r]);
      const scaled = scaledValue(scoresByRound[r]?.[dom.id]?.scaled) ?? '—';
      cells.push(raw, scaled);
    }
    return cells;
  });
  const sums = ROUNDS.map((r) => sumScaled(r, scoresByRound));
  const sumRow: Array<string | number> = ['Sum of Scaled Scores', '', sums[0] ?? '—', '', sums[1] ?? '—', '', sums[2] ?? '—'];
  scoreBody.push(sumRow);
  scoreBody.push(['Standard Score', '', '', '', '', '', '']);

  runTable(
    doc,
    autoTable,
    ['Domain', '1st Raw', '1st Scaled', '2nd Raw', '2nd Scaled', '3rd Raw', '3rd Scaled'],
    scoreBody,
    y,
    {
      columnStyles: {
        0: { cellWidth: 62 },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 20, halign: 'center' },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' },
        6: { cellWidth: 20, halign: 'center' },
      },
      didParseCell: (data: CellHookData) => {
        if (data.row.index === ECCD_DOMAINS.length) {
          data.cell.styles.fillColor = LIGHT_FILL;
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.textColor = DARK_TEAL;
        }
        if (data.row.index === ECCD_DOMAINS.length + 1 && data.column.index === 0) {
          data.cell.styles.fontStyle = 'bold';
        }
      },
    }
  );
  y = lastTableFinalY(doc) || y;
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.text('Official Interpretation of Scaled Scores', PDF_MARGIN, y);
  y += 4.5;
  const bandBody = INTERPRETATIONS.map((r) => [`${r.min}-${r.max}`, r.meaning] as Array<string | number>);
  runTable(doc, autoTable, ['Scaled Score', 'Interpretation'], bandBody, y, {
    columnStyles: { 0: { cellWidth: 40, halign: 'center' }, 1: { cellWidth: 142 } },
  });
  y = lastTableFinalY(doc) || y;
  y += 5;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text(
    'Standard Score: leave blank — computed from the official Sum-of-Scaled-Scores conversion table and hand-written on the printed form.',
    PDF_MARGIN,
    y,
    { maxWidth: PDF_CONTENT_W }
  );

  /* ---------- Section 12: Scaled Scores Profile chart ---------- */
  doc.addPage();
  y = 20;
  y = sectionTitle(doc, 'Section 12: Scaled Scores Profile', y);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text("Mark an x on the dot corresponding to the Scaled Score for each domain and connect the x's.", PDF_MARGIN, y, { maxWidth: PDF_CONTENT_W });
  y += 8;

  const chartLeft = PDF_MARGIN + 20;
  const chartRight = PDF_W - PDF_MARGIN;
  const chartTop = y + 4;
  const chartBottom = 250;
  const plotH = chartBottom - chartTop;
  const slots = ECCD_DOMAINS.length;
  const slotW = (chartRight - chartLeft) / slots;

  // Y axis ticks (scaled score 0-19).
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  for (const v of [19, 15, 10, 5, 1, 0]) {
    const yy = chartTop + (19 - v) * (plotH / 19);
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.15);
    doc.line(chartLeft, yy, chartRight, yy);
    doc.text(String(v), chartLeft - 3, yy + 1.5, { align: 'right' });
  }
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.3);
  doc.line(chartLeft, chartTop, chartLeft, chartBottom);
  doc.line(chartLeft, chartBottom, chartRight, chartBottom);
  doc.text('Scaled Score', chartLeft - 6, chartTop - 4, { align: 'center' });

  ECCD_DOMAINS.forEach((dom, i) => {
    const cx = chartLeft + slotW * (i + 0.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(dom.shortLabel, cx, chartBottom + 4, { align: 'center', angle: i % 2 === 1 ? 40 : 0 });
  });

  ROUNDS.forEach((r, ri) => {
    const pts: Array<{ x: number; y: number }> = [];
    ECCD_DOMAINS.forEach((dom, i) => {
      const s = scaledNumber(scoresByRound[r]?.[dom.id]?.scaled);
      if (s !== null) {
        pts.push({
          x: chartLeft + slotW * (i + 0.5),
          y: chartTop + (19 - s) * (plotH / 19),
        });
      }
    });
    if (pts.length === 0) return;
    doc.setDrawColor(ROUND_COLORS[ri][0], ROUND_COLORS[ri][1], ROUND_COLORS[ri][2]);
    doc.setTextColor(ROUND_COLORS[ri][0], ROUND_COLORS[ri][1], ROUND_COLORS[ri][2]);
    doc.setLineWidth(0.35);
    for (let i = 0; i < pts.length - 1; i += 1) {
      doc.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    for (const p of pts) {
      doc.text('X', p.x, p.y + 1.4, { align: 'center' });
    }
  });

  // Legend.
  y = chartBottom + 14;
  ROUNDS.forEach((r, ri) => {
    doc.setDrawColor(ROUND_COLORS[ri][0], ROUND_COLORS[ri][1], ROUND_COLORS[ri][2]);
    doc.setLineWidth(0.5);
    const lx = PDF_MARGIN + ri * 62;
    doc.line(lx, y - 1, lx + 10, y - 1);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(roundLabel(r), lx + 13, y);
  });

  /* ---------- Section 13: Standard Scores chart ---------- */
  doc.addPage();
  y = 20;
  y = sectionTitle(doc, 'Section 13: Standard Scores', y);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text(
    "Mark an x on the corresponding standard score for each test administration and connect the x's. Write the date for each test administration. X marks are hand-written using the official conversion table.",
    PDF_MARGIN,
    y,
    { maxWidth: PDF_CONTENT_W }
  );
  y += 10;

  const stdLeft = PDF_MARGIN + 28;
  const stdRight = PDF_W - PDF_MARGIN;
  const stdTop = y;
  const stdBottom = 235;
  const stdScores = [160, 150, 140, 130, 120, 110, 100, 90, 80, 70, 60, 50];
  const ages = ['3 years & 1 month', '4 years', '5 years'];

  // Age rows.
  const ageH = (stdBottom - stdTop) / ages.length;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  ages.forEach((age, i) => {
    const yy = stdTop + ageH * (i + 1);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.line(stdLeft, yy, stdRight, yy);
    doc.text(age, stdLeft - 4, yy - 2.5, { align: 'right' });
  });

  // Score columns.
  const colW = (stdRight - stdLeft) / (stdScores.length - 1);
  stdScores.forEach((s, i) => {
    const x = stdLeft + colW * i;
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.2);
    doc.line(x, stdTop, x, stdBottom);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
    doc.text(String(s), x, stdTop - 3, { align: 'center' });
  });
  doc.setDrawColor(150, 150, 150);
  doc.setLineWidth(0.4);
  doc.line(stdLeft, stdTop, stdRight, stdTop);
  doc.line(stdLeft, stdBottom, stdRight, stdBottom);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text('AGES', stdLeft - 4, stdTop - 3, { align: 'right' });

  // Bands.
  y = stdBottom + 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(DARK_TEAL[0], DARK_TEAL[1], DARK_TEAL[2]);
  doc.text('Interpretation bands:', PDF_MARGIN, y);
  y += 5;
  for (const b of STANDARD_BANDS) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(INK[0], INK[1], INK[2]);
    doc.text(
      b.min === 0 ? `Below 85 — ${b.label}` : `${b.min} and above — ${b.label}`,
      PDF_MARGIN + 2,
      y
    );
    y += 4.8;
  }

  /* ---------- Footer on every page ---------- */
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 120, 120);
    doc.text(
      "Early Childhood Care and Development (ECCD) Checklist, Child's Record 2",
      PDF_MARGIN,
      PDF_H - 8
    );
    doc.text(`Page ${i} of ${pageCount}`, PDF_W - PDF_MARGIN, PDF_H - 8, { align: 'right' });
  }
}
