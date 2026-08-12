'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { 
  CheckCircle2, 
  Plus, 
  Edit3, 
  Archive, 
  TrendingUp, 
  FileText, 
  Megaphone,
  Eye,
  BellRing,
  Sparkles,
  BookOpen,
  MessageSquare,
  Activity,
  CheckCircle,
} from 'lucide-react';
import { DEFAULT_AVATAR } from '@/data/mockData';
import PupilDetailModal from '@/components/PupilDetailModal';
import ConfirmArchiveModal from '@/components/ConfirmArchiveModal';
import { ECCD_DOMAINS } from '@/data/eccdChecklist';
import { useDaycare, type MockPupil, type MockAttendance, type MockAnnouncement, type MockProgress } from '@/contexts/DaycareContext';

interface WorkerViewProps {
  activeTab: string;
  pupils: MockPupil[];
  attendance: MockAttendance[];
  progress: MockProgress[];
  announcements: MockAnnouncement[];
  searchQuery: string;
  onOpenPupilModal: () => void;
  onOpenProgressModal: () => void;
  onOpenAnnouncementModal: () => void;
  onOpenDSWDReportModal: () => void;
  onSaveAttendance: (records: MockAttendance[], dateStr: string) => void;
  onArchivePupil: (id: string) => void;
  onEditPupil: (pupil: MockPupil) => void;
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
  const { showToast, logAuditAction } = useDaycare();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDomainId, setSelectedDomainId] = useState('gross_motor');
  const [selectedPupilDetail, setSelectedPupilDetail] = useState<MockPupil | null>(null);
  const [archiveTargetPupil, setArchiveTargetPupil] = useState<MockPupil | null>(null);

  // ECCD checklist evaluations state
  const [evaluations, setEvaluations] = useState<Record<string, Record<string, 'P' | 'O' | 'R'>>>({});

  // Parent Notes Inbox State
  interface ParentNote {
    id: string;
    pupilId: string;
    pupilName: string;
    date: string;
    reason: string;
    notes: string;
    phone: string;
    status: string;
    submittedAt: string;
  }

  const [inboxNotes, setInboxNotes] = useState<ParentNote[]>([
    {
      id: 'NOTE-101',
      pupilId: 'PUP-2026-001',
      pupilName: 'Maria Santos',
      date: '2026-02-09',
      reason: 'Doctor Visit / Checkup',
      notes: 'Maria had her routine 4-year-old pediatric checkup and immunization update at Barangay Bacong Health Center.',
      phone: '0917-888-9900',
      status: 'Excused & Acknowledged',
      submittedAt: 'Feb 9, 2026 07:45 AM',
    },
    {
      id: 'NOTE-102',
      pupilId: 'PUP-2026-003',
      pupilName: 'Juan Santos',
      date: '2026-02-10',
      reason: 'Illness / Fever',
      notes: 'Juan developed a mild fever this morning. Requesting excused absence for today.',
      phone: '0917-888-9900',
      status: 'Pending Teacher Review',
      submittedAt: 'Feb 10, 2026 07:15 AM',
    }
  ]);

  // Nutritional Log State
  const [healthLogs] = useState<Record<string, { weight: string; height: string; status: string }>>({
    'PUP-2026-001': { weight: '14.5', height: '98.5', status: 'Normal' },
    'PUP-2026-002': { weight: '15.1', height: '100.2', status: 'Normal' },
    'PUP-2026-003': { weight: '13.8', height: '96.0', status: 'Normal' },
  });

  const enrolledPupils = pupils.filter(p => p.enrollmentStatus === 'enrolled');

  const filteredEnrolledPupils = enrolledPupils.filter(p => {
    const full = `${p.firstName} ${p.lastName} ${p.id} ${p.guardian?.fullName}`.toLowerCase();
    return full.includes(searchQuery.toLowerCase());
  });

  const getAttendanceStatus = (pupilId: string) => {
    const record = attendance.find(a => a.pupil_id === pupilId && a.date === selectedDate);
    return record || { status: 'present', notes: '' };
  };

  // Edit overlay: only entries the user has toggled for the selected date.
  // Saved statuses come from the `attendance` prop (real DB after sync); the
  // overlay lets user edits win until the register is saved.
  const [dailyAttendanceState, setDailyAttendanceState] = useState<Record<string, { status: string; notes?: string }>>({});

  const displayedStatus = (pupilId: string) =>
    dailyAttendanceState[pupilId]?.status || getAttendanceStatus(pupilId).status;

  const handleStatusToggle = (pupilId: string, newStatus: string) => {
    setDailyAttendanceState(prev => ({
      ...prev,
      [pupilId]: {
        ...prev[pupilId],
        status: newStatus
      }
    }));
  };

  const handleSaveRegister = () => {
    const records: MockAttendance[] = enrolledPupils.map(pupil => {
      const rec = dailyAttendanceState[pupil.id] || getAttendanceStatus(pupil.id);
      return {
        pupil_id: pupil.id,
        date: selectedDate,
        status: (rec.status || 'present') as MockAttendance['status'],
        notes: rec.notes || ''
      };
    });

    onSaveAttendance(records, selectedDate);
  };

  const handleMarkAllPresent = () => {
    const updatedState: Record<string, { status: string; notes?: string }> = {};
    enrolledPupils.forEach(pupil => {
      updatedState[pupil.id] = {
        status: 'present',
        notes: dailyAttendanceState[pupil.id]?.notes || ''
      };
    });
    setDailyAttendanceState(updatedState);
  };

  const handleAcknowledgeParentNote = (noteId: string, pupilId: string, pupilName: string) => {
    setInboxNotes(prev => prev.map(n => n.id === noteId ? { ...n, status: 'Excused & Acknowledged' } : n));
    showToast(`Absence note for ${pupilName} marked as Excused!`, 'success');
    logAuditAction('Acknowledged Parent Absence Note', pupilId, `Teacher Teresa marked absence note for ${pupilName} as Excused.`);
  };

  const handleSetECCDItemRating = (pupilId: string, itemId: string, rating: 'P' | 'O' | 'R') => {
    setEvaluations(prev => ({
      ...prev,
      [pupilId]: {
        ...(prev[pupilId] || {}),
        [itemId]: rating
      }
    }));
    showToast(`Recorded ECCD rating ${rating} for item ${itemId}.`, 'info');
  };

  const presentCount = enrolledPupils.filter(p => displayedStatus(p.id) === 'present').length;
  const lateCount = enrolledPupils.filter(p => displayedStatus(p.id) === 'late').length;
  const absentCount = enrolledPupils.filter(p => displayedStatus(p.id) === 'absent').length;

  const activeDomain = ECCD_DOMAINS.find(d => d.id === selectedDomainId) || ECCD_DOMAINS[0];

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
              Mark daily attendance registers, evaluate 109 DepEd ECCD milestones, review parent absence notes, and record growth metrics.
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

      {/* 1. Daily Register View */}
      {(activeTab === 'dashboard' || activeTab === 'register') && (
        <>
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

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={handleMarkAllPresent}
                  className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                  title="Quick mark all enrolled pupils as Present"
                >
                  <CheckCircle2 size={15} />
                  <span>Mark All Present</span>
                </button>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    // Reset the edit overlay so the register reflects saved records.
                    setDailyAttendanceState({});
                  }}
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                      const rec = dailyAttendanceState[pupil.id] || getAttendanceStatus(pupil.id);
                      return (
                        <tr key={pupil.id}>
                          <td>
                            <div className="flex items-center gap-2.5">
                              <Image src={pupil.avatar || DEFAULT_AVATAR} alt={pupil.firstName} width={36} height={36} className="w-9 h-9 rounded-full object-cover shrink-0" />
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

      {/* 2. Enrolled Pupils Tab */}
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
                  <Image src={pupil.avatar || DEFAULT_AVATAR} alt={pupil.firstName} width={48} height={48} className="w-12 h-12 rounded-2xl object-cover shrink-0" />
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

      {/* 3. 109-Item DepEd ECCD Checklist Evaluation Tool */}
      {activeTab === 'progress' && (
        <div className="card bg-white p-5 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BookOpen size={18} className="text-[#2F8F8A]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#2F8F8A]">
                  Teacher 109-Item Evaluation Suite
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#2B2B2B] m-0">
                109-Item Official ECCD Evaluation Checklist
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1 m-0">
                Evaluate enrolled pupils on official DepEd/DSWD ECCD competency items.
              </p>
            </div>

            <button onClick={onOpenProgressModal} className="btn btn-primary btn-sm font-bold shrink-0" suppressHydrationWarning>
              <TrendingUp size={16} />
              <span>Record Milestone Observation</span>
            </button>
          </div>

          {/* Domain Selection Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {ECCD_DOMAINS.map((dom) => {
              const isSelected = dom.id === selectedDomainId;
              return (
                <button
                  key={dom.id}
                  onClick={() => setSelectedDomainId(dom.id)}
                  className={`px-3 py-1.5 rounded-2xl text-xs font-bold transition-all cursor-pointer border-none shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#2F8F8A] text-white shadow-sm'
                      : 'bg-[#FAF8F5] text-[#6B6B6B] hover:bg-[#EAE6DF]'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dom.color }}></span>
                  <span>{dom.shortLabel}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-[#EAE6DF] text-[#6B6B6B]'}`}>
                    {dom.items.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Evaluation Roster */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-[#2B2B2B] m-0">Evaluating: {activeDomain.label} ({activeDomain.items.length} Items)</h4>
            {enrolledPupils.slice(0, 3).map((pupil) => (
              <div key={pupil.id} className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Image src={pupil.avatar || DEFAULT_AVATAR} alt={pupil.firstName} width={36} height={36} className="w-9 h-9 rounded-full object-cover" />
                    <div>
                      <div className="font-bold text-[#2B2B2B] text-sm">{pupil.firstName} {pupil.lastName}</div>
                      <span className="text-[10px] text-[#9B9B9B]">{pupil.id} • Room A</span>
                    </div>
                  </div>
                  <span className="badge badge-primary text-[10px]">Baseline Evaluation</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {activeDomain.items.slice(0, 4).map((item) => {
                    const currentRating = evaluations[pupil.id]?.[item.id] || 'P';
                    return (
                      <div key={item.id} className="p-2.5 rounded-2xl bg-white border border-[#E6E4DF] flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[#2B2B2B] font-semibold truncate flex-1">{item.number}. {item.description}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleSetECCDItemRating(pupil.id, item.id, 'P')}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer border-none ${
                              currentRating === 'P' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            P
                          </button>
                          <button
                            onClick={() => handleSetECCDItemRating(pupil.id, item.id, 'O')}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer border-none ${
                              currentRating === 'O' ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            O
                          </button>
                          <button
                            onClick={() => handleSetECCDItemRating(pupil.id, item.id, 'R')}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold cursor-pointer border-none ${
                              currentRating === 'R' ? 'bg-rose-600 text-white' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            R
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Parent Absence Notes Inbox */}
      {activeTab === 'parent_notes_inbox' && (
        <div className="card bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare size={18} className="text-[#2F8F8A]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#2F8F8A]">
                  Guardian Communication Portal
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#2B2B2B] m-0">
                Parent Absence Notes Inbox
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1 m-0">
                Review and acknowledge absence excusal notes submitted by parents.
              </p>
            </div>
            <span className="badge badge-primary font-bold">{inboxNotes.length} Messages Received</span>
          </div>

          <div className="space-y-3">
            {inboxNotes.map((note) => (
              <div key={note.id} className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[#2B2B2B] text-sm">{note.pupilName} ({note.pupilId})</span>
                    <span className="badge badge-warning text-[10px]">{note.date}</span>
                    <span className="badge badge-primary text-[10px]">{note.reason}</span>
                  </div>
                  <p className="text-[#4A4A4A] leading-relaxed m-0 text-xs">{note.notes}</p>
                  <span className="text-[10px] text-[#9B9B9B]">Submitted: {note.submittedAt} • Phone: {note.phone}</span>
                </div>

                <div className="shrink-0">
                  {note.status === 'Excused & Acknowledged' ? (
                    <span className="px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs flex items-center gap-1">
                      <CheckCircle size={14} /> Excused & Acknowledged
                    </span>
                  ) : (
                    <button
                      onClick={() => handleAcknowledgeParentNote(note.id, note.pupilId, note.pupilName)}
                      className="btn btn-primary btn-sm font-bold shadow-md"
                      suppressHydrationWarning
                    >
                      <CheckCircle size={14} />
                      <span>Acknowledge & Mark Excused</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Pupil Nutritional & Growth Log */}
      {activeTab === 'health_entry' && (
        <div className="card bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Activity size={18} className="text-[#2F8F8A]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#2F8F8A]">
                  Early Childhood Health Telemetry
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#2B2B2B] m-0">
                Pupil Nutritional & Growth Telemetry Entry
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1 m-0">
                Record height (cm) and weight (kg) measurements for DSWD Form 1 nutritional status tracking.
              </p>
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Pupil Name</th>
                  <th>Weight (kg)</th>
                  <th>Height (cm)</th>
                  <th>Nutritional Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {enrolledPupils.map((pupil) => {
                  const log = healthLogs[pupil.id] || { weight: '14.2', height: '98.0', status: 'Normal' };
                  return (
                    <tr key={pupil.id}>
                      <td className="font-bold text-[#2B2B2B]">{pupil.firstName} {pupil.lastName}</td>
                      <td>
                        <input
                          type="text"
                          defaultValue={log.weight}
                          className="w-20 px-2 py-1 rounded-xl border border-[#E6E4DF] text-xs font-semibold"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          defaultValue={log.height}
                          className="w-20 px-2 py-1 rounded-xl border border-[#E6E4DF] text-xs font-semibold"
                        />
                      </td>
                      <td>
                        <span className="badge badge-success">{log.status}</span>
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            showToast(`Updated health record for ${pupil.firstName}!`, 'success');
                            logAuditAction('Updated Pupil Health Log', pupil.id, 'Recorded weight and height measurement.');
                          }}
                          className="btn btn-secondary btn-sm text-xs"
                        >
                          Save Log
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. Daycare Notices Tab */}
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
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#2F8F8A]">{notice.title}</span>
                  <span className="text-[11px] text-[#9B9B9B]">{notice.date}</span>
                </div>
                <p className="text-xs text-[#4A4A4A] leading-relaxed m-0">{notice.content}</p>
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
