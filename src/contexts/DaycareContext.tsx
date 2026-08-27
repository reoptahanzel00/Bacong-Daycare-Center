'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  INITIAL_PUPILS,
  INITIAL_ATTENDANCE,
  INITIAL_PROGRESS,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_USERS,
  INITIAL_AUDIT_LOGS,
  DEFAULT_AVATAR,
  getStoredData,
  saveStoredData,
} from '@/data/mockData';
import { createClient } from '@/lib/supabase/client';
import {
  fetchPupils,
  enrollPupil,
  type PupilRow,
  type PupilEnrollPayload,
  type SociodemographicProfileRow,
} from '@/services/pupilService';
import { fetchAttendance, saveBulkAttendance } from '@/services/attendanceService';
import { fetchProgress, recordObservation, type ProgressPayload, type ProgressRow } from '@/services/progressService';
import { fetchUsers, updateUserStatus } from '@/services/usersService';
import { logAuditEntry, fetchAuditLogs } from '@/services/auditService';
import { fetchAnnouncements, publishAnnouncement, type AnnouncementRow } from '@/services/announcementsService';

// Local-compatible types (matching mockData shape).
// Optional fields cover the loose demo payloads used across the UI.
export interface MockPupil {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  sex: string;
  address?: string;
  enrollmentStatus: string;
  enrollmentDate?: string;
  rejectionReason?: string | null;
  avatar?: string;
  guardian?: {
    fullName: string;
    relationship: string;
    phone?: string;
    isPrimary?: boolean;
  };
  sociodemographic?: SociodemographicProfileRow | null;
  consecutiveAbsences?: number;
}

export interface MockAttendance {
  pupil_id: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  notes?: string;
}

export interface MockAnnouncement {
  id: string;
  title: string;
  body?: string;
  date: string;
  postedBy?: string;
  /** Resolved author display name from the server (may be null for staff). */
  authorName?: string | null;
  content?: string;
  author?: string;
}

export interface MockUser {
  id: string;
  name: string;
  fullName?: string;
  email: string;
  role: string;
  phone?: string;
  status: string;
  createdAt?: string;
}

export interface MockProgress {
  id: string;
  pupil_id: string;
  domain: string;
  title?: string;
  rating?: string;
  notes?: string;
  note?: string;
  date: string;
  recordedBy?: string;
}

export interface MockAuditLog {
  id: string;
  timestamp: string;
  userName: string;
  role: string;
  action: string;
  target: string;
  details?: string;
}

export type UserRole = 'worker' | 'official' | 'barangay_admin' | 'parent';

interface ToastState {
  message: string;
  type: string;
}

interface DaycareContextValue {
  // Navigation
  currentRole: UserRole;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Data
  pupils: MockPupil[];
  attendance: MockAttendance[];
  progress: MockProgress[];
  announcements: MockAnnouncement[];
  users: MockUser[];
  auditLogs: MockAuditLog[];

  // CRUD Actions
  handleSavePupil: (pupilData: MockPupil) => void;
  updatePupilEnrollment: (pupilId: string, status: 'enrolled' | 'rejected', reason?: string | null) => void;
  handleArchivePupil: (pupilId: string) => void;
  handleEditPupil: (pupil: MockPupil) => void;
  handleSaveAttendance: (records: MockAttendance[], dateStr: string) => void;
  handleSaveProgress: (progressData: MockProgress) => void;
  handleSaveAnnouncement: (annData: MockAnnouncement) => void;
  handleSaveUser: (userData: MockUser) => void;
  handleToggleUserStatus: (userId: string) => void;
  logAuditAction: (action: string, target: string, details: string) => void;
  showToast: (message: string, type?: string) => void;

  // Modal state lifted to context so any component can open modals
  toast: ToastState | null;
  setToast: (t: ToastState | null) => void;
  isMobileNavOpen: boolean;
  setIsMobileNavOpen: (open: boolean) => void;
  isPupilModalOpen: boolean;
  setIsPupilModalOpen: (open: boolean) => void;
  pupilToEdit: MockPupil | null;
  setPupilToEdit: (p: MockPupil | null) => void;
  isProgressModalOpen: boolean;
  setIsProgressModalOpen: (v: boolean) => void;
  isAnnouncementModalOpen: boolean;
  setIsAnnouncementModalOpen: (v: boolean) => void;
  isUserModalOpen: boolean;
  setIsUserModalOpen: (v: boolean) => void;
  isLinkParentModalOpen: boolean;
  setIsLinkParentModalOpen: (v: boolean) => void;
  /** Increments on every open so LinkParentModal remounts with fresh state. */
  linkParentOpenCount: number;
  setLinkParentOpenCount: (v: number | ((prev: number) => number)) => void;
  isDSWDReportModalOpen: boolean;
  setIsDSWDReportModalOpen: (v: boolean) => void;

  isHydrated: boolean;
}

/** Maps a snake_case API/DB pupil row to the client MockPupil shape. */
function mapPupilRowStatic(row: PupilRow): MockPupil {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    birthDate: row.birth_date,
    sex: row.sex,
    address: row.address,
    enrollmentStatus: row.enrollment_status,
    enrollmentDate: row.enrollment_date,
    rejectionReason: row.rejection_reason ?? null,
    consecutiveAbsences: row.consecutive_absences ?? 0,
    avatar: row.avatar_url || DEFAULT_AVATAR,
    guardian: Array.isArray(row.guardian) && row.guardian.length > 0
      ? (() => {
          const g = row.guardian.find(x => x.is_primary_contact) || row.guardian[0];
          return {
            fullName: g.full_name,
            relationship: g.relationship,
            phone: g.phone,
            isPrimary: g.is_primary_contact,
          };
        })()
      : undefined,
    sociodemographic: Array.isArray(row.sociodemographic)
      ? (row.sociodemographic[0] || null)
      : (row.sociodemographic || null),
  };
}

/** Maps a progress observation (already domain/date/rating-mapped) to MockProgress. */
function mapProgressRowStatic(r: ProgressRow): MockProgress {
  return {
    id: r.id,
    pupil_id: r.pupil_id,
    domain: r.domain,
    title: r.title,
    rating: r.rating,
    note: r.note,
    date: r.date,
    recordedBy: r.recorded_by || undefined,
  } as MockProgress;
}

/** Maps an announcement row to the client MockAnnouncement shape. */
function mapAnnouncementRowStatic(a: AnnouncementRow): MockAnnouncement {
  return {
    id: a.id,
    title: a.title,
    content: a.body,
    date: (a.created_at || '').slice(0, 10),
    postedBy: a.posted_by || undefined,
    authorName: a.author_name || null,
  } as MockAnnouncement;
}

/** The tab each role lands on. Kept in one place so the server-seeded first
 *  paint and the client's post-sign-in routing cannot disagree. */
function defaultTabFor(role: UserRole): string {
  if (role === 'official') return 'overview';
  if (role === 'barangay_admin') return 'users';
  if (role === 'parent') return 'child';
  return 'dashboard';
}

const DaycareContext = createContext<DaycareContextValue | null>(null);

/**
 * Data resolved on the server for first paint. When present the provider seeds
 * its state from it and skips the mount-time session + roster round trips.
 */
export interface InitialAppState {
  role: UserRole | null;
  userName: string | null;
  pupils?: PupilRow[];
  attendance?: Array<{ pupil_id: string; date: string; status: string; notes?: string }>;
  progress?: ProgressRow[];
  announcements?: AnnouncementRow[];
}

export function DaycareProvider({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: InitialAppState;
}) {
  const router = useRouter();
  // The active role is resolved from the verified server profile only. There
  // is deliberately no client-facing setter: a role must never be switchable
  // from the browser, even though every API call re-verifies it server-side.
  const [currentRole, setCurrentRoleState] = useState<UserRole>(() => {
    // The server-resolved role is authoritative and available before first
    // paint, so there is no flash of the wrong role's shell.
    if (initial?.role) return initial.role;
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bacong_auth_role');
      if (saved && ['worker', 'official', 'barangay_admin', 'parent'].includes(saved)) {
        return saved as UserRole;
      }
    }
    return 'worker';
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (initial?.role) return defaultTabFor(initial.role);
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bacong_auth_role');
      if (saved === 'official') return 'overview';
      if (saved === 'barangay_admin') return 'users';
      if (saved === 'parent') return 'child';
    }
    return 'dashboard';
  });

  // Display name of the signed-in user, resolved from the authoritative
  // users table. Used so audit entries name the real actor.
  const [currentUserName, setCurrentUserName] = useState<string | null>(initial?.userName ?? null);
  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [isPupilModalOpen, setIsPupilModalOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const [pupils, setPupils] = useState<MockPupil[]>(
    () => (initial?.pupils ? initial.pupils.map(mapPupilRowStatic) : INITIAL_PUPILS)
  );
  const [attendance, setAttendance] = useState<MockAttendance[]>(
    () => (initial?.attendance
      ? initial.attendance.map(r => ({
          pupil_id: r.pupil_id,
          date: r.date,
          status: r.status,
          notes: r.notes,
        }) as MockAttendance)
      : INITIAL_ATTENDANCE)
  );
  const [progress, setProgress] = useState<MockProgress[]>(
    () => (initial?.progress
      ? initial.progress.map(r => mapProgressRowStatic(r))
      : INITIAL_PROGRESS)
  );
  const [announcements, setAnnouncements] = useState<MockAnnouncement[]>(
    () => (initial?.announcements
      ? initial.announcements.map(r => mapAnnouncementRowStatic(r))
      : INITIAL_ANNOUNCEMENTS)
  );
  const [users, setUsers] = useState<MockUser[]>(INITIAL_USERS);
  const [auditLogs, setAuditLogs] = useState<MockAuditLog[]>(INITIAL_AUDIT_LOGS);

  const [pupilToEdit, setPupilToEdit] = useState<MockPupil | null>(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isLinkParentModalOpen, setIsLinkParentModalOpen] = useState(false);
  const [linkParentOpenCount, setLinkParentOpenCount] = useState(0);
  const [isDSWDReportModalOpen, setIsDSWDReportModalOpen] = useState(false);

  // ---- Real-data helpers -------------------------------------------------

  /** Builds the POST /api/pupils payload from a MockPupil. */
  const toEnrollPayload = useCallback((
    pupil: MockPupil,
    id?: string,
    enrollmentStatus?: string,
  ): PupilEnrollPayload => ({
    id,
    firstName: pupil.firstName,
    lastName: pupil.lastName,
    birthDate: pupil.birthDate,
    sex: pupil.sex as 'Male' | 'Female',
    address: pupil.address || '',
    enrollmentStatus: (enrollmentStatus || pupil.enrollmentStatus || 'enrolled') as 'enrolled' | 'archived',
    guardianName: pupil.guardian?.fullName || '',
    relationship: (pupil.guardian?.relationship || 'Mother') as PupilEnrollPayload['relationship'],
    guardianPhone: pupil.guardian?.phone || '',
  }), []);

  /**
   * Pulls the authoritative pupil roster + attendance register from the API.
   * Runs once a real Supabase session exists; localStorage stays as the
   * offline/demo fallback when the API is unreachable.
   */
  const syncFromServer = useCallback(async (role: UserRole | null = null) => {
    try {
      // Admin-only endpoints (user directory, audit trail) are only fetched for
      // the barangay_admin to avoid firing 401/403 requests for every other role.
      const isAdmin = role === 'barangay_admin';
      const [pupilRes, attendanceRes, progressRes, usersRes, auditRes, announcementRes] = await Promise.all([
        fetchPupils(['pending', 'enrolled', 'rejected']),
        fetchAttendance(),
        fetchProgress(),
        isAdmin ? fetchUsers() : Promise.resolve({ ok: false, users: [] }),
        isAdmin ? fetchAuditLogs() : Promise.resolve({ ok: false, logs: [] }),
        fetchAnnouncements(),
      ]);

      if (pupilRes.ok) {
        setPupils(pupilRes.pupils.map(mapPupilRowStatic));
      }
      if (attendanceRes.ok) {
        setAttendance(attendanceRes.records.map(r => ({
          pupil_id: r.pupil_id,
          date: r.date,
          status: r.status,
          notes: r.notes,
        })));
      }
      if (progressRes.ok) {
        setProgress(progressRes.observations.map(r => ({
          id: r.id,
          pupil_id: r.pupil_id,
          domain: r.domain,
          title: r.title,
          rating: r.rating,
          note: r.note,
          date: r.date,
          recordedBy: r.recorded_by || undefined,
        })));
      }
      if (usersRes.ok) {
        setUsers(usersRes.users.map(u => ({
          id: u.id,
          name: u.full_name,
          fullName: u.full_name,
          email: u.email,
          role: u.role,
          phone: u.phone || undefined,
          status: u.status,
          createdAt: u.created_at,
        })));
      }
      if (auditRes.ok) {
        setAuditLogs(auditRes.logs.map(l => ({
          id: l.id,
          timestamp: l.created_at ? new Date(l.created_at).toLocaleString('sv').replace('T', ' ') : '',
          userName: l.user_name,
          role: l.role,
          action: l.action,
          target: l.target,
          details: l.details || undefined,
        })));
      }
      if (announcementRes.ok) {
        setAnnouncements(announcementRes.announcements.map(a => ({
          id: a.id,
          title: a.title,
          content: a.body,
          date: (a.created_at || '').slice(0, 10),
          postedBy: a.posted_by || undefined,
          authorName: a.author_name || null,
        })));
      }
    } catch (e) {
      console.warn('Server sync failed; continuing with local data.', e);
    }
  }, []);

  // Whether this render was seeded by the server. Read once: `initial` is a
  // prop object whose identity would otherwise re-trigger the effect.
  const hasServerData = Boolean(initial?.role);
  const initialRole = initial?.role ?? null;

  // Hydrate from localStorage & load Supabase session role on mount
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      // Defer past the synchronous effect body: keeps SSR-safe mount-time
      // hydration from localStorage without triggering cascading renders.
      await Promise.resolve();
      if (cancelled) return;
      // When the server already supplied the roster, the local cache is the
      // older copy — restoring it here would overwrite fresh data with stale.
      if (!hasServerData) {
        setPupils(getStoredData('pupils', INITIAL_PUPILS));
        setAttendance(getStoredData('attendance', INITIAL_ATTENDANCE));
        setProgress(getStoredData('progress', INITIAL_PROGRESS));
        setAnnouncements(getStoredData('announcements', INITIAL_ANNOUNCEMENTS));
      }
      // The staff directory and the audit trail are deliberately NOT restored
      // from local storage: both are admin-only, neither is usable offline,
      // and caching them puts staff emails and the audit record on the disk of
      // every shared terminal an admin has ever signed in to. They come from
      // the server each session or not at all.
      setIsHydrated(true);
    }
    hydrate();

    async function loadAuthUserRole() {
      try {
        // The server already resolved the session, the role and the roster for
        // this render, so skip the whole client round trip. Admin-only data is
        // still fetched below for the one role that needs it.
        if (hasServerData && initialRole) {
          localStorage.setItem('bacong_auth_role', initialRole);
          if (initialRole === 'barangay_admin') await syncFromServer(initialRole);
          return;
        }

        const savedRole = localStorage.getItem('bacong_auth_role') as UserRole | null;
        const isDemoMode = !process.env.NEXT_PUBLIC_SUPABASE_URL;

        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        let resolvedRole: UserRole | null = null;

        if (session?.user) {
          // Resolve the role from the users table (authoritative) first, then
          // pull the authoritative roster + register from the API. Passing the
          // role lets the sync avoid admin-only endpoints for other roles.
          const { data: profile } = await supabase
            .from('users')
            .select('role, full_name')
            .eq('id', session.user.id)
            .single();

          if (profile?.role && ['worker', 'official', 'barangay_admin', 'parent'].includes(profile.role)) {
            resolvedRole = profile.role as UserRole;
          }
          if (profile?.full_name) setCurrentUserName(profile.full_name);
          await syncFromServer(resolvedRole);
        }

        // Demo mode only: without a configured Supabase project there is no
        // server profile to verify against, so the local role is acceptable.
        // In real mode we NEVER trust the client-settable localStorage role to
        // render privileged views — the server profile is authoritative.
        if (
          isDemoMode &&
          !resolvedRole &&
          savedRole &&
          ['worker', 'official', 'barangay_admin', 'parent'].includes(savedRole)
        ) {
          resolvedRole = savedRole;
        }

        if (resolvedRole) {
          setCurrentRoleState(resolvedRole);
          localStorage.setItem('bacong_auth_role', resolvedRole);

          setActiveTab(defaultTabFor(resolvedRole));
        } else {
          // Unauthenticated visitor -> Redirect to login page
          if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
            router.push('/login');
          }
        }
      } catch (e) {
        console.warn('Auth role hydration warning:', e);
      }
    }

    loadAuthUserRole();

    return () => {
      cancelled = true;
    };
  }, [router, syncFromServer, hasServerData, initialRole]);

  // Persist to localStorage whenever data changes
  useEffect(() => { if (isHydrated) saveStoredData('pupils', pupils); }, [pupils, isHydrated]);
  useEffect(() => { if (isHydrated) saveStoredData('attendance', attendance); }, [attendance, isHydrated]);
  useEffect(() => { if (isHydrated) saveStoredData('progress', progress); }, [progress, isHydrated]);
  useEffect(() => { if (isHydrated) saveStoredData('announcements', announcements); }, [announcements, isHydrated]);
  // users and auditLogs are intentionally not persisted — see the hydration
  // comment above.

  const showToast = useCallback((message: string, type = 'success') => {
    setToast({ message, type });
  }, []);

  const logAuditAction = useCallback((action: string, target: string, details: string) => {
    // The optimistic local entry must name the real signed-in user. The server
    // resolves the actor from the verified session independently, so a wrong
    // name here would make the admin's on-screen trail disagree with the
    // immutable record it claims to show.
    const newLog: MockAuditLog = {
      id: `AUD-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toLocaleString('sv').replace('T', ' '),
      userName: currentUserName || 'System User',
      role: currentRole.toUpperCase(),
      action,
      target,
      details,
    };
    setAuditLogs(prev => [newLog, ...prev.slice(0, 499)]); // Cap at 500 entries
    // Persist to the immutable server-side trail (fire-and-forget; the local
    // entry keeps the UI responsive even when the write is delayed/fails).
    logAuditEntry(action, target, details).catch(() => {});
  }, [currentRole, currentUserName]);

  const handleSavePupil = useCallback(async (pupilData: MockPupil) => {
    const isEdit = !!pupilToEdit;

    if (isEdit) {
      // Upsert with the existing id so the DB row updates in place.
      await enrollPupil(toEnrollPayload(pupilData, pupilToEdit.id));
      setPupils(prev => prev.map(p => p.id === pupilData.id ? pupilData : p));
      logAuditAction('Updated Pupil Profile', `${pupilData.firstName} ${pupilData.lastName} (${pupilData.id})`, 'Modified pupil demographic / guardian information.');
      showToast(`Pupil profile for ${pupilData.firstName} updated.`);
    } else {
      // New pupil: let the server generate the authoritative id.
      const res = await enrollPupil(toEnrollPayload(pupilData));
      if (res.success && res.pupil?.id) {
        const serverPupil: MockPupil = {
          id: res.pupil.id,
          firstName: res.pupil.firstName,
          lastName: res.pupil.lastName,
          birthDate: res.pupil.birthDate,
          sex: res.pupil.sex,
          address: res.pupil.address,
          enrollmentStatus: res.pupil.enrollmentStatus,
          enrollmentDate: res.pupil.enrollmentDate,
          consecutiveAbsences: res.pupil.consecutiveAbsences,
          avatar: pupilData.avatar || DEFAULT_AVATAR,
          guardian: res.pupil.guardian,
        };
        setPupils(prev => [serverPupil, ...prev]);
        logAuditAction('Enrolled New Pupil', `${pupilData.firstName} ${pupilData.lastName} (${serverPupil.id})`, `Enrolled under guardian ${pupilData.guardian?.fullName}.`);
      } else {
        // DB not reachable (offline/demo) — keep the optimistic local pupil.
        setPupils(prev => [pupilData, ...prev]);
        logAuditAction('Enrolled New Pupil', `${pupilData.firstName} ${pupilData.lastName} (${pupilData.id})`, `Enrolled under guardian ${pupilData.guardian?.fullName}.`);
      }
      showToast(`Pupil ${pupilData.firstName} ${pupilData.lastName} enrolled successfully!`);
    }
    setPupilToEdit(null);
  }, [pupilToEdit, toEnrollPayload, logAuditAction, showToast]);

  /** Local-only update after a worker approves/rejects a parent enrollment. */
  const updatePupilEnrollment = useCallback((
    pupilId: string,
    status: 'enrolled' | 'rejected',
    reason?: string | null,
  ) => {
    setPupils(prev => prev.map(p =>
      p.id === pupilId
        ? { ...p, enrollmentStatus: status, rejectionReason: reason ?? null }
        : p
    ));
  }, []);

  const handleArchivePupil = useCallback(async (pupilId: string) => {
    const targetPupil = pupils.find(p => p.id === pupilId);
    if (targetPupil) {
      // Soft-archive server-side (enrollment_status = archived).
      await enrollPupil(toEnrollPayload(targetPupil, pupilId, 'archived'));
    }
    setPupils(prev => prev.map(p => p.id === pupilId ? { ...p, enrollmentStatus: 'archived' } : p));
    logAuditAction('Archived Pupil Record', pupilId, `Soft-archived record for ${targetPupil?.firstName} ${targetPupil?.lastName}.`);
    showToast(`Record for ${targetPupil?.firstName || pupilId} archived.`, 'danger');
  }, [pupils, toEnrollPayload, logAuditAction, showToast]);

  const handleEditPupil = useCallback((pupil: MockPupil) => {
    setPupilToEdit(pupil);
    setIsPupilModalOpen(true);
  }, []);

  const handleSaveAttendance = useCallback(async (records: MockAttendance[], dateStr: string) => {
    // Atomically replace all records for this specific date
    setAttendance(prev => {
      const filtered = prev.filter(a => a.date !== dateStr);
      return [...records, ...filtered];
    });

    // ✅ FIX: Recalculate consecutive absences from SORTED history — not by incrementing on save
    setPupils(prev => prev.map(pupil => {
      const todayRecord = records.find(r => r.pupil_id === pupil.id);
      if (!todayRecord) return pupil;

      // Get all attendance for this pupil sorted by most recent first
      const allRecords = attendance
        .filter(a => a.pupil_id === pupil.id && a.date !== dateStr)
        .sort((a, b) => b.date.localeCompare(a.date));

      // Add today's record at the front
      const sortedWithToday = [todayRecord, ...allRecords];

      // Count consecutive absences from the most recent day backwards
      let consecutive = 0;
      for (const rec of sortedWithToday) {
        if (rec.status === 'absent') consecutive++;
        else break;
      }

      return { ...pupil, consecutiveAbsences: consecutive };
    }));

    logAuditAction('Saved Daily Attendance', `Register Date: ${dateStr}`, `Marked attendance for ${records.length} pupils.`);
    // Optimistic toast — the local save already happened.
    showToast(`Attendance register for ${dateStr} saved!`);

    // Persist to the real daily register; surface failure without blocking UX.
    const res = await saveBulkAttendance(
      dateStr,
      records.map(({ pupil_id, status, notes }) => ({ pupil_id, status, notes })),
    );
    if (!res.success) {
      showToast(`Database sync unavailable — register saved locally for ${dateStr}.`, 'warning');
    }
  }, [attendance, logAuditAction, showToast]);

  const handleSaveProgress = useCallback(async (progressData: MockProgress) => {
    const payload: ProgressPayload = {
      pupil_id: progressData.pupil_id,
      domain: progressData.domain as ProgressPayload['domain'],
      title: progressData.title || (progressData.rating ? `${progressData.rating} observation` : 'Milestone observation'),
      note: progressData.note || progressData.notes || '',
      date: progressData.date,
      rating: progressData.rating,
    };

    setProgress(prev => [progressData, ...prev]);
    const targetPupil = pupils.find(p => p.id === progressData.pupil_id);
    logAuditAction('Recorded Progress Observation', `${targetPupil?.firstName || progressData.pupil_id}`, `Added milestone observation under ${progressData.domain}.`);
    // Optimistic toast — the local save already happened.
    showToast(`Development milestone recorded for ${targetPupil?.firstName || 'pupil'}.`);

    // Persist to the real observations table; surface failure without blocking UX.
    const res = await recordObservation(payload);
    if (!res.success) {
      showToast('Milestone saved locally — database sync unavailable.', 'warning');
    }
  }, [pupils, logAuditAction, showToast]);

  const handleSaveAnnouncement = useCallback(async (annData: MockAnnouncement) => {
    setAnnouncements(prev => [annData, ...prev]);
    const res = await publishAnnouncement(annData.title, annData.content || annData.body || '');
    if (!res.success) {
      showToast(`Notice saved locally — could not reach the server.`, 'warning');
    }
    logAuditAction('Published Announcement', annData.title, 'Broadcasted daycare notice to parent portal.');
    showToast(`Notice "${annData.title}" broadcasted to parents.`);
  }, [logAuditAction, showToast]);

  const handleSaveUser = useCallback((userData: MockUser) => {
    setUsers(prev => [userData, ...prev]);
    logAuditAction('Created User Account', `${userData.name} (${userData.role})`, `Provisioned account with email ${userData.email}.`);
    showToast(`User account created for ${userData.name}.`);
  }, [logAuditAction, showToast]);

  const handleToggleUserStatus = useCallback(async (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    const nextStatus = targetUser.status === 'active' ? 'disabled' : 'active';

    // Persist to the real users table (admin API).
    await updateUserStatus(userId, nextStatus);

    setUsers(prev => prev.map(u => (u.id === userId ? { ...u, status: nextStatus } : u)));
    logAuditAction('Toggled Account Status', targetUser.email, `Changed account status to ${nextStatus}.`);
    showToast(`Account ${targetUser.name} is now ${nextStatus}.`, nextStatus === 'active' ? 'success' : 'danger');
  }, [users, logAuditAction, showToast]);

  // Memoised so consumers only re-render when a value actually changes.
  // Without this, the object identity changes on every provider render and
  // every view (each 1000+ lines, unmemoised) re-renders on each keystroke.
  const value: DaycareContextValue = useMemo(() => ({
    currentRole, activeTab, setActiveTab, searchQuery, setSearchQuery,
    pupils, attendance, progress, announcements, users, auditLogs,
    handleSavePupil, updatePupilEnrollment, handleArchivePupil, handleEditPupil, handleSaveAttendance,
    handleSaveProgress, handleSaveAnnouncement, handleSaveUser, handleToggleUserStatus,
    logAuditAction,
    showToast,
    toast,
    setToast,
    isMobileNavOpen,
    setIsMobileNavOpen,
    isPupilModalOpen,
    setIsPupilModalOpen, pupilToEdit, setPupilToEdit,
    isProgressModalOpen, setIsProgressModalOpen,
    isAnnouncementModalOpen, setIsAnnouncementModalOpen,
    isUserModalOpen, setIsUserModalOpen,
    isLinkParentModalOpen, setIsLinkParentModalOpen,
    linkParentOpenCount, setLinkParentOpenCount,
    isDSWDReportModalOpen, setIsDSWDReportModalOpen,
    isHydrated,
  }), [
    currentRole, activeTab, searchQuery,
    pupils, attendance, progress, announcements, users, auditLogs,
    handleSavePupil, updatePupilEnrollment, handleArchivePupil, handleEditPupil,
    handleSaveAttendance, handleSaveProgress, handleSaveAnnouncement, handleSaveUser,
    handleToggleUserStatus, logAuditAction, showToast, toast,
    isMobileNavOpen, isPupilModalOpen, pupilToEdit,
    isProgressModalOpen, isAnnouncementModalOpen, isUserModalOpen,
    isLinkParentModalOpen, linkParentOpenCount, isDSWDReportModalOpen,
    isHydrated,
  ]);

  return (
    <DaycareContext.Provider value={value}>
      {children}
    </DaycareContext.Provider>
  );
}

export function useDaycare(): DaycareContextValue {
  const ctx = useContext(DaycareContext);
  if (!ctx) throw new Error('useDaycare must be used within <DaycareProvider>');
  return ctx;
}
