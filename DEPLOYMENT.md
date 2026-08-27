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
| `UPSTASH_REDIS_REST_URL` | ✅ Yes for production | Shared store for the sign-in rate limiter. Without it the limit is per-instance only — see below. |
| `UPSTASH_REDIS_REST_TOKEN` | ✅ Yes for production | Paired token for the same store. |
| `NEXT_PUBLIC_APP_URL` | âš ï¸ Optional | Full URL of the deployed app (e.g. `https://bacong-daycare.vercel.app`) |

> âš ï¸ **Security:** Never commit `.env.local` to git. It is already in `.gitignore`.  
> âš ï¸ **Security:** Never put `SUPABASE_SERVICE_ROLE_KEY` in any `NEXT_PUBLIC_*` variable.

---

## Rate Limiting (required before production)

`/api/auth/login` and `/api/auth/signup` are rate limited per IP. The limiter
uses a shared Redis store when `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` are set, and falls back to an in-process counter
when they are not.

**The fallback is not a real limit on serverless.** Every function instance
gets its own memory, so "10 sign-in attempts per 15 minutes" becomes 10 per
instance rather than 10 per attacker. Provision the store before going live:

```bash
# 1. Link this repository to its Vercel project (opens a browser to sign in)
npx vercel link

# 2. Provision Upstash Redis through the Vercel Marketplace.
#    This creates a billable Marketplace resource and injects both
#    UPSTASH_REDIS_* variables into the project automatically.
npx vercel integration add upstash

# 3. Pull the new variables down for local development
npx vercel env pull .env.local --yes
```

No code change is needed - the limiter switches to Redis as soon as both
variables are present. If Redis is configured but unreachable at request time,
it degrades to the in-process counter rather than locking every user out.

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
