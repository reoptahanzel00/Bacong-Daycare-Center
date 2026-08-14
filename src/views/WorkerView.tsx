'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useEffect } from 'react';
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
  ShieldCheck,
  X,
  AlertTriangle,
  FileDown,
} from 'lucide-react';
import { DEFAULT_AVATAR } from '@/data/mockData';
import PupilDetailModal from '@/components/PupilDetailModal';
import ConfirmArchiveModal from '@/components/ConfirmArchiveModal';
import { ECCD_DOMAINS, ECCD_TOTAL_ITEMS } from '@/data/eccdChecklist';
import {
  fetchEccdRatings,
  saveEccdRatings,
  fetchEccdScores,
  saveEccdScores,
  fetchChildBackground,
  saveChildBackground,
  type ChildBackground,
  type EccdRound,
} from '@/services/eccdService';
import { fetchParentNotes, acknowledgeParentNote, type ParentNoteRow } from '@/services/parentNotesService';
import { fetchHealthLogs, saveHealthLog } from '@/services/healthLogsService';
import ChildBackgroundModal from '@/components/ChildBackgroundModal';
import ECCDReportModal from '@/components/ECCDReportModal';
import { verifyPupil } from '@/services/pupilService';
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
  const { showToast, logAuditAction, updatePupilEnrollment } = useDaycare();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedDomainId, setSelectedDomainId] = useState('gross_motor');
  const [selectedPupilDetail, setSelectedPupilDetail] = useState<MockPupil | null>(null);
  const [archiveTargetPupil, setArchiveTargetPupil] = useState<MockPupil | null>(null);
  const [backgrounds, setBackgrounds] = useState<Record<string, ChildBackground | null>>({});
  const [backgroundPupil, setBackgroundPupil] = useState<MockPupil | null>(null);
  const [isBackgroundModalOpen, setIsBackgroundModalOpen] = useState(false);
  const [verifyPupilRecord, setVerifyPupilRecord] = useState<MockPupil | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyAction, setVerifyAction] = useState<'approve' | 'reject' | null>(null);

  // ECCD checklist state: ✓ (present) per item, per pupil, per round.
  const [selectedRound, setSelectedRound] = useState<EccdRound>(1);
  const [evaluations, setEvaluations] = useState<Record<string, Record<string, boolean>>>({});
  const [eccdScores, setEccdScores] = useState<Record<string, Record<string, { raw: number; scaled?: string }>>>({});
  const [savingEvalPupil, setSavingEvalPupil] = useState<string | null>(null);
  const [reportPupil, setReportPupil] = useState<MockPupil | null>(null);

  // Load the saved checklist ratings + scores for the selected round.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [ratingsRes, scoresRes] = await Promise.all([
        fetchEccdRatings(selectedRound),
        fetchEccdScores(selectedRound),
      ]);
      if (cancelled) return;

      const seeded: Record<string, Record<string, boolean>> = {};
      for (const row of ratingsRes.ok ? ratingsRes.ratings : []) {
        if (row.status_rating !== 'Present') continue;
        if (!seeded[row.pupil_id]) seeded[row.pupil_id] = {};
        seeded[row.pupil_id][row.milestone_code] = true;
      }
      setEvaluations(seeded);

      const scoreMap: Record<string, Record<string, { raw: number; scaled?: string }>> = {};
      for (const s of scoresRes.ok ? scoresRes.scores : []) {
        if (!scoreMap[s.pupil_id]) scoreMap[s.pupil_id] = {};
        scoreMap[s.pupil_id][s.domain_id] = {
          raw: s.raw_score,
          scaled: s.scaled_score != null ? String(s.scaled_score) : undefined,
        };
      }
      setEccdScores(scoreMap);
    })();
    return () => { cancelled = true; };
  }, [selectedRound]);

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

  const [inboxNotes, setInboxNotes] = useState<ParentNote[]>([]);

  // Nutritional Log State
  const [healthLogs, setHealthLogs] = useState<Record<string, { weight: string; height: string }>>({});
  const [healthDrafts, setHealthDrafts] = useState<Record<string, { weight: string; height: string }>>({});
  const [savingHealthPupil, setSavingHealthPupil] = useState<string | null>(null);

  // Load the real parent-notes inbox + health logs once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [notesRes, healthRes] = await Promise.all([fetchParentNotes(), fetchHealthLogs()]);
      if (cancelled) return;

      if (notesRes.ok && notesRes.notes.length > 0) {
        const pupilName = (row: ParentNoteRow) => {
          const p = pupils.find(x => x.id === row.pupil_id);
          return p ? `${p.firstName} ${p.lastName}` : row.pupil_id;
        };
        setInboxNotes(notesRes.notes.map((row) => ({
          id: row.id,
          pupilId: row.pupil_id,
          pupilName: pupilName(row),
          date: row.note_date,
          reason: row.reason,
          notes: row.notes,
          phone: row.phone || '',
          status: row.status === 'acknowledged' ? 'Excused & Acknowledged' : 'Pending Teacher Review',
          submittedAt: row.submitted_at ? new Date(row.submitted_at).toLocaleString('sv').replace('T', ' ') : '',
        })));
      }

      if (healthRes.ok && healthRes.logs.length > 0) {
        const map: Record<string, { weight: string; height: string }> = {};
        for (const log of healthRes.logs) {
          if (!map[log.pupil_id]) {
            map[log.pupil_id] = { weight: log.weight_kg || '', height: log.height_cm || '' };
          }
        }
        setHealthLogs(map);
      }
    })();
    return () => { cancelled = true; };
  }, [pupils]);

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

  const handleAcknowledgeParentNote = async (noteId: string, pupilId: string, pupilName: string) => {
    setInboxNotes(prev => prev.map(n => n.id === noteId ? { ...n, status: 'Excused & Acknowledged' } : n));
    const res = await acknowledgeParentNote(noteId);
    if (res.success) {
      showToast(`Absence note for ${pupilName} marked as Excused!`, 'success');
    } else {
      showToast(`Marked locally — could not reach the server.`, 'warning');
    }
    logAuditAction('Acknowledged Parent Absence Note', pupilId, `Teacher Teresa marked absence note for ${pupilName} as Excused.`);
  };

  const handleToggleECCDItem = (pupilId: string, itemId: string) => {
    setEvaluations(prev => {
      const pupilMap = { ...(prev[pupilId] || {}) };
      pupilMap[itemId] = !pupilMap[itemId];
      return { ...prev, [pupilId]: pupilMap };
    });
  };

  const handleSaveEvaluation = async (pupil: MockPupil) => {
    const pupilRatings = evaluations[pupil.id] || {};
    const ratings: Array<{ milestone_code: string; domain_id: string; present: boolean }> = [];
    for (const [itemId, present] of Object.entries(pupilRatings)) {
      const domain = ECCD_DOMAINS.find((d) => d.items.some((i) => i.id === itemId));
      if (!domain) continue;
      ratings.push({ milestone_code: itemId, domain_id: domain.id, present });
    }

    setSavingEvalPupil(pupil.id);
    const res = await saveEccdRatings(pupil.id, selectedRound, ratings);

    // Persist per-domain raw scores (auto from ✓ counts) + manual scaled scores.
    const scores = ECCD_DOMAINS.map((d) => {
      const raw = d.items.filter((i) => pupilRatings[i.id]).length;
      const scaledRaw = eccdScores[pupil.id]?.[d.id]?.scaled;
      return {
        domain_id: d.id,
        raw_score: raw,
        scaled_score: scaledRaw && scaledRaw.trim() !== '' ? Number(scaledRaw) : null,
      };
    });
    await saveEccdScores(pupil.id, selectedRound, scores);

    setSavingEvalPupil(null);
    if (res.success) {
      const presentCount = ratings.filter((r) => r.present).length;
      showToast(`Saved ${presentCount} ✓ item(s) for ${pupil.firstName} (round ${selectedRound}).`);
      logAuditAction('Saved ECCD Evaluation', `${pupil.firstName} ${pupil.lastName} (${pupil.id})`, `Persisted round ${selectedRound} checklist ratings + scores.`);
      // Auto-open the printable ECCD pupil report after grading is saved.
      setReportPupil(pupil);
    } else {
      showToast(`Could not save evaluation: ${res.error || 'unknown error'}`, 'danger');
    }
  };

  const handleSaveHealthLog = async (pupil: MockPupil, weight: string, height: string) => {
    setSavingHealthPupil(pupil.id);
    const res = await saveHealthLog(pupil.id, weight, height);
    setSavingHealthPupil(null);
    if (res.success) {
      setHealthLogs(prev => ({ ...prev, [pupil.id]: { weight, height } }));
      setHealthDrafts(prev => {
        const next = { ...prev };
        delete next[pupil.id];
        return next;
      });
      showToast(`Updated health record for ${pupil.firstName}!`, 'success');
      logAuditAction('Updated Pupil Health Log', pupil.id, `Recorded weight ${weight}kg, height ${height}cm.`);
    } else {
      showToast(`Could not save health log: ${res.error || 'unknown error'}`, 'danger');
    }
  };

  const openBackgroundModal = async (pupil: MockPupil) => {
    setBackgroundPupil(pupil);
    setIsBackgroundModalOpen(true);
    const res = await fetchChildBackground(pupil.id);
    if (res.ok) {
      setBackgrounds(prev => ({ ...prev, [pupil.id]: res.background }));
    }
  };

  const handleSaveBackground = async (
    fields: Partial<Omit<ChildBackground, 'pupil_id' | 'updated_by' | 'updated_at'>>
  ) => {
    if (!backgroundPupil) return;
    const res = await saveChildBackground(backgroundPupil.id, fields);
    if (res.success) {
      setBackgrounds(prev => ({
        ...prev,
        [backgroundPupil.id]: { pupil_id: backgroundPupil.id, ...fields, updated_at: new Date().toISOString() },
      }));
      showToast(`Child & family background saved for ${backgroundPupil.firstName}.`, 'success');
      logAuditAction(
        'Updated Child & Family Background',
        backgroundPupil.id,
        `${backgroundPupil.firstName} ${backgroundPupil.lastName}`
      );
    } else {
      showToast(res.error || 'Could not save background info.', 'danger');
    }
    setIsBackgroundModalOpen(false);
    setBackgroundPupil(null);
  };

  const pendingPupils = pupils.filter(p => p.enrollmentStatus === 'pending');
  const rejectedPupils = pupils.filter(p => p.enrollmentStatus === 'rejected');

  const openVerifyModal = (pupil: MockPupil, action: 'approve' | 'reject') => {
    setVerifyPupilRecord(pupil);
    setVerifyAction(action);
    setRejectReason('');
    setIsVerifyModalOpen(true);
  };

  const handleVerify = async () => {
    if (!verifyPupilRecord || !verifyAction) return;
    if (verifyAction === 'reject' && !rejectReason.trim()) {
      showToast('Please provide a reason for rejecting this enrollment.', 'danger');
      return;
    }
    const res = await verifyPupil(verifyPupilRecord.id, verifyAction, rejectReason.trim() || undefined);
    if (res.success) {
      const pupil = verifyPupilRecord;
      updatePupilEnrollment(
        pupil.id,
        verifyAction === 'approve' ? 'enrolled' : 'rejected',
        rejectReason.trim() || null
      );
      showToast(
        verifyAction === 'approve'
          ? `${pupil.firstName} ${pupil.lastName} is now enrolled.`
          : `Enrollment for ${pupil.firstName} ${pupil.lastName} was rejected.`,
        verifyAction === 'approve' ? 'success' : 'info'
      );
      logAuditAction(
        verifyAction === 'approve' ? 'Approved Parent Enrollment' : 'Rejected Parent Enrollment',
        pupil.id,
        `${pupil.firstName} ${pupil.lastName}${verifyAction === 'reject' ? ` — ${rejectReason.trim()}` : ''}`
      );
    } else {
      showToast(res.error ? String(res.error) : 'Could not verify this enrollment.', 'danger');
    }
    setIsVerifyModalOpen(false);
    setVerifyPupilRecord(null);
    setVerifyAction(null);
    setRejectReason('');
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
              Mark daily attendance registers, evaluate {ECCD_TOTAL_ITEMS} DepEd ECCD milestones, review parent absence notes, and record growth metrics.
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

      {/* 2b. Verify Parent-Submitted Enrollments */}
      {activeTab === 'verify' && (
        <div className="card bg-white p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={18} className="text-[#2F8F8A]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[#2F8F8A]">
                Enrollment Verification
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-[#2B2B2B] m-0">Parent-Submitted Child Profiles</h3>
            <p className="text-xs text-[#6B6B6B] mt-1 m-0">
              Parents submitted these sociodemographic profiles (ECCD Form Section 1) at account
              creation. Review each one, then approve the enrollment or reject it with a reason.
            </p>
          </div>

          {pendingPupils.length === 0 ? (
            <div className="p-6 rounded-3xl bg-[#EBF5F4] border border-dashed border-[#2F8F8A]/30 text-center">
              <CheckCircle size={28} className="text-[#2F8F8A] mx-auto mb-2" />
              <p className="text-sm font-bold text-[#2F8F8A] m-0">No pending enrollments</p>
              <p className="text-xs text-[#6B6B6B] m-0 mt-1">
                New parent-submitted profiles will appear here for verification.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingPupils.map((pupil) => {
                const profile = pupil.sociodemographic;
                return (
                  <div key={pupil.id} className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Image
                          src={pupil.avatar || DEFAULT_AVATAR}
                          alt={pupil.firstName}
                          width={48}
                          height={48}
                          className="w-12 h-12 rounded-2xl object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="badge badge-warning">{pupil.id}</span>
                            <span className="badge badge-primary">Pending</span>
                          </div>
                          <h4 className="text-sm font-bold text-[#2B2B2B] m-0 mt-1">
                            {pupil.firstName} {pupil.lastName}
                          </h4>
                          <span className="text-[11px] text-[#6B6B6B]">
                            {pupil.sex} • Born: {pupil.birthDate} • Submitted {pupil.enrollmentDate || 'recently'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => openVerifyModal(pupil, 'approve')}
                          className="btn btn-primary btn-sm font-bold"
                          suppressHydrationWarning
                        >
                          <CheckCircle2 size={14} />
                          Approve
                        </button>
                        <button
                          onClick={() => openVerifyModal(pupil, 'reject')}
                          className="btn btn-secondary btn-sm font-bold text-[#D32F2F]"
                          suppressHydrationWarning
                        >
                          <X size={14} />
                          Reject
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-2xl bg-white border border-[#E6E4DF] space-y-1">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#2F8F8A]">Guardian</div>
                        <div><strong className="text-[#2B2B2B]">Name:</strong> {pupil.guardian?.fullName || '—'} ({pupil.guardian?.relationship || '—'})</div>
                        <div><strong className="text-[#2B2B2B]">Phone:</strong> {pupil.guardian?.phone || '—'}</div>
                        <div><strong className="text-[#2B2B2B]">Address:</strong> {pupil.address || '—'}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-white border border-[#E6E4DF] space-y-1">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#2F8F8A]">Sociodemographic Profile</div>
                        <div>
                          <strong className="text-[#2B2B2B]">Handedness:</strong>{' '}
                          {profile?.handedness ? profile.handedness.replace(/_/g, ' ') : '—'}
                        </div>
                        <div>
                          <strong className="text-[#2B2B2B]">Currently studying:</strong>{' '}
                          {profile?.currently_studying ? 'Yes' : 'No'}
                          {profile?.currently_studying && profile?.school_name ? ` — ${profile.school_name}` : ''}
                        </div>
                        <div>
                          <strong className="text-[#2B2B2B]">Address parts:</strong>{' '}
                          {[profile?.barangay, profile?.municipality, profile?.province, profile?.region]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </div>
                      </div>
                    </div>

                    <details className="text-[11px]">
                      <summary className="cursor-pointer font-bold text-[#2F8F8A]">Parent &amp; sibling details</summary>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-[#4A4A4A]">
                        <div><strong>Father:</strong> {profile?.father_name || '—'}{profile?.father_age ? ` (${profile.father_age})` : ''}{profile?.father_occupation ? `, ${profile.father_occupation}` : ''}{profile?.father_education ? ` — ${profile.father_education}` : ''}</div>
                        <div><strong>Mother:</strong> {profile?.mother_name || '—'}{profile?.mother_age ? ` (${profile.mother_age})` : ''}{profile?.mother_occupation ? `, ${profile.mother_occupation}` : ''}{profile?.mother_education ? ` — ${profile.mother_education}` : ''}</div>
                        <div><strong>Siblings:</strong> {profile?.siblings_count ?? '—'}</div>
                        <div><strong>Birth order:</strong> {profile?.birth_order || '—'}</div>
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          )}

          {rejectedPupils.length > 0 && (
            <div className="pt-2 border-t border-[#E6E4DF]">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-[#9B9B9B] m-0 mb-2">
                Recently Rejected ({rejectedPupils.length})
              </h4>
              <div className="space-y-2">
                {rejectedPupils.map((pupil) => (
                  <div key={pupil.id} className="p-3 rounded-2xl bg-[#FFF7F7] border border-[#FFCDD2] text-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="text-[#D32F2F] shrink-0" />
                      <strong className="text-[#2B2B2B]">{pupil.firstName} {pupil.lastName}</strong>
                      <span className="badge badge-danger">Rejected</span>
                    </div>
                    {pupil.rejectionReason && (
                      <p className="text-[11px] text-[#6B6B6B] m-0 mt-1">Reason: {pupil.rejectionReason}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. ECCD DepEd Checklist Evaluation Tool */}
      {activeTab === 'progress' && (
        <div className="card bg-white p-5 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BookOpen size={18} className="text-[#2F8F8A]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#2F8F8A]">
                  Official ECCD Evaluation Suite
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#2B2B2B] m-0">
                {ECCD_TOTAL_ITEMS}-Item Official ECCD Evaluation Checklist
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1 m-0">
                Check (✓) the skills the pupil demonstrates. Absence is left unchecked.
                Administered once a year per official DepEd ECCD procedure.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              {/* Evaluation Round Selector */}
              <div className="flex items-center gap-1.5 p-1.5 bg-[#FAF8F5] border border-[#E6E4DF] rounded-2xl">
                {([1, 2, 3] as EccdRound[]).map((round) => (
                  <button
                    key={round}
                    type="button"
                    onClick={() => setSelectedRound(round)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border-none ${
                      selectedRound === round
                        ? 'bg-[#2F8F8A] text-white shadow-sm'
                        : 'text-[#6B6B6B] hover:text-[#2B2B2B]'
                    }`}
                    suppressHydrationWarning
                  >
                    {round === 1 ? '1st' : round === 2 ? '2nd' : '3rd'} Assessment
                  </button>
                ))}
              </div>
              <button onClick={onOpenProgressModal} className="btn btn-primary btn-sm font-bold" suppressHydrationWarning>
                <TrendingUp size={16} />
                <span>Record Milestone Observation</span>
              </button>
            </div>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-[#2B2B2B] m-0">
                {activeDomain.label} ({activeDomain.items.length} Items)
                <span className="ml-2 text-[11px] font-semibold text-[#9B9B9B]">
                  Round {selectedRound === 1 ? '1st' : selectedRound === 2 ? '2nd' : '3rd'} Assessment
                </span>
              </h4>
              <span className="text-[11px] text-[#9B9B9B] font-semibold">
                Tap ✓ when the child demonstrates the skill
              </span>
            </div>
            {enrolledPupils.map((pupil) => {
              const pupilRatings = evaluations[pupil.id] || {};
              const domainRaw = activeDomain.items.filter((i) => pupilRatings[i.id]).length;
              const totalRated = Object.values(pupilRatings).filter(Boolean).length;
              const scaled = eccdScores[pupil.id]?.[activeDomain.id]?.scaled ?? '';
              return (
                <div key={pupil.id} className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Image src={pupil.avatar || DEFAULT_AVATAR} alt={pupil.firstName} width={36} height={36} className="w-9 h-9 rounded-full object-cover" />
                      <div>
                        <div className="font-bold text-[#2B2B2B] text-sm">{pupil.firstName} {pupil.lastName}</div>
                        <span className="text-[10px] text-[#9B9B9B]">{pupil.id} • Room A</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="badge badge-primary text-[10px]">
                        ✓ {totalRated} total
                      </span>
                      <button
                        onClick={() => openBackgroundModal(pupil)}
                        className="btn btn-secondary btn-sm font-bold"
                        title="ECCD Form Section 2 - Child & Family Background"
                        suppressHydrationWarning
                      >
                        <FileText size={14} />
                        Background
                      </button>
                      <button
                        onClick={() => setReportPupil(pupil)}
                        className="btn btn-secondary btn-sm font-bold"
                        title="Download printable ECCD evaluation report PDF"
                        suppressHydrationWarning
                      >
                        <FileDown size={14} />
                        <span>Report PDF</span>
                      </button>
                      <button
                        onClick={() => handleSaveEvaluation(pupil)}
                        disabled={savingEvalPupil === pupil.id}
                        className="btn btn-primary btn-sm font-bold shadow-md"
                        suppressHydrationWarning
                      >
                        {savingEvalPupil === pupil.id ? 'Saving...' : 'Save Evaluation'}
                      </button>
                    </div>
                  </div>

                  {/* Raw / Scaled score row for the active domain */}
                  <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white border border-[#E6E4DF] text-xs">
                    <span className="font-bold text-[#2F8F8A]">
                      Raw Score: {domainRaw}/{activeDomain.items.length}
                    </span>
                    <span className="text-[#9B9B9B]">•</span>
                    <label className="text-[#6B6B6B] font-semibold">Scaled Score:</label>
                    <input
                      type="number"
                      min={0}
                      max={19}
                      value={scaled}
                      onChange={(e) => {
                        const value = e.target.value;
                        setEccdScores(prev => ({
                          ...prev,
                          [pupil.id]: {
                            ...(prev[pupil.id] || {}),
                            [activeDomain.id]: { raw: domainRaw, scaled: value },
                          },
                        }));
                      }}
                      placeholder="1–19"
                      className="w-16 px-2 py-1 rounded-xl border border-[#E6E4DF] text-xs font-semibold"
                    />
                  </div>

                  <div className="max-h-80 overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      {activeDomain.items.map((item) => {
                        const present = !!pupilRatings[item.id];
                        return (
                          <div key={item.id} className="p-2.5 rounded-2xl bg-white border border-[#E6E4DF] flex items-center justify-between gap-2">
                            <span className="text-[11px] text-[#2B2B2B] font-semibold truncate flex-1" title={item.procedure || item.description}>
                              {item.number}. {item.description}
                            </span>
                            <button
                              onClick={() => handleToggleECCDItem(pupil.id, item.id)}
                              className={`w-8 h-8 rounded-xl text-sm font-extrabold cursor-pointer border-none shrink-0 transition-all ${
                                present
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-gray-100 text-gray-400 hover:bg-emerald-50 hover:text-emerald-600'
                              }`}
                              title={present ? 'Present — tap to clear' : 'Tap to mark present (✓)'}
                              suppressHydrationWarning
                            >
                              ✓
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Official Interpretation Reference */}
          <div className="p-4 rounded-2xl bg-[#FEF8EC] border border-[#F5DAA0] text-[11px] space-y-2">
            <div className="font-bold text-[#8A5D00]">Official Interpretation of Scaled Scores</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {[
                ['1–3', 'Development must be monitored after 3 months'],
                ['4–6', 'Development must be monitored after 6 months'],
                ['7–13', 'Average overall development'],
                ['14–16', 'Slightly advanced development'],
                ['17–19', 'Highly advanced development'],
              ].map(([range, meaning]) => (
                <div key={range} className="flex items-center justify-between gap-2 rounded-xl bg-white border border-[#F5DAA0] px-3 py-1.5">
                  <span className="font-extrabold text-[#8A5D00]">{range}</span>
                  <span className="text-[#6B6B6B]">{meaning}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-[#9B9B9B] m-0 pt-1">
              Raw Score = number of ✓ items. Scaled Score is entered manually from the official
              raw-to-scaled conversion tables (age-based). Standard Score conversion is a future step.
            </p>
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
                  const saved = healthLogs[pupil.id];
                  const draft = healthDrafts[pupil.id] || saved || { weight: '', height: '' };
                  return (
                    <tr key={pupil.id}>
                      <td className="font-bold text-[#2B2B2B]">{pupil.firstName} {pupil.lastName}</td>
                      <td>
                        <input
                          type="text"
                          value={draft.weight}
                          onChange={(e) => setHealthDrafts(prev => ({
                            ...prev,
                            [pupil.id]: { weight: e.target.value, height: draft.height },
                          }))}
                          placeholder="kg"
                          className="w-20 px-2 py-1 rounded-xl border border-[#E6E4DF] text-xs font-semibold"
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          value={draft.height}
                          onChange={(e) => setHealthDrafts(prev => ({
                            ...prev,
                            [pupil.id]: { weight: draft.weight, height: e.target.value },
                          }))}
                          placeholder="cm"
                          className="w-20 px-2 py-1 rounded-xl border border-[#E6E4DF] text-xs font-semibold"
                        />
                      </td>
                      <td>
                        {saved ? (
                          <span className="badge badge-success">Recorded</span>
                        ) : (
                          <span className="badge badge-warning">No log yet</span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => handleSaveHealthLog(pupil, draft.weight, draft.height)}
                          disabled={savingHealthPupil === pupil.id}
                          className="btn btn-secondary btn-sm text-xs"
                        >
                          {savingHealthPupil === pupil.id ? 'Saving...' : 'Save Log'}
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

      {/* ECCD Form Section 2 — Child & Family Background */}
      <ChildBackgroundModal
        isOpen={isBackgroundModalOpen}
        onClose={() => { setIsBackgroundModalOpen(false); setBackgroundPupil(null); }}
        onSave={handleSaveBackground}
        initial={backgroundPupil ? backgrounds[backgroundPupil.id] ?? null : null}
        childName={backgroundPupil ? `${backgroundPupil.firstName} ${backgroundPupil.lastName}` : undefined}
      />

      {/* ECCD Pupil Evaluation Report — PDF / print after grading */}
      <ECCDReportModal
        isOpen={!!reportPupil}
        onClose={() => setReportPupil(null)}
        pupil={reportPupil}
      />

      {/* Verify Enrollment Confirmation */}
      {isVerifyModalOpen && verifyPupilRecord && verifyAction && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn" suppressHydrationWarning>
          <div className="bg-white rounded-3xl shadow-2xl border border-[#E6E4DF] w-full max-w-md p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                  verifyAction === 'approve' ? 'bg-[#EBF5F4] text-[#2F8F8A]' : 'bg-[#FFEBEE] text-[#D32F2F]'
                }`}>
                  {verifyAction === 'approve' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#2B2B2B] m-0">
                    {verifyAction === 'approve' ? 'Approve enrollment?' : 'Reject enrollment?'}
                  </h3>
                  <p className="text-xs text-[#6B6B6B] m-0">
                    {verifyPupilRecord.firstName} {verifyPupilRecord.lastName} ({verifyPupilRecord.id})
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setIsVerifyModalOpen(false); setVerifyPupilRecord(null); setVerifyAction(null); setRejectReason(''); }}
                className="p-2 rounded-full text-[#9B9B9B] hover:bg-[#FAF8F5] hover:text-[#2B2B2B] border-none bg-transparent cursor-pointer transition-all"
                suppressHydrationWarning
              >
                <X size={20} />
              </button>
            </div>

            {verifyAction === 'approve' ? (
              <p className="text-xs text-[#4A4A4A] leading-relaxed m-0 bg-[#EBF5F4] border border-[#B7DDDA] rounded-2xl p-3">
                The child becomes <strong>enrolled</strong> and the parent is notified. Their
                sociodemographic profile stays attached to the pupil record.
              </p>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#2B2B2B]">Reason for rejection *</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="e.g. Missing birth certificate; please contact the daycare to complete the profile."
                  className="w-full px-3 py-2.5 rounded-2xl border border-[#E6E4DF] bg-[#FAF8F5] text-sm text-[#2B2B2B] outline-none focus:border-[#D32F2F] focus:ring-2 focus:ring-[#D32F2F]/20 transition-all resize-y"
                />
                <p className="text-[10px] text-[#9B9B9B] m-0">
                  The parent will see this reason in their portal.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E6E4DF]">
              <button
                onClick={() => { setIsVerifyModalOpen(false); setVerifyPupilRecord(null); setVerifyAction(null); setRejectReason(''); }}
                className="px-4 py-2 rounded-2xl text-xs font-bold text-[#6B6B6B] bg-[#FAF8F5] hover:bg-[#EAE6DF] border-none cursor-pointer transition-all"
                suppressHydrationWarning
              >
                Cancel
              </button>
              <button
                onClick={handleVerify}
                className={`px-4 py-2 rounded-2xl text-xs font-bold text-white border-none cursor-pointer shadow-md transition-all flex items-center gap-1.5 ${
                  verifyAction === 'approve'
                    ? 'bg-[#2F8F8A] hover:bg-[#1D605D]'
                    : 'bg-[#D32F2F] hover:bg-[#B71C1C]'
                }`}
                suppressHydrationWarning
              >
                {verifyAction === 'approve' ? <CheckCircle2 size={14} /> : <X size={14} />}
                {verifyAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
