export const INITIAL_PUPILS = [
  {
    id: 'PUP-2026-001',
    firstName: 'Mateo',
    lastName: 'Santos',
    birthDate: '2021-04-12',
    sex: 'Male',
    address: 'Purok 1, Barangay Bacong',
    enrollmentStatus: 'enrolled',
    enrollmentDate: '2025-06-02',
    avatar: 'https://images.unsplash.com/photo-1543332164-6e82f355badc?auto=format&fit=crop&w=200&q=80',
    guardian: {
      fullName: 'Maria Santos',
      relationship: 'Mother',
      phone: '0917-123-4567',
      isPrimary: true
    },
    consecutiveAbsences: 0
  },
  {
    id: 'PUP-2026-002',
    firstName: 'Sophia',
    lastName: 'Reyes',
    birthDate: '2021-09-25',
    sex: 'Female',
    address: 'Purok 2, Barangay Bacong',
    enrollmentStatus: 'enrolled',
    enrollmentDate: '2025-06-02',
    avatar: 'https://images.unsplash.com/photo-1595454114216-892fe21272e7?auto=format&fit=crop&w=200&q=80',
    guardian: {
      fullName: 'Juan Reyes',
      relationship: 'Father',
      phone: '0918-987-6543',
      isPrimary: true
    },
    consecutiveAbsences: 3
  },
  {
    id: 'PUP-2026-003',
    firstName: 'Gabriel',
    lastName: 'Dela Cruz',
    birthDate: '2021-02-14',
    sex: 'Male',
    address: 'Purok 3, Barangay Bacong',
    enrollmentStatus: 'enrolled',
    enrollmentDate: '2025-06-02',
    avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=80',
    guardian: {
      fullName: 'Elena Dela Cruz',
      relationship: 'Mother',
      phone: '0920-555-1234',
      isPrimary: true
    },
    consecutiveAbsences: 0
  },
  {
    id: 'PUP-2026-004',
    firstName: 'Althea',
    lastName: 'Mendoza',
    birthDate: '2021-11-03',
    sex: 'Female',
    address: 'Purok 1, Barangay Bacong',
    enrollmentStatus: 'enrolled',
    enrollmentDate: '2025-06-02',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80',
    guardian: {
      fullName: 'Carmela Mendoza',
      relationship: 'Grandmother',
      phone: '0919-444-8899',
      isPrimary: true
    },
    consecutiveAbsences: 0
  },
  {
    id: 'PUP-2026-005',
    firstName: 'Lucas',
    lastName: 'Bautista',
    birthDate: '2021-07-19',
    sex: 'Male',
    address: 'Purok 4, Barangay Bacong',
    enrollmentStatus: 'enrolled',
    enrollmentDate: '2025-06-02',
    avatar: 'https://images.unsplash.com/photo-1502086223501-7ea6ecd79368?auto=format&fit=crop&w=200&q=80',
    guardian: {
      fullName: 'Roberto Bautista',
      relationship: 'Father',
      phone: '0922-333-7711',
      isPrimary: true
    },
    consecutiveAbsences: 0
  },
  {
    id: 'PUP-2026-006',
    firstName: 'Samantha',
    lastName: 'Villanueva',
    birthDate: '2021-05-30',
    sex: 'Female',
    address: 'Purok 2, Barangay Bacong',
    enrollmentStatus: 'enrolled',
    enrollmentDate: '2025-06-02',
    avatar: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?auto=format&fit=crop&w=200&q=80',
    guardian: {
      fullName: 'Maria Santos',
      relationship: 'Mother',
      phone: '0917-123-4567',
      isPrimary: true
    },
    consecutiveAbsences: 0
  },
  {
    id: 'PUP-2026-007',
    firstName: 'Daniel',
    lastName: 'Aquino',
    birthDate: '2021-08-11',
    sex: 'Male',
    address: 'Purok 5, Barangay Bacong',
    enrollmentStatus: 'archived',
    enrollmentDate: '2024-06-01',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    guardian: {
      fullName: 'Teresa Aquino',
      relationship: 'Mother',
      phone: '0928-111-2233',
      isPrimary: true
    },
    consecutiveAbsences: 0
  }
];

export const INITIAL_ATTENDANCE = [
  { pupil_id: 'PUP-2026-001', date: '2026-08-07', status: 'present', notes: '' },
  { pupil_id: 'PUP-2026-002', date: '2026-08-07', status: 'absent', notes: 'Fever reported by parent' },
  { pupil_id: 'PUP-2026-003', date: '2026-08-07', status: 'present', notes: '' },
  { pupil_id: 'PUP-2026-004', date: '2026-08-07', status: 'late', notes: 'Arrived at 8:45 AM due to rain' },
  { pupil_id: 'PUP-2026-005', date: '2026-08-07', status: 'present', notes: '' },
  { pupil_id: 'PUP-2026-006', date: '2026-08-07', status: 'present', notes: '' },

  { pupil_id: 'PUP-2026-001', date: '2026-08-08', status: 'present', notes: '' },
  { pupil_id: 'PUP-2026-002', date: '2026-08-08', status: 'absent', notes: 'Still recovering' },
  { pupil_id: 'PUP-2026-003', date: '2026-08-08', status: 'present', notes: '' },
  { pupil_id: 'PUP-2026-004', date: '2026-08-08', status: 'present', notes: '' },
  { pupil_id: 'PUP-2026-005', date: '2026-08-08', status: 'present', notes: '' },
  { pupil_id: 'PUP-2026-006', date: '2026-08-08', status: 'present', notes: '' },

  { pupil_id: 'PUP-2026-001', date: '2026-08-09', status: 'present', notes: '' },
  { pupil_id: 'PUP-2026-002', date: '2026-08-09', status: 'absent', notes: 'Unexcused 3rd consecutive day' },
  { pupil_id: 'PUP-2026-003', date: '2026-08-09', status: 'present', notes: '' },
  { pupil_id: 'PUP-2026-004', date: '2026-08-09', status: 'present', notes: '' },
  { pupil_id: 'PUP-2026-005', date: '2026-08-09', status: 'present', notes: '' },
  { pupil_id: 'PUP-2026-006', date: '2026-08-09', status: 'present', notes: '' }
];

export const INITIAL_PROGRESS = [
  {
    id: 'PROG-101',
    pupil_id: 'PUP-2026-001',
    domain: 'Motor Skills',
    title: 'Fine Motor Control & Crayola Grip',
    date: '2026-08-05',
    note: 'Mateo successfully demonstrated pincer grip while holding crayons and drew clear circular shapes without assistance.',
    recordedBy: 'Teacher Teresa (Daycare Worker)'
  },
  {
    id: 'PROG-102',
    pupil_id: 'PUP-2026-001',
    domain: 'Language & Communication',
    title: 'Storytelling & Vocabulary',
    date: '2026-08-01',
    note: 'Exhibited strong verbal response during Tagalog storytime. Recalled 4 story details accurately when prompted.',
    recordedBy: 'Teacher Teresa (Daycare Worker)'
  },
  {
    id: 'PROG-103',
    pupil_id: 'PUP-2026-001',
    domain: 'Socio-Emotional',
    title: 'Group Play & Sharing Toys',
    date: '2026-07-28',
    note: 'Willfully shared building blocks with classmates during free play period without needing teacher intervention.',
    recordedBy: 'Teacher Teresa (Daycare Worker)'
  },
  {
    id: 'PROG-104',
    pupil_id: 'PUP-2026-002',
    domain: 'Self-Help & Cognitive',
    title: 'Handwashing Routine',
    date: '2026-08-02',
    note: 'Sophia independently washed hands before snack time following the 5-step handwashing chart.',
    recordedBy: 'Teacher Teresa (Daycare Worker)'
  },
  {
    id: 'PROG-105',
    pupil_id: 'PUP-2026-003',
    domain: 'Motor Skills',
    title: 'Balance & Hopping',
    date: '2026-08-04',
    note: 'Gabriel hopped on one foot 5 consecutive times during outdoor physical play.',
    recordedBy: 'Teacher Teresa (Daycare Worker)'
  }
];

export const INITIAL_ANNOUNCEMENTS = [
  {
    id: 'ANN-001',
    title: 'Nutrition Month Culminating Activity & Feeding Program',
    body: 'Dear Parents, please prepare a clean food container and spoon for your child this coming Friday, August 15. The Barangay Nutrition Council will conduct a special healthy feeding session.',
    date: '2026-08-08',
    postedBy: 'Teacher Teresa (Daycare Worker)'
  },
  {
    id: 'ANN-002',
    title: 'Deworming & Health Screening Schedule',
    body: 'Barangay Health Workers will visit our Daycare Center on August 20 for the bi-annual DOH deworming initiative. Consent forms have been distributed.',
    date: '2026-08-03',
    postedBy: 'Barangay Health Office'
  }
];

export const INITIAL_USERS = [
  {
    id: 'USR-01',
    name: 'Teacher Teresa Cruz',
    email: 'teresa.cruz@bacong.gov.ph',
    role: 'worker',
    phone: '0917-000-1122',
    status: 'active'
  },
  {
    id: 'USR-02',
    name: 'Hon. Captain Ramon Santos',
    email: 'captain.santos@bacong.gov.ph',
    role: 'official',
    phone: '0918-000-3344',
    status: 'active'
  },
  {
    id: 'USR-03',
    name: 'Admin Josephine Mercado',
    email: 'admin.mercado@bacong.gov.ph',
    role: 'barangay_admin',
    phone: '0920-000-5566',
    status: 'active'
  },
  {
    id: 'USR-04',
    name: 'Maria Santos (Parent)',
    email: 'maria.santos@gmail.com',
    role: 'parent',
    phone: '0917-123-4567',
    status: 'active',
    linkedPupilIds: ['PUP-2026-001', 'PUP-2026-006']
  }
];

export const INITIAL_AUDIT_LOGS = [
  {
    id: 'AUD-001',
    timestamp: '2026-08-09 08:30:15',
    userName: 'Teacher Teresa Cruz',
    role: 'Daycare Worker',
    action: 'Marked Attendance',
    target: 'Daily Register (2026-08-09)',
    details: 'Recorded attendance for 6 enrolled pupils (5 Present, 1 Absent)'
  },
  {
    id: 'AUD-002',
    timestamp: '2026-08-08 14:15:02',
    userName: 'Teacher Teresa Cruz',
    role: 'Daycare Worker',
    action: 'Recorded Progress',
    target: 'Mateo Santos (PUP-2026-001)',
    details: 'Added observation under Motor Skills domain'
  },
  {
    id: 'AUD-003',
    timestamp: '2026-08-08 09:05:40',
    userName: 'Admin Josephine Mercado',
    role: 'Barangay Admin',
    action: 'Created Parent Account',
    target: 'Maria Santos (USR-04)',
    details: 'Provisioned parent portal credentials linked to pupils PUP-2026-001 & PUP-2026-006'
  }
];

export function getStoredData<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const data = localStorage.getItem(`bacong_daycare_${key}`);
    return data ? JSON.parse(data) : fallback;
  } catch (e) {
    console.error('LocalStorage read error:', e);
    return fallback;
  }
}

export function saveStoredData<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`bacong_daycare_${key}`, JSON.stringify(value));
  } catch (e) {
    console.error('LocalStorage write error:', e);
  }
}
