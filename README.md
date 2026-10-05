# 🏫 Barangay Bacong Daycare Center Tracker

A comprehensive daycare management system built for **Barangay Bacong, San Luis, Aurora** — tracking pupil enrollment, daily attendance, ECCD milestone evaluations, and generating DSWD-compliant reports.

---

## ✨ Features

### 👩‍🏫 Daycare Worker
- Pupil enrollment & profile management (with guardian info)
- Daily attendance register (Present / Absent / Late)
- ECCD 7-domain milestone observation logging
- 109-item ECCD checklist (3 rounds, item comments) that fills the official Child's Record 2 Word form
- Parent notifications (absence alerts, enrollment decisions)
- Verify parent enrollments: age check (3y 1m – 5y), birth certificate on file, health & special needs; approve, or return to the parent with a reason (the parent resubmits)
- Enrolled counts: boys, girls and children with special needs
- Approve or decline numbered excuse letters (Excuse 1, Excuse 2, …)
- DSWD Form 1 PDF report generation
- Archive graduated/withdrawn pupils, with an Archived Pupils panel to restore them
- User account management (create, disable, reset password, link parents)
- Audit trail (written by the server for every change) and centre settings

### 👨‍👩‍👧 Parent / Guardian
- Enroll a child: health & special needs first, split guardian name, Barangay Bacong or "Other" address, birth certificate upload
- A returned enrollment shows as PENDING with the reason; correct it and resubmit
- Forgot-password reset by email
- Sign in with email or the child's Student ID
- View child's attendance history
- Receive notifications (absence alerts, enrollment decisions)
- View and download the child's ECCD Child's Record 2 as a PDF, identical to the worker's copy

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| **Backend** | Next.js API Routes, Supabase |
| **Database** | PostgreSQL (via Supabase) |
| **Auth** | Supabase Auth (email/password) |
| **PDF** | jsPDF + autoTable |
| **Testing** | Playwright E2E |
| **CI/CD** | GitHub Actions |
| **Deployment** | Vercel (recommended) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- npm 10+
- A [Supabase](https://supabase.com) project

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/reoptahanzel00/Bacong-Daycare-Center.git
cd Bacong-Daycare-Center

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 4. Start development server
npm run dev
# → http://localhost:3000
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for full database setup instructions with SQL schema.

---

## 📁 Project Structure

```
src/
├── app/              # Next.js App Router: pages, API routes (app/api), auth callbacks
├── components/       # Reusable UI components and modals
├── contexts/         # DaycareContext — global client state
├── data/             # ECCD checklist (generated) and offline demo data
├── hooks/            # Shared React hooks (modal accessibility)
├── lib/              # Server and shared utilities (auth, Supabase clients, exports)
├── services/         # Client-side API service layer
├── templates/        # Official ECCD Child's Record 2 Word template
├── views/            # Role-based screens: WorkerView, AdminView, ParentView
└── middleware.ts     # Session refresh and route protection
supabase/             # schema.sql (fresh database) and migrations/ (live changes)
scripts/              # Contract/RLS checks, test-user seeding, checklist generator
tests/                # Playwright end-to-end tests
docs/                 # Architecture and defense guides; audits/ holds audit reports
```

---

## 🧪 Testing

```bash
# Run Playwright E2E tests
npx playwright test

# Run with UI
npx playwright test --ui
```

---

## 📦 Deployment

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for:
- Full Supabase database schema (SQL)
- Row Level Security (RLS) policies
- Vercel deployment guide
- GitHub Actions secrets setup

---

## 👥 Team

| Name | Role |
|---|---|
| Hanzel Reopta | Project Lead / Developer |

---

## 📄 License

This project is developed as a capstone/thesis project for Barangay Bacong Daycare Center. All rights reserved.
