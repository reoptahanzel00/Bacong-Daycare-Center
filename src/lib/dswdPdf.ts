import type { jsPDF } from 'jspdf';

/**
 * DSWD Form 1 as a vector PDF.
 *
 * This report used to be produced by rasterising the on-screen preview through
 * html2canvas at scale 2, which turned a two-page form into a ~9 MB image —
 * against ~270 KB for the ECCD record, which is drawn with the same table
 * engine used here. On a barangay connection that difference is the whole
 * point: the file is emailed and archived, not just downloaded once.
 *
 * Drawing it also makes the text selectable and searchable in the archive copy,
 * which a screenshot never is.
 */

type AutoTableFn = typeof import('jspdf-autotable').autoTable;

const MARGIN = 14;
const TEAL: [number, number, number] = [36, 117, 113];
const INK: [number, number, number] = [43, 43, 43];
const MUTED: [number, number, number] = [107, 107, 107];

export interface DswdPupilRow {
  id: string;
  name: string;
  sex: string;
  birthDate: string;
  guardian: string;
  guardianPhone: string;
  status: string;
}

export interface DswdReportData {
  centerName: string;
  schoolYear: string;
  reportDate: string;
  totalEnrolled: number;
  maleCount: number;
  femaleCount: number;
  avgAttendance: number;
  masteredPercent: number;
  pupils: DswdPupilRow[];
  preparedBy: string;
  notedBy: string;
}

function finalY(doc: jsPDF): number {
  const last = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable;
  return last?.finalY ?? 0;
}

function drawHeader(doc: jsPDF, data: DswdReportData) {
  const centre = doc.internal.pageSize.getWidth() / 2;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('REPUBLIC OF THE PHILIPPINES • REGION V • PROVINCE OF ALBAY', centre, 16, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(data.centerName.toUpperCase(), centre, 23, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.text('DSWD FORM 1: ANNUAL ECCD DEMOGRAPHIC & MILESTONE COMPREHENSIVE REPORT', centre, 29, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text(`School Year: ${data.schoolYear}   •   Report Date: ${data.reportDate}`, centre, 34, { align: 'center' });

  doc.setDrawColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.setLineWidth(0.6);
  doc.line(MARGIN, 37, doc.internal.pageSize.getWidth() - MARGIN, 37);
}

function drawFooter(doc: jsPDF, data: DswdReportData) {
  const pages = doc.getNumberOfPages();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    doc.text(`${data.centerName} — DSWD Form 1`, MARGIN, height - 8);
    doc.text(`Page ${i} of ${pages}`, width - MARGIN, height - 8, { align: 'right' });
  }
}

/** Renders the whole report into `doc`. */
export function buildDswdPdf(doc: jsPDF, autoTable: AutoTableFn, data: DswdReportData) {
  drawHeader(doc, data);

  // Summary figures, drawn as a table so the columns align on any page size.
  autoTable(doc, {
    startY: 43,
    margin: { left: MARGIN, right: MARGIN, top: 43, bottom: 18 },
    head: [['Total Enrolled', 'Sex Ratio (M / F)', 'Average Attendance', 'ECCD Mastery']],
    body: [[
      String(data.totalEnrolled),
      `${data.maleCount} M / ${data.femaleCount} F`,
      `${data.avgAttendance}%`,
      `${data.masteredPercent}%`,
    ]],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 3, halign: 'center', textColor: INK,
              lineColor: [214, 214, 214], lineWidth: 0.15 },
    headStyles: { fillColor: [235, 245, 244], textColor: TEAL, fontStyle: 'bold', fontSize: 7.5 },
    bodyStyles: { fontStyle: 'bold', fontSize: 12 },
  });

  let y = finalY(doc) + 9;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.text('SECTION A: ENROLLED DAYCARE PUPILS DEMOGRAPHICS', MARGIN, y);
  y += 5;

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN, top: 22, bottom: 18 },
    head: [['Pupil ID', 'Pupil Full Name', 'Sex', 'Birth Date', 'Guardian Contact', 'Status']],
    body: data.pupils.map((p) => [
      p.id, p.name, p.sex, p.birthDate,
      p.guardianPhone ? `${p.guardian} (${p.guardianPhone})` : p.guardian,
      p.status,
    ]),
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 1.8, textColor: INK,
              lineColor: [214, 214, 214], lineWidth: 0.15, valign: 'middle' },
    headStyles: { fillColor: [235, 245, 244], textColor: TEAL, fontStyle: 'bold', fontSize: 7.5 },
    columnStyles: {
      0: { cellWidth: 26, textColor: TEAL, fontStyle: 'bold' },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 22 },
      5: { cellWidth: 22, halign: 'center', fontStyle: 'bold' },
    },
    // Every page of a multi-page roster carries the form's identity, the way
    // the printed DSWD form does.
    didDrawPage: () => drawHeader(doc, data),
  });

  // Signature block, kept on the last page below the roster.
  const height = doc.internal.pageSize.getHeight();
  let sigY = finalY(doc) + 20;
  if (sigY > height - 40) {
    doc.addPage();
    drawHeader(doc, data);
    sigY = 55;
  }

  const width = doc.internal.pageSize.getWidth();
  const colLeft = MARGIN + 12;
  const colRight = width / 2 + 12;
  const lineW = 62;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('Prepared & Certified By:', colLeft, sigY);
  doc.text('Approved & Noted By:', colRight, sigY);

  doc.setDrawColor(INK[0], INK[1], INK[2]);
  doc.setLineWidth(0.4);
  doc.line(colLeft, sigY + 14, colLeft + lineW, sigY + 14);
  doc.line(colRight, sigY + 14, colRight + lineW, sigY + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(INK[0], INK[1], INK[2]);
  doc.text(data.preparedBy.toUpperCase(), colLeft + lineW / 2, sigY + 12, { align: 'center' });
  doc.text(data.notedBy.toUpperCase(), colRight + lineW / 2, sigY + 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  doc.text('Lead Daycare Worker', colLeft + lineW / 2, sigY + 19, { align: 'center' });
  doc.text('Barangay Captain / Official Oversight', colRight + lineW / 2, sigY + 19, { align: 'center' });

  drawFooter(doc, data);
}
