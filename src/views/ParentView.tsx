'use client';

import React, { useState } from 'react';
import { 
  Heart, 
  CalendarCheck, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  PhoneCall, 
  Download, 
  ShieldCheck,
  User,
  MapPin,
  Clock,
  Megaphone,
  Sparkles,
  BookOpen,
  Award
} from 'lucide-react';

interface ParentViewProps {
  pupils: any[];
  attendance: any[];
  progress: any[];
  announcements: any[];
  activeTab?: string;
  onOpenDSWDReportModal?: () => void;
}

export default function ParentView({ 
  pupils, 
  attendance, 
  progress, 
  announcements, 
  activeTab = 'child',
  onOpenDSWDReportModal 
}: ParentViewProps) {
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Record<string, boolean>>({});

  // Scoped to linked child records (Data Privacy Act RA 10173)
  const child = pupils.find(p => p.id === 'PUP-2026-001') || pupils[0];

  const childAttendance = attendance.filter(a => a.pupil_id === child?.id);
  const presentCount = childAttendance.filter(a => a.status === 'present').length;
  const lateCount = childAttendance.filter(a => a.status === 'late').length;
  const absentCount = childAttendance.filter(a => a.status === 'absent').length;
  const total = childAttendance.length;

  const rate = total ? Math.round(((presentCount + lateCount) / total) * 100) : 100;
  const childProgress = progress.filter(p => p.pupil_id === child?.id);

  const handleAcknowledgeAlert = (alertId: string) => {
    setAcknowledgedAlerts(prev => ({ ...prev, [alertId]: true }));
    alert('Thank you! Your absence alert acknowledgment has been registered for Teacher Teresa.');
  };

  const getRatingProgressPercent = (rating: string) => {
    switch (rating) {
      case 'Demonstrates Mastery':
      case 'Mastered':
        return 100;
      case 'Developing':
        return 75;
      case 'Needs Practice':
        return 45;
      default:
        return 60;
    }
  };

  return (
    <div className="space-y-6 pb-12" suppressHydrationWarning>
      
      {/* 1. Daycare Notices Tab View (Active when activeTab is announcements) */}
      {activeTab === 'announcements' && (
        <div className="card bg-white p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#2B2B2B] m-0">Daycare Notices & Broadcast Feed</h3>
              <span className="text-xs text-[#6B6B6B]">Official announcements broadcasted to Barangay Bacong parents</span>
            </div>
            <span className="badge badge-primary">Data Privacy Protected</span>
          </div>

          <div className="space-y-3.5">
            {announcements.map((notice) => (
              <div key={notice.id} className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#2F8F8A] text-sm">{notice.title}</span>
                  <span className="text-[11px] text-[#9B9B9B] font-semibold">{notice.date}</span>
                </div>
                <p className="text-xs text-[#4A4A4A] leading-relaxed m-0">{notice.content}</p>
                <div className="flex items-center justify-between pt-2 border-t border-[#E6E4DF] text-[10px]">
                  <span className="badge badge-warning">Broadcasted to Parent Portal</span>
                  <span className="text-[#9B9B9B]">Author: Lead Daycare Worker</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Child Portal Tab View (Active when activeTab is child, my_children, or default) */}
      {activeTab !== 'announcements' && (
        <>
          {/* Top Child Hero Profile Card */}
          <div className="card bg-gradient-to-br from-[#F2896B] via-[#E87556] to-[#D96B4D] text-white p-6 rounded-3xl shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <img
                  src={child?.avatar || 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=150&q=80'}
                  alt={child?.firstName}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white/40 shadow-md shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Heart size={16} className="text-white" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white/90">
                      Parent Portal • Linked Child Profile
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-white m-0 tracking-tight">
                    {child?.firstName} {child?.lastName}
                  </h2>
                  <p className="text-xs text-white/90 mt-1 m-0">
                    ID: <strong>{child?.id}</strong> • Sex: <strong>{child?.sex}</strong> • DOB: <strong>{child?.birthDate}</strong> (4 yrs old)
                  </p>
                  <p className="text-xs text-white/85 mt-0.5 m-0">
                    Assigned Daycare Class: <strong>Barangay Bacong Daycare Center Room A</strong> • Lead Teacher: <strong>Teacher Teresa Cruz</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {onOpenDSWDReportModal && (
                  <button
                    onClick={onOpenDSWDReportModal}
                    className="btn btn-secondary btn-sm bg-white text-[#D96B4D] font-bold border-none shadow-md"
                    suppressHydrationWarning
                  >
                    <Download size={16} />
                    <span>Download Report Card</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Child Attendance Stat Boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            <div className="card bg-[#EBF5F4] border border-[#2F8F8A]/20 p-4">
              <div className="text-2xl font-extrabold text-[#2F8F8A]">{rate}%</div>
              <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mt-1">Attendance Rate</div>
            </div>
            <div className="card bg-[#EBF8FF] border border-[#2B6CB0]/20 p-4">
              <div className="text-2xl font-extrabold text-[#2B6CB0]">{presentCount}</div>
              <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mt-1">Days Present</div>
            </div>
            <div className="card bg-[#FEF8EC] border border-[#F5B942]/30 p-4">
              <div className="text-2xl font-extrabold text-[#8A5D00]">{lateCount}</div>
              <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mt-1">Days Late</div>
            </div>
            <div className="card bg-[#FFEBEE] border border-[#FFCDD2] p-4">
              <div className="text-2xl font-extrabold text-[#D32F2F]">{absentCount}</div>
              <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mt-1">Days Absent</div>
            </div>
          </div>

          {/* Interactive Consecutive Absence Alert Warning */}
          {absentCount >= 2 && !acknowledgedAlerts['ABS-001'] && (
            <div className="p-4 rounded-3xl bg-[#FFEBEE] border border-[#FFCDD2] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle size={22} className="text-[#D32F2F] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#D32F2F] text-sm">Attendance Advisory Alert</div>
                  <p className="text-[#4A4A4A] m-0 mt-0.5 leading-relaxed">
                    {child?.firstName} has accumulated absences. Automated SMS alert telemetry sent to primary guardian ({child?.guardian?.phone || '0917-888-9900'}).
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleAcknowledgeAlert('ABS-001')}
                className="btn btn-sm text-white bg-[#D32F2F] hover:bg-[#B71C1C] font-bold shrink-0 shadow-sm"
                suppressHydrationWarning
              >
                Acknowledge Alert
              </button>
            </div>
          )}

          {/* Main Grid: 4-Domain Progress & Daily Attendance History */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Col: 4-Domain ECCD Progress Evaluation Bars */}
            <div className="card bg-white p-5 lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#2F8F8A]">
                  <TrendingUp size={20} />
                  <h3 className="text-base font-bold text-[#2B2B2B] m-0">
                    {child?.firstName}'s 4-Domain ECCD Progress Evaluation
                  </h3>
                </div>
                <span className="badge badge-primary">{childProgress.length} Evaluated Domains</span>
              </div>

              <div className="space-y-4">
                {childProgress.map((item) => {
                  const percent = getRatingProgressPercent(item.rating);
                  return (
                    <div key={item.id} className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#2B2B2B] text-sm">{item.domain}</span>
                          <span className="px-2.5 py-0.5 rounded-full font-bold bg-[#EBF5F4] text-[#2F8F8A] text-[10px]">
                            {item.rating}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#9B9B9B] font-semibold">{item.date}</span>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="w-full h-2.5 bg-[#EAE6DF] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#2F8F8A] to-[#1D605D] rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>

                      <p className="text-xs text-[#4A4A4A] leading-relaxed m-0 pt-1">{item.notes}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Col: Teacher Contact & Daily Attendance History Log */}
            <div className="space-y-6">
              
              {/* Teacher Direct Advisory Contact Card */}
              <div className="card bg-white p-5 space-y-3 border border-[#E6E4DF]">
                <div className="flex items-center gap-2 text-[#2F8F8A]">
                  <PhoneCall size={18} />
                  <h4 className="text-sm font-bold text-[#2B2B2B] m-0">Lead Teacher Contact</h4>
                </div>
                <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E6E4DF] text-xs space-y-1.5">
                  <div className="font-bold text-[#2B2B2B]">Teacher Teresa Cruz</div>
                  <div className="text-[#6B6B6B]">Lead Daycare Worker • Barangay Bacong</div>
                  <div className="text-[#2F8F8A] font-semibold flex items-center gap-1">
                    <PhoneCall size={12} /> 0917-000-1122
                  </div>
                </div>
              </div>

              {/* Attendance Log History */}
              <div className="card bg-white p-5 space-y-3 border border-[#E6E4DF]">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-[#2B2B2B] m-0">Recent Attendance Log</h4>
                  <span className="text-[10px] text-[#9B9B9B]">Daily register entries</span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {childAttendance.length > 0 ? (
                    childAttendance.map((a, idx) => (
                      <div key={idx} className="p-2.5 rounded-2xl border border-[#E6E4DF] bg-[#FAF8F5] flex items-center justify-between text-xs">
                        <span className="font-bold text-[#2B2B2B]">{a.date}</span>
                        <span className={`badge ${
                          a.status === 'present' ? 'badge-primary' : a.status === 'late' ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {a.status.toUpperCase()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-xs text-[#9B9B9B] p-4 bg-[#FAF8F5] rounded-2xl border border-[#E6E4DF]">
                      Attendance logged via daily register.
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        </>
      )}

    </div>
  );
}
