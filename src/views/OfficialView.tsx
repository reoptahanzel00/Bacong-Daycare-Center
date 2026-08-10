'use client';

import React from 'react';
import { 
  Users, 
  CheckCircle2, 
  FileText, 
  BarChart3, 
  PieChart, 
  Award,
  Download
} from 'lucide-react';

interface OfficialViewProps {
  pupils: any[];
  attendance: any[];
  progress: any[];
  onOpenDSWDReportModal: () => void;
}

export default function OfficialView({ pupils, attendance, progress, onOpenDSWDReportModal }: OfficialViewProps) {
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

  return (
    <div className="space-y-6" suppressHydrationWarning>
      
      {/* Executive Hero Banner */}
      <div className="card bg-gradient-to-br from-[#1E3A8A] via-[#1D605D] to-[#2F8F8A] text-white p-6 rounded-3xl shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white m-0 tracking-tight">
              Barangay Executive Oversight Hub 🏛️
            </h1>
            <p className="text-xs md:text-sm text-white/90 mt-1.5 leading-relaxed max-w-2xl m-0">
              Official portal for monitoring daycare center operations, demographic ratios, daily attendance rates, and generating DSWD-compliant summary reports.
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
        
        {/* Sex Demographic Ratio */}
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

        {/* Attendance Status Ratio */}
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

    </div>
  );
}
