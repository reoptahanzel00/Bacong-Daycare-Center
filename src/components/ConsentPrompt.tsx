'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { clearStoredData } from '@/data/mockData';

/**
 * Shown at the foot of the privacy notice when a signed-in parent agreed to an
 * older version. The portal does not open until they agree to this one; a
 * parent who does not agree can sign out and speak to the Daycare Worker.
 */
export default function ConsentPrompt({ version }: { version: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const agree = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ consentVersion: version }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Your consent could not be saved. Please try again.');
        setBusy(false);
        return;
      }
      router.replace('/');
      router.refresh();
    } catch {
      setError('Your consent could not be saved. Please check your connection and try again.');
      setBusy(false);
    }
  };

  const signOut = async () => {
    try {
      clearStoredData();
      await createClient().auth.signOut();
    } catch {}
    router.push('/login');
    router.refresh();
  };

  return (
    <div className="rounded-2xl border border-primary-border bg-primary-light p-5 space-y-3">
      <p className="text-sm font-bold text-ink m-0">This privacy notice has been updated</p>
      <p className="text-xs text-ink-muted leading-relaxed m-0">
        Please read the notice above. It now explains how we handle your child&apos;s health information and birth
        certificate. Your child&apos;s portal opens once you agree. If you do not agree, sign out and talk to the
        Daycare Worker.
      </p>
      {error && (
        <p role="alert" className="text-xs font-semibold text-danger m-0">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary" onClick={agree} disabled={busy}>
          {busy ? 'Saving…' : 'I have read this notice and I agree'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={signOut} disabled={busy}>
          Sign out
        </button>
      </div>
    </div>
  );
}
