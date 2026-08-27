# Deployment Guide â€” Barangay Bacong Daycare Center Tracker

## Overview

This app is built with **Next.js 15** (App Router) and **Supabase** as the backend.  
It is designed for deployment on **Vercel** (recommended) or any Node.js-compatible host.

---

## Required Environment Variables

Copy `.env.example` to `.env.local` and fill in all values before running or deploying.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | âœ… Yes | Your Supabase project URL. From: Project Settings â†’ API â†’ Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | âœ… Yes | Supabase anon public key. From: Project Settings â†’ API â†’ `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | âœ… Yes (server-only) | Service role key for admin operations. **Never expose to client.** |
| `SEMAPHORE_API_KEY` | âš ï¸ Optional | Philippine SMS gateway API key. Get from https://semaphore.co |
| `SEMAPHORE_SENDER_NAME` | âš ï¸ Optional | Sender name for SMS (e.g. `BacongDaycare`) |
| `RESEND_API_KEY` | ⚠️ Optional | Email dispatch for notifications. Get from https://resend.com |
| `EMAIL_FROM` | ⚠️ Optional | Sender address for notification emails (e.g. `Bacong Daycare <noreply@yourdomain.com>`) |
| `KV_REST_API_URL` | ✅ Yes for production | Shared Upstash Redis store for the sign-in rate limiter. Without it the limit is per-instance only — see below. |
| `KV_REST_API_TOKEN` | ✅ Yes for production | Paired token for the same store. |
| `NEXT_PUBLIC_APP_URL` | âš ï¸ Optional | Full URL of the deployed app (e.g. `https://bacong-daycare.vercel.app`) |

> âš ï¸ **Security:** Never commit `.env.local` to git. It is already in `.gitignore`.  
> âš ï¸ **Security:** Never put `SUPABASE_SERVICE_ROLE_KEY` in any `NEXT_PUBLIC_*` variable.

---

## Rate Limiting (required before production)

`/api/auth/login` and `/api/auth/signup` are rate limited per IP. The limiter
uses a shared Redis store when its REST credentials are set, and falls back to
an in-process counter when they are not. The Vercel Marketplace injects
`KV_REST_API_URL` / `KV_REST_API_TOKEN`; a store created directly on Upstash
sets `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` instead. Either
pair works.

**The fallback is not a real limit on serverless.** Every function instance
gets its own memory, so "10 sign-in attempts per 15 minutes" becomes 10 per
instance rather than 10 per attacker. Provision the store before going live:

```bash
# 1. Link this repository to its Vercel project (opens a browser to sign in)
npx vercel link

# 2. Provision Upstash Redis through the Vercel Marketplace.
#    This creates a billable Marketplace resource and injects both
#    UPSTASH_REDIS_* variables into the project automatically.
npx vercel integration add upstash/upstash-kv

# 3. Pull the new variables down for local development
npx vercel env pull .env.local --yes
```

No code change is needed - the limiter switches to Redis as soon as both
variables are present. Accept the Upstash Marketplace terms in the browser when
the CLI prompts; the install cannot finish until you do. If Redis is configured but unreachable at request time,
it degrades to the in-process counter rather than locking every user out.

---

## Applying database changes

`supabase/schema.sql` builds a project **from empty**. It is safe to re-run, but it is
not how you change a database that already holds records.

For a live project, apply the numbered files in `supabase/migrations/` in order, once
each, through the Supabase SQL editor. Each is wrapped in a transaction and is safe to
re-run. After applying, run the verification queries at the bottom of the migration --
in particular this one, which confirms the absence-streak trigger is the current
windowed version rather than the old row-by-row loop:

```sql
SELECT pg_get_functiondef('calculate_consecutive_absences()'::regprocedure)
       LIKE '%ROWS UNBOUNDED PRECEDING%' AS trigger_is_current;
```

Keep the two in step: a change made in a migration belongs in `schema.sql` too, so a
fresh project and a migrated one end up identical.

---

## Staging project and authenticated tests

The offline E2E suite proves signed-out users are locked out. It cannot prove the RLS
policies are right, because every authenticated route answers 401 before a policy is
consulted. That needs a second Supabase project (the free tier allows two).

```bash
# 1. Create a second Supabase project, then apply schema.sql and seed.sql to it.

# 2. Seed one account per role. Refuses to run against a URL that does not look
#    like staging -- these accounts have known passwords.
NEXT_PUBLIC_SUPABASE_URL=<staging-url> \
SUPABASE_SERVICE_ROLE_KEY=<staging-service-key> \
E2E_PASSWORD=<pick-a-strong-one> \
npm run db:seed-test-users

# 3. Run the authenticated suite locally
E2E_SUPABASE_URL=<staging-url> \
E2E_SUPABASE_ANON_KEY=<staging-anon-key> \
E2E_PASSWORD=<same-password> \
npm run test:e2e
```

For CI, add `E2E_SUPABASE_URL`, `E2E_SUPABASE_ANON_KEY`,
`E2E_SUPABASE_SERVICE_ROLE_KEY` and `E2E_PASSWORD` as GitHub secrets. Without them the
authenticated step is skipped and the pipeline still passes.

---

## Auth redirect URLs (required)

Password recovery does not work until this is set. In Supabase -> Authentication ->
URL Configuration -> Redirect URLs, add for **both** the production and staging projects:

```
https://<your-domain>/auth/callback
```

Without it the recovery link lands on the Site URL, where nothing exchanges its code, and
a locked-out parent has no way back in.

---

## Error visibility

Client crashes are posted to `/api/client-error` and written to the Vercel runtime logs as
structured JSON with `"kind":"client-error"`. Find them under the project's Logs tab, or
with `npx vercel logs <deployment>`. The payload carries a message, a component stack and a
path only -- never pupil data. If the volume outgrows the dashboard, add a Vercel log drain
rather than reintroducing a client-side reporting SDK.

---

## Before go-live

- [ ] Replace the placeholder text at `/privacy` with wording approved by the Barangay's
      Data Protection Officer, and bump `PRIVACY_NOTICE_VERSION` in `src/lib/privacyNotice.ts`.
- [ ] Fill in the Centre &amp; Signatories panel (Admin portal -> Security) so DSWD Form 1
      carries the real barangay captain rather than an empty field.
- [ ] Provision the Upstash rate-limit store (see above) -- the in-process fallback is not
      a real limit on serverless.
- [ ] Run `UAT_CHECKLIST.md` against staging with an actual daycare worker on their phone.

---

## Supabase Database Setup

### 1. Apply the canonical database schema

Run the two SQL files in this order in the Supabase SQL Editor
(Dashboard -> SQL Editor -> New query):

1. `supabase/schema.sql` - creates all tables, indexes, the consecutive-absences
   trigger, and RLS policies. This file is the single source of truth; the app's
   API routes are written against its exact column names.
2. `supabase/seed.sql` - seeds the current school year (SY 2026-2027), the ECCD
   progress domains, and optional demo pupils/guardians/announcements.

> The schema uses a `current_user_role()` SECURITY DEFINER helper so RLS policies
> can check roles without recursive policy evaluation on the `users` table.

> **Critical:** A `SUPABASE_SERVICE_ROLE_KEY` was previously committed to git
> history and must be considered **compromised**. Rotate it now in
> Supabase Dashboard -> Project Settings -> API Keys -> `service_role` -> **Rotate**.
> The code no longer ships any fallback credentials - the key is read strictly
> from `SUPABASE_SERVICE_ROLE_KEY` in the server environment.

### 2. Verify the policies

```sql
SELECT schemaname, tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
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
# â†’ App running at http://localhost:3000
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
# Vercel Dashboard â†’ Settings â†’ Environment Variables
# Add all variables from .env.example

# 4. Deploy
vercel --prod
```

---

## GitHub Actions Secrets Required

Set these in: GitHub repo â†’ Settings â†’ Secrets and variables â†’ Actions

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
