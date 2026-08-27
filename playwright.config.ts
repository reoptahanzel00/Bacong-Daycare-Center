import { defineConfig, devices } from '@playwright/test';

/**
 * Authenticated tests need a real staging database and seeded accounts. Without
 * them the project is omitted rather than failing, so the demo suite stays the
 * baseline everyone can run.
 */
const RUN_AUTHENTICATED = Boolean(
  process.env.E2E_SUPABASE_URL && process.env.E2E_SUPABASE_ANON_KEY && process.env.E2E_PASSWORD
);

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Serial execution: the Next dev server compiles routes on demand and also
  // proxies fonts/images in dev, so parallel workers starve the early tests.
  // CI is already serial; this keeps local runs stable too.
  workers: 1,
  reporter: 'html',
  // Local dev-mode runs optimize remote images through the dev server, which
  // adds latency under parallel workers. 10s keeps assertions robust without
  // weakening what they verify.
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    // Offline demo mode. Proves signed-out users are locked out, and covers the
    // UI without needing a database.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/auth\.setup\.ts/, /rls\.spec\.ts/],
    },

    // Authenticated coverage against a STAGING project. Skipped entirely unless
    // staging credentials are present, so a clone with no secrets still runs a
    // green suite. See scripts/seed-test-users.mjs.
    ...(RUN_AUTHENTICATED
      ? [
          {
            name: 'setup',
            use: { ...devices['Desktop Chrome'] },
            testMatch: /auth\.setup\.ts/,
          },
          {
            name: 'authenticated',
            use: { ...devices['Desktop Chrome'] },
            testMatch: /rls\.spec\.ts/,
            dependencies: ['setup'],
          },
        ]
      : []),
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    // Run the app in offline demo mode so E2E is deterministic without a
    // live Supabase session. With real credentials the auth middleware
    // redirects unauthenticated visitors to /login.
    env: RUN_AUTHENTICATED
      ? {
          NEXT_PUBLIC_SUPABASE_URL: process.env.E2E_SUPABASE_URL as string,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.E2E_SUPABASE_ANON_KEY as string,
          SUPABASE_SERVICE_ROLE_KEY: process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ?? '',
        }
      : {
          NEXT_PUBLIC_SUPABASE_URL: '',
          NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
          SUPABASE_SERVICE_ROLE_KEY: '',
        },
  },
});
