import { defineConfig, devices } from '@playwright/test';

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
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    // Run the app in offline demo mode so E2E is deterministic without a
    // live Supabase session. With real credentials the auth middleware
    // redirects unauthenticated visitors to /login.
    env: {
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    },
  },
});
