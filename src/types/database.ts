export type UserRole = 'worker' | 'official' | 'barangay_admin' | 'parent';
export type EnrollmentStatus = 'enrolled' | 'archived';
export type AttendanceStatus = 'present' | 'absent' | 'late';
export type ECDDomain = 'motor' | 'language' | 'socio-emotional' | 'self-help';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  status: 'active' | 'disabled';
  created_at: string;
}

export interface GuardianInfo {
  id?: string;
  pupil_id?: string;
  user_id?: string;
  full_name: string;
  relationship: 'Mother' | 'Father' | 'Grandmother' | 'Grandfather' | 'Legal Guardian';
  phone: string;
  is_primary_contact?: boolean;
}

export interface Pupil {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  sex: 'Male' | 'Female';
  address: string;
  enrollment_status: EnrollmentStatus;
  enrollment_date: string;
  archive_reason?: 'Graduated' | 'Transferred' | 'Dropped Out' | 'Other';
  avatar_url?: string;
  consecutive_absences: number;
  school_year_id?: string;
  guardian?: GuardianInfo;
  created_by?: string;
  created_at?: string;
}

export interface AttendanceRecord {
  id?: string;
  pupil_id: string;
  date: string;
  status: AttendanceStatus;
  notes?: string;
  recorded_by?: string;
  created_at?: string;
}

export interface ProgressObservation {
  id: string;
  pupil_id: string;
  domain_id: ECDDomain;
  milestone_code?: string;
  title: string;
  note: string;
  observation_date: string;
  status_rating?: 'Present' | 'In_Progress' | 'Not_Yet_Observed';
  recorded_by: string;
  created_at?: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  posted_by: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_name: string;
  role: string;
  action: string;
  target: string;
  details?: string;
  created_at: string;
}
