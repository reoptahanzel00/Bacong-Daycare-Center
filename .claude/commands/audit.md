---
description: Full pre-deployment audit of the Bacong Daycare Tracker — seven gates, ranked findings, deploy verdict
allowed-tools: Bash, Read, Grep, Glob, Write, Edit, WebFetch
---

# Pre-deployment audit — Barangay Bacong Daycare Center Tracker

You are auditing a production-bound system before it carries the real records of real
children. It is a Next.js 15 App Router application on Supabase, deployed to the Vercel
project `bacong-daycare-center`. Its users are daycare workers on cheap Android phones,
barangay officials, an administrator, and parents. Its data is sensitive personal
information about minors, covered by the Philippine Data Privacy Act (RA 10173).

Treat "it probably works" as a failed audit. Your job is to find what is actually still
open, prove the gates pass on this machine, and end with a verdict someone can act on.

## Ground rules

1. **Verify, never assume.** Every finding cites `path/file.ts:line`. Every runtime
   claim names the command that demonstrated it and quotes the relevant output. If you
   could not verify something, it goes in the "Not verified" section — not in the
   findings as if it were established.
2. **Do not rediscover finished work.** This repo has already been hardened over many
   passes: RLS policies with a `current_user_role()` helper, a server-only service-role
   client, CSP/HSTS headers, a Redis-backed sign-in limiter, an offline + authenticated
   Playwright suite in CI. Confirm those still hold, then spend your effort on what is
   still open.
3. **Rank honestly.** A finding is a BLOCKER only if it leaks data, bypasses auth,
   fails at runtime in production, or creates legal exposure. Do not inflate a
   preference into a blocker, and do not soften a real leak into a "consideration".
4. **Read-only until told otherwise.** Gather every finding before changing any file.
5. **No new dependencies** and no parallel implementations. Reuse what exists:
   `src/services/*`, `src/lib/auth.ts`, `src/lib/rateLimit.ts`, `src/lib/notify.ts`.

## Gate 0 — Mechanical checks

Run each, in this order, and record the exact result. Any failure here is an automatic
BLOCKER — the report says so before anything else.

```bash
npx tsc --noEmit
npm run lint
npm run check:contract     # scripts/check-uuid-ids.mjs — schema/route ID contract
npm run check:rls          # scripts/check-rls.mjs — every table has RLS + a policy
npm run build
npm run test:e2e           # Playwright, offline demo mode (needs no secrets)
```

`check:rls` covers Gate 2's first question mechanically, so treat a green run as
evidence for the file and keep looking at the *shape* of the policies — a table can
have RLS, a policy, and still let a parent read another family's child.

Also confirm the working tree is clean and nothing build-generated is tracked:

```bash
git status --porcelain
git ls-files | grep -E "^(\.next|test-results|playwright-report)/" || echo clean
```

## Gate 1 — Authentication and access control

- `src/middleware.ts` — the public-path allowlist (`/login`, `/register`, `/auth`,
  `/reset-password`, `/privacy`). Can any of those prefixes be abused to reach a
  protected page, given they are matched with `startsWith` rather than an exact match?
  The matcher deliberately excludes `/api`, so confirm the claim it rests on: **every**
  route under `src/app/api/**` verifies the session inside the handler. Enumerate them
  and prove it — a route that skips the check is a BLOCKER.
- Role enforcement: worker / official / admin / parent. For each API route, is the role
  checked server-side, or only hidden in the UI? Check especially `/api/users/*`,
  `/api/audit-log`, `/api/settings`, `/api/eccd/*`.
- `src/lib/auth.ts` — session verification, role lookup, and what happens when the
  lookup fails (it must fail closed, never open).
- `src/lib/rateLimit.ts` — does the Redis path actually engage when `KV_REST_API_*` or
  `UPSTASH_REDIS_REST_*` are set, and does it degrade rather than lock everyone out
  when Redis is unreachable? The in-process fallback is not a real limit on serverless;
  if production is running on the fallback, that is a HIGH at minimum.
- `src/lib/supabase/admin.ts` — the service-role client must be `server-only` and
  unreachable from any client component. Grep every import of it across `src/`.
- `src/app/api/auth/*` — login, signup, session. Any user enumeration in the error
  responses? Any password policy gap (`src/lib/password.ts`)?

## Gate 2 — Supabase schema and RLS

- `supabase/schema.sql` and `supabase/migrations/20260828_01_deployment_readiness.sql`
  must agree. DEPLOYMENT.md states this contract: a change made in a migration belongs
  in `schema.sql` too, so a fresh project and a migrated one end up identical. Compare
  them table by table, policy by policy, and report any drift.
- Every table has `ENABLE ROW LEVEL SECURITY` and at least one policy. RLS on with no
  policy is a silent lockout; RLS off is a leak.
- Parent isolation: prove from the policy text that a parent cannot read another
  family's pupil, attendance, health log, progress record, or parent note.
- Policies use `current_user_role()` rather than a recursive select on `users`.
- Column-name contract: cross-check the columns the API routes and
  `src/types/database.ts` reference against `schema.sql`. A mismatch fails at runtime,
  not at build.
- The consecutive-absence trigger is the windowed version, not the row-by-row loop.

## Gate 3 — Data privacy (RA 10173)

- `src/lib/privacyNotice.ts` — is the notice still placeholder text, and is
  `PRIVACY_NOTICE_VERSION` still unbumped? Going live with a placeholder privacy notice
  for children's data is legal exposure, not a cosmetic issue.
- `/privacy` (`src/app/privacy/page.tsx`) and consent capture in
  `src/app/register/page.tsx` — is consent recorded, versioned, and re-requested when
  the version changes?
- PII in logs. Read `src/app/api/client-error/route.ts` and `src/services/auditService.ts`
  line by line. Nothing reaching a log line may carry a child's name, address, guardian
  contact, or health detail. Grep for `console.log` / `console.error` calls that
  interpolate whole record objects.
- Data minimisation: `src/views/OfficialView.tsx` should see aggregates, not
  identifiable child records. Confirm what the official-facing API routes actually
  return, not what the view chooses to render.
- Exports (`src/lib/dswdPdf.ts`, `src/lib/exportPdf.ts`) — who can generate them, and is
  that gated server-side?

## Gate 4 — Correctness and data integrity

- Enrollment verification: `src/lib/enrollment.ts` and `/api/pupils/verify`. A prior fix
  closed a bypass where editing a pupil could skip verification — confirm it holds and
  that `tests/enrollment.spec.ts` / `tests/enrollment-status.spec.ts` still cover it.
- Attendance: `/api/attendance/bulk` — partial-failure behaviour, duplicate rows for the
  same pupil and date, and timezone handling. This centre is UTC+8; a date computed in
  UTC silently mis-files the late-afternoon records.
- ECCD: `src/data/eccdChecklist.ts`, `src/lib/progressMapping.ts` — age computation at
  month boundaries, score aggregation, and the multi-page Child's Record 2 export.
- PDF exports with empty or missing signatories, and with more rows than fit one page.
- Input validation: every route accepting a body should parse it with the existing `zod`
  schemas. Find any route that trusts the body shape.

## Gate 5 — Accessibility and UI (WCAG 2.1 AA)

- Contrast: check the tokenised palette in `tailwind.config.js` and `src/app/globals.css`
  — 4.5:1 for body text, 3:1 for large text and UI boundaries. Compute the ratios; do
  not eyeball them.
- Visible focus on every interactive element, and no `outline: none` without a
  replacement.
- Tap targets at least 44x44px — this is used one-handed on a phone in a daycare room.
- Every control has an accessible name. Icon-only `lucide-react` buttons need
  `aria-label`.
- Modals in `src/components/*Modal.tsx`: focus trap, focus restored on close, Escape
  closes, background inert.
- `MobileNav.tsx`, `Sidebar.tsx`, `Header.tsx` — keyboard traversal in a sensible order.
- Offline behaviour: `OfflineIndicator.tsx`, `ServiceWorkerRegister.tsx`, `public/sw.js`
  — what does a worker see when the signal drops mid-save?

## Gate 6 — Deployment readiness

- `next.config.mjs`: CSP, HSTS, frame-ancestors, and the `no-store` headers on `/sw.js`
  and `/manifest.json`. Is `unsafe-eval` correctly dev-only?
- Vercel project identity — must be `bacong-daycare-center`, never a personal account:

```bash
cat .vercel/project.json
npx vercel env ls production
```

- Required production vars present: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and the rate-limit pair
  (`KV_REST_API_URL` / `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` / `_TOKEN`).
- No secret hiding in a `NEXT_PUBLIC_*` name, and confirm the historically leaked
  service-role key was rotated:

```bash
grep -rn "NEXT_PUBLIC_" src/ | grep -iE "service_role|secret|token|api_key"
git log -p --all -S service_role -- . | head -50
```

- `.gitignore` still denies `.env*` by default with only `.env.example` allowed back.
- Supabase Auth redirect URLs include `<domain>/auth/callback` for both the production
  and staging projects — without it password recovery is dead. This needs the dashboard;
  if you cannot reach it, list it under "Not verified" with the exact steps.
- Walk the "Before go-live" checklist in `DEPLOYMENT.md` and report each item's real
  state rather than its checkbox.

## Output

Write the report to `docs/AUDIT-<YYYY-MM-DD>.md` with this shape:

```markdown
# Pre-deployment audit — <date>

## Verdict
**SAFE TO DEPLOY** | **DEPLOY WITH NOTED RISKS** | **DO NOT DEPLOY**
<one paragraph: why, and what would change it>

## Gate results
| Gate | Result | Notes |
(one row per gate: PASS / PASS WITH FINDINGS / FAIL)

## Findings
### BLOCKER
#### B1 — <one-line title>
- **Where:** `src/path/file.ts:123`
- **What:** <the defect, stated plainly>
- **How it fails:** <concrete inputs or state, then the wrong result>
- **Evidence:** <command run and its output, or the quoted code>
- **Fix:** <the specific change>

### HIGH / ### MEDIUM / ### LOW   (same shape, numbered H1, M1, L1)

## Not verified locally
<each item, why it could not be checked here, and the manual steps to check it>

## Green — confirmed working
<short list, so a re-read knows what was actually proven, not merely silent>
```

Then report in the terminal: the verdict, the count at each severity, and the blockers
by title. Do not paste the whole report into chat.
