import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from '@playwright/test';
import JSZip from 'jszip';
import { DOMParser } from '@xmldom/xmldom';
import type { Element as XmlElement } from '@xmldom/xmldom';
import { fillEccdDocx } from '@/lib/eccdDocx';
import type { EccdRecord } from '@/lib/eccdRecord';
import { ECCD_TOTAL_ITEMS } from '@/data/eccdChecklist';

/**
 * Fills the real Child's Record 2 template with a fixture record and reads the
 * result back cell by cell. No server or browser needed: this is the contract
 * between src/templates/eccd-child-record-2.docx and src/lib/eccdDocx.ts.
 */

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const TEMPLATE = path.join(__dirname, '..', 'src', 'templates', 'eccd-child-record-2.docx');

const record: EccdRecord = {
  pupil: {
    id: 'PUP-2026-001',
    firstName: 'Mateo',
    lastName: 'Santos',
    sex: 'Male',
    birthDate: '2022-05-20',
    address: 'Purok 3',
  },
  profile: {
    handedness: 'right',
    currentlyStudying: true,
    schoolName: 'Barangay Bacong Daycare Center',
    barangay: 'Bacong',
    municipality: 'San Luis',
    province: 'Aurora',
    region: 'III',
    fatherName: 'Jose Santos',
    fatherAge: 34,
    fatherOccupation: 'Farmer',
    fatherEducation: 'High School',
    motherName: 'Ana Santos',
    motherAge: 31,
    motherOccupation: 'Vendor',
    motherEducation: 'College',
    siblingsCount: 2,
    birthOrder: '2nd',
  },
  rounds: [
    {
      round: 1,
      graded: true,
      testedOn: '2026-09-10',
      examinerName: 'Teresa Cruz',
      standardScore: 95,
      present: ['GM-01', 'GM-02', 'SE-05'],
      comments: { 'GM-03': 'Afraid of falling' },
      scaled: { gross_motor: 9, fine_motor: 10 },
    },
    { round: 2, graded: false, testedOn: null, examinerName: null, standardScore: null, present: [], comments: {}, scaled: {} },
    { round: 3, graded: false, testedOn: null, examinerName: null, standardScore: null, present: [], comments: {}, scaled: {} },
  ],
  background: {
    child_background: 'Healthy and active.',
    family_environment: '',
    stimulating_activities: '',
    home_environment: '',
    others: '',
  },
  centerName: 'Barangay Bacong Daycare Center',
};

function kids(el: XmlElement, name: string): XmlElement[] {
  const out: XmlElement[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as XmlElement).localName === name) out.push(n as XmlElement);
  }
  return out;
}

const text = (el: XmlElement) =>
  (Array.from(el.getElementsByTagNameNS(W, 't')) as XmlElement[]).map((t) => t.textContent ?? '').join('');

async function fill() {
  const out = await fillEccdDocx(readFileSync(TEMPLATE), record);
  const zip = await JSZip.loadAsync(out);
  const doc = new DOMParser().parseFromString(await zip.file('word/document.xml')!.async('string'), 'text/xml');
  const body = doc.getElementsByTagNameNS(W, 'body')[0] as XmlElement;
  const tables = kids(body, 'tbl');
  const paragraphs = kids(body, 'p').map(text);
  const rows = (table: XmlElement) => kids(table, 'tr').map((tr) => kids(tr, 'tc'));
  const domainTable = (heading: string) => tables.find((t) => text(rows(t)[0][1]).trim() === heading)!;
  const itemRow = (heading: string, n: number) => rows(domainTable(heading)).find((tcs) => text(tcs[0]).trim() === String(n))!;
  return { out, zip, tables, paragraphs, rows, domainTable, itemRow };
}

test.describe("ECCD Child's Record 2 docx", () => {
  test('the template yields the full 109-item checklist', () => {
    expect(ECCD_TOTAL_ITEMS).toBe(109);
  });

  test('fills the profile, checklist, summary and notes in place', async ({}, testInfo) => {
    const { out, zip, tables, paragraphs, rows, domainTable, itemRow } = await fill();
    writeFileSync(testInfo.outputPath('ECCD_Record2_fixture.docx'), out);

    // Same parts as the template: nothing added or dropped.
    const template = await JSZip.loadAsync(readFileSync(TEMPLATE));
    expect(Object.keys(zip.files).sort()).toEqual(Object.keys(template.files).sort());

    // Sociodemographic profile.
    expect(paragraphs.find((p) => p.startsWith("Child's Name:"))).toContain('Santos, Mateo');
    expect(paragraphs.find((p) => p.startsWith('Sex:'))).toContain('05/20/2022');
    expect(paragraphs.find((p) => p.startsWith('Address'))).toContain('Purok 3, Bacong, San Luis, Aurora, III');
    expect(paragraphs.find((p) => p.startsWith("Child's Handedness:"))).toContain('☒ right');
    expect(paragraphs.find((p) => p.startsWith('Is the child presently studying?'))).toContain('☒ Yes');
    expect(paragraphs.find((p) => p.startsWith("Father's Name:"))).toContain('Jose Santos');
    expect(paragraphs.find((p) => p.startsWith("Mother's Occupation:"))).toContain('College');
    // No data for this line, so the blank stays for handwriting.
    expect(paragraphs.find((p) => p.startsWith('Brother/s and Sister/s:'))).toMatch(/_{10,}/);

    // Age computation: 2026-09-10 minus 2022-05-20 with 30-day months = 4y 3m 20d.
    const age = rows(tables[0]);
    expect(age[1].slice(2).map(text)).toEqual(['2026', '09', '10', 'Teresa Cruz']);
    expect(age[3].slice(2, 5).map(text)).toEqual(['4', '3', '20']);
    expect(age[4].slice(2).map(text)).toEqual(['', '', '', '']);

    // Checklist marks: ✔ present, - graded but not shown, blank for ungraded rounds.
    expect(itemRow('Gross Motor', 1).slice(3, 6).map(text)).toEqual(['✔', '', '']);
    expect(itemRow('Gross Motor', 3).slice(3, 6).map(text)).toEqual(['-', '', '']);
    expect(text(itemRow('Gross Motor', 3)[6])).toBe('1st: Afraid of falling');
    expect(itemRow('Social-Emotional', 5).slice(3, 6).map(text)).toEqual(['✔', '', '']);
    const gmTotal = rows(domainTable('Gross Motor')).find((tcs) => text(tcs[1]) === 'TOTAL SCORE')!;
    expect(gmTotal.slice(3, 6).map(text)).toEqual(['2', '', '']);

    // Template typo fixes.
    expect(text(itemRow('Receptive Language', 5)[1])).toBe('Follows two-step instructions that include simple prepositions');
    expect(rows(domainTable('Fine Motor')).some((tcs) => /Gross|Grass/.test(text(tcs[1])))).toBe(false);

    // Summary of scores.
    const summary = tables.find((t) => text(rows(t)[0][0]) === 'Domain')!;
    const summaryRow = (label: string) => rows(summary).find((tcs) => text(tcs[0]) === label)!;
    expect(text(rows(summary)[0][1])).toContain('Date: 09/10/2026');
    expect(text(rows(summary)[0][1])).toContain('Age: 4y 3m 20d');
    expect(text(rows(summary)[0][2])).toContain('Date:___');
    const gmSummary = summaryRow('Gross Motor')[1];
    expect(text(gmSummary)).toBe('29');
    expect(gmSummary.getElementsByTagNameNS(W, 'tab').length).toBeGreaterThan(0);
    expect(text(summaryRow('Sum of Scaled Scores')[1])).toBe('19');
    expect(text(summaryRow('Standard Score')[1])).toBe('95');
    expect(text(summaryRow('Interpretation')[1])).toBe('Average overall development');
    expect(text(summaryRow('Interpretation')[2])).toBe('');

    // Examiner's notes.
    expect(paragraphs.find((p) => p.startsWith('Name of examiner:'))).toContain('Teresa Cruz');
    expect(paragraphs.find((p) => p.startsWith('Date administered:'))).toContain('09/10/2026');
    const bgIndex = paragraphs.findIndex((p) => p.startsWith("Child's background"));
    expect(paragraphs[bgIndex + 1]).toBe('Healthy and active.');
  });
});
