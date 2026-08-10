# 🏫 Barangay Bacong Daycare Center Tracker

A comprehensive daycare management system built for **Barangay Bacong, Negros Oriental** — tracking pupil enrollment, daily attendance, ECCD milestone evaluations, and generating DSWD-compliant reports.

---

## ✨ Features

### 👩‍🏫 Daycare Worker
- Pupil enrollment & profile management (with guardian info)
- Daily attendance register (Present / Absent / Late)
- ECCD 7-domain milestone observation logging
- Class announcements & parent notifications
- DSWD Form 1 PDF report generation
- Archive graduated/withdrawn pupils

### 🏛️ Barangay Official
- Read-only oversight dashboard
- Real-time enrollment & attendance statistics
- Consecutive absence alerts (3+ days auto-notification)
- Monthly trend reports

### 🔐 Barangay Admin
- User account management (create, disable, reset password)
- Role-based access control (Worker / Official / Admin / Parent)
- System-wide audit log with search & pagination
- School year management

### 👨‍👩‍👧 Parent / Guardian
- View child's attendance history & calendar
- Receive real-time notifications (absences, announcements)
- Access ECCD milestone progress report
- View upcoming barangay events

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
├── app/              # Next.js App Router pages & API routes
│   ├── api/          # REST API endpoints
│   └── login/        # Login page
├── components/       # Reusable UI components
├── contexts/         # DaycareContext — global state
├── data/             # Mock/seed data
├── lib/              # Supabase client utilities
├── services/         # API service layer
├── types/            # TypeScript type definitions
├── views/            # Role-based dashboard views
│   ├── WorkerView.tsx
│   ├── OfficialView.tsx
│   ├── AdminView.tsx
│   └── ParentView.tsx
└── middleware.ts      # Auth middleware
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
