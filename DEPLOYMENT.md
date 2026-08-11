# Deployment Guide — Barangay Bacong Daycare Center Tracker

## Overview

This app is built with **Next.js 15** (App Router) and **Supabase** as the backend.  
It is designed for deployment on **Vercel** (recommended) or any Node.js-compatible host.

---

## Required Environment Variables

Copy `.env.example` to `.env.local` and fill in all values before running or deploying.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Yes | Your Supabase project URL. From: Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Yes | Supabase anon public key. From: Project Settings → API → `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Yes (server-only) | Service role key for admin operations. **Never expose to client.** |
| `SEMAPHORE_API_KEY` | ⚠️ Optional | Philippine SMS gateway API key. Get from https://semaphore.co |
| `SEMAPHORE_SENDER_NAME` | ⚠️ Optional | Sender name for SMS (e.g. `BacongDaycare`) |
| `NEXT_PUBLIC_APP_URL` | ⚠️ Optional | Full URL of the deployed app (e.g. `https://bacong-daycare.vercel.app`) |

> ⚠️ **Security:** Never commit `.env.local` to git. It is already in `.gitignore`.  
> ⚠️ **Security:** Never put `SUPABASE_SERVICE_ROLE_KEY` in any `NEXT_PUBLIC_*` variable.

---

## Supabase Database Setup

### 1. Create the following tables in your Supabase project

Run this SQL in the Supabase SQL Editor:

```sql
-- School years table
CREATE TABLE school_years (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles (extends Supabase Auth)
CREATE TABLE users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('worker', 'official', 'barangay_admin', 'parent')),
  phone TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pupils
CREATE TABLE pupils (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('Male', 'Female')),
  address TEXT,
  enrollment_status TEXT DEFAULT 'enrolled' CHECK (enrollment_status IN ('enrolled', 'archived')),
  enrollment_date DATE,
  archive_reason TEXT,
  consecutive_absences INTEGER DEFAULT 0,
  school_year_id UUID REFERENCES school_years(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Guardians
CREATE TABLE guardians (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pupil_id TEXT REFERENCES pupils(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  full_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  phone TEXT,
  is_primary_contact BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pupil_id, relationship)
);

-- Attendance
CREATE TABLE attendance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pupil_id TEXT REFERENCES pupils(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late')),
  notes TEXT DEFAULT '',
  recorded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (pupil_id, date)
);

-- Progress observations
CREATE TABLE progress_observations (
  id TEXT PRIMARY KEY,
  pupil_id TEXT REFERENCES pupils(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  title TEXT NOT NULL,
  note TEXT,
  date DATE,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_id TEXT NOT NULL,
  pupil_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT DEFAULT 'PORTAL',
  severity TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs (immutable)
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT NOT NULL,
  role TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2. Enable Row Level Security on all tables

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE pupils ENABLE ROW LEVEL SECURITY;
ALTER TABLE guardians ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE progress_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
```

### 3. Set up comprehensive RLS policies

> ⚠️ **Critical:** A `SUPABASE_SERVICE_ROLE_KEY` was previously committed to git
> history and must be considered **compromised**. Rotate it now in
> Supabase Dashboard → Project Settings → API Keys → `service_role` → **Rotate**.
> The code no longer ships any fallback credentials — the key is read strictly
> from `SUPABASE_SERVICE_ROLE_KEY` in the server environment.

Apply these policies after enabling RLS. Roles come exclusively from the
`users` table (`worker`, `official`, `barangay_admin`, `parent`); `user_metadata`
is user-editable and is never used for authorization.

```sql
-- =====================================================================
-- users: users see their own profile; admins see all profiles.
-- Provisioning/updates go through the admin API (service role), so no
-- anon INSERT/UPDATE/DELETE policies are defined.
-- =====================================================================
CREATE POLICY "Users view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins view all users" ON users
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'barangay_admin')
  );

-- =====================================================================
-- pupils
-- =====================================================================
CREATE POLICY "Staff view all pupils" ON pupils
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('worker', 'official', 'barangay_admin'))
  );

CREATE POLICY "Parents view linked pupils" ON pupils
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM guardians WHERE pupil_id = pupils.id AND user_id = auth.uid())
  );

CREATE POLICY "Workers and admins enroll pupils" ON pupils
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('worker', 'barangay_admin'))
  );

CREATE POLICY "Workers and admins update pupils" ON pupils
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('worker', 'barangay_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('worker', 'barangay_admin'))
  );

-- No DELETE policy: records are soft-archived via enrollment_status.

-- =====================================================================
-- guardians
-- =====================================================================
CREATE POLICY "Staff view guardians" ON guardians
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('worker', 'official', 'barangay_admin'))
  );

CREATE POLICY "Parents view own guardianship" ON guardians
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Workers and admins manage guardians" ON guardians
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('worker', 'barangay_admin'))
  );

CREATE POLICY "Workers and admins update guardians" ON guardians
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('worker', 'barangay_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('worker', 'barangay_admin'))
  );

-- =====================================================================
-- attendance
-- =====================================================================
CREATE POLICY "Staff view attendance" ON attendance
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('worker', 'official', 'barangay_admin'))
  );

CREATE POLICY "Parents view linked attendance" ON attendance
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM guardians g
      JOIN pupils p ON p.id = g.pupil_id
      WHERE p.id = attendance.pupil_id AND g.user_id = auth.uid()
    )
  );

CREATE POLICY "Workers and admins record attendance" ON attendance
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('worker', 'barangay_admin'))
  );

CREATE POLICY "Workers and admins update attendance" ON attendance
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('worker', 'barangay_admin'))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('worker', 'barangay_admin'))
  );

-- =====================================================================
-- progress_observations
-- =====================================================================
CREATE POLICY "Staff view observations" ON progress_observations
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('worker', 'official', 'barangay_admin'))
  );

CREATE POLICY "Parents view linked observations" ON progress_observations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM guardians g
      JOIN pupils p ON p.id = g.pupil_id
      WHERE p.id = progress_observations.pupil_id AND g.user_id = auth.uid()
    )
  );

CREATE POLICY "Workers and admins record observations" ON progress_observations
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('worker', 'barangay_admin'))
  );

-- =====================================================================
-- notifications
-- =====================================================================
CREATE POLICY "Users view their notifications" ON notifications
  FOR SELECT USING (recipient_id = auth.uid()::text OR recipient_id = 'all');

CREATE POLICY "Workers and admins send notifications" ON notifications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('worker', 'barangay_admin'))
  );

-- =====================================================================
-- audit_logs
-- =====================================================================
CREATE POLICY "Admins view audit logs" ON audit_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'barangay_admin')
  );
-- Audit log writes are performed server-side with the service-role key
-- (which bypasses RLS). No client INSERT policy exists, so users cannot
-- forge audit entries.
```

### 4. Verify the policies

```sql
SELECT schemaname, tablename, policyname FROM pg_policies
WHERE tablename IN ('users','pupils','guardians','attendance','progress_observations','notifications','audit_logs')
ORDER BY tablename, policyname;
```

---

## Local Development Setup

```bash
# 1. Clone the repository
git clone <repo-url>
cd "Bacong Daycare"

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 4. Start development server
npm run dev
# → App running at http://localhost:3000
```

---

## Vercel Deployment

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login and link project
vercel login
vercel link

# 3. Add environment variables via dashboard
# Vercel Dashboard → Settings → Environment Variables
# Add all variables from .env.example

# 4. Deploy
vercel --prod
```

---

## GitHub Actions Secrets Required

Set these in: GitHub repo → Settings → Secrets and variables → Actions

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

---

## Post-Deployment Checklist

- [ ] Supabase tables created and RLS enabled
- [ ] At least one admin user provisioned via Supabase Auth
- [ ] `.env.local` / Vercel environment variables set
- [ ] Test login flow as each role (worker, official, admin, parent)
- [ ] Test attendance save and verify Supabase row created
- [ ] Test pupil enrollment and verify Supabase row created
- [ ] Verify parent can only see their own child's data

---

## Support

For technical issues, contact the system developer or refer to:
- [Supabase Docs](https://supabase.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [Vercel Docs](https://vercel.com/docs)
