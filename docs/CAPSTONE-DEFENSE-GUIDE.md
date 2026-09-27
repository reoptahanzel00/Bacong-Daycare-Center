# SYSTEM DEFENSE GUIDE
### Bacong Daycare Center Management System
**Prepared from full codebase review — September 2026**

---

## 1. EXECUTIVE SUMMARY

The **Bacong Daycare Center Management System** is a web-based information system built specifically for the Barangay Bacong Daycare Center. It digitizes the daycare's core administrative workflows — pupil enrollment, daily attendance tracking, developmental assessments using the DSWD/DepEd ECCD checklist, document generation, and parent communication — that were previously done manually using paper forms.

The system is designed around **two user roles**: a Daycare Worker who manages everything operational (including user accounts, the audit trail and the reports sent to the Barangay and DSWD), and Parents who enroll their child, monitor their child's progress and communicate with the teacher. The Barangay Official role was removed after the panel review; the Barangay receives the DSWD Form 1 summary report instead of logging in. It is built as a secure, server-rendered web application and requires no app installation — it runs in any modern browser.

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
| **Parent / Guardian** | Enrolled child's parent; monitors child's progress |

### Main features
1. Pupil enrollment: online parent registration with health & special needs, birth certificate upload and age validation (3 years 1 month to 5 years); worker verification, return-for-correction and parent resubmission; archiving and restoring
2. Daily attendance register (no future dates) with consecutive absence detection
3. ECCD 109-item developmental assessment tool (3 evaluation rounds)
4. ECCD Child's Record 2 — PDF download identical for parent and worker (editable Word copy also available)
5. DSWD Form 1 — PDF summary report generation, including boys, girls and children with special needs
6. Numbered excuse letters (Excuse 1, Excuse 2, …) that the worker approves or declines
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
8. **Administration Module** — user management, settings, audit log, archived pupils

### Operational Workflow Diagram
The end-to-end operational flow across all actors is mapped in the system design board. Note: the board predates the panel revisions and still shows a Barangay Official lane; that role has since been removed (see Section 9).
- Visual Board: [docs/diagrams/system-workflow-board.png](file:///C:/Bacong%20Daycare/docs/diagrams/system-workflow-board.png)
- Full Mermaid Architecture: See Section 2.C in [docs/SYSTEM-ARCHITECTURE-GUIDE.md](file:///C:/Bacong%20Daycare/docs/SYSTEM-ARCHITECTURE-GUIDE.md#c-operational--role-based-workflow-flowchart)

### "Explain it like I'm presenting to the panel"

*"Our system is a web-based management tool for the Barangay Bacong Daycare Center. Before this system, the teacher had to fill out attendance registers, ECCD checklists, and DSWD reports all on paper — which was time-consuming and hard to organize.*

*Parents enroll their child online: they answer the health and special-needs questions first, enter the guardian's last, first and middle name, and upload the child's birth certificate. The system checks that the child is 3 years 1 month to 5 years old. The daycare worker then approves the enrollment, or returns it with a reason; the parent sees it as pending, corrects it and resubmits.*

*The daycare worker records attendance on a tablet or laptop, assesses children using the official DSWD 109-item ECCD developmental checklist, and generates the ECCD record and the DSWD Form 1 as PDFs automatically.*

*Parents can log in to see their child's attendance and the same ECCD record the worker sees, and send numbered excuse letters that the worker approves or declines. The Barangay receives summary figures through the DSWD Form 1 report, never individual children's records.*

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
| **jsPDF + jspdf-autotable** | PDF generation library | DSWD Form 1 and ECCD Child's Record 2 PDFs | Generates proper vector PDF (not a screenshot); small files with selectable text |
| **JSZip + @xmldom/xmldom** | ZIP and XML manipulation | Editable ECCD Child's Record 2 DOCX copy | .docx files are ZIP archives of XML; these libraries let us fill the official template programmatically |
| **Resend API** | Email sending service | Consecutive absence email notifications | Simple REST API for transactional email; does not require managing an SMTP server |

### Database / Infrastructure

| Technology | What it is | Where used | Why chosen |
|---|---|---|---|
| **Supabase** | Backend-as-a-Service built on PostgreSQL | Database, authentication, RLS, private Storage for birth certificates | Provides a production-grade PostgreSQL database + Auth + Row Level Security in a managed cloud service; no need to manage a server |
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
3. `users` — Linked 1:1 with `auth.users(id)` via ON DELETE CASCADE. Stores role (`worker`, `parent`), last/first/middle name, status, and RA 10173 consent version
4. `pupils` — Primary student profile, enrollment status (`pending`, `enrolled`, `rejected` = returned to parent, `archived`), health conditions, special needs, `submitted_at` (date and time the parent enrolled), `verified_at`, `resubmission_count`, and calculated `consecutive_absences`
5. `guardians` — Connects pupils to parents/users, with last/first/middle name. `UNIQUE(pupil_id, phone)` prevents duplicates
6. `attendance` — Daily attendance record. `UNIQUE(pupil_id, date)` guarantees one entry per pupil per day and enables atomic upserts
7. `progress_domains` — 11 domain lookup items (gross motor, fine motor, self-help, etc.)
8. `progress_observations` — Observational milestones per round
9. `audit_log` — Server-only immutable audit trail (no public INSERT policy)
10. `notifications` — Portal and email notification queue
11. `parent_notes` — Excuse letters submitted by parents, numbered per child (`excuse_no`, assigned by a trigger) and approved or declined by the worker
12. `eccd_scores` — Composite PK `(pupil_id, domain_id, evaluation_round)` storing raw and scaled scores
13. `child_backgrounds` — 1:1 with `pupils` for ECCD Section 2 narrative background
14. `sociodemographic_profiles` — 1:1 with `pupils` storing parental education, occupation, and birth order
15. `eccd_evaluations` — Composite PK `(pupil_id, evaluation_round)` storing overall standard score
16. `eccd_item_comments` — Composite PK `(pupil_id, evaluation_round, milestone_code)` for examiner item notes

**Attendance Trigger:** PostgreSQL window function trigger on `attendance` runs on every insert/update, recalculating unbroken consecutive absence streaks (bounded to 120 days) directly into `pupils.consecutive_absences`.

**Excuse Numbering Trigger:** `trg_assign_excuse_no` gives each new excuse letter the next number for that child (Excuse 1, Excuse 2, …), with a per-child advisory lock so two letters filed at once cannot share a number.

**Birth Certificates:** stored in the private Supabase Storage bucket `enrollment-docs` at `<pupil_id>/birth-certificate`. The bucket has no client policies: the server checks the guardian link or worker role, then issues a single-use signed upload URL or a 10-minute signed download URL.

**RLS Helper:** `current_user_role()` runs as `SECURITY DEFINER` reading directly from `public.users` (not user-editable JWT metadata).

---

## 7. CRITICAL SECURITY DEFENSE ANSWERS

### Why a parent cannot see another child's records:
1. **Application level:** the parent portal only loads children linked to the parent's account.
2. **API level:** every child-specific route (ECCD report, documents, resubmit, excuse letters) checks the `guardians` link on the server.
3. **Database level:** PostgreSQL RLS returns only rows whose `pupil_id` is linked to `auth.uid()` in `guardians`.

### Why the age and document checks cannot be bypassed:
The 3 years 1 month to 5 years rule is one function (`enrollmentAgeError` in `src/lib/enrollment.ts`) called by the form **and** by the signup, pupils and resubmit APIs, so skipping the form does not skip the rule. Birth certificates never pass through the browser with a storage credential; the server issues a one-time upload URL only after checking who is asking.

### How IDOR is prevented in reports:
Before `/api/eccd/report` streams a child's DOCX report, it performs a server-side relationship verification confirming the logged-in parent is listed in `guardians` for that specific `pupil_id`.

---

## 8. QUICK RECAP: 20 PRIORITY QUESTIONS

1. **What is your system?** A web-based daycare management system for Barangay Bacong digitizing attendance, ECCD assessment, and DSWD reporting.
2. **What problem does it solve?** Eliminates error-prone paper records, automates DSWD Form 1 and ECCD Child Record 2 document generation, and provides real-time parent notifications.
3. **Who are the users?** Two roles: the Daycare Worker (full operations, accounts, reports) and Parents (enrollment and child portal). The Barangay Official role was removed after the panel review; the Barangay receives the DSWD Form 1 report.
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
14. **How is the ECCD record generated?** The server assembles one record (GET `/api/eccd/report?format=json`); the browser renders it on screen and draws the same record as a PDF with jsPDF, so parent and worker get an identical file. An editable Word copy is filled from the official `.docx` template with JSZip and `@xmldom/xmldom`.
15. **How is DSWD Form 1 generated?** jsPDF and `jspdf-autotable` draw a vector PDF in the browser, including enrolled boys, girls and children with special needs.
16. **How do you comply with RA 10173?** Informed consent tracking with versioning, role-based data minimization, session local storage wipe on logout, and an immutable audit trail.
17. **What testing was performed?** Playwright end-to-end tests covering RBAC, RLS policies, attendance, enrollment, accessibility, and security APIs.
18. **Why no native mobile app?** A responsive web app delivers instant cross-platform access without APK installation or update distribution overhead.
19. **What is the system's biggest limitation?** Requires an internet connection (no offline PWA caching yet).
20. **What are your future recommendations?** Offline PWA sync, direct SMS gateway integration, and expanded multi-center tenant isolation.

---

## 9. PANEL REVISIONS (September 2026)

Changes made in response to the capstone panel's review, and how to demonstrate each.

| Panel comment | What the system does now | Where to show it |
|---|---|---|
| Remove Barangay from the panel | Barangay Official role removed; two roles remain (Worker, Parent). Existing official accounts were disabled. | Sign-in page role list; worker User Accounts |
| Guardian last, first, middle name | Guardian name is entered as three fields and stored as "Last, First Middle" | Parent Create Account; worker Enroll New Pupil |
| Age validation + birth certificate | Child must be 3 years 1 month to 5 years; birth certificate (PDF/JPG/PNG, ≤5 MB) required; missing documents can be attached later | Create Account; worker Verify Enrollments shows "Age OK" and "View birth certificate" / "Missing birth certificate" |
| "Rejected" should read "PENDING" | Parents see PENDING with the worker's reason; never the word "rejected" | Parent portal of a returned child |
| Rejected account stays alive and can resubmit | Account stays active; parent corrects and resubmits; the child returns to the worker's queue | Parent "Correct & Resubmit Enrollment" |
| Know when/how to reject; move rejected to a table | Worker "Return to Parent" with standard reasons (missing certificate, age, incomplete info); returned enrollments listed in a separate table | Verify Enrollments |
| "Other" for other places | Address defaults to Brgy. Bacong, San Luis, Aurora; "Other" opens free-text fields | Create Account → Address |
| Date and time of enrollment | Each enrollment shows when the parent submitted it (date and time) | Verify Enrollments card; parent pending notice |
| Enroll not clickable after approval; different color | After approval the card shows a green, non-clickable ENROLLED badge; Enrolled badges are green everywhere | Verify Enrollments; Enrolled Pupils |
| Capital NOTIFY on approval | Parent notification titled "ENROLLMENT APPROVED" | Parent notification bell |
| Change notification icon | Bell rings when unread; icons per type (approved ✓, action needed !, absence calendar) | Notification drawer |
| Approve excuses, "Excuse 1" for parent and worker | Letters numbered per child; worker approves or declines; both sides see the same label and status | Parent Notes; worker Parent Notes Inbox |
| Archive in the last panel | "Archived Pupils" is the worker's last menu item, with Restore | Worker sidebar |
| ECCD as PDF, same for parent and worker, downloadable | ECCD Child's Record 2 downloads as PDF; parent's ECCD tab shows the same record the worker sees | Parent ECCD tab; worker ECCD Record |
| Forgot password for parents | "Forgot password?" on the sign-in page sends a reset link to the account email | Sign-in page |
| No advanced dates on attendance | Future dates are blocked on the date picker and rejected by the server | Daily Register date picker |
| Count of enrolled boys, girls, special needs | Stat row on Enrolled Pupils; also on DSWD Form 1 | Enrolled Pupils; DSWD report |
| Illness asked before enrolling | "Child Health & Special Needs" is the first section of the child's enrollment form | Create Account |

