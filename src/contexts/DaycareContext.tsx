'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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
} from '@/services/pupilService';
import { fetchAttendance, saveBulkAttendance } from '@/services/attendanceService';

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
  avatar?: string;
  guardian?: {
    fullName: string;
    relationship: string;
    phone?: string;
    isPrimary?: boolean;
  };
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
  setCurrentRole: (role: UserRole) => void;
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
  isDSWDReportModalOpen: boolean;
  setIsDSWDReportModalOpen: (v: boolean) => void;

  isHydrated: boolean;
}

const DaycareContext = createContext<DaycareContextValue | null>(null);

export function DaycareProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [currentRole, setCurrentRoleState] = useState<UserRole>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bacong_auth_role');
      if (saved && ['worker', 'official', 'barangay_admin', 'parent'].includes(saved)) {
        return saved as UserRole;
      }
    }
    return 'worker';
  });

  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bacong_auth_role');
      if (saved === 'official') return 'overview';
      if (saved === 'barangay_admin') return 'users';
      if (saved === 'parent') return 'child';
    }
    return 'dashboard';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [isPupilModalOpen, setIsPupilModalOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  const [pupils, setPupils] = useState<MockPupil[]>(INITIAL_PUPILS);
  const [attendance, setAttendance] = useState<MockAttendance[]>(INITIAL_ATTENDANCE);
  const [progress, setProgress] = useState<MockProgress[]>(INITIAL_PROGRESS);
  const [announcements, setAnnouncements] = useState<MockAnnouncement[]>(INITIAL_ANNOUNCEMENTS);
  const [users, setUsers] = useState<MockUser[]>(INITIAL_USERS);
  const [auditLogs, setAuditLogs] = useState<MockAuditLog[]>(INITIAL_AUDIT_LOGS);

  const [pupilToEdit, setPupilToEdit] = useState<MockPupil | null>(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isDSWDReportModalOpen, setIsDSWDReportModalOpen] = useState(false);

  // ---- Real-data helpers -------------------------------------------------

  /** Maps a snake_case API pupil row to the client MockPupil shape. */
  const mapPupilRow = useCallback((row: PupilRow): MockPupil => ({
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    birthDate: row.birth_date,
    sex: row.sex,
    address: row.address,
    enrollmentStatus: row.enrollment_status,
    enrollmentDate: row.enrollment_date,
    consecutiveAbsences: row.consecutive_absences ?? 0,
    avatar: row.avatar_url || DEFAULT_AVATAR,
    guardian: row.guardian
      ? {
          fullName: row.guardian.full_name,
          relationship: row.guardian.relationship,
          phone: row.guardian.phone,
          isPrimary: row.guardian.is_primary_contact,
        }
      : undefined,
  }), []);

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
  const syncFromServer = useCallback(async () => {
    try {
      const [pupilRes, attendanceRes] = await Promise.all([
        fetchPupils('enrolled'),
        fetchAttendance(),
      ]);

      if (pupilRes.ok) {
        setPupils(pupilRes.pupils.map(mapPupilRow));
      }
      if (attendanceRes.ok) {
        setAttendance(attendanceRes.records.map(r => ({
          pupil_id: r.pupil_id,
          date: r.date,
          status: r.status,
          notes: r.notes,
        })));
      }
    } catch (e) {
      console.warn('Server sync failed; continuing with local data.', e);
    }
  }, [mapPupilRow]);

  // Hydrate from localStorage & load Supabase session role on mount
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      // Defer past the synchronous effect body: keeps SSR-safe mount-time
      // hydration from localStorage without triggering cascading renders.
      await Promise.resolve();
      if (cancelled) return;
      setPupils(getStoredData('pupils', INITIAL_PUPILS));
      setAttendance(getStoredData('attendance', INITIAL_ATTENDANCE));
      setProgress(getStoredData('progress', INITIAL_PROGRESS));
      setAnnouncements(getStoredData('announcements', INITIAL_ANNOUNCEMENTS));
      setUsers(getStoredData('users', INITIAL_USERS));
      setAuditLogs(getStoredData('audit_logs', INITIAL_AUDIT_LOGS));
      setIsHydrated(true);
    }
    hydrate();

    async function loadAuthUserRole() {
      try {
        const savedRole = localStorage.getItem('bacong_auth_role') as UserRole | null;

        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();

        let resolvedRole: UserRole | null = null;

        if (session?.user) {
          const userEmail = (session.user.email || '').toLowerCase();

          // Authenticated: pull the authoritative roster + register from the API.
          await syncFromServer();

          const { data: profile } = await supabase
            .from('users')
            .select('role')
            .eq('id', session.user.id)
            .single();

          if (profile?.role && ['worker', 'official', 'barangay_admin', 'parent'].includes(profile.role)) {
            resolvedRole = profile.role as UserRole;
          } else if (userEmail.includes('official')) {
            resolvedRole = 'official';
          } else if (userEmail.includes('admin')) {
            resolvedRole = 'barangay_admin';
          } else if (userEmail.includes('parent')) {
            resolvedRole = 'parent';
          } else if (userEmail.includes('worker')) {
            resolvedRole = 'worker';
          }
        }

        if (!resolvedRole && savedRole && ['worker', 'official', 'barangay_admin', 'parent'].includes(savedRole)) {
          resolvedRole = savedRole;
        }

        if (resolvedRole) {
          setCurrentRoleState(resolvedRole);
          localStorage.setItem('bacong_auth_role', resolvedRole);

          if (resolvedRole === 'official') setActiveTab('overview');
          else if (resolvedRole === 'barangay_admin') setActiveTab('users');
          else if (resolvedRole === 'parent') setActiveTab('child');
          else setActiveTab('dashboard');
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
  }, [router, syncFromServer]);

  // Persist to localStorage whenever data changes
  useEffect(() => { if (isHydrated) saveStoredData('pupils', pupils); }, [pupils, isHydrated]);
  useEffect(() => { if (isHydrated) saveStoredData('attendance', attendance); }, [attendance, isHydrated]);
  useEffect(() => { if (isHydrated) saveStoredData('progress', progress); }, [progress, isHydrated]);
  useEffect(() => { if (isHydrated) saveStoredData('announcements', announcements); }, [announcements, isHydrated]);
  useEffect(() => { if (isHydrated) saveStoredData('users', users); }, [users, isHydrated]);
  useEffect(() => { if (isHydrated) saveStoredData('audit_logs', auditLogs); }, [auditLogs, isHydrated]);

  const showToast = useCallback((message: string, type = 'success') => {
    setToast({ message, type });
  }, []);

  const setCurrentRole = useCallback((newRole: UserRole) => {
    setCurrentRoleState(newRole);
    if (newRole === 'worker') setActiveTab('dashboard');
    else if (newRole === 'official') setActiveTab('overview');
    else if (newRole === 'barangay_admin') setActiveTab('users');
    else if (newRole === 'parent') setActiveTab('child');
    showToast(`Switched to ${newRole.replace('_', ' ').toUpperCase()} mode.`, 'info');
  }, [showToast]);

  const logAuditAction = useCallback((action: string, target: string, details: string) => {
    const actorNames: Record<string, string> = {
      worker: 'Teacher Teresa Cruz (Daycare Worker)',
      official: 'Hon. Ramon Santos (Barangay Official)',
      barangay_admin: 'Admin Josephine Mercado (Barangay Admin)',
      parent: 'Maria Santos (Parent)',
    };
    const newLog: MockAuditLog = {
      id: `AUD-${Date.now().toString().slice(-6)}`,
      timestamp: new Date().toLocaleString('sv').replace('T', ' '),
      userName: actorNames[currentRole] || 'System User',
      role: currentRole.toUpperCase(),
      action,
      target,
      details,
    };
    setAuditLogs(prev => [newLog, ...prev.slice(0, 499)]); // Cap at 500 entries
  }, [currentRole]);

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

    // Persist to the real daily register.
    const res = await saveBulkAttendance(
      dateStr,
      records.map(({ pupil_id, status, notes }) => ({ pupil_id, status, notes })),
    );

    logAuditAction('Saved Daily Attendance', `Register Date: ${dateStr}`, `Marked attendance for ${records.length} pupils.`);
    if (res.success) {
      showToast(`Attendance register for ${dateStr} saved!`);
    } else {
      showToast(`Saved locally for ${dateStr} — database sync unavailable.`, 'warning');
    }
  }, [attendance, logAuditAction, showToast]);

  const handleSaveProgress = useCallback((progressData: MockProgress) => {
    setProgress(prev => [progressData, ...prev]);
    const targetPupil = pupils.find(p => p.id === progressData.pupil_id);
    logAuditAction('Recorded Progress Observation', `${targetPupil?.firstName || progressData.pupil_id}`, `Added milestone observation under ${progressData.domain}.`);
    showToast(`Development milestone recorded for ${targetPupil?.firstName || 'pupil'}.`);
  }, [pupils, logAuditAction, showToast]);

  const handleSaveAnnouncement = useCallback((annData: MockAnnouncement) => {
    setAnnouncements(prev => [annData, ...prev]);
    logAuditAction('Published Announcement', annData.title, 'Broadcasted daycare notice to parent portal.');
    showToast(`Notice "${annData.title}" broadcasted to parents.`);
  }, [logAuditAction, showToast]);

  const handleSaveUser = useCallback((userData: MockUser) => {
    setUsers(prev => [userData, ...prev]);
    logAuditAction('Created User Account', `${userData.name} (${userData.role})`, `Provisioned account with email ${userData.email}.`);
    showToast(`User account created for ${userData.name}.`);
  }, [logAuditAction, showToast]);

  const handleToggleUserStatus = useCallback((userId: string) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const nextStatus = u.status === 'active' ? 'disabled' : 'active';
        logAuditAction('Toggled Account Status', u.email, `Changed account status to ${nextStatus}.`);
        showToast(`Account ${u.name} is now ${nextStatus}.`, nextStatus === 'active' ? 'success' : 'danger');
        return { ...u, status: nextStatus };
      }
      return u;
    }));
  }, [logAuditAction, showToast]);

  const value: DaycareContextValue = {
    currentRole, setCurrentRole, activeTab, setActiveTab, searchQuery, setSearchQuery,
    pupils, attendance, progress, announcements, users, auditLogs,
    handleSavePupil, handleArchivePupil, handleEditPupil, handleSaveAttendance,
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
    isDSWDReportModalOpen, setIsDSWDReportModalOpen,
    isHydrated,
  };

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
