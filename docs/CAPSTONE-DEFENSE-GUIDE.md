# SYSTEM DEFENSE GUIDE
### Bacong Daycare Center Management System
**Prepared from full codebase review — September 2026**

---

## 1. EXECUTIVE SUMMARY

The **Bacong Daycare Center Management System** is a web-based information system built specifically for the Barangay Bacong Daycare Center. It digitizes the daycare's core administrative workflows — pupil enrollment, daily attendance tracking, developmental assessments using the DSWD/DepEd ECCD checklist, document generation, and parent communication — that were previously done manually using paper forms.

The system is designed around **three user roles**: a Daycare Worker who manages everything operational, Barangay Officials who see only aggregate figures for oversight, and Parents who can monitor their child's progress and communicate with the teacher. It is built as a secure, server-rendered web application and requires no app installation — it runs in any modern browser.

> [!IMPORTANT]
> This system was built to satisfy the requirements of a capstone project aligned with a specific capstone paper. Features that are out of scope for the paper were deliberately removed. Everything that remains is directly tied to the capstone objectives.

---

## 2. SYSTEM OVERVIEW

### What the system is
A role-based web application for managing a Philippine community daycare center. It handles the full lifecycle of a child's enrollment — from registration to daily attendance to ECCD developmental assessment to official document generation.

### The main purpose
To replace paper-based processes at the Barangay Bacong Daycare Center with a digital system that is accurate, organized, secure, and compliant with Philippine laws (RA 8980 — Early Childhood Care and Development Act, and RA 10173 — Data Privacy Act).

### The problem it solves
- Attendance registers were handwritten and prone to errors
- ECCD checklists were filled on paper with no way to track history
- Parents had no visibility into their child's progress
- DSWD Form 1 (summary report) was computed manually
- No audit trail existed for sensitive data changes
- Parents could not submit absence excuses digitally

### Target users
| Role | Who they are |
|------|-------------|
| **Daycare Worker** | The assigned daycare teacher; primary system user |
| **Barangay Official** | Barangay Captain or authorized official; oversight only |
| **Parent / Guardian** | Enrolled child's parent; monitors child's progress |

### Main features
1. Pupil enrollment management (registration, verification, archiving)
2. Daily attendance register with consecutive absence detection
3. ECCD 109-item developmental assessment tool (3 evaluation rounds)
4. ECCD Child's Record 2 — auto-filled Word (.docx) document generation
5. DSWD Form 1 — PDF summary report generation
6. Parent absence note submission and inbox
7. Notification system (portal and email)
8. User account management with role-based access
9. Audit trail (immutable, server-written)
10. RA 10173 privacy consent tracking

### Major system modules
1. **Authentication & Authorization** — login, session, RBAC
2. **Enrollment Module** — pupil records, guardian linking, verification
3. **Attendance Module** — daily register, absence streak tracking
4. **ECCD Assessment Module** — 109-item checklist, scoring, reports
5. **Reports Module** — DSWD PDF Form 1, ECCD DOCX
6. **Notifications Module** — in-portal and email alerts
7. **Parent Communication Module** — absence notes, progress viewing
8. **Administration Module** — user management, settings, audit log
9. **Officials Dashboard** — aggregate statistics only

### Operational Workflow Diagram
The end-to-end operational flow across all actors (Super Admin, Daycare Teacher, Security Gate, Barangay Officials, Parents, and Center Management) is mapped in the system design board:
- Visual Board: [docs/diagrams/system-workflow-board.png](file:///C:/Bacong%20Daycare/docs/diagrams/system-workflow-board.png)
- Full Mermaid Architecture: See Section 2.C in [docs/SYSTEM-ARCHITECTURE-GUIDE.md](file:///C:/Bacong%20Daycare/docs/SYSTEM-ARCHITECTURE-GUIDE.md#c-operational--role-based-workflow-flowchart)

### "Explain it like I'm presenting to the panel"

*"Our system is a web-based management tool for the Barangay Bacong Daycare Center. Before this system, the teacher had to fill out attendance registers, ECCD checklists, and DSWD reports all on paper — which was time-consuming and hard to organize.*

*Our system lets the daycare worker record attendance on a tablet or laptop, assess children using the official DSWD 109-item ECCD developmental checklist, and generate official Word and PDF reports automatically.*

*Parents can log in to see their child's attendance and developmental progress. Barangay officials can see enrollment numbers and attendance summaries without ever seeing individual children's personal data.*

*Everything is stored securely in a cloud database, and all actions by users are tracked in an audit log. The system also complies with the Data Privacy Act — parents give consent before registering, and the system tracks which version of the privacy notice they agreed to."*

---

## 3. TECHNOLOGY STACK

### Frontend

| Technology | What it is | Where used | Why chosen | Alternatives |
|---|---|---|---|---|
| **Next.js 15** (App Router) | React-based full-stack web framework | Entire application structure, routing, API routes, SSR | Provides both frontend rendering AND backend API in one project; no separate server needed; App Router enables Server Components for security | Create React App (no backend), Express + React (two projects) |
| **React 19** | UI component library | All views and components | Industry standard for building interactive UIs; used by Next.js | Vue.js, Svelte, Angular |
| **TypeScript 5.7** | Typed superset of JavaScript | All `.ts` and `.tsx` source files | Catches bugs at compile time; makes large codebases maintainable; auto-documents function signatures | Plain JavaScript |
| **Tailwind CSS 3** | Utility-first CSS framework | All component styling | Rapid styling without writing custom CSS files; consistent design system | Bootstrap, Material UI, plain CSS |
| **lucide-react** | Icon library | All icons in the UI | Consistent, clean icon set; tree-shakable (only used icons are bundled) | Font Awesome, Heroicons |
| **Nunito / Quicksand** | Google Fonts via `next/font` | Body text / Headings | Child-friendly, readable fonts appropriate for a daycare context; loaded optimally by Next.js | System fonts |

### Backend

| Technology | What it is | Where used | Why chosen |
|---|---|---|---|
| **Next.js API Routes** | Server-side route handlers inside the Next.js project | All `/api/` endpoints | Same project, same language, no separate Express server needed |
| **Zod** | TypeScript-first schema validation library | All API route inputs | Validates and sanitizes every request body before it touches the database; prevents bad data |
| **`server-only`** | npm package that causes a build error if imported in client code | `src/lib/supabase/admin.ts` | Guarantees the service role key never leaks to the browser bundle |
| **jsPDF + jspdf-autotable** | PDF generation library | DSWD Form 1 PDF report | Generates proper vector PDF (not a screenshot); ~270KB vs. 9MB image-based approach |
| **JSZip + @xmldom/xmldom** | ZIP and XML manipulation | ECCD Child's Record 2 DOCX generation | .docx files are ZIP archives of XML; these libraries let us fill the official template programmatically |
| **Resend API** | Email sending service | Consecutive absence email notifications | Simple REST API for transactional email; does not require managing an SMTP server |

### Database / Infrastructure

| Technology | What it is | Where used | Why chosen |
|---|---|---|---|
| **Supabase** | Backend-as-a-Service built on PostgreSQL | Database, authentication, RLS | Provides a production-grade PostgreSQL database + Auth + Row Level Security in a managed cloud service; no need to manage a server |
| **PostgreSQL** | Relational database (runs inside Supabase) | All data storage | Supports RLS, triggers, SECURITY DEFINER functions — all critical to this system's security architecture |
| **Upstash Redis** | Serverless Redis for rate limiting | `src/lib/rateLimit.ts` | Serverless-compatible (unlike regular Redis); sliding window rate limiting across requests |

### Development Tools

| Tool | Purpose |
|---|---|
| **Git + GitHub** | Version control; all code tracked with commits and PRs |
| **Playwright** | End-to-end testing framework |
| **Node.js ≥ 20** | JavaScript runtime for Next.js |
| **npm ≥ 10** | Package manager |
| **ESLint** | Code linting and style enforcement |

---

## 4. PROGRAMMING LANGUAGES

> [!NOTE]
> A **programming language** is a formal set of instructions a computer can execute. A **framework** (like Next.js or React) is a collection of pre-written code in a programming language. A **library** (like Zod, jsPDF) is a reusable set of functions. A **platform** (like Supabase) is a managed service. These are different things.

| Language | Category | Where used | Why appropriate |
|---|---|---|---|
| **TypeScript** | Programming language | All source files (`.ts`, `.tsx`) — frontend components, backend API routes, services, libraries, hooks | Statically typed; catches bugs before runtime; scales well in large codebases |
| **JavaScript** | Programming language | Config files (`tailwind.config.js`, `playwright.config.ts` compiles to JS) | TypeScript compiles to JavaScript; the browser ultimately runs JavaScript |
| **SQL** | Query language | `supabase/schema.sql`, `supabase/seed.sql`, RLS policies, trigger, SECURITY DEFINER function | Standard language for relational databases; PostgreSQL-specific features used (RLS, triggers) |
| **HTML** | Markup language | JSX in `.tsx` files compiles to HTML at render time | Defines document structure; always present in web apps even when written as JSX |
| **CSS** | Styling language | `globals.css`, Tailwind utility classes in all components | Defines visual appearance |
| **JSON** | Data format | `package.json`, `tsconfig.json`, test fixtures, API request/response bodies | Standard data exchange format |

---

## 5. SYSTEM ARCHITECTURE

### Architecture Type
**Server-Side Rendered (SSR) Monolith with BaaS** — Next.js App Router with Supabase as the managed backend.

```
┌─────────────────────────────────────────────────────────────┐
│                        USER BROWSER                         │
│          (any device — laptop, tablet, phone)               │
└─────────────────────┬───────────────────────────────────────┘
                      │  HTTPS
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   NEXT.JS APPLICATION                        │
│                  (Vercel / Node.js host)                    │
│                                                             │
│  ┌─────────────────────┐    ┌──────────────────────────┐   │
│  │   React Server      │    │   Next.js API Routes     │   │
│  │   Components        │    │   /api/pupils            │   │
│  │   (page.tsx,        │    │   /api/attendance/bulk   │   │
│  │    layout.tsx)      │    │   /api/eccd/report       │   │
│  │                     │    │   /api/reports/summary   │   │
│  │   React Client      │    │   /api/users/create      │   │
│  │   Components        │    │   /api/audit-log         │   │
│  │   ('use client')    │    │   /api/notifications     │   │
│  │   Views, Modals,    │    │   /api/parent-notes      │   │
│  │   Sidebar           │    │   /api/progress          │   │
│  └─────────────────────┘    │   /api/settings          │   │
│                             └──────────┬─────────────────┘  │
│  ┌──────────────────────────────────── │ ───────────────┐   │
│  │             MIDDLEWARE              │                │   │
│  │   src/middleware.ts                 │                │   │
│  │   - Route protection (public/auth) │                │   │
│  │   - 503 on missing env vars (prod) │                │   │
│  └──────────────────────────────────── │ ───────────────┘   │
└─────────────────────────────────────── │ ───────────────────┘
                                         │
          ┌──────────────────────────────┼────────────────────┐
          │                             │                    │
          ▼                             ▼                    ▼
┌─────────────────┐          ┌─────────────────┐   ┌───────────────┐
│    SUPABASE     │          │  UPSTASH REDIS  │   │  RESEND API   │
│                 │          │                 │   │               │
│  PostgreSQL DB  │          │  Rate Limiting  │   │  Email Alerts │
│  Row-Level Sec. │          │  (sliding win.) │   │  (absence     │
│  Auth (GoTrue)  │          │                 │   │   notif.)     │
│  RLS Policies   │          └─────────────────┘   └───────────────┘
│  Triggers       │
└─────────────────┘
```

---

## 6. DATABASE SUMMARY (16 Tables)

1. `school_years` — Tracks academic terms (e.g., SY 2026-2027)
2. `center_settings` — Singleton record (boolean PK `id = true`) storing center name and signatories
3. `users` — Linked 1:1 with `auth.users(id)` via ON DELETE CASCADE. Stores role (`worker`, `official`, `parent`), status, and RA 10173 consent version
4. `pupils` — Primary student profile, enrollment status (`pending`, `enrolled`, `rejected`, `archived`), and calculated `consecutive_absences`
5. `guardians` — Connects pupils to parents/users. `UNIQUE(pupil_id, phone)` prevents duplicates
6. `attendance` — Daily attendance record. `UNIQUE(pupil_id, date)` guarantees one entry per pupil per day and enables atomic upserts
7. `progress_domains` — 11 domain lookup items (gross motor, fine motor, self-help, etc.)
8. `progress_observations` — Observational milestones per round
9. `audit_log` — Server-only immutable audit trail (no public INSERT policy)
10. `notifications` — Portal and email notification queue
11. `parent_notes` — Absence excuse notes submitted by parents; reviewed in Worker Inbox
12. `eccd_scores` — Composite PK `(pupil_id, domain_id, evaluation_round)` storing raw and scaled scores
13. `child_backgrounds` — 1:1 with `pupils` for ECCD Section 2 narrative background
14. `sociodemographic_profiles` — 1:1 with `pupils` storing parental education, occupation, and birth order
15. `eccd_evaluations` — Composite PK `(pupil_id, evaluation_round)` storing overall standard score
16. `eccd_item_comments` — Composite PK `(pupil_id, evaluation_round, milestone_code)` for examiner item notes

**Attendance Trigger:** PostgreSQL window function trigger on `attendance` runs on every insert/update, recalculating unbroken consecutive absence streaks (bounded to 120 days) directly into `pupils.consecutive_absences`.

**RLS Helper:** `current_user_role()` runs as `SECURITY DEFINER` reading directly from `public.users` (not user-editable JWT metadata).

---

## 7. CRITICAL SECURITY DEFENSE ANSWERS

### Why officials cannot see individual child records:
1. **Application level:** `OfficialView.tsx` only renders aggregate charts and counts.
2. **API level:** `/api/reports/summary` runs aggregate queries returning counts only.
3. **Database level:** PostgreSQL RLS gives the `official` role zero SELECT permissions on `pupils`, `attendance`, `guardians`, and ECCD tables.

### How IDOR is prevented in reports:
Before `/api/eccd/report` streams a child's DOCX report, it performs a server-side relationship verification confirming the logged-in parent is listed in `guardians` for that specific `pupil_id`.

---

## 8. QUICK RECAP: 20 PRIORITY QUESTIONS

1. **What is your system?** A web-based daycare management system for Barangay Bacong digitizing attendance, ECCD assessment, and DSWD reporting.
2. **What problem does it solve?** Eliminates error-prone paper records, automates DSWD Form 1 and ECCD Child Record 2 document generation, and provides real-time parent notifications.
3. **Who are the users?** Daycare Worker (full operations), Barangay Officials (summary metrics only), Parents (child portal).
4. **Is React a programming language?** No, React is a UI library. The language is TypeScript/JavaScript.
5. **Why TypeScript?** Catches type errors at compile time, ensures strict interface contracts, and simplifies refactoring.
6. **Why Next.js?** Unified full-stack architecture — Server Components, API routes, and frontend in one deployable unit.
7. **Where is your backend?** Inside Next.js App Router API routes (`src/app/api/*`), executing server-side on Node.js.
8. **What is Supabase?** A Backend-as-a-Service providing PostgreSQL, GoTrue authentication, and Row Level Security.
9. **What is Row Level Security (RLS)?** Database-level access control that filters rows based on the requesting user's identity and role.
10. **Why use an attendance trigger?** Guarantees that `consecutive_absences` is always recalculated at the database engine level, avoiding application race conditions.
11. **How do you prevent duplicate daily attendance?** `UNIQUE(pupil_id, date)` constraint on the `attendance` table paired with SQL upsert.
12. **Can users tamper with audit logs?** No. The `audit_log` table has no client INSERT policy; it is only written by the server admin client.
13. **How does ECCD assessment work?** 109 checklist items across 7 domains evaluated in 3 rounds. Raw scores sum checkmarks; scaled scores (1-19) are derived from DSWD age tables; standard scores represent overall development.
14. **How is the ECCD Word report generated?** JSZip and `@xmldom/xmldom` load the official `.docx` template as a ZIP/XML package, populate form fields, and stream the generated binary.
15. **How is DSWD Form 1 generated?** jsPDF and `jspdf-autotable` generate a high-performance vector PDF (~270KB) on the server.
16. **How do you comply with RA 10173?** Informed consent tracking with versioning, role-based data minimization, session local storage wipe on logout, and an immutable audit trail.
17. **What testing was performed?** Playwright end-to-end tests covering RBAC, RLS policies, attendance, enrollment, accessibility, and security APIs.
18. **Why no native mobile app?** A responsive web app delivers instant cross-platform access without APK installation or update distribution overhead.
19. **What is the system's biggest limitation?** Requires an internet connection (no offline PWA caching yet).
20. **What are your future recommendations?** Offline PWA sync, direct SMS gateway integration, and expanded multi-center tenant isolation.

---
*For the complete 25-section guide, refer to the full markdown artifact.*
