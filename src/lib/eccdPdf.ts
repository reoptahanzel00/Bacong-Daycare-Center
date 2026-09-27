import type { jsPDF } from 'jspdf';
import { ECCD_DOMAINS } from '@/data/eccdChecklist';
import {
  BACKGROUND_FIELDS,
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
  sumOfScaledScores,
  type EccdRecord,
} from '@/lib/eccdRecord';

/**
 * ECCD Checklist, Child's Record 2, as a vector PDF.
 *
 * Built in the browser from the same `EccdRecord` the on-screen preview renders
 * (GET /api/eccd/report?format=json), so the parent and the Daycare Worker
 * download an identical document and it matches what they see. Drawn with the
 * same table engine as DSWD Form 1: small file, selectable text.
 */

type AutoTableFn = typeof import('jspdf-autotable').autoTable;

const MARGIN = 12;
const TEAL: [number, number, number] = [36, 117, 113];
const INK: [number, number, number] = [43, 43, 43];
const MUTED: [number, number, number] = [107, 107, 107];
const HEAD_FILL: [number, number, number] = [235, 245, 244];
const GRID: [number, number, number] = [214, 214, 214];

const HANDEDNESS: Record<string, string> = {
  right: 'Right',
  left: 'Left',
  both: 'Both',
  not_yet_established: 'Not yet established',
};

function finalY(doc: jsPDF): number {
  const last = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  return last?.finalY ?? 0;
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  const height = doc.internal.pageSize.getHeight();
  if (y > height - 30) {
    doc.addPage();
    y = 20;
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.text(text.toUpperCase(), MARGIN, y);
  return y + 3;
}

const tableBase = {
  theme: 'grid' as const,
  margin: { left: MARGIN, right: MARGIN, top: 16, bottom: 16 },
  styles: {
    font: 'helvetica',
    fontSize: 7.5,
    cellPadding: 1.4,
    textColor: INK,
    lineColor: GRID,
    lineWidth: 0.15,
    valign: 'middle' as const,
  },
  headStyles: { fillColor: HEAD_FILL, textColor: TEAL, fontStyle: 'bold' as const, fontSize: 7 },
};

/** Draws a ✔ inside a cell: the standard PDF fonts have no check glyph. */
function drawTick(doc: jsPDF, cell: { x: number; y: number; width: number; height: number }) {
  const cx = cell.x + cell.width / 2;
  const cy = cell.y + cell.height / 2;
  doc.setDrawColor(46, 125, 50);
  doc.setLineWidth(0.5);
  doc.line(cx - 1.6, cy, cx - 0.4, cy + 1.2);
  doc.line(cx - 0.4, cy + 1.2, cx + 1.8, cy - 1.4);
}

export function eccdPdfFileName(record: EccdRecord): string {
  const safe = `${record.pupil.lastName}_${record.pupil.firstName}`
    .replace(/[^A-Za-z0-9À-ÖØ-öø-ÿ]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `ECCD_Record2_${safe || record.pupil.id}.pdf`;
}

/** Renders the whole Child's Record 2 into `doc`. */
export function buildEccdPdf(doc: jsPDF, autoTable: AutoTableFn, record: EccdRecord) {
  const { pupil, profile } = record;
  const width = doc.internal.pageSize.getWidth();
  const centre = width / 2;

  // ---- Title ----
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('REPUBLIC OF THE PHILIPPINES • REGION III • PROVINCE OF AURORA • MUNICIPALITY OF SAN LUIS', centre, 12, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text('EARLY CHILDHOOD CARE AND DEVELOPMENT (ECCD) CHECKLIST', centre, 19, { align: 'center' });
  doc.setFontSize(9);
  doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.text(`Child's Record 2 — Ages 3 years 1 month to 5 years • ${record.centerName}`, centre, 24.5, { align: 'center' });
  doc.setDrawColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, 27, width - MARGIN, 27);

  // ---- Sociodemographic profile ----
  let y = sectionTitle(doc, 'Sociodemographic Profile', 33);
  const join = (parts: Array<string | number | null | undefined>, sep = ' / ') =>
    parts.filter((v) => v !== null && v !== undefined && v !== '').join(sep);
  autoTable(doc, {
    ...tableBase,
    startY: y,
    body: [
      ["Child's Name", `${pupil.lastName}, ${pupil.firstName}`, 'Sex', pupil.sex],
      ['Date of Birth', formatFormDate(pupil.birthDate), 'Handedness', profile?.handedness ? HANDEDNESS[profile.handedness] : ''],
      ['Address', { content: formAddress(record), colSpan: 3 }],
      ['Presently studying?', profile ? (profile.currentlyStudying ? 'Yes' : 'No') : '', 'School', profile?.currentlyStudying ? profile.schoolName : ''],
      ["Father's Name / Age", profile ? join([profile.fatherName, profile.fatherAge]) : '', "Mother's Name / Age", profile ? join([profile.motherName, profile.motherAge]) : ''],
      ["Father's Occupation / Education", profile ? join([profile.fatherOccupation, profile.fatherEducation]) : '', "Mother's Occupation / Education", profile ? join([profile.motherOccupation, profile.motherEducation]) : ''],
      ['No. of Siblings / Birth Order', profile ? join([profile.siblingsCount, profile.birthOrder]) : '', 'Student ID', pupil.id],
    ],
    columnStyles: {
      0: { cellWidth: 38, fontStyle: 'bold', textColor: TEAL, fontSize: 6.8 },
      2: { cellWidth: 38, fontStyle: 'bold', textColor: TEAL, fontSize: 6.8 },
    },
  });

  // ---- Age computation ----
  y = sectionTitle(doc, "Computation of the Child's Age", finalY(doc) + 8);
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [['Assessment', 'Date Tested', 'Date of Birth', "Child's Age (Y / M / D)", "Examiner's Name"]],
    body: record.rounds.map((round) => {
      const age = round.testedOn ? computeAgeYMD(pupil.birthDate, round.testedOn) : null;
      return [
        `${ROUND_ORDINAL[round.round]} assessment`,
        round.graded ? formatFormDate(round.testedOn) : '—',
        round.graded ? formatFormDate(pupil.birthDate) : '—',
        age ? `${age.y} / ${age.m} / ${age.d}` : '—',
        round.examinerName || '',
      ];
    }),
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'center', fontStyle: 'bold' } },
  });

  // ---- Checklist per domain ----
  for (const dom of ECCD_DOMAINS) {
    y = sectionTitle(doc, `${dom.label} (${dom.items.length} items)`, finalY(doc) + 8);
    const body = dom.items.map((item) => [
      String(item.number),
      item.description,
      ...record.rounds.map((round) => {
        const mark = itemMark(round, item.id);
        return mark === '✔' ? '' : mark;
      }),
      itemComments(record, item.id).join('\n'),
    ]);
    body.push([
      '',
      'TOTAL SCORE',
      ...record.rounds.map((round) => (round.graded ? String(rawScore(round, dom.id)) : '')),
      '',
    ]);
    autoTable(doc, {
      ...tableBase,
      startY: y,
      head: [['#', 'Item', ...record.rounds.map((r) => `${ROUND_ORDINAL[r.round]} Eval`), 'Comments']],
      body,
      columnStyles: {
        0: { cellWidth: 7, halign: 'center', textColor: MUTED },
        2: { cellWidth: 13, halign: 'center' },
        3: { cellWidth: 13, halign: 'center' },
        4: { cellWidth: 13, halign: 'center' },
        5: { cellWidth: 42, textColor: MUTED, fontSize: 6.5 },
      },
      didParseCell: (hook) => {
        if (hook.section === 'body' && hook.row.index === body.length - 1) {
          hook.cell.styles.fontStyle = 'bold';
          hook.cell.styles.fillColor = [250, 248, 245];
          if (hook.column.index >= 2 && hook.column.index <= 4) hook.cell.styles.textColor = TEAL;
        }
      },
      didDrawCell: (hook) => {
        if (hook.section !== 'body' || hook.row.index === body.length - 1) return;
        const roundIdx = hook.column.index - 2;
        if (roundIdx < 0 || roundIdx >= record.rounds.length) return;
        const item = dom.items[hook.row.index];
        if (item && itemMark(record.rounds[roundIdx], item.id) === '✔') drawTick(doc, hook.cell);
      },
    });
  }

  // ---- Summary of scores ----
  y = sectionTitle(doc, 'Summary of Scores', finalY(doc) + 8);
  autoTable(doc, {
    ...tableBase,
    startY: y,
    head: [
      [
        { content: 'Domain', rowSpan: 2 },
        ...record.rounds.map((round) => {
          const age = round.testedOn ? computeAgeYMD(pupil.birthDate, round.testedOn) : null;
          return {
            content: `${ROUND_ORDINAL[round.round]} Evaluation${round.graded ? `\n${formatFormDate(round.testedOn)} • ${formatAge(age)}` : ''}`,
            colSpan: 2,
            styles: { halign: 'center' as const },
          };
        }),
      ],
      record.rounds.flatMap(() => ['Raw', 'Scaled']),
    ],
    body: [
      ...ECCD_DOMAINS.map((dom) => [
        dom.shortLabel,
        ...record.rounds.flatMap((round) => [
          round.graded ? String(rawScore(round, dom.id)) : '',
          round.graded ? String(round.scaled[dom.id] ?? '—') : '',
        ]),
      ]),
      ['Sum of Scaled Scores', ...record.rounds.map((round) => ({
        content: round.graded ? String(sumOfScaledScores(round) ?? '—') : '', colSpan: 2,
      }))],
      ['Standard Score', ...record.rounds.map((round) => ({
        content: round.standardScore != null ? String(round.standardScore) : '', colSpan: 2,
      }))],
      ['Interpretation', ...record.rounds.map((round) => ({
        content: interpretStandardScore(round.standardScore), colSpan: 2,
      }))],
    ],
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 40 } },
    didParseCell: (hook) => {
      if (hook.section === 'body' && hook.column.index > 0) hook.cell.styles.halign = 'center';
    },
  });

  // ---- Examiner's notes ----
  const latest = latestGradedRound(record);
  y = sectionTitle(doc, "Examiner's Notes", finalY(doc) + 8);
  const backgroundRows = BACKGROUND_FIELDS
    .map((f) => [f.heading, record.background?.[f.key]?.trim() || ''])
    .filter((r) => r[1]);
  autoTable(doc, {
    ...tableBase,
    startY: y,
    body: [
      ['Name of examiner', latest?.examinerName || ''],
      ['Date administered', formatFormDate(latest?.testedOn)],
      ['Place', record.centerName],
      ...(backgroundRows.length ? backgroundRows : [['Background', 'No background information recorded.']]),
    ],
    columnStyles: { 0: { cellWidth: 45, fontStyle: 'bold', textColor: TEAL } },
  });

  // ---- Footer ----
  const pages = doc.getNumberOfPages();
  const height = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`${record.centerName} — ECCD Child's Record 2 — ${pupil.lastName}, ${pupil.firstName} (${pupil.id})`, MARGIN, height - 7);
    doc.text(`Page ${i} of ${pages}`, width - MARGIN, height - 7, { align: 'right' });
  }
}

/** Builds and saves the PDF in the browser. */
export async function downloadEccdPdf(record: EccdRecord): Promise<void> {
  const { default: JsPDF } = await import('jspdf');
  const { autoTable } = await import('jspdf-autotable');
  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  buildEccdPdf(doc, autoTable, record);
  doc.save(eccdPdfFileName(record));
}
