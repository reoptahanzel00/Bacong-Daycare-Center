# 🤝 Contributing & Handoff Guide — Barangay Bacong Daycare Center Tracker

Welcome to the **Barangay Bacong Daycare Center Tracker** repository!  
This project is developed as an official thesis/capstone daycare management platform for **Barangay Bacong, Negros Oriental, Philippines**.

---

## 📋 System Architecture Overview

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 15 (App Router), Tailwind CSS, Lucide React | Glassmorphic UI, responsive PWA |
| **Backend** | Next.js API Routes, `@supabase/ssr` | REST endpoints & server auth validation |
| **Database** | Supabase (PostgreSQL 15) | Relational database with composite indexes & RLS |
| **State** | `DaycareContext` | Centralized global state provider |
| **PDF** | jsPDF + html2canvas | DSWD Form 1 compliant report exports |
| **Testing** | Playwright | End-to-end and security test suite |

---

## 🛠️ Local Development Setup

### 1. Requirements
- **Node.js**: `>= 20.0.0`
- **npm**: `>= 10.0.0`
- **Git**: `>= 2.40`

### 2. Quick Start
```bash
# Clone the repository
git clone https://github.com/reoptahanzel00/Bacong-Daycare-Center.git
cd Bacong-Daycare-Center

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# Start development server
npm run dev
# → http://localhost:3000
```

---

## 🗄️ Database Tables & DSWD Form 1 Mapping Matrix

| Form Field | Database Table | Column Name | Data Type | Notes |
|---|---|---|---|---|
| **Pupil ID** | `pupils` | `id` | `TEXT (PK)` | Format: `PUP-2026-XXX` |
| **First Name** | `pupils` | `first_name` | `TEXT` | Required |
| **Last Name** | `pupils` | `last_name` | `TEXT` | Required |
| **Date of Birth** | `pupils` | `birth_date` | `DATE` | `YYYY-MM-DD` |
| **Sex** | `pupils` | `sex` | `TEXT` | `Male` \| `Female` |
| **Barangay Address** | `pupils` | `address` | `TEXT` | Default: `Barangay Bacong` |
| **Guardian Name** | `guardians` | `full_name` | `TEXT` | Primary Contact |
| **Relationship** | `guardians` | `relationship` | `TEXT` | Mother, Father, etc. |
| **Guardian Phone** | `guardians` | `phone` | `TEXT` | Format: `09XX-XXX-XXXX` |
| **Consecutive Absences** | `pupils` | `consecutive_absences` | `INTEGER` | Auto-calculated by DB trigger |
| **Academic Year** | `school_years` | `label` | `TEXT` | e.g. `SY 2025-2026` |

---

## 🔒 Data Privacy & Security Guidelines (RA 10173)

1. **Child Data Protection**: Personal Identifiable Information (PII) of minors must never be logged or rendered in raw client logs.
2. **Row Level Security (RLS)**: RLS is active on all 9 PostgreSQL tables. Parent accounts can only access records where `guardians.user_id = auth.uid()`.
3. **Soft Delete**: Archived pupils are marked with `enrollment_status = 'archived'` rather than `DELETE` queries to preserve historical DSWD audit reports.

---

## 🧪 Testing Checklist

Before submitting a Pull Request, run:

```bash
# Type check & lint
npm run lint

# Production build verification
npm run build

# Run Playwright E2E tests
npm run test:e2e
```
