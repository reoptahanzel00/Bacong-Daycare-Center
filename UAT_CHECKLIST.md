# UAT Handoff — Barangay Bacong Daycare Center Tracker

Handoff guide for testing the live system (https://bacong-daycare-center.vercel.app) and
the operational notes for whoever runs it day to day.

---

## 1. Test Accounts

All test accounts use the password set at creation (`Password123!` unless changed).

| Role | Email | Sees |
|---|---|---|
| Daycare Worker | `worker@bacong.gov.ph` | All 6 pupils, attendance register, ECCD tool |
| Barangay Official | `official@bacong.gov.ph` | Read-only oversight dashboards |
| Barangay Admin | `admin@bacong.gov.ph` | User management, audit trail, parent linking |
| Parent (Mateo) | `parent@bacong.gov.ph` | Only Mateo Santos (PUP-2026-001) |
| Parent (Sophia) | `juan.reyes@bacong.gov.ph` | Only Sophia Reyes (PUP-2026-002) |

If a password is forgotten: Supabase Dashboard → **Authentication → Users** → the account →
**Reset password** (or use the admin "Reset Pass" button in the app, which returns a link).

## 2. Per-Role Walkthrough

### Daycare Worker

1. Sign in — should land on the worker dashboard with **real pupils** (Mateo, Sophia, Gabriel,
   Althea, Lucas, Samantha) from the database.
2. **Daily Register** — pick today's date, toggle a couple of pupils (Present/Late/Absent),
   click **Save Today Register**. Expect the "saved" toast.
3. **Verify the write**: Supabase → Table Editor → `attendance` → new rows for today.
4. **Absence alert** — mark a pupil absent for 3 consecutive school days. The linked parent's
   notification bell should show an "Absence Alert" and (if email is configured) receive an email.
5. **Enrolled Pupils** — guardian names should display; edit a profile; archive is a soft-archive
   (`enrollment_status = archived`).
6. **ECCD tool** — open a pupil, rate a few items; **Record Milestone Observation** saves to
   `progress_observations` and notifies the parent's feed.

### Parent

1. Sign in as `parent@bacong.gov.ph` — **must see only Mateo** (no other children, no admin/worker
   tabs).
2. Verify attendance history shows Mateo's records only.
3. Open the notification bell — should show the absence alert if the worker triggered one.
4. Sign in as `juan.reyes@bacong.gov.ph` — **must see only Sophia**.

### Barangay Official

1. Sign in — read-only overview with real enrollment/attendance statistics (now backed by the
   seeded history + today's register).
2. Confirm there are no edit/save controls.

### Barangay Admin

1. Sign in — user list shows the real accounts with correct roles/status.
2. **Provision User Account** — create an account, then verify it can sign in.
3. **Link Parent Accounts** — link a guardian (existing account or create new), then confirm the
   parent sees only their child.
4. **Reset Pass** — generates a real recovery link (opens the Supabase password page).
5. **Status toggle** — disable a user, confirm they can no longer sign in / get authorized.
6. **Security Audit tab** — real audit entries for the actions above (attendance saves, enrollments,
   account toggles, resets).

## 3. Data Verification (Supabase Table Editor)

| Table | Expect |
|---|---|
| `pupils` | 6 enrolled pupils with correct `consecutive_absences` |
| `guardians` | 6 guardians; `user_id` set for Maria Santos + Juan Reyes |
| `attendance` | ~66 rows (10 school days × 6 pupils + today) |
| `progress_observations` | Any observations recorded during UAT |
| `users` | 5 accounts (worker, official, admin, 2 parents), all `active` |
| `audit_log` | Growing; entries have real `user_name`/`role` |
| `notifications` | Absence/milestone alerts for linked parents |

## 4. Operations Notes

- **Deployments**: pushing/merging to `main` auto-deploys to Vercel. CI (build + typecheck + lint)
  runs on every push and PR. Keep the `develop` branch synced to `main` before branching features.
- **Environment variables** (Vercel + GitHub Actions + `.env.local`):
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (rotated
  key), `NEXT_PUBLIC_APP_URL`. Optional: `SEMAPHORE_API_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`.
- **Backups**: Supabase has daily automated backups + point-in-time recovery for paid plans; the
  free tier keeps 7 days of daily backups. Confirm this is enabled in Project Settings → Backups.
- **Monitoring**: Vercel provides deployment logs; Supabase has an observability dashboard
  (Project Settings → Observability). No external uptime monitor is configured yet.
- **Security hygiene**: the service-role key must never be exposed to the client. If it ever leaks,
  rotate it in Supabase and update all environments.
- **Daily routine**: the worker saves the register each school day; the consecutive-absences
  trigger and alerts run automatically.

## 5. Known Gaps

- SMS dispatch (Semaphore) and email dispatch (Resend) are implemented as pluggable channels but
  only activate when the respective API keys are configured. In-app feed works without them.
- Announcements are still local/demo (no database table/API yet).
- No unit tests yet — E2E covers the main flows in demo mode.
