import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
import type { Document as XmlDocument, Element as XmlElement } from '@xmldom/xmldom';
import { ECCD_DOMAINS } from '@/data/eccdChecklist';
import {
  BACKGROUND_FIELDS,
  computeAgeYMD,
  formAddress,
  formatAge,
  formatFormDate,
  interpretStandardScore,
  itemComments,
  itemMark,
  latestGradedRound,
  rawScore,
  splitISODate,
  sumOfScaledScores,
  type EccdRecord,
  type EccdRecordRound,
} from '@/lib/eccdRecord';

/**
 * Fills the official ECCD Checklist, Child's Record 2 Word template
 * (src/templates/eccd-child-record-2.docx) with one child's record.
 *
 * The template is filled in place: values go into its existing blank cells and
 * over its `____` lines, so the downloaded file is the centre's own form, not a
 * re-drawing of it. Cells are found by what the form prints (a domain table by
 * its heading, an item row by its number, a field by its label), never by
 * position alone, so the form's repeated header rows and sub-domain rows are
 * skipped naturally.
 */

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';

interface RunStyle {
  bold?: boolean;
  /** Half-points, as Word stores them (20 = 10pt). */
  size?: number;
  underline?: boolean;
}

function children(el: XmlElement, localName: string): XmlElement[] {
  const out: XmlElement[] = [];
  for (let n = el.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && (n as XmlElement).namespaceURI === W && (n as XmlElement).localName === localName) {
      out.push(n as XmlElement);
    }
  }
  return out;
}

function descendants(el: XmlElement, localName: string): XmlElement[] {
  return Array.from(el.getElementsByTagNameNS(W, localName)) as XmlElement[];
}

function textOf(el: XmlElement): string {
  return descendants(el, 't').map((t) => t.textContent ?? '').join('');
}

/** Curly apostrophes and runs of spaces vary across the form; compare on a normal form. */
function norm(s: string): string {
  return s.replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}

function wEl(doc: XmlDocument, name: string, attrs: Record<string, string> = {}): XmlElement {
  const el = doc.createElementNS(W, `w:${name}`);
  for (const [k, v] of Object.entries(attrs)) el.setAttributeNS(W, `w:${k}`, v);
  return el;
}

/** A run of text; `\n` in the text becomes a line break within the same paragraph. */
function makeRun(doc: XmlDocument, text: string, style: RunStyle = {}): XmlElement {
  const r = wEl(doc, 'r');
  const rPr = wEl(doc, 'rPr');
  // Child order follows the WordprocessingML schema, which Word enforces.
  if (style.bold) {
    rPr.appendChild(wEl(doc, 'b'));
    rPr.appendChild(wEl(doc, 'bCs'));
  }
  if (style.size) {
    rPr.appendChild(wEl(doc, 'sz', { val: String(style.size) }));
    rPr.appendChild(wEl(doc, 'szCs', { val: String(style.size) }));
  }
  if (style.underline) rPr.appendChild(wEl(doc, 'u', { val: 'single' }));
  if (rPr.firstChild) r.appendChild(rPr);
  text.split('\n').forEach((line, i) => {
    if (i > 0) r.appendChild(wEl(doc, 'br'));
    const parts = line.split('\t');
    parts.forEach((part, j) => {
      if (j > 0) r.appendChild(wEl(doc, 'tab'));
      if (!part) return;
      const t = wEl(doc, 't');
      t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
      t.appendChild(doc.createTextNode(part));
      r.appendChild(t);
    });
  });
  return r;
}

function ensurePPr(doc: XmlDocument, p: XmlElement): XmlElement {
  const existing = children(p, 'pPr')[0];
  if (existing) return existing;
  const pPr = wEl(doc, 'pPr');
  p.insertBefore(pPr, p.firstChild);
  return pPr;
}

/** Inserts `el` into a paragraph's pPr ahead of the first child that the schema orders after it. */
function insertIntoPPr(pPr: XmlElement, el: XmlElement, before: string[]) {
  for (let n = pPr.firstChild; n; n = n.nextSibling) {
    if (n.nodeType === 1 && before.includes((n as XmlElement).localName ?? '')) {
      pPr.insertBefore(el, n);
      return;
    }
  }
  pPr.appendChild(el);
}

const AFTER_JC = ['textDirection', 'textAlignment', 'textboxTightWrap', 'outlineLvl', 'divId', 'cnfStyle', 'rPr', 'sectPr', 'pPrChange'];
const AFTER_TABS = ['suppressAutoHyphens', 'kinsoku', 'wordWrap', 'overflowPunct', 'topLinePunct', 'autoSpaceDE', 'autoSpaceDN', 'bidi', 'adjustRightInd', 'snapToGrid', 'spacing', 'ind', 'contextualSpacing', 'mirrorIndents', 'suppressOverlap', 'jc', ...AFTER_JC];

function setCellText(
  doc: XmlDocument,
  tc: XmlElement,
  text: string,
  style: RunStyle & { center?: boolean; tabAt?: number } = {}
) {
  if (!text) return;
  let p = children(tc, 'p')[0];
  if (!p) {
    p = wEl(doc, 'p');
    tc.appendChild(p);
  }
  for (const r of children(p, 'r')) p.removeChild(r);
  if (style.center && !children(ensurePPr(doc, p), 'jc').length) {
    insertIntoPPr(ensurePPr(doc, p), wEl(doc, 'jc', { val: 'center' }), AFTER_JC);
  }
  if (style.tabAt) {
    const tabs = wEl(doc, 'tabs');
    tabs.appendChild(wEl(doc, 'tab', { val: 'left', pos: String(style.tabAt) }));
    insertIntoPPr(ensurePPr(doc, p), tabs, AFTER_TABS);
  }
  p.appendChild(makeRun(doc, text, style));
}

/** Label (as printed, without the trailing colon) -> value, for the form's `____` lines. */
function fieldValues(record: EccdRecord): Record<string, string> {
  const p = record.profile;
  const latest = latestGradedRound(record);
  const num = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
  return {
    "Child's Name": `${record.pupil.lastName}, ${record.pupil.firstName}`,
    Sex: record.pupil.sex,
    'Date of Birth (month/day/year)': formatFormDate(record.pupil.birthDate),
    'Address (Barangay, Municipality/City, Province, Region)': formAddress(record),
    "If Yes, name of child's school/learning center/day care": p?.currentlyStudying ? p.schoolName : '',
    "Father's Name": p?.fatherName ?? '',
    "Father's Age": num(p?.fatherAge),
    "Father's Occupation": p?.fatherOccupation ?? '',
    "Father's Educational Attainment": p?.fatherEducation ?? '',
    "Mother's Name": p?.motherName ?? '',
    "Mother's Age": num(p?.motherAge),
    "Mother's Occupation": p?.motherOccupation ?? '',
    "Mother's Educational Attainment": p?.motherEducation ?? '',
    "Child's Number of Siblings": num(p?.siblingsCount),
    "Child's Birth Order (1st, 2nd, 3rd, etc.)": p?.birthOrder ?? '',
    'Name of examiner': latest?.examinerName ?? '',
    'Date administered': formatFormDate(latest?.testedOn),
    'Place where test is administered': record.centerName,
  };
}

/** Writes each value over the `____` run that follows its bold label. */
function fillUnderscoreFields(doc: XmlDocument, paragraphs: XmlElement[], values: Record<string, string>) {
  for (const p of paragraphs) {
    const runs = children(p, 'r');
    runs.forEach((run, i) => {
      const label = norm(textOf(run)).replace(/:$/, '');
      const value = values[label];
      if (!value) return;
      const blank = runs.slice(i + 1).find((r) => /^_{3,}\s*$/.test(textOf(r)));
      if (!blank) return;
      const t = descendants(blank, 't')[0];
      const trailing = (t.textContent ?? '').match(/\s*$/)?.[0] ?? '';
      t.textContent = ` ${value} `;
      t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
      let rPr = children(blank, 'rPr')[0];
      if (!rPr) {
        rPr = wEl(doc, 'rPr');
        blank.insertBefore(rPr, blank.firstChild);
      }
      rPr.appendChild(wEl(doc, 'u', { val: 'single' }));
      // Keep the gap before the next label on the same line, un-underlined.
      if (trailing) {
        const gap = blank.cloneNode(true) as XmlElement;
        const gapRPr = children(gap, 'rPr')[0];
        for (const u of children(gapRPr, 'u')) gapRPr.removeChild(u);
        descendants(gap, 't')[0].textContent = trailing;
        p.insertBefore(gap, blank.nextSibling);
      }
    });
  }
}

/** Ticks one `☐ option` in a checkbox line, e.g. "Child's Handedness:  ☐ right   ☐ left". */
function tickOption(paragraphs: XmlElement[], lineStart: string, option: string | null) {
  if (!option) return;
  const p = paragraphs.find((para) => norm(textOf(para)).startsWith(lineStart));
  if (!p) return;
  for (const t of descendants(p, 't')) {
    const text = t.textContent ?? '';
    if (text.includes(`☐ ${option}`)) {
      t.textContent = text.replace(`☐ ${option}`, `☒ ${option}`);
      return;
    }
  }
}

function fillAgeTable(doc: XmlDocument, table: XmlElement, record: EccdRecord) {
  const rows = children(table, 'tr');
  const dob = splitISODate(record.pupil.birthDate);
  for (const round of record.rounds) {
    if (!round.graded || !round.testedOn) continue;
    const tested = splitISODate(round.testedOn);
    const age = computeAgeYMD(record.pupil.birthDate, round.testedOn);
    const base = 1 + (round.round - 1) * 3;
    const lines: Array<[string, string[], string]> = [
      ['Date Tested', [tested.y, tested.m, tested.d], round.examinerName ?? ''],
      ["Child's Date of Birth", [dob.y, dob.m, dob.d], ''],
      ["Child's Age", age ? [String(age.y), String(age.m), String(age.d)] : ['', '', ''], ''],
    ];
    lines.forEach(([label, ymd, examiner], offset) => {
      const tcs = children(rows[base + offset], 'tc');
      if (norm(textOf(tcs[1])) !== label) {
        throw new Error(`ECCD template: expected "${label}" in the age table, found "${textOf(tcs[1])}"`);
      }
      ymd.forEach((v, i) => setCellText(doc, tcs[2 + i], v, { center: true }));
      setCellText(doc, tcs[5], examiner);
    });
  }
}

function fillDomainTable(doc: XmlDocument, table: XmlElement, record: EccdRecord): boolean {
  const rows = children(table, 'tr');
  const heading = norm(textOf(children(rows[0], 'tc')[1] ?? rows[0]));
  const domain = ECCD_DOMAINS.find((d) => d.shortLabel === heading);
  if (!domain) return false;

  for (const tr of rows.slice(1)) {
    const tcs = children(tr, 'tc');
    if (tcs.length < 7) continue;
    const first = norm(textOf(tcs[0]));
    if (/^\d+$/.test(first)) {
      const item = domain.items[Number(first) - 1];
      if (!item) {
        throw new Error(`ECCD template: ${domain.shortLabel} row ${first} has no checklist item`);
      }
      record.rounds.forEach((round, i) => {
        setCellText(doc, tcs[3 + i], itemMark(round, item.id), { center: true, bold: true, size: 22 });
      });
      setCellText(doc, tcs[6], itemComments(record, item.id).join('\n'), { size: 17 });
    } else if (norm(textOf(tcs[1])) === 'TOTAL SCORE') {
      record.rounds.forEach((round, i) => {
        if (round.graded) {
          setCellText(doc, tcs[3 + i], String(rawScore(round, domain.id)), { center: true, bold: true });
        }
      });
    }
  }
  return true;
}

/** Raw and Scaled share one cell per round; a tab stop puts Scaled under its heading. */
const SCALED_TAB_POS = 1250;

function fillSummaryTable(doc: XmlDocument, table: XmlElement, record: EccdRecord) {
  const rows = children(table, 'tr');
  const headerCells = children(rows[0], 'tc');
  record.rounds.forEach((round, i) => {
    if (!round.graded) return;
    const age = round.testedOn ? computeAgeYMD(record.pupil.birthDate, round.testedOn) : null;
    for (const t of descendants(headerCells[1 + i], 't')) {
      const text = t.textContent ?? '';
      if (!/Date:_+|Age:_+/.test(text)) continue;
      t.textContent = text
        .replace(/Date:_+/, `Date: ${formatFormDate(round.testedOn) || '___'}`)
        .replace(/Age:_+/, `Age: ${formatAge(age) || '___'}`);
      t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    }
  });

  for (const tr of rows.slice(2)) {
    const tcs = children(tr, 'tc');
    const label = norm(textOf(tcs[0]));
    const domain = ECCD_DOMAINS.find((d) => d.shortLabel === label);
    record.rounds.forEach((round: EccdRecordRound, i) => {
      if (!round.graded) return;
      const cell = tcs[1 + i];
      if (domain) {
        const scaled = round.scaled[domain.id];
        const text = `${rawScore(round, domain.id)}\t${scaled ?? ''}`;
        setCellText(doc, cell, text, { tabAt: SCALED_TAB_POS });
      } else if (label === 'Sum of Scaled Scores') {
        setCellText(doc, cell, String(sumOfScaledScores(round) ?? ''), { tabAt: SCALED_TAB_POS });
        // Sits in the Scaled column, so lead with the tab.
        const run = children(children(cell, 'p')[0], 'r')[0];
        if (run) run.insertBefore(wEl(doc, 'tab'), children(run, 't')[0] ?? null);
      } else if (label === 'Standard Score') {
        setCellText(doc, cell, round.standardScore === null ? '' : String(round.standardScore), { center: true, bold: true });
      } else if (label === 'Interpretation') {
        setCellText(doc, cell, interpretStandardScore(round.standardScore), { size: 17 });
      }
    });
  }
}

/** Adds each Child & Family Background note as a paragraph under its prompt. */
function fillExaminerNotes(doc: XmlDocument, paragraphs: XmlElement[], record: EccdRecord) {
  if (!record.background) return;
  const start = paragraphs.findIndex((p) => norm(textOf(p)).startsWith('Write down your notes'));
  if (start < 0) return;
  for (const field of BACKGROUND_FIELDS) {
    const note = (record.background[field.key] || '').trim();
    if (!note) continue;
    const prompt = paragraphs.slice(start + 1).find((p) => norm(textOf(p)).startsWith(field.heading));
    if (!prompt) continue;
    const p = wEl(doc, 'p');
    const pPr = wEl(doc, 'pPr');
    pPr.appendChild(wEl(doc, 'spacing', { after: '160' }));
    pPr.appendChild(wEl(doc, 'ind', { left: '360' }));
    p.appendChild(pPr);
    p.appendChild(makeRun(doc, note, { size: 22 }));
    prompt.parentNode?.insertBefore(p, prompt.nextSibling);
  }
}

export async function fillEccdDocx(template: Uint8Array | ArrayBuffer, record: EccdRecord): Promise<Buffer> {
  const zip = await JSZip.loadAsync(template);
  const entry = zip.file('word/document.xml');
  if (!entry) throw new Error('ECCD template: word/document.xml is missing');
  const doc = new DOMParser().parseFromString(await entry.async('string'), 'text/xml');
  const body = doc.getElementsByTagNameNS(W, 'body')[0] as XmlElement | undefined;
  if (!body) throw new Error('ECCD template: document body is missing');

  const paragraphs = children(body, 'p');
  const tables = children(body, 'tbl');

  fillUnderscoreFields(doc, paragraphs, fieldValues(record));
  const handedness = record.profile?.handedness;
  tickOption(paragraphs, "Child's Handedness:", handedness === 'not_yet_established' ? 'not yet established' : handedness ?? null);
  if (record.profile) {
    tickOption(paragraphs, 'Is the child presently studying?', record.profile.currentlyStudying ? 'Yes' : 'No');
  }

  let domainTables = 0;
  for (const table of tables) {
    const firstRow = children(table, 'tr')[0];
    const header = firstRow ? children(firstRow, 'tc').map((tc) => norm(textOf(tc))) : [];
    if (header[5] === "Examiner's Name") fillAgeTable(doc, table, record);
    else if (header[0] === 'Domain' && header[1]?.includes('Evaluation')) fillSummaryTable(doc, table, record);
    else if (header[0] === '#' && fillDomainTable(doc, table, record)) domainTables += 1;
  }
  if (domainTables !== ECCD_DOMAINS.length) {
    throw new Error(`ECCD template: filled ${domainTables} of ${ECCD_DOMAINS.length} domain tables`);
  }

  fillExaminerNotes(doc, paragraphs, record);

  let xml = new XMLSerializer().serializeToString(doc);
  if (!xml.startsWith('<?xml')) {
    xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n${xml}`;
  }
  zip.file('word/document.xml', xml, { createFolders: false });
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
