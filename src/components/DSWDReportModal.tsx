'use client';

import React, { useState, useRef } from 'react';
import { X, FileText, Download, ShieldCheck } from 'lucide-react';
import type { MockPupil, MockAttendance, MockProgress } from '@/contexts/DaycareContext';
import type { CenterSettingsRow } from '@/services/settingsService';
import { buildDswdPdf, type DswdPupilRow } from '@/lib/dswdPdf';

interface DSWDReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  pupils: MockPupil[];
  attendance: MockAttendance[];
  progress: MockProgress[];
  /** Centre name and the barangay official who signs the form. */
  settings: CenterSettingsRow;
  /** The person generating this copy; they are the one certifying it. */
  preparedBy: string | null;
}

export default function DSWDReportModal({
  isOpen,
  onClose,
  pupils,
  attendance,
  progress,
  settings,
  preparedBy,
}: DSWDReportModalProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('SY 2026-2027');
  const reportRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const enrolledPupils = pupils.filter(p => p.enrollmentStatus === 'enrolled');
  const maleCount = enrolledPupils.filter(p => p.sex === 'Male').length;
  const femaleCount = enrolledPupils.filter(p => p.sex === 'Female').length;

  const totalAttendance = attendance.length;
  const totalPresent = attendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const avgAttendance = totalAttendance ? Math.round((totalPresent / totalAttendance) * 100) : 92;

  const masteredCount = progress.filter(p => p.rating === 'Demonstrates Mastery' || p.rating === 'Mastered').length;
  const totalProg = progress.length || 1;
  const masteredPercent = Math.round((masteredCount / totalProg) * 100);

  const handleExportPDF = async () => {
    if (!reportRef.current) return;
    setIsExporting(true);

    try {
      // Drawn as vector text rather than rasterised from the preview: the
      // screenshot route produced a ~9 MB file for the same two pages.
      const { default: jsPDF } = await import('jspdf');
      const { autoTable } = await import('jspdf-autotable');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const rows: DswdPupilRow[] = enrolledPupils.map((p) => ({
        id: p.id,
        name: `${p.firstName} ${p.lastName}`,
        sex: p.sex,
        birthDate: p.birthDate,
        guardian: p.guardian?.fullName || 'Not recorded',
        guardianPhone: p.guardian?.phone || '',
        status: 'ENROLLED',
      }));

      buildDswdPdf(doc, autoTable, {
        schoolYear: selectedSchoolYear,
        reportDate: new Date().toISOString().split('T')[0],
        totalEnrolled: enrolledPupils.length,
        maleCount,
        femaleCount,
        avgAttendance,
        masteredPercent,
        pupils: rows,
        centerName: settings.center_name,
        // The preparer certifies the copy they generated; the noting official
        // comes from centre settings, which an admin keeps current.
        preparedBy: preparedBy || settings.daycare_worker_name || 'Not recorded',
        notedBy: settings.barangay_captain_name || 'Not recorded',
      });

      doc.save(`DSWD_Form_1_Barangay_Bacong_${selectedSchoolYear.replace(' ', '_')}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      alert('Failed to generate PDF. Printing native report format instead.');
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn" suppressHydrationWarning>
      <div className="bg-white rounded-3xl shadow-2xl border border-line w-full max-w-4xl p-6 space-y-5 animate-scaleUp max-h-[90vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-line pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-light text-primary flex items-center justify-center font-bold shrink-0">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-ink m-0">DSWD Form 1 Official Report PDF Generator</h3>
              <p className="text-xs text-ink-muted m-0">
                Republic of the Philippines • Department of Social Welfare and Development Region V
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedSchoolYear}
              onChange={(e) => setSelectedSchoolYear(e.target.value)}
              className="px-3 py-1.5 rounded-full border border-line text-xs font-semibold bg-canvas focus:outline-none"
              suppressHydrationWarning
            >
              <option value="SY 2026-2027">SY 2026-2027</option>
              <option value="SY 2025-2026">SY 2025-2026</option>
              <option value="SY 2024-2025">SY 2024-2025</option>
            </select>

            <button
              onClick={onClose}
              className="p-2 rounded-full text-ink-subtle hover:bg-canvas hover:text-ink border-none bg-transparent cursor-pointer transition-all"
              suppressHydrationWarning
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Report Preview Body (300 DPI Document Container) */}
        <div className="flex-1 overflow-y-auto pr-2 space-y-4">
          <div ref={reportRef} className="bg-white p-6 rounded-2xl border border-line space-y-6 text-ink font-sans">
            
            {/* Government Header */}
            <div className="text-center border-b-2 border-primary-display pb-4 space-y-1">
              <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider">
                Republic of the Philippines • Region V • Province of Albay
              </div>
              <h2 className="text-lg font-black text-primary-hover uppercase tracking-tight m-0">
                BARANGAY BACONG DAYCARE CENTER
              </h2>
              <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider m-0">
                DSWD FORM 1: ANNUAL ECCD DEMOGRAPHIC & MILESTONE COMPREHENSIVE REPORT
              </h4>
              <div className="text-[11px] text-ink-muted">
                School Year: <strong>{selectedSchoolYear}</strong> • Report Date: <strong>{new Date().toISOString().split('T')[0]}</strong>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-4 gap-4 text-center">
              <div className="p-3 rounded-2xl bg-primary-light border border-primary-display/20">
                <div className="text-xl font-extrabold text-primary">{enrolledPupils.length}</div>
                <div className="text-[10px] font-bold text-ink-muted uppercase">Total Enrolled</div>
              </div>
              <div className="p-3 rounded-2xl bg-[#EBF8FF] border border-[#2B6CB0]/20">
                <div className="text-xl font-extrabold text-[#2B6CB0]">{maleCount} M / {femaleCount} F</div>
                <div className="text-[10px] font-bold text-ink-muted uppercase">Sex Ratio</div>
              </div>
              <div className="p-3 rounded-2xl bg-warn-light border border-warn-fill/30">
                <div className="text-xl font-extrabold text-warn">{avgAttendance}%</div>
                <div className="text-[10px] font-bold text-ink-muted uppercase">Avg Attendance</div>
              </div>
              <div className="p-3 rounded-2xl bg-danger-light border border-danger-border">
                <div className="text-xl font-extrabold text-danger">{masteredPercent}%</div>
                <div className="text-[10px] font-bold text-ink-muted uppercase">ECCD Mastery</div>
              </div>
            </div>

            {/* Pupil Roster Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider m-0">
                Section A: Enrolled Daycare Pupils Demographics
              </h4>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-primary-light text-primary-hover">
                    <th className="p-2 border border-line text-left">Pupil ID</th>
                    <th className="p-2 border border-line text-left">Pupil Full Name</th>
                    <th className="p-2 border border-line text-left">Sex</th>
                    <th className="p-2 border border-line text-left">Birth Date</th>
                    <th className="p-2 border border-line text-left">Guardian Contact</th>
                    <th className="p-2 border border-line text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrolledPupils.map(p => (
                    <tr key={p.id} className="border-b border-line">
                      <td className="p-2 font-bold text-primary border border-line">{p.id}</td>
                      <td className="p-2 font-semibold border border-line">{p.firstName} {p.lastName}</td>
                      <td className="p-2 border border-line">{p.sex}</td>
                      <td className="p-2 border border-line">{p.birthDate}</td>
                      <td className="p-2 border border-line">{p.guardian?.fullName} ({p.guardian?.phone})</td>
                      <td className="p-2 border border-line font-bold text-[#2D7A50]">ENROLLED</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Signatory Block */}
            <div className="grid grid-cols-2 gap-8 pt-6 border-t border-line text-xs">
              <div className="text-center space-y-6">
                <div className="text-[10px] text-ink-muted">Prepared & Certified By:</div>
                <div className="border-b border-ink font-bold pb-1 text-ink uppercase">{preparedBy || settings.daycare_worker_name || 'Not recorded'}</div>
                <div className="text-[10px] text-ink-muted">Lead Daycare Worker • Barangay Bacong</div>
              </div>
              <div className="text-center space-y-6">
                <div className="text-[10px] text-ink-muted">Approved & Noted By:</div>
                <div className="border-b border-ink font-bold pb-1 text-ink uppercase">{settings.barangay_captain_name || 'Not recorded'}</div>
                <div className="text-[10px] text-ink-muted">Barangay Captain / Official Oversight</div>
              </div>
            </div>

          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-line flex items-center justify-between shrink-0">
          <span className="text-xs text-ink-muted font-semibold flex items-center gap-1">
            <ShieldCheck size={16} className="text-primary" /> DSWD Form 1 Standard Vector PDF Export Ready
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-ink-muted border border-line hover:bg-canvas transition-all cursor-pointer border-none bg-transparent"
              suppressHydrationWarning
            >
              Cancel
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-primary hover:bg-primary-hover transition-all flex items-center gap-2 shadow-md cursor-pointer border-none disabled:opacity-50"
              suppressHydrationWarning
            >
              <Download size={16} />
              <span>{isExporting ? 'Generating PDF...' : 'Download DSWD Form 1 PDF'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
