'use client';

import React, { useState } from 'react';
import { 
  Users, 
  CheckCircle2, 
  Plus, 
  AlertTriangle, 
  Edit3, 
  Archive, 
  TrendingUp, 
  FileText, 
  Megaphone,
  ChevronRight,
  Eye,
  CalendarCheck,
  BellRing,
  Sparkles,
  Filter
} from 'lucide-react';
import PupilDetailModal from '@/components/PupilDetailModal';
import ConfirmArchiveModal from '@/components/ConfirmArchiveModal';

interface WorkerViewProps {
  activeTab: string;
  pupils: any[];
  attendance: any[];
  progress: any[];
  announcements: any[];
  searchQuery: string;
  onOpenPupilModal: () => void;
  onOpenProgressModal: () => void;
  onOpenAnnouncementModal: () => void;
  onOpenDSWDReportModal: () => void;
  onSaveAttendance: (records: any[], dateStr: string) => void;
  onArchivePupil: (id: string) => void;
  onEditPupil: (pupil: any) => void;
}

export default function WorkerView({ 
  activeTab, 
  pupils, 
  attendance, 
  progress, 
  announcements,
  searchQuery,
  onOpenPupilModal,
  onOpenProgressModal,
  onOpenAnnouncementModal,
  onOpenDSWDReportModal,
  onSaveAttendance,
  onArchivePupil,
  onEditPupil
}: WorkerViewProps) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDomain, setSelectedDomain] = useState('all');
  const [selectedPupilDetail, setSelectedPupilDetail] = useState<any>(null);
  const [archiveTargetPupil, setArchiveTargetPupil] = useState<any>(null);

  const enrolledPupils = pupils.filter(p => p.enrollmentStatus === 'enrolled');

  const filteredEnrolledPupils = enrolledPupils.filter(p => {
    const full = `${p.firstName} ${p.lastName} ${p.id} ${p.guardian?.fullName}`.toLowerCase();
    return full.includes(searchQuery.toLowerCase());
  });

  const getAttendanceStatus = (pupilId: string) => {
    const record = attendance.find(a => a.pupil_id === pupilId && a.date === selectedDate);
    return record || { status: 'present', notes: '' };
  };

  const [dailyAttendanceState, setDailyAttendanceState] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    enrolledPupils.forEach(p => {
      initial[p.id] = getAttendanceStatus(p.id);
    });
    return initial;
  });

  const handleStatusToggle = (pupilId: string, newStatus: string) => {
    setDailyAttendanceState(prev => ({
      ...prev,
      [pupilId]: {
        ...prev[pupilId],
        status: newStatus
      }
    }));
  };

  const handleNotesChange = (pupilId: string, notes: string) => {
    setDailyAttendanceState(prev => ({
      ...prev,
      [pupilId]: {
        ...prev[pupilId],
        notes
      }
    }));
  };

  const handleSaveRegister = () => {
    const records = Object.keys(dailyAttendanceState).map(pupilId => ({
      pupil_id: pupilId,
      date: selectedDate,
      status: dailyAttendanceState[pupilId].status || 'present',
      notes: dailyAttendanceState[pupilId].notes || ''
    }));

    onSaveAttendance(records, selectedDate);
  };

  const presentCount = Object.values(dailyAttendanceState).filter(r => r.status === 'present').length;
  const lateCount = Object.values(dailyAttendanceState).filter(r => r.status === 'late').length;
  const absentCount = Object.values(dailyAttendanceState).filter(r => r.status === 'absent').length;

  const filteredProgress = progress.filter(item => {
    if (selectedDomain === 'all') return true;
    return item.domain === selectedDomain;
  });

  return (
    <div className="space-y-6 pb-12" suppressHydrationWarning>
      
      {/* Top Banner Action Bar */}
      <div className="card bg-gradient-to-br from-[#2F8F8A] to-[#1D605D] text-white p-6 rounded-3xl shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={18} className="text-[#F5B942]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#F5B942]">
                Lead Daycare Worker Workspace
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold text-white m-0 tracking-tight">
              Barangay Bacong ECCD Daily Operations
            </h2>
            <p className="text-xs md:text-sm text-white/90 mt-1.5 leading-relaxed max-w-2xl m-0">
              Mark daily attendance registers, evaluate 4-domain milestone development, and manage pupil enrollment records.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenPupilModal}
              className="btn btn-secondary btn-sm bg-white text-[#2F8F8A] font-bold border-none"
              suppressHydrationWarning
            >
              <Plus size={16} />
              <span>Enroll Pupil</span>
            </button>
            <button
              onClick={onOpenDSWDReportModal}
              className="btn btn-warning btn-sm font-bold shadow-md"
              suppressHydrationWarning
            >
              <FileText size={16} />
              <span>DSWD PDF Report</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. Daily Register View (Active when tab is dashboard or register) */}
      {(activeTab === 'dashboard' || activeTab === 'register') && (
        <>
          {/* Attendance Action Strip */}
          <div className="card bg-[#FEF8EC] border border-[#F5DAA0] p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#F5B942] text-[#8A5D00] flex items-center justify-center font-bold shrink-0">
                  <BellRing size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[#8A5D00] m-0">Daily Attendance Register • {selectedDate}</h4>
                  <div className="text-xs text-[#6B6B6B] mt-0.5">
                    <strong className="text-[#2F8F8A]">{presentCount} Present</strong> • {lateCount} Late • {absentCount} Absent Today
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 rounded-full border border-[#E6E4DF] bg-white text-xs font-semibold focus:outline-none"
                  suppressHydrationWarning
                />
                <button
                  onClick={handleSaveRegister}
                  className="btn btn-primary btn-sm font-bold shadow-md"
                  suppressHydrationWarning
                >
                  <CheckCircle2 size={16} />
                  <span>Save Today Register</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick Action Stat Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className="card bg-white p-4 flex items-center gap-4 cursor-pointer hover:-translate-y-1 transition-all"
              onClick={onOpenPupilModal}
            >
              <div className="w-12 h-12 rounded-2xl bg-[#EBF5F4] text-[#2F8F8A] flex items-center justify-center shrink-0">
                <Users size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-[#2B2B2B] m-0">Pupil Roster</h4>
                <span className="text-xs text-[#6B6B6B]">{enrolledPupils.length} Enrolled pupils</span>
              </div>
              <ChevronRight size={18} className="text-[#9B9B9B]" />
            </div>

            <div
              className="card bg-white p-4 flex items-center gap-4 cursor-pointer hover:-translate-y-1 transition-all"
              onClick={handleSaveRegister}
            >
              <div className="w-12 h-12 rounded-2xl bg-[#EBF8FF] text-[#2B6CB0] flex items-center justify-center shrink-0">
                <CalendarCheck size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-[#2B2B2B] m-0">Mark Attendance</h4>
                <span className="text-xs text-[#6B6B6B]">{presentCount} Present today</span>
              </div>
              <ChevronRight size={18} className="text-[#9B9B9B]" />
            </div>

            <div
              className="card bg-white p-4 flex items-center gap-4 cursor-pointer hover:-translate-y-1 transition-all"
              onClick={onOpenProgressModal}
            >
              <div className="w-12 h-12 rounded-2xl bg-[#FFEBEE] text-[#D32F2F] flex items-center justify-center shrink-0">
                <TrendingUp size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-[#2B2B2B] m-0">Record Milestone</h4>
                <span className="text-xs text-[#6B6B6B]">4 ECD Domains</span>
              </div>
              <ChevronRight size={18} className="text-[#9B9B9B]" />
            </div>
          </div>

          {/* Main Register Table & Sidebar Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Daily Register Table */}
            <div className="card bg-white p-5 lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#2B2B2B] m-0">Daily Register Checklist</h3>
                  <span className="text-xs text-[#6B6B6B]">Segmented status toggles for day log</span>
                </div>
              </div>

              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Pupil Name</th>
                      <th>Guardian</th>
                      <th>Status Control</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEnrolledPupils.map((pupil) => {
                      const rec = dailyAttendanceState[pupil.id] || { status: 'present' };
                      return (
                        <tr key={pupil.id}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <img src={pupil.avatar} alt={pupil.firstName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                              <div>
                                <div className="font-bold text-[#2B2B2B]">{pupil.firstName} {pupil.lastName}</div>
                                <span className="text-[10px] text-[#9B9B9B]">{pupil.id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="text-xs text-[#6B6B6B]">{pupil.guardian?.fullName}</td>
                          <td>
                            <div className="segmented-control">
                              <button
                                onClick={() => handleStatusToggle(pupil.id, 'present')}
                                className={`segmented-btn present ${rec.status === 'present' ? 'active' : ''}`}
                                suppressHydrationWarning
                              >
                                Present
                              </button>
                              <button
                                onClick={() => handleStatusToggle(pupil.id, 'late')}
                                className={`segmented-btn late ${rec.status === 'late' ? 'active' : ''}`}
                                suppressHydrationWarning
                              >
                                Late
                              </button>
                              <button
                                onClick={() => handleStatusToggle(pupil.id, 'absent')}
                                className={`segmented-btn absent ${rec.status === 'absent' ? 'active' : ''}`}
                                suppressHydrationWarning
                              >
                                Absent
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sidebar Notices Feed */}
            <div className="card bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#2B2B2B] m-0">Daycare Notices</h3>
                <button
                  onClick={onOpenAnnouncementModal}
                  className="btn btn-secondary btn-sm text-[11px] py-1 px-2.5"
                  suppressHydrationWarning
                >
                  + Notice
                </button>
              </div>

              <div className="space-y-3">
                {announcements.slice(0, 4).map((item) => (
                  <div key={item.id} className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E6E4DF] text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#2F8F8A] truncate">{item.title}</span>
                      <span className="text-[10px] text-[#9B9B9B] shrink-0">{item.date}</span>
                    </div>
                    <p className="text-[#4A4A4A] text-[11px] leading-relaxed m-0">{item.content}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </>
      )}

      {/* 2. Enrolled Pupils Tab (Active when tab is pupils or roster) */}
      {(activeTab === 'pupils' || activeTab === 'roster') && (
        <div className="card bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#2B2B2B] m-0">Enrolled Pupil Roster</h3>
              <span className="text-xs text-[#6B6B6B]">Showing {filteredEnrolledPupils.length} active daycare pupils</span>
            </div>
            <button onClick={onOpenPupilModal} className="btn btn-primary btn-sm font-bold" suppressHydrationWarning>
              <Plus size={16} />
              <span>Enroll New Pupil</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEnrolledPupils.map((pupil) => (
              <div key={pupil.id} className="p-4 rounded-3xl border border-[#E6E4DF] bg-white hover:-translate-y-1 transition-all space-y-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <img src={pupil.avatar} alt={pupil.firstName} className="w-12 h-12 rounded-2xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="badge badge-primary">{pupil.id}</span>
                      <span className="badge badge-success">Enrolled</span>
                    </div>
                    <h4 className="text-sm font-bold text-[#2B2B2B] m-0 mt-1 truncate">{pupil.firstName} {pupil.lastName}</h4>
                    <span className="text-[11px] text-[#6B6B6B]">{pupil.sex} • Born: {pupil.birthDate}</span>
                  </div>
                </div>

                <div className="p-2.5 rounded-2xl bg-[#FAF8F5] border border-[#E6E4DF] text-xs space-y-1">
                  <div><strong className="text-[#2B2B2B]">Guardian:</strong> {pupil.guardian?.fullName} ({pupil.guardian?.relationship})</div>
                  <div><strong className="text-[#2B2B2B]">Phone:</strong> {pupil.guardian?.phone}</div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#E6E4DF]">
                  <button
                    onClick={() => setSelectedPupilDetail(pupil)}
                    className="btn btn-secondary btn-sm text-xs"
                    suppressHydrationWarning
                  >
                    <Eye size={14} />
                    <span>View Profile</span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onEditPupil(pupil)}
                      className="p-2 rounded-xl text-[#6B6B6B] hover:bg-[#F5F3EF] border-none bg-transparent cursor-pointer"
                      title="Edit Profile"
                      suppressHydrationWarning
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => setArchiveTargetPupil(pupil)}
                      className="p-2 rounded-xl text-[#D32F2F] hover:bg-[#FFEBEE] border-none bg-transparent cursor-pointer"
                      title="Soft Archive"
                      suppressHydrationWarning
                    >
                      <Archive size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. 4-Domain ECCD Milestone Tab (Active when tab is progress) */}
      {activeTab === 'progress' && (
        <div className="card bg-white p-5 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-[#2B2B2B] m-0">4-Domain ECCD Milestone Evaluation Hub</h3>
              <span className="text-xs text-[#6B6B6B]">Record and inspect early childhood development milestone observations</span>
            </div>
            <button onClick={onOpenProgressModal} className="btn btn-primary btn-sm font-bold shrink-0" suppressHydrationWarning>
              <TrendingUp size={16} />
              <span>Record Milestone Observation</span>
            </button>
          </div>

          {/* Domain Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="font-bold text-[#6B6B6B] flex items-center gap-1 shrink-0">
              <Filter size={14} /> Filter Domain:
            </span>
            {[
              { id: 'all', label: 'All 4 Domains' },
              { id: 'Motor Skills', label: '🏃 Motor Skills' },
              { id: 'Language & Communication', label: '🗣️ Language' },
              { id: 'Socio-Emotional', label: '🤝 Socio-Emotional' },
              { id: 'Self-Help & Cognitive', label: '🧠 Self-Help' },
            ].map(domain => (
              <button
                key={domain.id}
                onClick={() => setSelectedDomain(domain.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer border-none ${
                  selectedDomain === domain.id
                    ? 'bg-[#2F8F8A] text-white shadow-sm'
                    : 'bg-[#F5F3EF] text-[#6B6B6B] hover:bg-[#EAE6DF]'
                }`}
                suppressHydrationWarning
              >
                {domain.label}
              </button>
            ))}
          </div>

          {/* Observations List */}
          <div className="space-y-3">
            {filteredProgress.map((item) => {
              const pupil = pupils.find(p => p.id === item.pupil_id);
              return (
                <div key={item.id} className="p-4 rounded-3xl border border-[#E6E4DF] bg-white flex items-start justify-between text-xs space-x-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#2B2B2B] text-sm">{pupil ? `${pupil.firstName} ${pupil.lastName}` : item.pupil_id}</span>
                      <span className="badge badge-primary">{item.domain}</span>
                      <span className="px-2.5 py-0.5 rounded-full font-bold bg-[#FEF8EC] text-[#8A5D00] text-[10px]">
                        {item.rating}
                      </span>
                    </div>
                    <p className="text-[#4A4A4A] leading-relaxed m-0 text-xs">{item.notes}</p>
                  </div>
                  <span className="text-[11px] text-[#9B9B9B] shrink-0 font-semibold">{item.date}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Daycare Notices Tab (Active when tab is announcements) */}
      {activeTab === 'announcements' && (
        <div className="card bg-white p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#2B2B2B] m-0">Daycare Notices & Broadcast Feed</h3>
              <span className="text-xs text-[#6B6B6B]">Broadcast official daycare notices to parent portal</span>
            </div>
            <button onClick={onOpenAnnouncementModal} className="btn btn-primary btn-sm font-bold" suppressHydrationWarning>
              <Megaphone size={16} />
              <span>+ Publish Notice</span>
            </button>
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

      {/* Profile & Archive Modals */}
      <PupilDetailModal
        isOpen={!!selectedPupilDetail}
        onClose={() => setSelectedPupilDetail(null)}
        pupil={selectedPupilDetail}
        attendanceRecords={attendance}
        progressRecords={progress}
        onOpenProgressModal={onOpenProgressModal}
      />

      <ConfirmArchiveModal
        isOpen={!!archiveTargetPupil}
        onClose={() => setArchiveTargetPupil(null)}
        pupilName={archiveTargetPupil ? `${archiveTargetPupil.firstName} ${archiveTargetPupil.lastName}` : ''}
        onConfirm={() => {
          if (archiveTargetPupil) {
            onArchivePupil(archiveTargetPupil.id);
          }
        }}
      />

    </div>
  );
}
