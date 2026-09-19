# System Audit Prompt — Bacong Daycare Center Tracker

> **How to use this document:**
> Paste the block below into an AI assistant (e.g. Antigravity, Claude, Gemini) and ask it to run a full audit.
> The AI should execute every command, read every file, and produce a new audit report in the same format as `docs/AUDIT-2026-09-15.md`.
> Update the **Findings Tracker** at the bottom after each audit run.

---

## Prompt Block (paste this into your AI assistant)

```
You are auditing the Barangay Bacong Daycare Center Tracker — a Next.js 15 / Supabase application
that tracks enrollment, daily attendance, and developmental progress for a Philippine barangay daycare.
The codebase is at: C:\Bacong Daycare
The live production site is: https://bacong-daycare-center.vercel.app
The Supabase project reference is: ukzruwisvuemdjjqgoko

Your job is to run a full pre-deployment audit across 7 gates and produce a report in the format of
docs/AUDIT-2026-09-15.md. For each gate: run the listed commands, read the listed files, and produce
explicit PASS / PASS WITH FINDINGS / FAIL verdicts with evidence. Do not skip any gate.
After all gates, produce a final DEPLOY / DEPLOY WITH NOTED RISKS / DO NOT DEPLOY verdict.

---

GATE 0 — Mechanical Checks

Run these commands exactly and report each exit code and output:

    npm run build
    npx tsc --noEmit
    npm run lint
    npm run check:contract
    npm run check:rls
    npx playwright test --reporter=list

Expected: all exit 0. Note any failures, warnings, or skipped tests.

Also check:
- git status --porcelain   (expect clean; flag any untracked files that look sensitive)
- git log --oneline -5     (note the current HEAD commit)

---

GATE 1 — Authentication & RBAC

For every file under src/app/api/**/route.ts, verify:
1. getServerSession() is called BEFORE any data access or response.
2. authorizeRole() is called with the correct allowed roles.
3. The route returns 401 when not authenticated and 403 when the role is wrong.
4. No route trusts user_metadata for authorization.
5. The admin Supabase client is imported only server-side.

Check src/lib/auth.ts: getServerSession() must fail CLOSED.
Check src/middleware.ts: public paths, redirect logic, startsWith() guard (L1), env-missing pass-through (L2).

Role matrix to verify:
  GET  /api/pupils              worker=YES official=NO  parent=YES(scoped) unauth=NO
  POST /api/pupils              worker=YES official=NO  parent=NO          unauth=NO
  POST /api/pupils/verify       worker=YES official=NO  parent=NO          unauth=NO
  POST /api/attendance/bulk     worker=YES official=NO  parent=NO          unauth=NO
  GET  /api/reports/summary     worker=YES official=YES parent=NO          unauth=NO
  GET  /api/eccd                worker=YES official=NO  parent=YES(scoped) unauth=NO
  POST /api/eccd                worker=YES official=NO  parent=NO          unauth=NO
  GET  /api/audit-log           worker=YES official=NO  parent=NO          unauth=NO
  POST /api/users/create        worker=YES official=NO  parent=NO          unauth=NO
  POST /api/auth/login          any role   any role     any role           YES
  POST /api/auth/signup         any role   any role     any role           YES
  GET  /api/health              any role   any role     any role           YES

---

GATE 2 — Database Schema and RLS

1. Run: npm run check:contract  (no migration/schema drift)
2. Run: npm run check:rls  (all tables have RLS + at least one policy)
3. CRITICAL — verify 'official' is absent from SELECT policies on:
   pupils, guardians, sociodemographic_profiles, attendance, parent_notes,
   child_backgrounds, eccd_scores, eccd_evaluations, eccd_item_comments, progress_observations
   In Supabase SQL Editor:
     SELECT tablename, policyname FROM pg_policies
     WHERE schemaname = 'public' AND qual ILIKE '%official%';
   Expected: zero rows. If any rows found, B2 is OPEN (BLOCKER).
4. Verify parent isolation: all child-data tables scope parents via
   pupil_id IN (SELECT pupil_id FROM guardians WHERE user_id = auth.uid())
5. Verify current_user_role() reads from public.users, not user_metadata.
6. Verify NO UPDATE policy exists on public.users (prevents role self-assignment).
7. Verify absence trigger uses ROWS UNBOUNDED PRECEDING (not row-by-row loop).
   SELECT pg_get_functiondef('calculate_consecutive_absences()'::regprocedure)
          LIKE '%ROWS UNBOUNDED PRECEDING%' AS trigger_is_current;

---

GATE 3 — Data Privacy (RA 10173)

B1 — Privacy notice placeholders:
  grep -n PLACEHOLDER src/app/privacy/page.tsx
  If any lines found: B1 is OPEN (BLOCKER). Check PRIVACY_NOTICE_VERSION in src/lib/privacyNotice.ts.

B3 — Service worker cache (should be fixed):
  Read public/sw.js. Must NOT cache authenticated page responses.
  If it caches same-origin GETs outside /api/ and /_next/: B3 is OPEN (BLOCKER).

M2 — localStorage cleared on session end (should be fixed):
  Verify clearStoredData() is called in:
  - src/app/login/page.tsx (useEffect on mount)
  - src/components/Header.tsx (sign-out handler)
  - src/components/Sidebar.tsx (sign-out handler)

Consent: verify privacy_consent_version is inserted at signup in src/app/api/auth/signup/route.ts.
Client errors: verify src/app/api/client-error/route.ts logs only role/path/message/stack, never pupil data.

---

GATE 4 — Correctness and Integrity

H1 — Attendance save failure (should be fixed):
  Read src/app/api/attendance/bulk/route.ts.
  On upsert error: must return { success: false } with HTTP 503. NOT success: true.

Enrollment transitions:
  Read src/lib/enrollment.ts — resolveEnrollmentStatus().
  Verify 'pending'/'rejected' cannot be moved to 'enrolled' via POST /api/pupils.
  Only POST /api/pupils/verify (worker-only) can approve.

ECCD age calculation:
  Read src/lib/eccdRecord.ts — computeAgeYMD().
  Must use 30-day month rule (not calendar months).

Audit trail coverage:
  grep -rn "recordAudit" src/app/api/
  Every write route must call recordAudit() using verified server session.

---

GATE 5 — Accessibility (WCAG 2.1 AA)

Run: npx playwright test tests/modal-a11y.spec.ts --reporter=list

Check tailwind.config.js: text contrast tokens must be >=4.5:1.
Check src/app/globals.css: !important :focus-visible ring must be present.
Check tailwind.config.js: --tap-target: 44px must apply to interactive elements on coarse pointers.

---

GATE 6 — Deployment Readiness

B4 — Legacy JWT keys:
  .env.local NEXT_PUBLIC_SUPABASE_ANON_KEY must start with sb_publishable_
  .env.local SUPABASE_SERVICE_ROLE_KEY must start with sb_secret_
  Verify in Supabase Dashboard: legacy JWT keys must be DISABLED.

H2 — Key rotation:
  git log --all -S "sb_secret_" --oneline
  git log --all -S "service_role" --oneline
  Any result = key was compromised; rotate immediately.

Production headers (run live):
  curl -I https://bacong-daycare-center.vercel.app
  Expect: CSP frame-ancestors none, HSTS max-age=63072000, X-Frame-Options DENY, nosniff.

No secrets in NEXT_PUBLIC_*:
  grep -rn "NEXT_PUBLIC_.*KEY\|NEXT_PUBLIC_.*SECRET" src/ next.config.mjs
  Only NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are legitimate.

Supabase Auth redirect URL:
  Dashboard → Authentication → URL Configuration → Redirect URLs must include:
  https://bacong-daycare-center.vercel.app/auth/callback

Rate limiting:
  KV_REST_API_URL and KV_REST_API_TOKEN must be set in Vercel production environment.

.gitignore coverage:
  grep -E "supabase/.temp" .gitignore  → must have a match (L3 fix)

---

OUTPUT FORMAT

Produce your report as:

# Pre-deployment audit — [DATE]
Scope: main at [HEAD], Supabase ukzruwisvuemdjjqgoko, https://bacong-daycare-center.vercel.app

## Verdict
[DEPLOY / DEPLOY WITH NOTED RISKS / DO NOT DEPLOY]

## Gate results
| Gate | Result | Notes |
|---|---|---|
...

## Findings
[Only OPEN findings, with severity, Where, What, How it fails, Evidence, Fix]

## Green — confirmed working
[Everything that passed]
```

---

## Findings Tracker

| ID | Severity | Summary | First Found | Status | Notes |
|---|---|---|---|---|---|
| B1 | BLOCKER | Privacy notice is a placeholder; no retention period or DPO contact | 2026-09-15 | **OPEN** | Lines 8, 39, 44 in src/app/privacy/page.tsx still say PLACEHOLDER. Replace with DPO-approved text and bump PRIVACY_NOTICE_VERSION before real pupil data is entered. |
| B2 | BLOCKER | Officials could read full child records | 2026-09-15 | **FIXED** | Fixed by migrations 20260917_01 and 20260918_01. Officials restricted to /api/reports/summary. Verify: no 'official' in child-table policies. |
| B3 | BLOCKER | Service worker cached authenticated pages; survived sign-out | 2026-09-15 | **FIXED** | public/sw.js replaced with self-removing stub (deletes caches, unregisters, reloads tabs). |
| B4 | BLOCKER | Legacy service-role JWT in public git history; legacy JWT keys enabled | 2026-09-15 | **PARTIALLY FIXED** | New key pair in use (.env.local + Vercel). Legacy JWT keys must still be disabled in Supabase Dashboard. |
| H1 | HIGH | Failed attendance save returned success: true; data silently lost | 2026-09-15 | **FIXED** | attendance/bulk/route.ts now returns 503 + success: false on any write failure. |
| H2 | HIGH | Supabase service-role secret key shared in AI chat (2026-09-15 and 2026-09-16) | 2026-09-15 | **OPEN** | Key sb_secret_YSE4zZxRjPj3BjT-SnjaOw... must be rotated. Create new secret key in Supabase, update .env.local and Vercel, delete old key. |
| M1 | MEDIUM | Audit trail written by browser, not server | 2026-09-15 | **FIXED** | All write routes now call recordAudit() server-side with verified session. |
| M2 | MEDIUM | localStorage not cleared on session expiry | 2026-09-15 | **FIXED** | login/page.tsx calls clearStoredData() on mount. Sign-out buttons in Header and Sidebar also clear it. |
| M3 | MEDIUM | Staff accounts use demo names and fake email addresses | 2026-09-15 | **OPEN** | worker@bacong.gov.ph and official@bacong.gov.ph are test accounts. Replace with real staff emails; fill Centre & Signatories. |
| L1 | LOW | Middleware public-path check lacks trailing-slash guard | 2026-09-15 | **OPEN** | src/middleware.ts startsWith('/auth') would match /author. Fix: path === p or path.startsWith(p + '/'). |
| L2 | LOW | Middleware passes through when Supabase env vars missing | 2026-09-15 | **OPEN** | Demo fallback. Fix: fail closed when NODE_ENV === 'production'. |
| L3 | LOW | supabase/.temp/ untracked and not in .gitignore | 2026-09-15 | **OPEN** | Add supabase/.temp/ to .gitignore. |
| L4 | LOW | Parent signup auto-confirms email; no ownership proof | 2026-09-15 | **OPEN** | email_confirm: true in auth/signup/route.ts. No data exposure (worker still verifies), but a typo locks parent out of recovery. |

---

## Quick Reference — Key Files by Gate

| Gate | Files to Read |
|---|---|
| 0 | package.json, scripts/check-uuid-ids.mjs, scripts/check-rls.mjs, playwright.config.ts |
| 1 | src/lib/auth.ts, src/middleware.ts, src/lib/supabase/admin.ts, src/app/api/**/route.ts |
| 2 | supabase/schema.sql, supabase/migrations/*.sql |
| 3 | src/app/privacy/page.tsx, src/lib/privacyNotice.ts, public/sw.js, src/app/login/page.tsx |
| 4 | src/app/api/attendance/bulk/route.ts, src/lib/enrollment.ts, src/lib/eccdRecord.ts, src/lib/audit.ts |
| 5 | tailwind.config.js, src/app/globals.css, tests/modal-a11y.spec.ts |
| 6 | .env.local, .gitignore, next.config.mjs, src/middleware.ts |
