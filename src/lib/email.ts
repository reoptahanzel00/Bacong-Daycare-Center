/**
 * Email dispatch for notifications.
 *
 * Uses Resend (free tier, https://resend.com) when RESEND_API_KEY is set.
 * Without a key this is a graceful no-op — the app keeps working, and only
 * the in-app feed is delivered. Add the env vars to enable email delivery.
 */

export async function sendEmail(opts: { to: string; subject: string; text: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'Barangay Bacong Daycare <onboarding@resend.dev>';

  if (!apiKey) {
    console.warn('[Email] RESEND_API_KEY not set — skipping email dispatch.');
    return { skipped: true };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
      }),
    });

    if (!res.ok) {
      console.warn('[Email] Resend error:', res.status, await res.text().catch(() => ''));
      return { skipped: false, sent: false, error: `HTTP ${res.status}` };
    }
    return { skipped: false, sent: true };
  } catch (e) {
    console.warn('[Email] dispatch failed:', e);
    return { skipped: false, sent: false, error: 'Network error' };
  }
}
