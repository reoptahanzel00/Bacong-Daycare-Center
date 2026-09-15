'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  INITIAL_PUPILS,
  INITIAL_ATTENDANCE,
  INITIAL_PROGRESS,
  INITIAL_USERS,
  INITIAL_AUDIT_LOGS,
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
import { fetchSettings, updateSettings, EMPTY_SETTINGS, type CenterSettingsRow } from '@/services/settingsService';

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
  users: MockUser[];
  auditLogs: MockAuditLog[];

  // CRUD Actions
  handleSavePupil: (pupilData: MockPupil) => void;
  updatePupilEnrollment: (pupilId: string, status: 'enrolled' | 'rejected', reason?: string | null) => void;
  handleArchivePupil: (pupilId: string) => void;
  handleEditPupil: (pupil: MockPupil) => void;
  handleSaveAttendance: (records: MockAttendance[], dateStr: string) => void;
  handleSaveProgress: (progressData: MockProgress) => void;
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
  isUserModalOpen: boolean;
  setIsUserModalOpen: (v: boolean) => void;
  isLinkParentModalOpen: boolean;
  setIsLinkParentModalOpen: (v: boolean) => void;
  /** Increments on every open so LinkParentModal remounts with fresh state. */
  linkParentOpenCount: number;
  setLinkParentOpenCount: (v: number | ((prev: number) => number)) => void;
  isDSWDReportModalOpen: boolean;
  setIsDSWDReportModalOpen: (v: boolean) => void;

  /** Centre name and the officials who sign DSWD Form 1. */
  settings: CenterSettingsRow;
  saveSettings: (next: CenterSettingsRow) => Promise<{ success?: boolean; error?: string }>;
  /** Display name of the signed-in user; used as the report's preparer. */
  currentUserName: string | null;

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
    avatar: row.avatar_url || undefined,
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

/** A server error message fit for a toast; validation errors arrive as arrays. */
function errorText(error: unknown, fallback: string): string {
  return typeof error === 'string' && error.trim() ? error : fallback;
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
  settings?: CenterSettingsRow;
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
  const [settings, setSettings] = useState<CenterSettingsRow>(
    () => initial?.settings ?? EMPTY_SETTINGS
  );
  const [users, setUsers] = useState<MockUser[]>(INITIAL_USERS);
  const [auditLogs, setAuditLogs] = useState<MockAuditLog[]>(INITIAL_AUDIT_LOGS);

  const [pupilToEdit, setPupilToEdit] = useState<MockPupil | null>(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
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
      const [pupilRes, attendanceRes, progressRes, usersRes, auditRes] = await Promise.all([
        fetchPupils(['pending', 'enrolled', 'rejected']),
        fetchAttendance(),
        fetchProgress(),
        isAdmin ? fetchUsers() : Promise.resolve({ ok: false, users: [] }),
        isAdmin ? fetchAuditLogs() : Promise.resolve({ ok: false, logs: [] }),
      ]);

      const settingsRes = await fetchSettings();
      if (settingsRes.ok) setSettings(settingsRes.settings);

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

  // Demo mode only. With a real session nothing is written to the device: the
  // system has no offline mode (see the capstone paper's delimitations), and a
  // roster left in localStorage outlives the session on a shared phone.
  useEffect(() => { if (isHydrated && !hasServerData) saveStoredData('pupils', pupils); }, [pupils, isHydrated, hasServerData]);
  useEffect(() => { if (isHydrated && !hasServerData) saveStoredData('attendance', attendance); }, [attendance, isHydrated, hasServerData]);
  useEffect(() => { if (isHydrated && !hasServerData) saveStoredData('progress', progress); }, [progress, isHydrated, hasServerData]);
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
      const res = await enrollPupil(toEnrollPayload(pupilData, pupilToEdit.id));
      if (hasServerData && !res.success) {
        showToast(errorText(res.error, 'Could not save — check your connection and try again.'), 'danger');
        return;
      }
      setPupils(prev => prev.map(p => p.id === pupilData.id ? pupilData : p));
      logAuditAction('Updated Pupil Profile', `${pupilData.firstName} ${pupilData.lastName} (${pupilData.id})`, 'Modified pupil demographic / guardian information.');
      showToast(`Pupil profile for ${pupilData.firstName} updated.`);
    } else {
      // New pupil: let the server generate the authoritative id.
      const res = await enrollPupil(toEnrollPayload(pupilData));
      if (hasServerData && !(res.success && res.pupil?.id)) {
        showToast(errorText(res.error, 'Could not save — check your connection and try again.'), 'danger');
        return;
      }
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
          avatar: pupilData.avatar || undefined,
          guardian: res.pupil.guardian,
        };
        setPupils(prev => [serverPupil, ...prev]);
        logAuditAction('Enrolled New Pupil', `${pupilData.firstName} ${pupilData.lastName} (${serverPupil.id})`, `Enrolled under guardian ${pupilData.guardian?.fullName}.`);
      } else {
        // Demo mode (no database configured): the pupil lives in this browser only.
        setPupils(prev => [pupilData, ...prev]);
        logAuditAction('Enrolled New Pupil', `${pupilData.firstName} ${pupilData.lastName} (${pupilData.id})`, `Enrolled under guardian ${pupilData.guardian?.fullName}.`);
      }
      showToast(`Pupil ${pupilData.firstName} ${pupilData.lastName} enrolled successfully!`);
    }
    setPupilToEdit(null);
  }, [pupilToEdit, toEnrollPayload, logAuditAction, showToast, hasServerData]);

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
      const res = await enrollPupil(toEnrollPayload(targetPupil, pupilId, 'archived'));
      if (hasServerData && !res.success) {
        showToast(errorText(res.error, 'Could not archive — check your connection and try again.'), 'danger');
        return;
      }
    }
    setPupils(prev => prev.map(p => p.id === pupilId ? { ...p, enrollmentStatus: 'archived' } : p));
    logAuditAction('Archived Pupil Record', pupilId, `Soft-archived record for ${targetPupil?.firstName} ${targetPupil?.lastName}.`);
    showToast(`Record for ${targetPupil?.firstName || pupilId} archived.`, 'danger');
  }, [pupils, toEnrollPayload, logAuditAction, showToast, hasServerData]);

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

    if (!hasServerData) {
      // Demo mode (no database configured): the register lives in this browser only.
      logAuditAction('Saved Daily Attendance', `Register Date: ${dateStr}`, `Marked attendance for ${records.length} pupils.`);
      showToast(`Attendance register for ${dateStr} saved (demo mode).`);
      return;
    }

    // Only report success once the database has the register: there is no
    // offline queue to catch a failed save later.
    const res = await saveBulkAttendance(
      dateStr,
      records.map(({ pupil_id, status, notes }) => ({ pupil_id, status, notes })),
    );
    if (res.success) {
      logAuditAction('Saved Daily Attendance', `Register Date: ${dateStr}`, `Marked attendance for ${records.length} pupils.`);
      showToast(`Attendance register for ${dateStr} saved!`);
    } else {
      showToast(errorText(res.error, `The register for ${dateStr} was not saved — check your connection and try again.`), 'danger');
    }
  }, [attendance, logAuditAction, showToast, hasServerData]);

  const handleSaveProgress = useCallback(async (progressData: MockProgress) => {
    const payload: ProgressPayload = {
      pupil_id: progressData.pupil_id,
      domain: progressData.domain as ProgressPayload['domain'],
      title: progressData.title || (progressData.rating ? `${progressData.rating} observation` : 'Milestone observation'),
      note: progressData.note || progressData.notes || '',
      date: progressData.date,
      rating: progressData.rating,
    };

    const targetPupil = pupils.find(p => p.id === progressData.pupil_id);
    if (hasServerData) {
      const res = await recordObservation(payload);
      if (!res.success) {
        showToast(errorText(res.error, 'The observation was not saved — check your connection and try again.'), 'danger');
        return;
      }
    }
    setProgress(prev => [progressData, ...prev]);
    logAuditAction('Recorded Progress Observation', `${targetPupil?.firstName || progressData.pupil_id}`, `Added milestone observation under ${progressData.domain}.`);
    showToast(`Development milestone recorded for ${targetPupil?.firstName || 'pupil'}.`);
  }, [pupils, logAuditAction, showToast, hasServerData]);


  const handleSaveUser = useCallback((userData: MockUser) => {
    setUsers(prev => [userData, ...prev]);
    logAuditAction('Created User Account', `${userData.name} (${userData.role})`, `Provisioned account with email ${userData.email}.`);
    showToast(`User account created for ${userData.name}.`);
  }, [logAuditAction, showToast]);

  const saveSettings = useCallback(async (next: CenterSettingsRow) => {
    const res = await updateSettings(next);
    if (res?.success) {
      setSettings(res.settings ?? next);
      logAuditAction('Updated Centre Settings', next.center_name,
        'Changed the centre name or the officials named on DSWD Form 1.');
      showToast('Centre settings saved.');
    } else {
      showToast(res?.error || 'Could not save centre settings.', 'danger');
    }
    return res;
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
    pupils, attendance, progress, users, auditLogs,
    handleSavePupil, updatePupilEnrollment, handleArchivePupil, handleEditPupil, handleSaveAttendance,
    handleSaveProgress, handleSaveUser, handleToggleUserStatus,
    logAuditAction,
    settings, saveSettings, currentUserName,
    showToast,
    toast,
    setToast,
    isMobileNavOpen,
    setIsMobileNavOpen,
    isPupilModalOpen,
    setIsPupilModalOpen, pupilToEdit, setPupilToEdit,
    isProgressModalOpen, setIsProgressModalOpen,
    isUserModalOpen, setIsUserModalOpen,
    isLinkParentModalOpen, setIsLinkParentModalOpen,
    linkParentOpenCount, setLinkParentOpenCount,
    isDSWDReportModalOpen, setIsDSWDReportModalOpen,
    isHydrated,
  }), [
    currentRole, activeTab, searchQuery,
    pupils, attendance, progress, users, auditLogs,
    handleSavePupil, updatePupilEnrollment, handleArchivePupil, handleEditPupil,
    handleSaveAttendance, handleSaveProgress, handleSaveUser,
    handleToggleUserStatus, logAuditAction, settings, saveSettings, currentUserName, showToast, toast,
    isMobileNavOpen, isPupilModalOpen, pupilToEdit,
    isProgressModalOpen, isUserModalOpen,
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
