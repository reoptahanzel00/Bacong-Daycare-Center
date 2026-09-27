'use client';

import React, { useState, useMemo } from 'react';
import { useEffect } from 'react';
import { 
  CheckCircle2, 
  Plus, 
  Edit3, 
  Archive, 
  TrendingUp, 
  FileText, 
  Eye,
  BellRing,
  BookOpen,
  MessageSquare,
  CheckCircle,
  ShieldCheck,
  X,
  AlertTriangle,
  FileDown,
  Users,
  RotateCcw,
  HeartPulse,
  FileCheck2,
  FileWarning,
  Clock,
} from 'lucide-react';
import PupilAvatar from '@/components/PupilAvatar';
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
import { fetchParentNotes, reviewParentNote, excuseLabel, type ParentNoteRow } from '@/services/parentNotesService';
import { enrollmentAgeError, RETURN_REASONS } from '@/lib/enrollment';
import { fetchAttendance } from '@/services/attendanceService';
import ChildBackgroundModal from '@/components/ChildBackgroundModal';
import ECCDReportModal from '@/components/ECCDReportModal';
import { verifyPupil } from '@/services/pupilService';
import { useDaycare, type MockPupil, type MockAttendance, type MockProgress } from '@/contexts/DaycareContext';
import { todayLocalISO, formatLocalTimestamp } from '@/lib/dates';
import { errorText } from '@/lib/apiError';

interface WorkerViewProps {
  activeTab: string;
  pupils: MockPupil[];
  attendance: MockAttendance[];
  progress: MockProgress[];
  searchQuery: string;
  onOpenPupilModal: () => void;
  onOpenProgressModal: () => void;
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
  searchQuery,
  onOpenPupilModal,
  onOpenProgressModal,
  onOpenDSWDReportModal,
  onSaveAttendance,
  onArchivePupil,
  onEditPupil
}: WorkerViewProps) {
  const { showToast, updatePupilEnrollment, handleRestorePupil } = useDaycare();

  const [selectedDate, setSelectedDate] = useState(todayLocalISO());
  const [selectedDomainId, setSelectedDomainId] = useState('gross_motor');
  const [selectedPupilDetail, setSelectedPupilDetail] = useState<MockPupil | null>(null);
  const [archiveTargetPupil, setArchiveTargetPupil] = useState<MockPupil | null>(null);
  const [backgrounds, setBackgrounds] = useState<Record<string, ChildBackground | null>>({});
  const [backgroundPupil, setBackgroundPupil] = useState<MockPupil | null>(null);
  const [isBackgroundModalOpen, setIsBackgroundModalOpen] = useState(false);
  const [verifyPupilRecord, setVerifyPupilRecord] = useState<MockPupil | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  // Standard reasons ticked in the return dialog; rejectReason is the "Other" text.
  const [returnReasons, setReturnReasons] = useState<string[]>([]);
  // The enrollment whose decision is in flight: its buttons are disabled so a
  // double-click cannot send two decisions.
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  // Approved during this session: kept on the verify tab with a green,
  // non-clickable ENROLLED badge so the worker sees the result of the click.
  const [justApprovedIds, setJustApprovedIds] = useState<string[]>([]);
  // Pupils with a birth certificate on file (verify queue flags).
  const [docsOnFile, setDocsOnFile] = useState<Set<string> | null>(null);
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [verifyAction, setVerifyAction] = useState<'approve' | 'reject' | null>(null);

  // ECCD checklist state: ✓ (present) per item, per pupil, per round.
  const [selectedRound, setSelectedRound] = useState<EccdRound>(1);
  const [evaluations, setEvaluations] = useState<Record<string, Record<string, boolean>>>({});
  const [eccdScores, setEccdScores] = useState<Record<string, Record<string, { raw: number; scaled?: string }>>>({});
  // The form's Comments column (per pupil, per item) and Standard Score (per pupil) for the round.
  const [eccdComments, setEccdComments] = useState<Record<string, Record<string, string>>>({});
  const [standardScores, setStandardScores] = useState<Record<string, string>>({});
  const [openCommentKey, setOpenCommentKey] = useState<string | null>(null);
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

      const commentMap: Record<string, Record<string, string>> = {};
      for (const row of ratingsRes.ok ? ratingsRes.comments : []) {
        if (!commentMap[row.pupil_id]) commentMap[row.pupil_id] = {};
        commentMap[row.pupil_id][row.milestone_code] = row.comment;
      }
      setEccdComments(commentMap);

      const standardMap: Record<string, string> = {};
      for (const row of scoresRes.ok ? scoresRes.evaluations : []) {
        if (row.standard_score != null) standardMap[row.pupil_id] = String(row.standard_score);
      }
      setStandardScores(standardMap);
      setOpenCommentKey(null);

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
    status: ParentNoteRow['status'];
    /** "Excuse 1", "Excuse 2", ... — the same label the parent sees. */
    label: string;
    submittedAt: string;
  }

  // The inbox is held as the raw rows it arrived as, and pupil names are
  // resolved at render time. Resolving them inside the effect made the effect
  // depend on `pupils`, so the inbox was refetched on every roster change -
  // and each refetch discarded any acknowledgement made since it loaded.
  const [inboxRows, setInboxRows] = useState<ParentNoteRow[]>([]);
  const [noteDecisions, setNoteDecisions] = useState<Record<string, 'approved' | 'declined'>>({});

  // Load the real parent-notes inbox once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const notesRes = await fetchParentNotes();
      if (cancelled) return;
      if (notesRes.ok) setInboxRows(notesRes.notes);
    })();
    return () => { cancelled = true; };
  }, []);

  const inboxNotes: ParentNote[] = useMemo(
    () => inboxRows.map((row) => {
      const p = pupils.find(x => x.id === row.pupil_id);
      return {
        id: row.id,
        pupilId: row.pupil_id,
        pupilName: p ? `${p.firstName} ${p.lastName}` : row.pupil_id,
        date: row.note_date,
        reason: row.reason,
        notes: row.notes,
        phone: row.phone || '',
        status: noteDecisions[row.id] ?? row.status,
        label: excuseLabel(row),
        submittedAt: formatLocalTimestamp(row.submitted_at),
      };
    }),
    [inboxRows, pupils, noteDecisions]
  );

  const enrolledPupils = useMemo(
    () => pupils.filter(p => p.enrollmentStatus === 'enrolled'),
    [pupils]
  );

  // Re-runs on every keystroke in the header search, so it builds the haystack
  // once per pupil per query rather than per pupil per render.
  const filteredEnrolledPupils = useMemo(() => {
    const needle = searchQuery.toLowerCase();
    if (!needle) return enrolledPupils;
    return enrolledPupils.filter(p =>
      `${p.firstName} ${p.lastName} ${p.id} ${p.guardian?.fullName}`
        .toLowerCase()
        .includes(needle)
    );
  }, [enrolledPupils, searchQuery]);

  // The saved register for the selected date, fetched for that date alone.
  //
  // The `attendance` prop carries only the newest 500 rows across the whole
  // roster - about twelve school days for a full class - so any date older
  // than that is simply missing from it. getAttendanceStatus would then report
  // every pupil as Present for that day, and saving would upsert a full class
  // of falsified 'present' marks over the register actually on file.
  // Without a configured backend there is no stored register to load and
  // nothing that could be overwritten, so the prop fallback is the whole story.
  const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL;
  const [savedRegister, setSavedRegister] = useState<Record<string, { status: string; notes?: string }> | null>(null);
  // Starts true so the very first render is already treated as 'not loaded
  // yet' rather than as a register that came back empty.
  const [isRegisterLoading, setIsRegisterLoading] = useState(!isDemoMode);

  useEffect(() => {
    if (isDemoMode) return;
    let cancelled = false;
    (async () => {
      const res = await fetchAttendance({ date: selectedDate });
      if (cancelled) return;
      if (res.ok) {
        const map: Record<string, { status: string; notes?: string }> = {};
        for (const row of res.records) map[row.pupil_id] = { status: row.status, notes: row.notes };
        setSavedRegister(map);
      }
      setIsRegisterLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedDate, isDemoMode]);

  const getAttendanceStatus = (pupilId: string) => {
    const saved = savedRegister?.[pupilId];
    if (saved) return saved;
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
    // Never save a register that was rendered from defaults: if the day's saved
    // rows have not arrived, every pupil the worker did not touch would be
    // written as Present over whatever is really on file for that date.
    if (!isDemoMode && (isRegisterLoading || savedRegister === null)) {
      showToast(
        isRegisterLoading
          ? `Still loading the register for ${selectedDate} — please wait a moment.`
          : `The register for ${selectedDate} could not be loaded, so it cannot be saved safely. Check your connection and reselect the date.`,
        'danger'
      );
      return;
    }

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

  const handleReviewParentNote = async (note: ParentNote, decision: 'approved' | 'declined') => {
    // Optimistic, then rolled back if the server did not take it, so the
    // worker is never told the parent was answered when nothing was recorded.
    setNoteDecisions(prev => ({ ...prev, [note.id]: decision }));
    const res = await reviewParentNote(note.id, decision);
    if (res.success) {
      showToast(
        `${note.label} for ${note.pupilName} ${decision === 'approved' ? 'approved' : 'declined'}.`,
        decision === 'approved' ? 'success' : 'info'
      );
    } else {
      setNoteDecisions(prev => {
        const next = { ...prev };
        delete next[note.id];
        return next;
      });
      showToast(errorText(res.error, `Could not update ${note.label} — check your connection and try again.`), 'danger');
    }
  };

  const handleToggleECCDItem = (pupilId: string, itemId: string) => {
    setEvaluations(prev => {
      const pupilMap = { ...(prev[pupilId] || {}) };
      pupilMap[itemId] = !pupilMap[itemId];
      return { ...prev, [pupilId]: pupilMap };
    });
  };

  const handleEccdCommentChange = (pupilId: string, itemId: string, comment: string) => {
    setEccdComments(prev => ({ ...prev, [pupilId]: { ...(prev[pupilId] || {}), [itemId]: comment } }));
  };

  const handleSaveEvaluation = async (pupil: MockPupil) => {
    const pupilRatings = evaluations[pupil.id] || {};
    const pupilComments = eccdComments[pupil.id] || {};
    const ratings = ECCD_DOMAINS.flatMap((d) =>
      d.items.map((i) => ({
        milestone_code: i.id,
        domain_id: d.id,
        present: !!pupilRatings[i.id],
        comment: pupilComments[i.id]?.trim() || undefined,
      }))
    );

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
    const standardRaw = standardScores[pupil.id]?.trim();
    await saveEccdScores(pupil.id, selectedRound, scores, standardRaw ? Number(standardRaw) : null);

    setSavingEvalPupil(null);
    if (res.success) {
      const presentCount = ratings.filter((r) => r.present).length;
      showToast(`Saved ${presentCount} ✓ item(s) for ${pupil.firstName} (round ${selectedRound}).`);
      // Auto-open the pupil's ECCD Child's Record 2 after grading is saved.
      setReportPupil(pupil);
    } else {
      showToast(`Could not save evaluation: ${errorText(res.error, 'unknown error')}`, 'danger');
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
    } else {
      showToast(errorText(res.error, 'Could not save background info.'), 'danger');
    }
    setIsBackgroundModalOpen(false);
    setBackgroundPupil(null);
  };

  const pendingPupils = useMemo(
    () => pupils
      .filter(p => p.enrollmentStatus === 'pending' || (p.enrollmentStatus === 'enrolled' && justApprovedIds.includes(p.id)))
      // Oldest submission first: the queue is first come, first served.
      .sort((a, b) => (a.submittedAt || a.enrollmentDate || '').localeCompare(b.submittedAt || b.enrollmentDate || '')),
    [pupils, justApprovedIds]
  );
  const rejectedPupils = useMemo(
    () => pupils.filter(p => p.enrollmentStatus === 'rejected'),
    [pupils]
  );
  const archivedPupils = useMemo(
    () => pupils
      .filter(p => p.enrollmentStatus === 'archived')
      .sort((a, b) => (b.archivedAt || '').localeCompare(a.archivedAt || '')),
    [pupils]
  );

  // Which queued children have a birth certificate on file.
  const queueIdsKey = [...pendingPupils, ...rejectedPupils].map(p => p.id).sort().join(',');
  useEffect(() => {
    if (activeTab !== 'verify' || !queueIdsKey) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/pupils/documents?pupil_ids=${encodeURIComponent(queueIdsKey)}`, { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled && res.ok) setDocsOnFile(new Set<string>(data.withBirthCert || []));
      } catch {
        // Leave the flags unknown rather than claiming a document is missing.
      }
    })();
    return () => { cancelled = true; };
  }, [activeTab, queueIdsKey]);

  const openBirthCert = async (pupil: MockPupil) => {
    // Opened before the fetch so a popup blocker treats it as the user's click.
    // Not 'noopener' in the features: with it window.open returns null and the
    // tab could never be pointed at the file. The opener is cut by hand instead.
    const win = window.open('', '_blank');
    if (win) win.opener = null;
    try {
      const res = await fetch(`/api/pupils/documents?pupil_id=${encodeURIComponent(pupil.id)}`, { cache: 'no-store' });
      const data = await res.json();
      if (data.url && win) {
        win.location.href = data.url;
        return;
      }
      win?.close();
      showToast(`No birth certificate on file for ${pupil.firstName}.`, 'danger');
    } catch {
      win?.close();
      showToast('Could not open the birth certificate.', 'danger');
    }
  };

  const openVerifyModal = (pupil: MockPupil, action: 'approve' | 'reject') => {
    setVerifyPupilRecord(pupil);
    setVerifyAction(action);
    setRejectReason('');
    // Pre-tick the reasons the record itself shows, so the worker sees why.
    const suggested: string[] = [];
    if (docsOnFile && !docsOnFile.has(pupil.id)) suggested.push(RETURN_REASONS[0]);
    if (enrollmentAgeError(pupil.birthDate, todayLocalISO())) suggested.push(RETURN_REASONS[1]);
    setReturnReasons(action === 'reject' ? suggested : []);
    setIsVerifyModalOpen(true);
  };

  const closeVerifyModal = () => {
    setIsVerifyModalOpen(false);
    setVerifyPupilRecord(null);
    setVerifyAction(null);
    setRejectReason('');
    setReturnReasons([]);
  };

  const handleVerify = async () => {
    if (!verifyPupilRecord || !verifyAction || verifyingId) return;
    const reason = [...returnReasons, rejectReason.trim()].filter(Boolean).join('; ');
    if (verifyAction === 'reject' && !reason) {
      showToast('Tick at least one reason (or write one) so the parent knows what to correct.', 'danger');
      return;
    }
    const pupil = verifyPupilRecord;
    setVerifyingId(pupil.id);
    closeVerifyModal();
    const res = await verifyPupil(pupil.id, verifyAction, reason || undefined);
    setVerifyingId(null);
    if (res.success) {
      updatePupilEnrollment(pupil.id, verifyAction === 'approve' ? 'enrolled' : 'rejected', reason || null);
      if (verifyAction === 'approve') setJustApprovedIds(prev => [...prev, pupil.id]);
      showToast(
        verifyAction === 'approve'
          ? `${pupil.firstName} ${pupil.lastName} is now enrolled.`
          : `Enrollment for ${pupil.firstName} ${pupil.lastName} was returned to the parent for correction.`,
        verifyAction === 'approve' ? 'success' : 'info'
      );
    } else {
      showToast(errorText(res.error, 'Could not verify this enrollment.'), 'danger');
    }
  };

  const presentCount = enrolledPupils.filter(p => displayedStatus(p.id) === 'present').length;
  const lateCount = enrolledPupils.filter(p => displayedStatus(p.id) === 'late').length;
  const absentCount = enrolledPupils.filter(p => displayedStatus(p.id) === 'absent').length;

  const activeDomain = ECCD_DOMAINS.find(d => d.id === selectedDomainId) || ECCD_DOMAINS[0];

  return (
    <div className="space-y-6 pb-12" suppressHydrationWarning>
      
      {/* Top Banner Action Bar */}
      <div className="card bg-gradient-to-br from-primary-display to-primary-hover text-white p-6 rounded-3xl shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-white m-0 tracking-tight">
              Barangay Bacong ECCD Daily Operations
            </h2>
            <p className="text-xs md:text-sm text-white/90 mt-1.5 leading-relaxed max-w-2xl m-0">
              Mark daily attendance registers, evaluate {ECCD_TOTAL_ITEMS} DepEd ECCD milestones, and review parent absence notes.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenPupilModal}
              className="btn btn-secondary btn-sm bg-white text-primary font-bold border-none"
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
          <div className="card bg-warn-light border border-warn-border p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-warn-fill text-warn flex items-center justify-center font-bold shrink-0">
                  <BellRing size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-warn m-0">Daily Attendance Register • {selectedDate}</h4>
                  <div className="text-xs text-ink-muted mt-0.5">
                    <strong className="text-primary">{presentCount} Present</strong> • {lateCount} Late • {absentCount} Absent Today
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
                  aria-label="Attendance register date"
                  value={selectedDate}
                  max={todayLocalISO()}
                  onChange={(e) => {
                    // A register records what happened; a day that has not
                    // come yet cannot be marked.
                    if (e.target.value > todayLocalISO()) {
                      showToast('Attendance cannot be recorded for a future date.', 'danger');
                      return;
                    }
                    setSelectedDate(e.target.value);
                    // Reset the edit overlay so the register reflects saved records.
                    setDailyAttendanceState({});
                    // Drop the previous day's saved register in the same event
                    // that changes the date. Clearing it in the effect instead
                    // would leave one painted frame showing the old day's marks
                    // under the new date - and saving during that frame would
                    // copy them onto it.
                    if (!isDemoMode) {
                      setSavedRegister(null);
                      setIsRegisterLoading(true);
                    }
                  }}
                  className="px-3 py-1.5 rounded-full border border-line bg-white text-xs font-semibold focus:outline-none"
                  suppressHydrationWarning
                />
                <button
                  onClick={handleSaveRegister}
                  disabled={!isDemoMode && isRegisterLoading}
                  className="btn btn-primary btn-sm font-bold shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                  suppressHydrationWarning
                >
                  <CheckCircle2 size={16} />
                  <span>{!isDemoMode && isRegisterLoading ? 'Loading register…' : 'Save Today Register'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="card bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-ink m-0">Daily Register Checklist</h3>
                  <span className="text-xs text-ink-muted">Segmented status toggles for day log</span>
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
                              <PupilAvatar src={pupil.avatar} firstName={pupil.firstName} lastName={pupil.lastName} size={36} className="rounded-full" />
                              <div>
                                <div className="font-bold text-ink">{pupil.firstName} {pupil.lastName}</div>
                                <span className="text-[10px] text-ink-subtle">{pupil.id}</span>
                              </div>
                            </div>
                          </td>
                          <td className="text-xs text-ink-muted">{pupil.guardian?.fullName}</td>
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
          </div>
        </>
      )}

      {/* 2. Enrolled Pupils Tab */}
      {(activeTab === 'pupils' || activeTab === 'roster') && (
        <div className="card bg-white p-5 space-y-4">
          {/* Enrolled counts: boys, girls and children with special needs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" aria-label="Enrollment counts">
            {[
              { label: 'Total Enrolled', value: enrolledPupils.length, icon: Users, cls: 'text-primary bg-primary-light' },
              { label: 'Boys', value: enrolledPupils.filter(p => p.sex === 'Male').length, icon: Users, cls: 'text-accent-blue bg-accent-blue-light' },
              { label: 'Girls', value: enrolledPupils.filter(p => p.sex === 'Female').length, icon: Users, cls: 'text-accent-coral-strong bg-accent-coral-light' },
              { label: 'Children with Special Needs', value: enrolledPupils.filter(p => p.hasSpecialNeeds).length, icon: HeartPulse, cls: 'text-warn bg-warn-light' },
            ].map(({ label, value, icon: Icon, cls }) => (
              <div key={label} className="p-3.5 rounded-2xl border border-line bg-canvas flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${cls}`}>
                  <Icon size={18} />
                </div>
                <div className="min-w-0">
                  <div className="text-xl font-extrabold text-ink leading-none">{value}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted mt-1">{label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-ink m-0">Enrolled Pupil Roster</h3>
              <span className="text-xs text-ink-muted">Showing {filteredEnrolledPupils.length} active daycare pupils</span>
            </div>
            <button onClick={onOpenPupilModal} className="btn btn-primary btn-sm font-bold" suppressHydrationWarning>
              <Plus size={16} />
              <span>Enroll New Pupil</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredEnrolledPupils.map((pupil) => (
              <div key={pupil.id} className="p-4 rounded-3xl border border-line bg-white hover:-translate-y-1 transition-all space-y-3 shadow-sm">
                <div className="flex items-start gap-3">
                  <PupilAvatar src={pupil.avatar} firstName={pupil.firstName} lastName={pupil.lastName} size={48} className="rounded-2xl" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="badge badge-primary">{pupil.id}</span>
                      <span className="badge badge-enrolled font-bold">ENROLLED</span>
                    </div>
                    <h4 className="text-sm font-bold text-ink m-0 mt-1 truncate">{pupil.firstName} {pupil.middleName ? `${pupil.middleName} ` : ''}{pupil.lastName}</h4>
                    <span className="text-[11px] text-ink-muted">{pupil.sex} • Born: {pupil.birthDate}</span>
                    {(pupil.hasSpecialNeeds || pupil.healthConditions) && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {pupil.hasSpecialNeeds && <span className="badge badge-warning text-[10px]">Special needs</span>}
                        {pupil.healthConditions && <span className="badge badge-danger text-[10px]">Health condition</span>}
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-2.5 rounded-2xl bg-canvas border border-line text-xs space-y-1">
                  <div><strong className="text-ink">Guardian:</strong> {pupil.guardian?.fullName} ({pupil.guardian?.relationship})</div>
                  <div><strong className="text-ink">Phone:</strong> {pupil.guardian?.phone}</div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-line">
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
                      className="p-2 rounded-xl text-ink-muted hover:bg-[#F5F3EF] border-none bg-transparent cursor-pointer"
                      title="Edit Profile"
                      suppressHydrationWarning
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      onClick={() => setArchiveTargetPupil(pupil)}
                      className="p-2 rounded-xl text-danger hover:bg-danger-light border-none bg-transparent cursor-pointer"
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
              <ShieldCheck size={18} className="text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Enrollment Verification
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-ink m-0">Parent-Submitted Child Profiles</h3>
            <p className="text-xs text-ink-muted mt-1 m-0">
              Parents submitted these profiles (ECCD Form Section 1) at account creation. Approve
              when the birth certificate is on file and the child is within the enrollment age.
              Otherwise <strong>return</strong> it with the reason: the parent keeps their account,
              sees it as pending, corrects it and resubmits.
            </p>
          </div>

          {pendingPupils.length === 0 ? (
            <div className="p-6 rounded-3xl bg-primary-light border border-dashed border-primary-display/30 text-center">
              <CheckCircle size={28} className="text-primary mx-auto mb-2" />
              <p className="text-sm font-bold text-primary m-0">No pending enrollments</p>
              <p className="text-xs text-ink-muted m-0 mt-1">
                New parent-submitted profiles will appear here for verification.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingPupils.map((pupil) => {
                const profile = pupil.sociodemographic;
                const isApproved = pupil.enrollmentStatus === 'enrolled';
                const isBusy = verifyingId === pupil.id;
                const ageProblem = enrollmentAgeError(pupil.birthDate, todayLocalISO());
                const hasDoc = docsOnFile ? docsOnFile.has(pupil.id) : null;
                return (
                  <div key={pupil.id} className={`p-4 rounded-3xl border space-y-3 ${
                    isApproved ? 'border-[#A5D6A7] bg-[#F4FBF4]' : 'border-line bg-canvas'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <PupilAvatar src={pupil.avatar} firstName={pupil.firstName} lastName={pupil.lastName} size={48} className="rounded-2xl" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="badge badge-warning">{pupil.id}</span>
                            {isApproved
                              ? <span className="badge badge-enrolled font-bold">ENROLLED</span>
                              : <span className="badge badge-primary">Pending</span>}
                            {(pupil.resubmissionCount ?? 0) > 0 && (
                              <span className="badge badge-warning text-[10px]">
                                <RotateCcw size={10} className="inline mr-0.5" />Resubmitted ×{pupil.resubmissionCount}
                              </span>
                            )}
                          </div>
                          <h4 className="text-sm font-bold text-ink m-0 mt-1">
                            {pupil.firstName} {pupil.middleName ? `${pupil.middleName} ` : ''}{pupil.lastName}
                          </h4>
                          <span className="text-[11px] text-ink-muted">
                            {pupil.sex} • Born: {pupil.birthDate}
                          </span>
                          <div className="text-[11px] text-ink-soft font-semibold flex items-center gap-1 mt-0.5">
                            <Clock size={11} />
                            Enrolled by parent: {pupil.submittedAt ? formatLocalTimestamp(pupil.submittedAt) : (pupil.enrollmentDate || '—')}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {isApproved ? (
                          // Decided: nothing left to click.
                          <span
                            className="px-4 py-2 rounded-full text-xs font-extrabold flex items-center gap-1.5 bg-[#2E7D32] text-white cursor-default select-none"
                            aria-disabled="true"
                          >
                            <CheckCircle2 size={14} /> ENROLLED
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => openVerifyModal(pupil, 'approve')}
                              disabled={isBusy}
                              className="btn btn-primary btn-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed"
                              suppressHydrationWarning
                            >
                              <CheckCircle2 size={14} />
                              {isBusy ? 'Saving…' : 'Approve'}
                            </button>
                            <button
                              onClick={() => openVerifyModal(pupil, 'reject')}
                              disabled={isBusy}
                              className="btn btn-secondary btn-sm font-bold text-danger disabled:opacity-60 disabled:cursor-not-allowed"
                              suppressHydrationWarning
                            >
                              <RotateCcw size={14} />
                              Return to Parent
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* The checks that decide approve vs. return, at a glance */}
                    {!isApproved && (
                      <div className="flex flex-wrap gap-2 text-[11px] font-bold">
                        <span className={`px-2.5 py-1 rounded-full flex items-center gap-1 ${ageProblem ? 'bg-danger-light text-danger' : 'bg-[#E8F5E9] text-[#1B5E20]'}`}>
                          {ageProblem ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
                          {ageProblem ? 'Age not within 3y 1m – 5y' : 'Age OK'}
                        </span>
                        {hasDoc === null ? (
                          <span className="px-2.5 py-1 rounded-full bg-canvas text-ink-muted border border-line">Checking documents…</span>
                        ) : hasDoc ? (
                          <button
                            type="button"
                            onClick={() => openBirthCert(pupil)}
                            className="px-2.5 py-1 rounded-full flex items-center gap-1 bg-[#E8F5E9] text-[#1B5E20] border-none cursor-pointer hover:underline"
                          >
                            <FileCheck2 size={12} /> View birth certificate
                          </button>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full flex items-center gap-1 bg-danger-light text-danger">
                            <FileWarning size={12} /> Missing birth certificate
                          </span>
                        )}
                      </div>
                    )}

                    {(pupil.healthConditions || pupil.hasSpecialNeeds) && (
                      <div className="p-3 rounded-2xl bg-warn-light border border-warn-border text-xs space-y-1">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-warn flex items-center gap-1">
                          <HeartPulse size={12} /> Health &amp; Special Needs
                        </div>
                        {pupil.healthConditions && <div><strong className="text-ink">Illness / condition:</strong> {pupil.healthConditions}</div>}
                        {pupil.hasSpecialNeeds && <div><strong className="text-ink">Special needs:</strong> {pupil.specialNeedsDetails || 'Yes'}</div>}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-2xl bg-white border border-line space-y-1">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-primary">Guardian</div>
                        <div><strong className="text-ink">Name:</strong> {pupil.guardian?.fullName || '—'} ({pupil.guardian?.relationship || '—'})</div>
                        <div><strong className="text-ink">Phone:</strong> {pupil.guardian?.phone || '—'}</div>
                        <div><strong className="text-ink">Address:</strong> {pupil.address || '—'}</div>
                      </div>
                      <div className="p-3 rounded-2xl bg-white border border-line space-y-1">
                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-primary">Sociodemographic Profile</div>
                        <div>
                          <strong className="text-ink">Handedness:</strong>{' '}
                          {profile?.handedness ? profile.handedness.replace(/_/g, ' ') : '—'}
                        </div>
                        <div>
                          <strong className="text-ink">Currently studying:</strong>{' '}
                          {profile?.currently_studying ? 'Yes' : 'No'}
                          {profile?.currently_studying && profile?.school_name ? ` — ${profile.school_name}` : ''}
                        </div>
                        <div>
                          <strong className="text-ink">Address parts:</strong>{' '}
                          {[profile?.barangay, profile?.municipality, profile?.province, profile?.region]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </div>
                      </div>
                    </div>

                    <details className="text-[11px]">
                      <summary className="cursor-pointer font-bold text-primary">Parent &amp; sibling details</summary>
                      <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-soft">
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
            <div className="pt-3 border-t border-line space-y-2">
              <div>
                <h4 className="text-sm font-extrabold text-ink m-0">
                  Returned to Parent: Awaiting Correction ({rejectedPupils.length})
                </h4>
                <p className="text-[11px] text-ink-muted m-0">
                  The parent sees these as pending and can resubmit. A resubmission moves the
                  child back to the queue above.
                </p>
              </div>
              <div className="overflow-x-auto rounded-2xl border border-line">
                <table className="w-full text-xs">
                  <thead className="bg-canvas text-left text-[10px] uppercase tracking-wider text-ink-muted">
                    <tr>
                      <th scope="col" className="px-3 py-2">Child</th>
                      <th scope="col" className="px-3 py-2">Enrolled by parent</th>
                      <th scope="col" className="px-3 py-2">Returned</th>
                      <th scope="col" className="px-3 py-2">Reason</th>
                      <th scope="col" className="px-3 py-2">Birth cert.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rejectedPupils.map((pupil) => (
                      <tr key={pupil.id} className="border-t border-line align-top">
                        <td className="px-3 py-2">
                          <div className="font-bold text-ink">{pupil.firstName} {pupil.lastName}</div>
                          <div className="text-[10px] text-ink-subtle">{pupil.id}</div>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">{pupil.submittedAt ? formatLocalTimestamp(pupil.submittedAt) : (pupil.enrollmentDate || '—')}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{pupil.verifiedAt ? formatLocalTimestamp(pupil.verifiedAt) : '—'}</td>
                        <td className="px-3 py-2 text-ink-soft">{pupil.rejectionReason || '—'}</td>
                        <td className="px-3 py-2">
                          {docsOnFile === null ? '…' : docsOnFile.has(pupil.id)
                            ? <span className="text-[#1B5E20] font-bold">On file</span>
                            : <span className="text-danger font-bold">Missing</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3b. Archived Pupils: the last panel */}
      {activeTab === 'archived' && (
        <div className="card bg-white p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Archive size={18} className="text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Records Archive</span>
              </div>
              <h3 className="text-lg font-extrabold text-ink m-0">Archived Pupils</h3>
              <p className="text-xs text-ink-muted mt-1 m-0">
                Soft-archived records are kept here, not deleted. Restore a pupil to return them to the active roster.
              </p>
            </div>
            <span className="badge badge-primary font-bold shrink-0">{archivedPupils.length} archived</span>
          </div>

          {archivedPupils.length === 0 ? (
            <div className="p-6 rounded-3xl bg-canvas border border-dashed border-line text-center text-xs text-ink-muted">
              No archived pupils.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full text-xs">
                <thead className="bg-canvas text-left text-[10px] uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th scope="col" className="px-3 py-2">Pupil</th>
                    <th scope="col" className="px-3 py-2">Sex</th>
                    <th scope="col" className="px-3 py-2">Guardian</th>
                    <th scope="col" className="px-3 py-2">Archived</th>
                    <th scope="col" className="px-3 py-2"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {archivedPupils.map((pupil) => (
                    <tr key={pupil.id} className="border-t border-line">
                      <td className="px-3 py-2">
                        <div className="font-bold text-ink">{pupil.firstName} {pupil.lastName}</div>
                        <div className="text-[10px] text-ink-subtle">{pupil.id}</div>
                      </td>
                      <td className="px-3 py-2">{pupil.sex}</td>
                      <td className="px-3 py-2">{pupil.guardian?.fullName || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {pupil.archivedAt ? formatLocalTimestamp(pupil.archivedAt) : '—'}
                        {pupil.archiveReason ? <div className="text-[10px] text-ink-subtle">{pupil.archiveReason}</div> : null}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => handleRestorePupil(pupil.id)}
                          className="btn btn-secondary btn-sm font-bold"
                        >
                          <RotateCcw size={14} />
                          <span>Restore</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                <BookOpen size={18} className="text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Official ECCD Evaluation Suite
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-ink m-0">
                {ECCD_TOTAL_ITEMS}-Item Official ECCD Evaluation Checklist
              </h3>
              <p className="text-xs text-ink-muted mt-1 m-0">
                Check (✓) the skills the pupil demonstrates. Absence is left unchecked.
                Administered once a year per official DepEd ECCD procedure.
              </p>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              {/* Evaluation Round Selector */}
              <div className="flex items-center gap-1.5 p-1.5 bg-canvas border border-line rounded-2xl">
                {([1, 2, 3] as EccdRound[]).map((round) => (
                  <button
                    key={round}
                    type="button"
                    onClick={() => setSelectedRound(round)}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer border-none ${
                      selectedRound === round
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-ink-muted hover:text-ink'
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
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-canvas text-ink-muted hover:bg-line-strong'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dom.color }}></span>
                  <span>{dom.shortLabel}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-line-strong text-ink-muted'}`}>
                    {dom.items.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Evaluation Roster */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-bold text-ink m-0">
                {activeDomain.label} ({activeDomain.items.length} Items)
                <span className="ml-2 text-[11px] font-semibold text-ink-subtle">
                  Round {selectedRound === 1 ? '1st' : selectedRound === 2 ? '2nd' : '3rd'} Assessment
                </span>
              </h4>
              <span className="text-[11px] text-ink-subtle font-semibold">
                Tap ✓ when the child demonstrates the skill
              </span>
            </div>
            {enrolledPupils.map((pupil) => {
              const pupilRatings = evaluations[pupil.id] || {};
              const domainRaw = activeDomain.items.filter((i) => pupilRatings[i.id]).length;
              const totalRated = Object.values(pupilRatings).filter(Boolean).length;
              const scaled = eccdScores[pupil.id]?.[activeDomain.id]?.scaled ?? '';
              return (
                <div key={pupil.id} className="p-4 rounded-3xl border border-line bg-canvas space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <PupilAvatar src={pupil.avatar} firstName={pupil.firstName} lastName={pupil.lastName} size={36} className="rounded-full" />
                      <div>
                        <div className="font-bold text-ink text-sm">{pupil.firstName} {pupil.lastName}</div>
                        <span className="text-[10px] text-ink-subtle">{pupil.id}</span>
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
                        title="Preview and download the ECCD Child's Record 2 (Word)"
                        suppressHydrationWarning
                      >
                        <FileDown size={14} />
                        <span>ECCD Record</span>
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
                  <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white border border-line text-xs">
                    <span className="font-bold text-primary">
                      Raw Score: {domainRaw}/{activeDomain.items.length}
                    </span>
                    <span className="text-ink-subtle">•</span>
                    <label htmlFor="srcviewsworkerview-scaled-score-1" className="text-ink-muted font-semibold">Scaled Score:</label>
                    <input id="srcviewsworkerview-scaled-score-1"
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
                      className="w-16 px-2 py-1 rounded-xl border border-line text-xs font-semibold"
                    />
                    <span className="text-ink-subtle">•</span>
                    <label htmlFor={`standard-score-${pupil.id}`} className="text-ink-muted font-semibold">
                      Standard Score (all domains):
                    </label>
                    <input id={`standard-score-${pupil.id}`}
                      type="number"
                      min={0}
                      max={200}
                      value={standardScores[pupil.id] ?? ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        setStandardScores(prev => ({ ...prev, [pupil.id]: value }));
                      }}
                      placeholder="e.g. 100"
                      className="w-20 px-2 py-1 rounded-xl border border-line text-xs font-semibold"
                    />
                  </div>

                  <div className="max-h-80 overflow-y-auto pr-1">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                      {activeDomain.items.map((item) => {
                        const present = !!pupilRatings[item.id];
                        const comment = eccdComments[pupil.id]?.[item.id] ?? '';
                        const commentKey = `${pupil.id}:${item.id}`;
                        const commentOpen = openCommentKey === commentKey;
                        return (
                          <div key={item.id} className="p-2.5 rounded-2xl bg-white border border-line space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] text-ink font-semibold truncate flex-1" title={comment ? `${item.description}\nComment: ${comment}` : item.procedure || item.description}>
                              {item.number}. {item.description}
                            </span>
                            <button
                              type="button"
                              onClick={() => setOpenCommentKey(commentOpen ? null : commentKey)}
                              aria-label={`${comment ? 'Edit' : 'Add'} comment for item ${item.number}`}
                              aria-expanded={commentOpen}
                              className={`w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer border-none shrink-0 transition-all ${
                                comment
                                  ? 'bg-primary-light text-primary'
                                  : 'bg-canvas text-ink-soft hover:bg-primary-light hover:text-primary'
                              }`}
                              title={comment ? `Comment: ${comment}` : 'Add a comment (e.g. why the child could not do it)'}
                              suppressHydrationWarning
                            >
                              <MessageSquare size={14} />
                            </button>
                            <button
                              onClick={() => handleToggleECCDItem(pupil.id, item.id)}
                              className={`w-8 h-8 rounded-xl text-sm font-extrabold cursor-pointer border-none shrink-0 transition-all ${
                                present
                                  ? 'bg-emerald-600 text-white shadow-sm'
                                  : 'bg-canvas text-ink-soft hover:bg-primary-light hover:text-primary-hover'
                              }`}
                              title={present ? 'Present — tap to clear' : 'Tap to mark present (✓)'}
                              suppressHydrationWarning
                            >
                              ✓
                            </button>
                          </div>
                          {commentOpen && (
                            <input
                              type="text"
                              autoFocus
                              maxLength={300}
                              value={comment}
                              onChange={(e) => handleEccdCommentChange(pupil.id, item.id, e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setOpenCommentKey(null); }}
                              aria-label={`Comment for item ${item.number}: ${item.description}`}
                              placeholder="Comment for the form (e.g. why the child could not do it)"
                              className="w-full px-2.5 py-1.5 rounded-xl border border-line text-[11px]"
                            />
                          )}
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
          <div className="p-4 rounded-2xl bg-warn-light border border-warn-border text-[11px] space-y-2">
            <div className="font-bold text-warn">Official Interpretation of Scaled Scores</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {[
                ['1–3', 'Development must be monitored after 3 months'],
                ['4–6', 'Development must be monitored after 6 months'],
                ['7–13', 'Average overall development'],
                ['14–16', 'Slightly advanced development'],
                ['17–19', 'Highly advanced development'],
              ].map(([range, meaning]) => (
                <div key={range} className="flex items-center justify-between gap-2 rounded-xl bg-white border border-warn-border px-3 py-1.5">
                  <span className="font-extrabold text-warn">{range}</span>
                  <span className="text-ink-muted">{meaning}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-ink-subtle m-0 pt-1">
              Raw Score = number of ✓ items. Scaled Scores and the Standard Score are entered from the
              official conversion tables (age-based); the Child&apos;s Record 2 fills itself from what you save.
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
                <MessageSquare size={18} className="text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  Guardian Communication Portal
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-ink m-0">
                Parent Absence Notes Inbox
              </h3>
              <p className="text-xs text-ink-muted mt-1 m-0">
                Approve or decline excuse letters submitted by parents. Each letter is numbered per child (Excuse 1, Excuse 2, …) exactly as the parent sees it.
              </p>
            </div>
            <span className="badge badge-primary font-bold">{inboxNotes.length} Messages Received</span>
          </div>

          <div className="space-y-3">
            {inboxNotes.map((note) => (
              <div key={note.id} className="p-4 rounded-3xl border border-line bg-canvas flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge badge-primary text-[10px] font-extrabold">{note.label}</span>
                    <span className="font-bold text-ink text-sm">{note.pupilName} ({note.pupilId})</span>
                    <span className="badge badge-warning text-[10px]">{note.date}</span>
                    <span className="badge badge-primary text-[10px]">{note.reason}</span>
                  </div>
                  <p className="text-ink-soft leading-relaxed m-0 text-xs">{note.notes}</p>
                  <span className="text-[10px] text-ink-subtle">Submitted: {note.submittedAt} • Phone: {note.phone}</span>
                </div>

                <div className="shrink-0">
                  {note.status === 'pending' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleReviewParentNote(note, 'approved')}
                        className="btn btn-primary btn-sm font-bold shadow-md"
                        suppressHydrationWarning
                      >
                        <CheckCircle size={14} />
                        <span>Approve {note.label}</span>
                      </button>
                      <button
                        onClick={() => handleReviewParentNote(note, 'declined')}
                        className="btn btn-secondary btn-sm font-bold text-danger"
                        suppressHydrationWarning
                      >
                        <X size={14} />
                        <span>Decline</span>
                      </button>
                    </div>
                  ) : (
                    <span className={`badge font-extrabold text-xs flex items-center gap-1 ${
                      note.status === 'approved' ? 'badge-enrolled' : 'badge-danger'
                    }`}>
                      {note.status === 'approved' ? <CheckCircle size={14} /> : <X size={14} />}
                      {note.label} {note.status === 'approved' ? 'Approved' : 'Declined'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* ECCD Child's Record 2 — preview + Word download after grading */}
      <ECCDReportModal
        isOpen={!!reportPupil}
        onClose={() => setReportPupil(null)}
        pupil={reportPupil}
      />

      {/* Verify Enrollment Confirmation */}
      {isVerifyModalOpen && verifyPupilRecord && verifyAction && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn" suppressHydrationWarning>
          <div className="bg-white rounded-3xl shadow-2xl border border-line w-full max-w-md p-6 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                  verifyAction === 'approve' ? 'bg-primary-light text-primary' : 'bg-danger-light text-danger'
                }`}>
                  {verifyAction === 'approve' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-ink m-0">
                    {verifyAction === 'approve' ? 'Approve enrollment?' : 'Return enrollment to parent?'}
                  </h3>
                  <p className="text-xs text-ink-muted m-0">
                    {verifyPupilRecord.firstName} {verifyPupilRecord.lastName} ({verifyPupilRecord.id})
                  </p>
                </div>
              </div>
              <button
                aria-label="Close"
                onClick={closeVerifyModal}
                className="p-2 rounded-full text-ink-subtle hover:bg-canvas hover:text-ink border-none bg-transparent cursor-pointer transition-all"
                suppressHydrationWarning
              >
                <X size={20} />
              </button>
            </div>

            {verifyAction === 'approve' ? (
              <p className="text-xs text-ink-soft leading-relaxed m-0 bg-primary-light border border-[#B7DDDA] rounded-2xl p-3">
                The child becomes <strong>enrolled</strong> and the parent is notified. Their
                sociodemographic profile stays attached to the pupil record.
              </p>
            ) : (
              <div className="space-y-2">
                <fieldset className="border-none p-0 m-0 space-y-1.5">
                  <legend className="block text-xs font-bold text-ink mb-1">What does the parent need to correct? *</legend>
                  <p className="text-[10px] text-ink-subtle m-0">
                    Return only when something is missing or wrong. The parent keeps their account, sees
                    PENDING with these reasons, and resubmits.
                  </p>
                  {RETURN_REASONS.map((r) => (
                    <label key={r} className="flex items-start gap-2 text-xs text-ink-soft cursor-pointer">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={returnReasons.includes(r)}
                        onChange={(e) =>
                          setReturnReasons(prev => e.target.checked ? [...prev, r] : prev.filter(x => x !== r))
                        }
                      />
                      <span>{r}</span>
                    </label>
                  ))}
                </fieldset>
                <label htmlFor="srcviewsworkerview-reason-for-rejection-2" className="block text-xs font-bold text-ink">Other / details</label>
                <textarea id="srcviewsworkerview-reason-for-rejection-2"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  maxLength={300}
                  placeholder="e.g. The birth certificate photo is blurry; please upload a clearer copy."
                  className="w-full px-3 py-2.5 rounded-2xl border border-line bg-canvas text-sm text-ink outline-none focus:border-danger focus:ring-2 focus:ring-danger/20 transition-all resize-y"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-line">
              <button
                onClick={closeVerifyModal}
                className="px-4 py-2 rounded-2xl text-xs font-bold text-ink-muted bg-canvas hover:bg-line-strong border-none cursor-pointer transition-all"
                suppressHydrationWarning
              >
                Cancel
              </button>
              <button
                onClick={handleVerify}
                className={`px-4 py-2 rounded-2xl text-xs font-bold text-white border-none cursor-pointer shadow-md transition-all flex items-center gap-1.5 ${
                  verifyAction === 'approve'
                    ? 'bg-primary hover:bg-primary-hover'
                    : 'bg-danger hover:bg-[#B71C1C]'
                }`}
                suppressHydrationWarning
              >
                {verifyAction === 'approve' ? <CheckCircle2 size={14} /> : <X size={14} />}
                {verifyAction === 'approve' ? 'Confirm Approval' : 'Return to Parent'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
