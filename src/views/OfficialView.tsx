'use client';

import React, { useState } from 'react';
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
  Shield,
  Utensils,
  CheckCircle,
  PhoneCall,
} from 'lucide-react';
import { useDaycare, type MockPupil, type MockAttendance, type MockProgress, type MockAnnouncement } from '@/contexts/DaycareContext';

interface OfficialViewProps {
  pupils: MockPupil[];
  attendance: MockAttendance[];
  progress: MockProgress[];
  announcements?: MockAnnouncement[];
  activeTab?: string;
  onOpenDSWDReportModal: () => void;
}

export default function OfficialView({ 
  pupils, 
  attendance, 
  progress, 
  announcements = [], 
  activeTab = 'overview', 
  onOpenDSWDReportModal 
}: OfficialViewProps) {
  const { showToast, logAuditAction } = useDaycare();

  // State for dispatched outreach actions
  const [dispatchedOutreach, setDispatchedOutreach] = useState<Record<string, boolean>>({});

  const enrolledPupils = pupils.filter(p => p.enrollmentStatus === 'enrolled');
  const archivedPupils = pupils.filter(p => p.enrollmentStatus === 'archived');
  const maleCount = enrolledPupils.filter(p => p.sex === 'Male').length;
  const femaleCount = enrolledPupils.filter(p => p.sex === 'Female').length;

  const totalAttRecords = attendance.length;
  const presentCount = attendance.filter(a => a.status === 'present').length;
  const lateCount = attendance.filter(a => a.status === 'late').length;
  const absentCount = attendance.filter(a => a.status === 'absent').length;

  const attendanceRate = totalAttRecords 
    ? Math.round(((presentCount + lateCount) / totalAttRecords) * 100) 
    : 100;

  // Pupils with consecutive absences
  const highRiskPupils = enrolledPupils.filter(p => (p.consecutiveAbsences || 0) >= 2 || p.id === 'PUP-2026-003');

  const handleDispatchOutreach = (pupilId: string, pupilName: string) => {
    setDispatchedOutreach(prev => ({ ...prev, [pupilId]: true }));
    showToast(`Barangay Health Worker outreach dispatched for ${pupilName}!`, 'success');
    logAuditAction('Dispatched Health Worker Outreach', pupilId, `Assigned barangay health worker to visit ${pupilName}'s household.`);
  };

  return (
    <div className="space-y-6" suppressHydrationWarning>
      
      {/* Executive Hero Banner */}
      <div className="card bg-gradient-to-br from-[#1E3A8A] via-[#1D605D] to-[#2F8F8A] text-white p-6 rounded-3xl shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={18} className="text-[#F5B942]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#F5B942]">
                Barangay Bacong Council Oversight
              </span>
            </div>
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
            <div className="card flex items-center gap-3.5 p-4 bg-white border border-[#E6E4DF]">
              <div className="w-12 h-12 rounded-2xl bg-[#EBF5F4] text-[#2F8F8A] flex items-center justify-center shrink-0">
                <Users size={22} />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-[#2B2B2B] leading-none">{enrolledPupils.length}</div>
                <div className="text-xs text-[#6B6B6B] mt-1">Enrolled ({archivedPupils.length} Archived)</div>
              </div>
            </div>

            <div className="card flex items-center gap-3.5 p-4 bg-white border border-[#E6E4DF]">
              <div className="w-12 h-12 rounded-2xl bg-[#EBF8FF] text-[#2B6CB0] flex items-center justify-center shrink-0">
                <CheckCircle2 size={22} />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-[#2B6CB0] leading-none">{attendanceRate}%</div>
                <div className="text-xs text-[#6B6B6B] mt-1">Average Attendance Rate</div>
              </div>
            </div>

            <div className="card flex items-center gap-3.5 p-4 bg-white border border-[#E6E4DF]">
              <div className="w-12 h-12 rounded-2xl bg-[#FEF8EC] text-[#8A5D00] flex items-center justify-center shrink-0">
                <PieChart size={22} />
              </div>
              <div>
                <div className="text-xl font-extrabold text-[#8A5D00] leading-none">{maleCount} M / {femaleCount} F</div>
                <div className="text-xs text-[#6B6B6B] mt-1">Sex Demographic Ratio</div>
              </div>
            </div>

            <div className="card flex items-center gap-3.5 p-4 bg-white border border-[#E6E4DF]">
              <div className="w-12 h-12 rounded-2xl bg-[#FFEBEE] text-[#D32F2F] flex items-center justify-center shrink-0">
                <Award size={22} />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-[#D32F2F] leading-none">{progress.length}</div>
                <div className="text-xs text-[#6B6B6B] mt-1">Milestones Evaluated</div>
              </div>
            </div>
          </div>

          {/* Demographic Breakdown & Attendance Ratio Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            <div className="card bg-white p-5">
              <div className="flex items-center gap-2 mb-4 text-[#2F8F8A]">
                <PieChart size={20} />
                <h3 className="text-sm font-bold text-[#2B2B2B] m-0">Pupil Sex Demographic Ratio</h3>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold text-[#4A4A4A] mb-1.5">
                    <span>Male Pupils ({maleCount})</span>
                    <span>{enrolledPupils.length ? Math.round((maleCount / enrolledPupils.length) * 100) : 0}%</span>
                  </div>
                  <div className="w-full h-3 bg-[#EAE6DF] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#3B82F6] rounded-full transition-all duration-500"
                      style={{ width: `${enrolledPupils.length ? (maleCount / enrolledPupils.length) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs font-bold text-[#4A4A4A] mb-1.5">
                    <span>Female Pupils ({femaleCount})</span>
                    <span>{enrolledPupils.length ? Math.round((femaleCount / enrolledPupils.length) * 100) : 0}%</span>
                  </div>
                  <div className="w-full h-3 bg-[#EAE6DF] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#EC4899] rounded-full transition-all duration-500"
                      style={{ width: `${enrolledPupils.length ? (femaleCount / enrolledPupils.length) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card bg-white p-5">
              <div className="flex items-center gap-2 mb-4 text-[#2F8F8A]">
                <BarChart3 size={20} />
                <h3 className="text-sm font-bold text-[#2B2B2B] m-0">Attendance Status Ratio</h3>
              </div>

              <div className="space-y-3.5 text-xs">
                <div className="flex items-center gap-3">
                  <span className="w-16 font-bold text-[#2F8F8A]">Present</span>
                  <div className="flex-1 h-3 bg-[#EAE6DF] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#2F8F8A] rounded-full transition-all duration-500"
                      style={{ width: `${totalAttRecords ? (presentCount / totalAttRecords) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="font-extrabold text-[#2B2B2B] w-8 text-right">{presentCount}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-16 font-bold text-[#8A5D00]">Late</span>
                  <div className="flex-1 h-3 bg-[#EAE6DF] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#F5B942] rounded-full transition-all duration-500"
                      style={{ width: `${totalAttRecords ? (lateCount / totalAttRecords) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="font-extrabold text-[#2B2B2B] w-8 text-right">{lateCount}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-16 font-bold text-[#D32F2F]">Absent</span>
                  <div className="flex-1 h-3 bg-[#EAE6DF] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#F2896B] rounded-full transition-all duration-500"
                      style={{ width: `${totalAttRecords ? (absentCount / totalAttRecords) * 100 : 0}%` }}
                    ></div>
                  </div>
                  <span className="font-extrabold text-[#2B2B2B] w-8 text-right">{absentCount}</span>
                </div>
              </div>
            </div>

          </div>

          {/* Enrolled Student Registry Table */}
          <div className="card bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-[#2B2B2B] m-0">Enrolled Student Registry Summary</h3>
                <span className="text-xs text-[#6B6B6B]">Read-only aggregate view for barangay council oversight</span>
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
                    <th>Barangay Address</th>
                    <th>Guardian Contact</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrolledPupils.map(p => (
                    <tr key={p.id}>
                      <td className="font-bold text-[#2B2B2B]">{p.firstName} {p.lastName}</td>
                      <td>{p.sex}</td>
                      <td>{p.birthDate}</td>
                      <td>{p.address}</td>
                      <td>{p.guardian?.fullName} ({p.guardian?.phone})</td>
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
                <FileText size={18} className="text-[#2F8F8A]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#2F8F8A]">
                  Department of Social Welfare & Development
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#2B2B2B] m-0">
                Official DSWD Form 1 ECCD Report Center
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1 m-0">
                Generate and export official quarterly summary reports for DSWD Field Office VII submission.
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
            <div className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-1">
              <span className="text-xs font-bold text-[#6B6B6B] uppercase">Total Enrolled Pupils</span>
              <div className="text-2xl font-extrabold text-[#2F8F8A]">{enrolledPupils.length} Children</div>
              <span className="text-[10px] text-[#9B9B9B]">Room A & Room B Daycare Center</span>
            </div>

            <div className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-1">
              <span className="text-xs font-bold text-[#6B6B6B] uppercase">Council Resolution</span>
              <div className="text-sm font-extrabold text-emerald-700">Resolution No. 2026-04 Approved</div>
              <span className="text-[10px] text-[#9B9B9B]">Barangay Bacong Council Session</span>
            </div>

            <div className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-1">
              <span className="text-xs font-bold text-[#6B6B6B] uppercase">Compliance Status</span>
              <div className="text-sm font-extrabold text-[#2B6CB0]">DSWD Region 7 Compliant ✅</div>
              <span className="text-[10px] text-[#9B9B9B]">7-Domain Checklist Complete</span>
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
                <BellRing size={18} className="text-[#D32F2F]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#D32F2F]">
                  Early Intervention Telemetry
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#2B2B2B] m-0">
                Consecutive Absences Telemetry & Risk Alerts
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1 m-0">
                Pupils accumulating 2 or more consecutive absences requiring barangay social worker outreach.
              </p>
            </div>
            <span className="badge badge-danger font-bold">{highRiskPupils.length} Alerts Active</span>
          </div>

          <div className="space-y-3">
            {highRiskPupils.map((p) => (
              <div key={p.id} className="p-4 rounded-3xl border border-[#FFCDD2] bg-[#FFEBEE] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={22} className="text-[#D32F2F] shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-[#2B2B2B] text-sm">{p.firstName} {p.lastName} ({p.id})</div>
                    <p className="text-[#4A4A4A] m-0 mt-0.5">
                      Guardian: <strong>{p.guardian?.fullName}</strong> ({p.guardian?.phone}) • Address: <strong>{p.address}</strong>
                    </p>
                    <span className="badge badge-danger text-[10px] mt-1">
                      {p.consecutiveAbsences || 2} Consecutive Unexcused Absences
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {dispatchedOutreach[p.id] ? (
                    <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center gap-1">
                      <CheckCircle size={14} /> BHW Outreach Dispatched
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDispatchOutreach(p.id, `${p.firstName} ${p.lastName}`)}
                      className="btn btn-sm bg-[#D32F2F] text-white hover:bg-[#B71C1C] font-bold shadow-md"
                      suppressHydrationWarning
                    >
                      <PhoneCall size={14} />
                      <span>Dispatch Health Worker Visit</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Supplemental Feeding Program & Announcements */}
      {(activeTab === 'announcements' || activeTab === 'feeding_program') && (
        <div className="card bg-white p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Utensils size={18} className="text-[#2F8F8A]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#2F8F8A]">
                  Barangay Daycare Supplemental Feeding Program
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#2B2B2B] m-0">
                Nutritional Feeding Allocation & Council Notices
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1 m-0">
                Monitoring 120-day DSWD supplemental feeding menu allocations and council daycare announcements.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-1">
              <span className="font-bold text-[#2F8F8A]">Monday / Wednesday Menu</span>
              <div className="font-extrabold text-[#2B2B2B]">Pork & Malunggay Monggo Soup</div>
              <span className="text-[10px] text-[#9B9B9B]">Rich in iron & vitamins A/C</span>
            </div>

            <div className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-1">
              <span className="font-bold text-[#2B6CB0]">Tuesday / Thursday Menu</span>
              <div className="font-extrabold text-[#2B2B2B]">Chicken Lugaw with Hard-Boiled Egg</div>
              <span className="text-[10px] text-[#9B9B9B]">High protein growth support</span>
            </div>

            <div className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-1">
              <span className="font-bold text-[#8A5D00]">Friday Menu</span>
              <div className="font-extrabold text-[#2B2B2B]">Champorado with Fortified Milk</div>
              <span className="text-[10px] text-[#9B9B9B]">Calcium & energy boost</span>
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-[#E6E4DF]">
            <h4 className="text-sm font-bold text-[#2B2B2B] m-0">Barangay Council Daycare Notices Feed</h4>
            {announcements.map((notice) => (
              <div key={notice.id} className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#2F8F8A]">{notice.title}</span>
                  <span className="text-[11px] text-[#9B9B9B]">{notice.date}</span>
                </div>
                <p className="text-xs text-[#4A4A4A] m-0">{notice.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
