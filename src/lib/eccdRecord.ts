/**
 * ECCD Checklist, Child's Record 2 — the data a filled record is made of, and
 * the rules the form itself states for deriving values from it.
 *
 * Shared by the server (which fills the Word template in src/lib/eccdDocx.ts)
 * and the browser (which previews the same record before download), so it
 * holds no I/O.
 */
import { ECCD_DOMAINS } from '@/data/eccdChecklist';

export type EccdRound = 1 | 2 | 3;

export const ECCD_ROUNDS: EccdRound[] = [1, 2, 3];

export const ROUND_ORDINAL: Record<EccdRound, string> = { 1: '1st', 2: '2nd', 3: '3rd' };

export interface EccdRecordProfile {
  handedness: 'right' | 'left' | 'both' | 'not_yet_established' | null;
  currentlyStudying: boolean;
  schoolName: string;
  barangay: string;
  municipality: string;
  province: string;
  region: string;
  fatherName: string;
  fatherAge: number | null;
  fatherOccupation: string;
  fatherEducation: string;
  motherName: string;
  motherAge: number | null;
  motherOccupation: string;
  motherEducation: string;
  siblingsCount: number | null;
  birthOrder: string;
}

export interface EccdRecordRound {
  round: EccdRound;
  /** The round was saved at least once. Ungraded rounds print blank columns. */
  graded: boolean;
  /** `YYYY-MM-DD`, centre-local. */
  testedOn: string | null;
  examinerName: string | null;
  standardScore: number | null;
  /** Checklist item ids marked present (✔). */
  present: string[];
  /** Item id -> the examiner's comment for this round. */
  comments: Record<string, string>;
  /** Domain id -> scaled score read off the official table, if entered. */
  scaled: Record<string, number | null>;
}

export interface EccdRecordBackground {
  child_background: string;
  family_environment: string;
  stimulating_activities: string;
  home_environment: string;
  others: string;
}

export interface EccdRecord {
  pupil: {
    id: string;
    firstName: string;
    lastName: string;
    sex: string;
    /** `YYYY-MM-DD`. */
    birthDate: string;
    address: string;
  };
  profile: EccdRecordProfile | null;
  rounds: EccdRecordRound[];
  background: EccdRecordBackground | null;
  centerName: string;
}

export interface AgeYMD {
  y: number;
  m: number;
  d: number;
}

function isoParts(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/**
 * The child's age on the day tested, as the form instructs: subtract the date
 * of birth from the date tested, borrowing 30 days per month and 12 months per
 * year, without rounding. Works on the date strings directly so the browser's
 * timezone cannot shift either date by a day.
 */
export function computeAgeYMD(birthISO: string, testedISO: string): AgeYMD | null {
  const born = isoParts(birthISO);
  const tested = isoParts(testedISO);
  if (!born || !tested) return null;
  let { y, m, d } = tested;
  if (d < born.d) {
    d += 30;
    m -= 1;
  }
  if (m < born.m) {
    m += 12;
    y -= 1;
  }
  if (y < born.y) return null;
  return { y: y - born.y, m: m - born.m, d: d - born.d };
}

export function formatAge(age: AgeYMD | null): string {
  if (!age) return '';
  return `${age.y}y ${age.m}m ${age.d}d`;
}

/** `YYYY-MM-DD` -> `MM/DD/YYYY`, the form's month/day/year order. */
export function formatFormDate(iso: string | null | undefined): string {
  const p = iso ? isoParts(iso) : null;
  if (!p) return '';
  return `${String(p.m).padStart(2, '0')}/${String(p.d).padStart(2, '0')}/${p.y}`;
}

export function splitISODate(iso: string | null | undefined): { y: string; m: string; d: string } {
  const p = iso ? isoParts(iso) : null;
  if (!p) return { y: '', m: '', d: '' };
  return { y: String(p.y), m: String(p.m).padStart(2, '0'), d: String(p.d).padStart(2, '0') };
}

/** What the 1st/2nd/3rd Eval column shows: ✔ present, - not shown, blank if the round is not graded. */
export function itemMark(round: EccdRecordRound, itemId: string): '✔' | '-' | '' {
  if (round.present.includes(itemId)) return '✔';
  return round.graded ? '-' : '';
}

/** Raw score = number of ✔ in the domain (the form's "How to score"). */
export function rawScore(round: EccdRecordRound, domainId: string): number {
  const domain = ECCD_DOMAINS.find((d) => d.id === domainId);
  if (!domain) return 0;
  return domain.items.filter((item) => round.present.includes(item.id)).length;
}

export function sumOfScaledScores(round: EccdRecordRound): number | null {
  let sum = 0;
  let any = false;
  for (const domain of ECCD_DOMAINS) {
    const scaled = round.scaled[domain.id];
    if (scaled !== null && scaled !== undefined) {
      sum += scaled;
      any = true;
    }
  }
  return any ? sum : null;
}

/** The form's "Interpretation of Scaled Score" table. */
export const SCALED_SCORE_BANDS: Array<{ min: number; max: number; meaning: string }> = [
  { min: 1, max: 3, meaning: 'Development in the domain must be monitored after 3 months' },
  { min: 4, max: 6, meaning: 'Development in the domain must be monitored after 6 months' },
  { min: 7, max: 13, meaning: 'Average overall development in the domain' },
  { min: 14, max: 16, meaning: 'Suggests slightly advanced development in the domain' },
  { min: 17, max: 19, meaning: 'Suggests highly advanced development in the domain' },
];

/** The form's "Interpretation of Standard Score" table. */
export const STANDARD_SCORE_BANDS: Array<{ min: number; max: number; label: string; meaning: string }> = [
  { min: 0, max: 69, label: '69 and below', meaning: 'Overall development must be monitored after 3 months' },
  { min: 70, max: 79, label: '70-79', meaning: 'Overall development must be monitored after 6 months' },
  { min: 80, max: 119, label: '80-119', meaning: 'Average overall development' },
  { min: 120, max: 129, label: '120-129', meaning: 'Slightly advanced overall development' },
  { min: 130, max: Infinity, label: '130 and above', meaning: 'Highly advanced overall development' },
];

export function interpretStandardScore(score: number | null | undefined): string {
  if (score === null || score === undefined) return '';
  return STANDARD_SCORE_BANDS.find((b) => score >= b.min && score <= b.max)?.meaning ?? '';
}

/** Comments column text: one line per round that has a comment, e.g. "1st: …". */
export function itemComments(record: EccdRecord, itemId: string): string[] {
  return record.rounds
    .filter((r) => r.comments[itemId])
    .map((r) => `${ROUND_ORDINAL[r.round]}: ${r.comments[itemId]}`);
}

/** The form's single address line: street address, then barangay through region. */
export function formAddress(record: EccdRecord): string {
  const parts = [record.pupil.address];
  const p = record.profile;
  if (p) parts.push(p.barangay, p.municipality, p.province, p.region);
  const seen: string[] = [];
  for (const raw of parts) {
    const part = (raw || '').trim();
    if (!part) continue;
    if (seen.some((s) => s.toLowerCase().includes(part.toLowerCase()))) continue;
    seen.push(part);
  }
  return seen.join(', ');
}

/** The most recently tested round, for the Examiner's Notes page. */
export function latestGradedRound(record: EccdRecord): EccdRecordRound | null {
  const graded = record.rounds.filter((r) => r.graded);
  return graded.length ? graded[graded.length - 1] : null;
}

/** Examiner's Notes prompts, in form order; `heading` is how each prompt starts on the form. */
export const BACKGROUND_FIELDS: Array<{ key: keyof EccdRecordBackground; heading: string }> = [
  { key: 'child_background', heading: "Child's background" },
  { key: 'family_environment', heading: 'Family environment' },
  { key: 'stimulating_activities', heading: "Parents' stimulating activities" },
  { key: 'home_environment', heading: 'Home environment' },
  { key: 'others', heading: 'Others' },
];

export function recordFileName(record: EccdRecord): string {
  const safe = `${record.pupil.lastName}_${record.pupil.firstName}`
    .replace(/[^A-Za-z0-9À-ÖØ-öø-ÿ]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `ECCD_Record2_${safe || record.pupil.id}.docx`;
}
