'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  CheckCircle2, 
  FileText, 
  BarChart3, 
  PieChart, 
  Award,
  Download,
  AlertTriangle,
  BellRing,
} from 'lucide-react';
import { type MockPupil, type MockAttendance, type MockProgress } from '@/contexts/DaycareContext';

interface OfficialViewProps {
  pupils: MockPupil[];
  attendance: MockAttendance[];
  progress: MockProgress[];
  activeTab?: string;
  onOpenDSWDReportModal: () => void;
}

export default function OfficialView({ 
  pupils, 
  attendance, 
  progress, 
  activeTab = 'overview', 
  onOpenDSWDReportModal 
}: OfficialViewProps) {
  // Aggregate milestone count (officials cannot read individual notes; the
  // oversight stat is sourced from the aggregate endpoint instead).
  const [milestoneCount, setMilestoneCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadMilestoneStats() {
      try {
        const res = await fetch('/api/progress/stats', { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled && typeof data.total === 'number') setMilestoneCount(data.total);
      } catch {
        // Ignore â€” fall back to the client-provided progress length.
      }
    }
    loadMilestoneStats();
    return () => { cancelled = true; };
  }, []);

  const { enrolledPupils, archivedPupils, maleCount, femaleCount } = useMemo(() => {
    const enrolled = pupils.filter(p => p.enrollmentStatus === 'enrolled');
    return {
      enrolledPupils: enrolled,
      archivedPupils: pupils.filter(p => p.enrollmentStatus === 'archived'),
      maleCount: enrolled.filter(p => p.sex === 'Male').length,
      femaleCount: enrolled.filter(p => p.sex === 'Female').length,
    };
  }, [pupils]);

  const { presentCount, lateCount, absentCount, attendanceRate } = useMemo(() => {
    let present = 0, late = 0, absent = 0;
    for (const a of attendance) {
      if (a.status === 'present') present++;
      else if (a.status === 'late') late++;
      else if (a.status === 'absent') absent++;
    }
    return {
      presentCount: present,
      lateCount: late,
      absentCount: absent,
      attendanceRate: attendance.length
        ? Math.round(((present + late) / attendance.length) * 100)
        : null,
    };
  }, [attendance]);

  // Pupils on an active absence streak. The threshold is the only criterion:
  // this previously also pinned a specific demo pupil id into the alert list,
  // which surfaced a fabricated alert against real data.
  const totalAttRecords = attendance.length;

  const highRiskPupils = useMemo(
    () => enrolledPupils.filter(p => (p.consecutiveAbsences || 0) >= 2),
    [enrolledPupils]
  );

  return (
    <div className="space-y-6" suppressHydrationWarning>
      
      {/* Executive Hero Banner */}
      <div className="card bg-gradient-to-br from-[#1E3A8A] via-primary-hover to-primary-display text-white p-6 rounded-3xl shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white m-0 tracking-tight">
              Executive Governance & Telemetry Hub 🏛️
            </h1>
            <p className="text-xs md:text-sm text-white/90 mt-1.5 leading-relaxed max-w-2xl m-0">
              Monitoring daycare center demographic ratios, attendance rates, high-risk telemetry alerts, and generating official DSWD summary reports.
            </p>
          </div>
          <button
            onClick={onOpenDSWDReportModal}
            className="btn btn-warning font-bold shrink-0 shadow-md"
            suppressHydrationWarning
          >
            <FileText size={18} />
            <span>Generate DSWD Report PDF</span>
          </button>
        </div>
      </div>

      {/* TAB 1: Executive Overview Dashboard */}
      {(activeTab === 'overview' || activeTab === 'dashboard') && (
        <>
          {/* Executive Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card flex items-center gap-3.5 p-4 bg-white border border-line">
              <div className="w-12 h-12 rounded-2xl bg-primary-light text-primary flex items-center justify-center shrink-0">
                <Users size={22} />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-ink leading-none">{enrolledPupils.length}</div>
                <div className="text-xs text-ink-muted mt-1">Enrolled ({archivedPupils.length} Archived)</div>
              </div>
            </div>

            <div className="card flex items-center gap-3.5 p-4 bg-white border border-line">
              <div className="w-12 h-12 rounded-2xl bg-[#EBF8FF] text-[#2B6CB0] flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-[#2B6CB0] leading-none">{attendanceRate === null ? '—' : `${attendanceRate}%`}</div>
                <div className="text-xs text-ink-muted mt-1">Average Attendance Rate</div>
              </div>
            </div>

            <div className="card flex items-center gap-3.5 p-4 bg-white border border-line">
              <div className="w-12 h-12 rounded-2xl bg-warn-light text-warn flex items-center justify-center shrink-0">
                <PieChart size={22} />
              </div>
              <div>
                <div className="text-xl font-extrabold text-warn leading-none">{maleCount} M / {femaleCount} F</div>
                <div className="text-xs text-ink-muted mt-1">Sex Demographic Ratio</div>
              </div>
            </div>

            <div className="card flex items-center gap-3.5 p-4 bg-white border border-line">
              <div className="w-12 h-12 rounded-2xl bg-danger-light text-danger flex items-center justify-center shrink-0">
                <Award size={22} />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-danger leading-none">
                  {milestoneCount ?? progress.length}
                </div>
                <div className="text-xs text-ink-muted mt-1">Milestones Evaluated</div>
              </div>
            </div>
          </div>

          {/* Demographic Breakdown & Attendance Ratio Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="card bg-white p-5">
              <div className="flex items-center gap-2 mb-4 text-primary">
                <PieChart size={20} />
                <h3 className="text-sm font-bold text-ink m-0">Pupil Sex Demographic Ratio</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold text-ink-soft mb-1.5">
                    <span>Male Pupils ({maleCount})</span>
                    <span>{enrolledPupils.length ? Math.round((maleCount / enrolledPupils.length) * 100) : 0}%</span>
                  </div>
                  <div className="w-full h-3 bg-line-strong rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#3B82F6] rounded-full transition-all duration-500"
                      style={{ width: `${enrolledPupils.length ? (maleCount / enrolledPupils.length) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-ink-soft mb-1.5">
                    <span>Female Pupils ({femaleCount})</span>
                    <span>{enrolledPupils.length ? Math.round((femaleCount / enrolledPupils.length) * 100) : 0}%</span>
                  </div>
                  <div className="w-full h-3 bg-line-strong rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#EC4899] rounded-full transition-all duration-500"
                      style={{ width: `${enrolledPupils.length ? (femaleCount / enrolledPupils.length) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-white p-5">
              <div className="flex items-center gap-2 mb-4 text-primary">
                <BarChart3 size={20} />
                <h3 className="text-sm font-bold text-ink m-0">Attendance Status Ratio</h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-16 font-bold text-primary">Present</span>
                  <div className="flex-1 h-3 bg-line-strong rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${totalAttRecords ? (presentCount / totalAttRecords) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="font-extrabold text-ink w-8 text-right">{presentCount}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-16 font-bold text-warn">Late</span>
                  <div className="flex-1 h-3 bg-line-strong rounded-full overflow-hidden">
                    <div
                      className="h-full bg-warn-fill rounded-full transition-all duration-500"
                      style={{ width: `${totalAttRecords ? (lateCount / totalAttRecords) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="font-extrabold text-ink w-8 text-right">{lateCount}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-16 font-bold text-danger">Absent</span>
                  <div className="flex-1 h-3 bg-line-strong rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent-coral-strong rounded-full transition-all duration-500"
                      style={{ width: `${totalAttRecords ? (absentCount / totalAttRecords) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="font-extrabold text-ink w-8 text-right">{absentCount}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Enrolled Student Registry Table */}
          <div className="card bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-ink m-0">Enrolled Student Registry Summary</h3>
                <span className="text-xs text-ink-muted">Read-only aggregate view for barangay council oversight</span>
              </div>
              <button onClick={onOpenDSWDReportModal} className="btn btn-secondary btn-sm" suppressHydrationWarning>
                <FileText size={16} />
                <span>Official DSWD PDF</span>
              </button>
            </div>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Pupil Name</th>
                    <th>Sex</th>
                    <th>Birth Date</th>
                    <th>Guardian</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrolledPupils.map(p => (
                    <tr key={p.id}>
                      <td className="font-bold text-ink">{p.firstName} {p.lastName}</td>
                      <td>{p.sex}</td>
                      <td>{p.birthDate}</td>
                      <td>{p.guardian?.fullName}</td>
                      <td><span className="badge badge-success">Enrolled</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* TAB 2: DSWD Form 1 PDF Generation Center */}
      {activeTab === 'reports' && (
        <div className="card bg-white p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FileText size={18} className="text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Department of Social Welfare & Development
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-ink m-0">
                Official DSWD Form 1 ECCD Report Center
              </h3>
              <p className="text-xs text-ink-muted mt-1 m-0">
                Generate and export the DSWD Form 1 summary report for submission to the DSWD Field Office III.
              </p>
            </div>
            <button
              onClick={onOpenDSWDReportModal}
              className="btn btn-primary font-bold shadow-md"
              suppressHydrationWarning
            >
              <Download size={18} />
              <span>Generate DSWD PDF Report</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-3xl border border-line bg-canvas space-y-1">
              <span className="text-xs font-bold text-ink-muted uppercase">Total Enrolled Pupils</span>
              <div className="text-2xl font-extrabold text-primary">{enrolledPupils.length} Children</div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Absence Telemetry & High-Risk Alert Tracker */}
      {activeTab === 'consecutive_absences' && (
        <div className="card bg-white p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BellRing size={18} className="text-danger" />
                <span className="text-xs font-bold uppercase tracking-wider text-danger">
                  Early Intervention Telemetry
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-ink m-0">
                Consecutive Absences Telemetry & Risk Alerts
              </h3>
              <p className="text-xs text-ink-muted mt-1 m-0">
                Pupils accumulating 2 or more consecutive absences requiring barangay social worker outreach.
              </p>
            </div>
            <span className="badge badge-danger font-bold">{highRiskPupils.length} Alerts Active</span>
          </div>

          <div className="space-y-3">
            {highRiskPupils.map((p) => (
              <div key={p.id} className="p-4 rounded-3xl border border-danger-border bg-danger-light flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={22} className="text-danger shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-ink text-sm">{p.firstName} {p.lastName} ({p.id})</div>
                    <p className="text-ink-soft m-0 mt-0.5">
                      Guardian: <strong>{p.guardian?.fullName}</strong> • Follow-up is handled by the Daycare Worker.
                    </p>
                    <span className="badge badge-danger text-[10px] mt-1">
                      {p.consecutiveAbsences || 2} Consecutive Unexcused Absences
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
