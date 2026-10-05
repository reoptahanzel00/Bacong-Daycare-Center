'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Heart,
  TrendingUp,
  AlertTriangle,
  Download,
  BookOpen,
  MessageSquare,
  School,
  Send,
  Clock,
  CheckCircle,
  Pencil,
  AlertCircle,
} from 'lucide-react';
import PupilAvatar from '@/components/PupilAvatar';
import { ECCD_DOMAINS, ECCD_TOTAL_ITEMS } from '@/data/eccdChecklist';
import {
  fetchEccdRecord,
  fetchChildBackground,
  saveChildBackground,
  type ChildBackground,
} from '@/services/eccdService';
import { fetchParentNotes, submitParentNote, excuseLabel, type ParentNoteRow } from '@/services/parentNotesService';
import ResubmitEnrollment, { AttachBirthCert } from '@/components/ResubmitEnrollment';
import ChildBackgroundModal from '@/components/ChildBackgroundModal';
import ECCDReportModal, { RecordPreview } from '@/components/ECCDReportModal';
import { downloadEccdPdf } from '@/lib/eccdPdf';
import { useDaycare, type MockPupil, type MockAttendance } from '@/contexts/DaycareContext';
import { todayLocalISO, formatLocalTimestamp } from '@/lib/dates';
import { ABSENCE_ALERT_THRESHOLD } from '@/lib/absences';
import { errorText } from '@/lib/apiError';
import {
  ROUND_ORDINAL,
  computeAgeYMD,
  latestGradedRound,
  rawScore,
  type EccdRecord,
  type EccdRecordRound,
} from '@/lib/eccdRecord';

interface ParentViewProps {
  pupils: MockPupil[];
  attendance: MockAttendance[];
  activeTab?: string;
}

export default function ParentView({
  pupils,
  attendance,
  activeTab = 'child'
}: ParentViewProps) {
  const { showToast, settings, refreshPupils } = useDaycare();

  // Multi-child selection state
  const [selectedChildId, setSelectedChildId] = useState<string>(pupils[0]?.id ?? '');
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Record<string, boolean>>({});

  // The child's full ECCD record: the ECCD tab renders the same preview the
  // Daycare Worker sees, from the same server-side record.
  // Stamped with the child it belongs to: while another child's record loads,
  // the previous child's record (and its PDF download) must not be shown.
  const [loadedEccd, setLoadedEccd] = useState<{ pupilId: string; record: EccdRecord | null; latest: EccdRecordRound | null } | null>(null);
  const [isEccdDownloading, setIsEccdDownloading] = useState(false);
  const [loadedBackground, setLoadedBackground] = useState<{ pupilId: string; data: ChildBackground | null } | null>(null);
  const [isBackgroundModalOpen, setIsBackgroundModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isSendingNote, setIsSendingNote] = useState(false);

  // Direct Teacher Message / Absence Note Form State
  const [absenceReason, setAbsenceReason] = useState<string>('Illness / Fever');
  const [absenceDate, setAbsenceDate] = useState<string>(todayLocalISO());
  const [guardianNotes, setGuardianNotes] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string | null>(null);
  interface ParentSubmittedNote {
    id: string;
    pupilId: string;
    date: string;
    reason: string;
    notes: string;
    phone: string;
    status: ParentNoteRow['status'];
    /** "Excuse 1", "Excuse 2", ... — the same label the worker sees. */
    label: string;
    submittedAt: string;
  }

  const [submittedNotes, setSubmittedNotes] = useState<ParentSubmittedNote[]>([]);
  // The latest graded ECCD round, for the progress summary on the profile tab.

  // Active Linked Child Record
  const child = useMemo(
    () => pupils.find(p => p.id === selectedChildId) || pupils[0],
    [pupils, selectedChildId]
  );
  // Both sides must exist: with no child and nothing loaded, an optional-chain
  // comparison is undefined === undefined, which is true.
  const eccdForChild = child && loadedEccd && loadedEccd.pupilId === child.id ? loadedEccd : null;
  const eccdRecord = eccdForChild?.record ?? null;
  const latestRound = eccdForChild?.latest ?? null;
  const backgroundForChild = child && loadedBackground && loadedBackground.pupilId === child.id ? loadedBackground : null;
  const backgroundReady = backgroundForChild !== null;
  const childBackground = backgroundForChild?.data ?? null;

  // The guardian's phone on file, unless the parent types a different one.
  const notePhone = contactPhone ?? child?.guardian?.phone ?? '';

  // The notes this parent has actually sent (RLS returns only their own).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchParentNotes();
      if (cancelled || !res.ok) return;
      setSubmittedNotes(res.notes.map((n) => ({
        id: n.id,
        pupilId: n.pupil_id,
        date: n.note_date,
        reason: n.reason,
        notes: n.notes,
        phone: n.phone || '',
        status: n.status,
        label: excuseLabel(n),
        submittedAt: formatLocalTimestamp(n.submitted_at),
      })));
    })();
    return () => { cancelled = true; };
  }, []);

  // The child's ECCD record, reduced to the most recent graded round.
  useEffect(() => {
    if (!child?.id || child.enrollmentStatus !== 'enrolled') return;
    let cancelled = false;
    (async () => {
      const res = await fetchEccdRecord(child.id);
      if (cancelled) return;
      setLoadedEccd({ pupilId: child.id, record: res.record, latest: res.record ? latestGradedRound(res.record) : null });
    })();
    return () => { cancelled = true; };
  }, [child?.id, child?.enrollmentStatus]);

  const childAge = child?.birthDate ? computeAgeYMD(child.birthDate, todayLocalISO()) : null;
  const childNotes = submittedNotes.filter((n) => n.pupilId === child?.id);

  const childAttendance = useMemo(
    () => attendance.filter(a => a.pupil_id === child?.id),
    [attendance, child?.id]
  );

  // Load the child's ECCD Form Section 2 background record.
  useEffect(() => {
    if (!child?.id) return;
    let cancelled = false;
    (async () => {
      const res = await fetchChildBackground(child.id);
      if (!cancelled && res.ok) setLoadedBackground({ pupilId: child.id, data: res.background });
    })();
    return () => { cancelled = true; };
  }, [child?.id]);

  const handleSaveChildBackground = async (
    fields: Partial<Omit<ChildBackground, 'pupil_id' | 'updated_by' | 'updated_at'>>
  ): Promise<boolean> => {
    if (!child?.id) return false;
    const pupilId = child.id;
    const res = await saveChildBackground(pupilId, fields);
    if (res.success) {
      setLoadedBackground({ pupilId, data: res.background ?? { pupil_id: pupilId, ...fields, updated_at: new Date().toISOString() } });
      showToast('Child & family background saved. The teacher can review it before assessments.', 'success');
      setIsBackgroundModalOpen(false);
      return true;
    }
    showToast(errorText(res.error, 'Could not save background info.'), 'danger');
    return false;
  };

  const backgroundRows = [
    { label: "Child's background", value: childBackground?.child_background },
    { label: 'Family environment', value: childBackground?.family_environment },
    { label: "Parents' stimulating activities", value: childBackground?.stimulating_activities },
    { label: 'Home environment', value: childBackground?.home_environment },
    { label: 'Others', value: childBackground?.others },
  ];
  const hasBackground = backgroundRows.some((r) => r.value?.trim());

  const presentCount = childAttendance.filter(a => a.status === 'present').length;
  const lateCount = childAttendance.filter(a => a.status === 'late').length;
  const absentCount = childAttendance.filter(a => a.status === 'absent').length;
  const totalAtt = childAttendance.length;

  const rate = totalAtt ? Math.round(((presentCount + lateCount) / totalAtt) * 100) : null;

  // The unbroken run of absent days ending at the child's most recent record,
  // as maintained by the database trigger - not a total of absences this year.
  const consecutiveAbsences = child?.consecutiveAbsences ?? 0;
  const absenceAlertKey = `ABS-${child?.id ?? 'none'}`;

  // Dismisses the advisory for this child in this session only. Nothing is sent
  // to the centre, so the toast must not say it was: the parent's reply to an
  // absence advisory is the note they send from the Teacher Messages tab.
  const handleAcknowledgeAlert = (alertId: string) => {
    setAcknowledgedAlerts(prev => ({ ...prev, [alertId]: true }));
    showToast('Advisory dismissed. Send the Daycare Worker a note to explain the absence.', 'info');
  };

  const handleSendAbsenceNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardianNotes.trim()) {
      showToast('Please enter a brief note explaining the absence or special request.', 'danger');
      return;
    }
    if (!child?.id || isSendingNote) return;

    // One note per tap: a double tap on a slow connection filed two excuse
    // letters ("Excuse 3" and "Excuse 4") for the same absence.
    setIsSendingNote(true);
    let res;
    try {
      res = await submitParentNote({
        pupil_id: child.id,
        date: absenceDate,
        reason: absenceReason,
        notes: guardianNotes,
        phone: notePhone,
      });
    } finally {
      setIsSendingNote(false);
    }
    if (!res.success) {
      // Nothing is kept on the phone: the note is not sent until the server has it.
      showToast(errorText(res.error, 'Could not send the note — check your connection and try again.'), 'danger');
      return;
    }

    setSubmittedNotes(prev => [{
      id: res.note?.id || `NOTE-${Date.now()}`,
      pupilId: child.id,
      date: absenceDate,
      reason: absenceReason,
      notes: guardianNotes,
      phone: notePhone,
      status: 'pending',
      label: excuseLabel({ excuse_no: res.note?.excuse_no ?? null }),
      submittedAt: formatLocalTimestamp(new Date()),
    }, ...prev]);
    setGuardianNotes('');
    showToast(`Absence note for ${absenceDate} sent to the Daycare Worker.`, 'success');
  };

  // A parent portal with no child to show. Reachable: the roster the portal
  // loads covers pending, enrolled and rejected children, so once a worker
  // archives the last one there is nothing left — and every field below reads
  // off `child`, which renders the hero card with a blank name, a blank ID and
  // a blank date of birth. An explanation is not a nicer version of that; it is
  // the difference between a finished school year and a broken portal.
  if (pupils.length === 0) {
    return (
      <div className="card bg-white p-10 border border-line text-center space-y-3" suppressHydrationWarning>
        <div className="w-14 h-14 rounded-2xl bg-danger-light text-accent-coral flex items-center justify-center mx-auto">
          <Heart size={26} />
        </div>
        <h3 className="text-base font-bold text-ink m-0">No child records to show yet</h3>
        <p className="text-xs text-ink-muted m-0 max-w-md mx-auto leading-relaxed">
          Your account is not linked to a child&apos;s record at the moment. If you have just
          registered, the Daycare Worker still has to verify your child&apos;s enrollment. If you
          were expecting a record here, please contact the Daycare Worker.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12" suppressHydrationWarning>
      
      {/* Top Linked Child Selection Rail */}
      <div className="bg-white p-4 rounded-3xl border border-line shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-danger-light text-accent-coral flex items-center justify-center font-bold shrink-0">
            <Heart size={20} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-ink-subtle uppercase tracking-wider">
              Data Privacy Act (RA 10173) Linked Children
            </div>
            <h3 className="text-sm font-extrabold text-ink m-0">Family Portal Child Switcher</h3>
          </div>
        </div>

        {/* Every linked child, not the first three. Sign-up accepts up to five
            children per parent, and the switcher showed three — so a parent who
            registered four had no way to open the fourth child's portal at all.
            The rail already scrolls horizontally. */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {pupils.map((p) => {
            const isSelected = p.id === selectedChildId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedChildId(p.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-accent-coral-strong text-white border-accent-coral shadow-sm'
                    : 'bg-canvas text-ink border-line hover:border-accent-coral'
                }`}
              >
                <PupilAvatar src={p.avatar} firstName={p.firstName} lastName={p.lastName} size={24} className="rounded-full" />
                <span>{p.firstName} {p.lastName}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-line-strong text-ink-muted'}`}>
                  {p.id}
                </span>
                {p.enrollmentStatus !== 'enrolled' && (
                  // A returned enrollment is still pending from the parent's
                  // side: they can correct it and resubmit.
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                    isSelected ? 'bg-warn-fill/30 text-white' : 'bg-warn-light text-warn'
                  }`}>
                    PENDING
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: Main Child Profile View */}
      {activeTab === 'child' && (
        <>
          {/* Top Child Hero Card */}
          <div className="card bg-gradient-to-br from-accent-coral via-[#E87556] to-[#D96B4D] text-white p-6 rounded-3xl shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <PupilAvatar
                  src={child?.avatar}
                  firstName={child?.firstName}
                  lastName={child?.lastName}
                  size={64}
                  className="rounded-2xl border-2 border-white/40 shadow-md"
                />
                <div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-white m-0 tracking-tight">
                    {child?.firstName} {child?.lastName}
                  </h2>
                  <p className="text-xs text-white/90 mt-1 m-0">
                    ID: <strong>{child?.id}</strong> • Sex: <strong>{child?.sex}</strong> • DOB: <strong>{child?.birthDate}</strong>{childAge ? <> ({childAge.y} yr{childAge.y === 1 ? '' : 's'} {childAge.m} mo)</> : null}
                  </p>
                  <p className="text-xs text-white/85 mt-0.5 m-0">
                    Assigned Daycare Class: <strong>{settings.center_name}</strong>{settings.daycare_worker_name ? <> &bull; Lead Teacher: <strong>{settings.daycare_worker_name}</strong></> : null}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  onClick={() => setIsReportModalOpen(true)}
                  className="btn btn-secondary btn-sm bg-white text-danger font-bold border-none shadow-md"
                  suppressHydrationWarning
                >
                  <Download size={16} />
                  <span>Download Report Card</span>
                </button>
              </div>
            </div>
          </div>

          {/* Pending / Rejected status gate: no attendance/ECCD tooling until approved */}
          {child?.enrollmentStatus === 'enrolled' ? (
            <>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            <div className="card bg-primary-light border border-primary-display/20 p-4">
              <div className="text-2xl font-extrabold text-primary">{rate === null ? '—' : `${rate}%`}</div>
              <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mt-1">Attendance Rate</div>
            </div>
            <div className="card bg-[#EBF8FF] border border-[#2B6CB0]/20 p-4">
              <div className="text-2xl font-extrabold text-[#2B6CB0]">{presentCount}</div>
              <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mt-1">Days Present</div>
            </div>
            <div className="card bg-warn-light border border-warn-fill/30 p-4">
              <div className="text-2xl font-extrabold text-warn">{lateCount}</div>
              <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mt-1">Days Late</div>
            </div>
            <div className="card bg-danger-light border border-danger-border p-4">
              <div className="text-2xl font-extrabold text-danger">{absentCount}</div>
              <div className="text-[10px] font-bold text-ink-muted uppercase tracking-wider mt-1">Days Absent</div>
            </div>
          </div>

          {/* Child & Family Background (ECCD Form Section 2) */}
          <div className="card bg-white p-5 space-y-4 border border-line">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-primary">
                <BookOpen size={20} />
                <div>
                  <h3 className="text-base font-bold text-ink m-0">Child & Family Background</h3>
                  <p className="text-[11px] text-ink-muted m-0">
                    ECCD Form Section 2 — helps the teacher understand {child?.firstName}&apos;s development context before assessments.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBackgroundModalOpen(true)}
                disabled={!backgroundReady}
                className="btn btn-primary btn-sm font-bold shrink-0"
                suppressHydrationWarning
              >
                <Pencil size={14} />
                {hasBackground ? 'Edit Info' : 'Add Child Info'}
              </button>
            </div>

            {hasBackground ? (
              <div className="space-y-3">
                {backgroundRows.filter((r) => r.value?.trim()).map((row) => (
                  <div key={row.label} className="p-3 rounded-2xl bg-canvas border border-line">
                    <div className="text-[10px] font-extrabold uppercase tracking-wider text-primary mb-1">{row.label}</div>
                    <p className="text-xs text-ink-soft leading-relaxed m-0 whitespace-pre-wrap">{row.value}</p>
                  </div>
                ))}
                {childBackground?.updated_at && (
                  <p className="text-[10px] text-ink-subtle m-0">
                    Last updated {formatLocalTimestamp(childBackground.updated_at)}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-primary-light border border-dashed border-primary-display/30 text-center">
                <p className="text-xs font-bold text-primary m-0">No background info shared yet</p>
                <p className="text-[11px] text-ink-muted m-0 mt-1">
                  Add your child&apos;s background, family environment, and home details so the teacher can
                  personalize the ECCD assessment.
                </p>
              </div>
            )}
          </div>

          {/* Consecutive-absence advisory. Keyed off the pupil's consecutive
              streak (maintained by the database trigger) at the same threshold
              the worker's dashboard and the guardian alert use - it previously
              counted every absence on record and fired at 2, so a parent saw an
              advisory for absences that were neither consecutive nor flagged
              anywhere else. The dismissal key carries the pupil id so
              dismissing it for one child does not hide it for a sibling. */}
          {consecutiveAbsences >= ABSENCE_ALERT_THRESHOLD && !acknowledgedAlerts[absenceAlertKey] && (
            <div className="p-4 rounded-3xl bg-danger-light border border-danger-border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle size={22} className="text-danger shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-danger text-sm">Attendance Advisory Alert</div>
                  <p className="text-ink-soft m-0 mt-0.5 leading-relaxed">
                    {child?.firstName} has {consecutiveAbsences} consecutive absences. Please send the Daycare
                    Worker a note explaining the absence from the Teacher Messages &amp; Notes tab.
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleAcknowledgeAlert(absenceAlertKey)}
                className="btn btn-sm text-white bg-danger hover:bg-[#B71C1C] font-bold shrink-0 shadow-sm"
                suppressHydrationWarning
              >
                Acknowledge Alert
              </button>
            </div>
          )}

          {/* Daycare Daily Schedule Timeline */}
          <div className="card bg-white p-5 space-y-4 border border-line">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary">
                <Clock size={20} />
                <h3 className="text-base font-bold text-ink m-0">Daycare Center Daily Schedule Routine</h3>
              </div>
              <span className="badge badge-primary">Barangay Bacong Daycare</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-primary-light border border-primary-display/20 space-y-1">
                <span className="font-extrabold text-primary block">08:00 AM - 08:30 AM</span>
                <div className="font-bold text-ink">Circle Time</div>
                <p className="text-[11px] text-ink-muted m-0">Arrival, flag ceremony, national anthem & greeting.</p>
              </div>

              <div className="p-3 rounded-2xl bg-warn-light border border-warn-fill/30 space-y-1">
                <span className="font-extrabold text-warn block">08:30 AM - 09:30 AM</span>
                <div className="font-bold text-ink">ECCD Stations</div>
                <p className="text-[11px] text-ink-muted m-0">4-Domain learning stations (fine motor & language).</p>
              </div>

              <div className="p-3 rounded-2xl bg-[#EBF8FF] border border-[#2B6CB0]/20 space-y-1">
                <span className="font-extrabold text-[#2B6CB0] block">09:30 AM - 10:00 AM</span>
                <div className="font-bold text-ink">Healthy Snack</div>
                <p className="text-[11px] text-ink-muted m-0">Supervised handwashing & nutritional table manners.</p>
              </div>

              <div className="p-3 rounded-2xl bg-[#F3E8FF] border border-[#8B5CF6]/20 space-y-1">
                <span className="font-extrabold text-[#8B5CF6] block">10:00 AM - 11:15 AM</span>
                <div className="font-bold text-ink">Storytelling & Play</div>
                <p className="text-[11px] text-ink-muted m-0">Outdoor gross motor movement & Tagalog stories.</p>
              </div>

              <div className="p-3 rounded-2xl bg-danger-light border border-danger-border space-y-1">
                <span className="font-extrabold text-danger block">11:15 AM - 11:30 AM</span>
                <div className="font-bold text-ink">Dismissal</div>
                <p className="text-[11px] text-ink-muted m-0">Pack-up, prayer, and authorized guardian pick-up.</p>
              </div>
            </div>
          </div>

          {/* Main Grid: Progress Evaluation & Attendance Log */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* ECCD progress: the latest graded assessment, per domain */}
            <div className="card bg-white p-5 lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-primary">
                  <TrendingUp size={20} />
                  <h3 className="text-base font-bold text-ink m-0">
                    {child?.firstName}&rsquo;s ECCD Progress
                  </h3>
                </div>
                {latestRound && (
                  <span className="badge badge-primary">
                    {ROUND_ORDINAL[latestRound.round]} assessment{latestRound.testedOn ? ` • ${latestRound.testedOn}` : ''}
                  </span>
                )}
              </div>

              {latestRound ? (
                <div className="space-y-3">
                  {ECCD_DOMAINS.map((dom) => {
                    const raw = rawScore(latestRound, dom.id);
                    const percent = Math.round((raw / dom.items.length) * 100);
                    return (
                      <div key={dom.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-ink">{dom.shortLabel}</span>
                          <span className="font-semibold text-ink-muted">
                            {raw} of {dom.items.length} skills shown
                          </span>
                        </div>
                        <div
                          className="w-full h-2.5 bg-line-strong rounded-full overflow-hidden"
                          role="img"
                          aria-label={`${dom.shortLabel}: ${raw} of ${dom.items.length} skills shown`}
                        >
                          <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: dom.color }}></div>
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-[11px] text-ink-subtle m-0 pt-1">
                    From the Daycare Worker&apos;s ECCD checklist. See the full checklist in the {ECCD_TOTAL_ITEMS}-Item ECCD Checklist tab.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-2xl bg-canvas border border-line text-center text-xs text-ink-muted">
                  No ECCD assessment has been recorded for {child?.firstName} yet.
                </div>
              )}
            </div>

            {/* Sidebar: Teacher & Attendance History */}
            <div className="space-y-6">

              {settings.daycare_worker_name && (
                <div className="card bg-white p-5 space-y-3 border border-line">
                  <div className="flex items-center gap-2 text-primary">
                    <School size={18} />
                    <h4 className="text-sm font-bold text-ink m-0">Daycare Worker</h4>
                  </div>
                  <div className="p-3 rounded-2xl bg-canvas border border-line text-xs space-y-1.5">
                    <div className="font-bold text-ink">{settings.daycare_worker_name}</div>
                    <div className="text-ink-muted">{settings.center_name}</div>
                  </div>
                </div>
              )}

              <div className="card bg-white p-5 space-y-3 border border-line">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-ink m-0">Recent Attendance Log</h4>
                  <span className="text-[10px] text-ink-subtle">Daily register</span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {childAttendance.length > 0 ? (
                    childAttendance.map((a, idx) => (
                      <div key={idx} className="p-2.5 rounded-2xl border border-line bg-canvas flex items-center justify-between text-xs">
                        <span className="font-bold text-ink">{a.date}</span>
                        <span className={`badge ${
                          a.status === 'present' ? 'badge-primary' : a.status === 'late' ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {a.status.toUpperCase()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-xs text-ink-subtle p-4 bg-canvas rounded-2xl border border-line">
                      Attendance logged via daily register.
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
            </>
          ) : (
            <div className="p-6 rounded-3xl bg-white border border-line shadow-sm">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 bg-warn-light text-warn">
                  {child?.enrollmentStatus === 'rejected' ? <AlertCircle size={22} /> : <Clock size={22} />}
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                  <h4 className="text-base font-extrabold text-ink m-0">
                    {child?.enrollmentStatus === 'rejected'
                      ? 'Enrollment pending: action needed'
                      : 'Enrollment pending verification'}
                  </h4>
                  <p className="text-xs text-ink-muted leading-relaxed m-0">
                    {child?.enrollmentStatus === 'rejected' ? (
                      <>The Daycare Worker returned this enrollment so it can be corrected. Your
                      account stays active. Please fix the following and resubmit:{' '}
                      <strong className="text-ink">{child?.rejectionReason || 'Please contact the Daycare Worker.'}</strong></>
                    ) : (
                      <>Your child&apos;s sociodemographic profile has been submitted and is being
                      reviewed by the Daycare Worker. Once approved, attendance and the ECCD
                      checklist will appear here.</>
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge badge-warning font-bold uppercase">PENDING</span>
                    {child?.submittedAt && (
                      <span className="text-[11px] text-ink-subtle font-semibold">
                        Submitted {formatLocalTimestamp(child.submittedAt)}
                      </span>
                    )}
                  </div>
                  {child && child.enrollmentStatus === 'rejected' && (
                    <ResubmitEnrollment
                      key={child.id}
                      child={child}
                      onResubmitted={async () => {
                        await refreshPupils();
                        showToast('Enrollment resubmitted. The Daycare Worker will review it again.');
                      }}
                    />
                  )}
                  {child && child.enrollmentStatus === 'pending' && <AttachBirthCert key={child.id} pupilId={child.id} />}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: ECCD DepEd Domain Checklist Viewer */}
      {activeTab === 'eccd_checklist' && (
        child?.enrollmentStatus !== 'enrolled' ? (
          <div className="p-6 rounded-3xl bg-white border border-line shadow-sm text-center">
            <Clock size={28} className="text-warn mx-auto mb-2" />
            <p className="text-sm font-bold text-ink m-0">ECCD checklist unavailable</p>
            <p className="text-xs text-ink-muted m-0 mt-1">
              This tool unlocks once the Daycare Worker approves this child&apos;s enrollment.
            </p>
          </div>
        ) : (
        <div className="card bg-white p-5 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BookOpen size={18} className="text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">
                  DepEd / DSWD Early Childhood Development Standard
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-ink m-0">
                {ECCD_TOTAL_ITEMS}-Item ECCD Checklist: Child&apos;s Record 2
              </h3>
              <p className="text-xs text-ink-muted mt-1 m-0">
                The same record the Daycare Worker sees for <strong>{child?.firstName} {child?.lastName}</strong>,
                all three rounds. A check (✓) means the skill was demonstrated.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                if (!eccdRecord) return;
                setIsEccdDownloading(true);
                try {
                  await downloadEccdPdf(eccdRecord);
                } catch {
                  showToast('Could not generate the PDF. Please try again.', 'danger');
                }
                setIsEccdDownloading(false);
              }}
              disabled={!eccdRecord || isEccdDownloading}
              className="btn btn-primary btn-sm font-bold shrink-0 disabled:opacity-60"
            >
              <Download size={16} />
              <span>{isEccdDownloading ? 'Preparing…' : 'Download PDF'}</span>
            </button>
          </div>

          {eccdRecord ? (
            <RecordPreview record={eccdRecord} />
          ) : (
            <div className="p-6 text-center text-xs text-ink-muted">Loading the ECCD record…</div>
          )}
        </div>
        )
      )}

      {/* TAB 3: Direct Teacher Messaging & Absence Excusal Form */}
      {activeTab === 'parent_notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Form Side */}
          <div className="card bg-white p-5 space-y-4 border border-line lg:col-span-1">
            <div className="flex items-center gap-2 text-primary">
              <MessageSquare size={20} />
              <h3 className="text-base font-bold text-ink m-0">Submit Absence Notice</h3>
            </div>
            <p className="text-xs text-ink-muted m-0 leading-relaxed">
              Send an absence note to the Daycare Worker for <strong>{child?.firstName}</strong>.
            </p>

            <form onSubmit={handleSendAbsenceNote} className="space-y-3.5">
              <div>
                <label htmlFor="srcviewsparentview-reason-for-absence-1" className="block text-xs font-bold text-ink mb-1">Reason for Absence</label>
                <select id="srcviewsparentview-reason-for-absence-1"
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-line bg-canvas text-xs font-semibold focus:outline-none focus:border-primary-display"
                >
                  <option value="Illness / Fever">Illness / Fever</option>
                  <option value="Doctor Visit / Checkup">Doctor Visit / Checkup</option>
                  <option value="Family Emergency">Family Emergency</option>
                  <option value="Out of Town / Travel">Out of Town / Travel</option>
                  <option value="Weather / Typhoon Warning">Weather / Typhoon Warning</option>
                </select>
              </div>

              <div>
                <label htmlFor="srcviewsparentview-date-of-absence-2" className="block text-xs font-bold text-ink mb-1">Date of Absence</label>
                <input id="srcviewsparentview-date-of-absence-2"
                  type="date"
                  value={absenceDate}
                  onChange={(e) => setAbsenceDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-line bg-canvas text-xs font-semibold focus:outline-none focus:border-primary-display"
                />
              </div>

              <div>
                <label htmlFor="srcviewsparentview-guardian-contact-phone-3" className="block text-xs font-bold text-ink mb-1">Guardian Contact Phone</label>
                <input id="srcviewsparentview-guardian-contact-phone-3"
                  type="text"
                  value={notePhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-line bg-canvas text-xs font-semibold focus:outline-none focus:border-primary-display"
                />
              </div>

              <div>
                <label htmlFor="srcviewsparentview-detailed-explanation-note-4" className="block text-xs font-bold text-ink mb-1">Detailed Explanation Note</label>
                <textarea id="srcviewsparentview-detailed-explanation-note-4"
                  rows={3}
                  value={guardianNotes}
                  onChange={(e) => setGuardianNotes(e.target.value)}
                  placeholder="Explain symptoms, doctor recommendations, or pickup instructions..."
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-line bg-canvas text-xs font-semibold focus:outline-none focus:border-primary-display"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={isSendingNote}
                className="w-full py-3 px-4 rounded-2xl bg-primary text-white font-bold text-xs shadow-md hover:bg-primary-hover transition-all flex items-center justify-center gap-2 border-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Send size={16} />
                <span>{isSendingNote ? 'Sending…' : 'Submit Notice to Teacher'}</span>
              </button>
            </form>
          </div>

          {/* History Log Side */}
          <div className="card bg-white p-5 space-y-4 border border-line lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-ink m-0">Submitted Guardian Notices Log</h3>
                <span className="text-xs text-ink-muted">History of absence notes and teacher responses</span>
              </div>
              <span className="badge badge-primary">{childNotes.length} Submitted Notes</span>
            </div>

            <div className="space-y-3">
              {childNotes.length === 0 && (
                <div className="p-4 rounded-2xl bg-canvas border border-line text-center text-xs text-ink-muted">
                  No notes sent for {child?.firstName} yet.
                </div>
              )}
              {childNotes.map((note) => (
                <div key={note.id} className="p-4 rounded-3xl border border-line bg-canvas space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge badge-primary text-[10px] font-extrabold">{note.label}</span>
                      <span className="font-bold text-primary text-sm">{note.reason}</span>
                      <span className="badge badge-warning text-[10px]">{note.date}</span>
                    </div>
                    <span className={`badge font-bold text-[10px] ${
                      note.status === 'approved' ? 'badge-enrolled' : note.status === 'declined' ? 'badge-danger' : 'badge-warning'
                    }`}>
                      {note.status === 'approved' ? 'Approved' : note.status === 'declined' ? 'Declined' : 'Pending'}
                    </span>
                  </div>

                  <p className="text-xs text-ink-soft leading-relaxed m-0">{note.notes}</p>

                  {note.status === 'approved' && (
                    <div className="font-bold text-primary text-xs flex items-center gap-1.5">
                      <CheckCircle size={14} /> {note.label} approved by the Daycare Worker
                    </div>
                  )}
                  {note.status === 'declined' && (
                    <div className="font-bold text-danger text-xs flex items-center gap-1.5">
                      <AlertCircle size={14} /> {note.label} declined. Please contact the Daycare Worker.
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-line text-[10px] text-ink-subtle">
                    <span>Submitted: {note.submittedAt}</span>
                    {note.phone && <span>Contact: {note.phone}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Child & Family Background modal — shared with the ECCD Section 2 form */}
      <ChildBackgroundModal
        key={`${child?.id ?? 'none'}-${isBackgroundModalOpen}`}
        isOpen={isBackgroundModalOpen}
        onClose={() => setIsBackgroundModalOpen(false)}
        onSave={handleSaveChildBackground}
        initial={childBackground}
        childName={child ? `${child.firstName} ${child.lastName}` : undefined}
      />

      {/* ECCD Child's Record 2 — the linked child's filled Word form */}
      <ECCDReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        pupil={child ?? null}
      />

    </div>
  );
}
