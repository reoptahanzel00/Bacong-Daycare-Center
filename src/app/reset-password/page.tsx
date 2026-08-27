'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Eye, EyeOff, KeyRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { checkPassword, PASSWORD_RULES } from '@/lib/password';

/**
 * Sets a new password after a recovery link has been exchanged for a session by
 * /auth/callback. Reaching this page without that session means the link was
 * opened directly or has expired, so it says so rather than failing on submit.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionState, setSessionState] = useState<'checking' | 'ready' | 'missing'>('checking');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        setSessionState(session ? 'ready' : 'missing');
      } catch {
        if (!cancelled) setSessionState('missing');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const ruleError = checkPassword(password);
    if (ruleError) {
      setError(ruleError);
      return;
    }
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        setSaving(false);
        return;
      }
      setDone(true);
      // The recovery session is a real session, so the app is reachable now.
      setTimeout(() => router.push('/'), 1600);
    } catch {
      setError('Could not save the new password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl border border-line shadow-xl p-8">

        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl bg-primary-light text-primary flex items-center justify-center shrink-0">
            <KeyRound size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-ink m-0">Set a New Password</h1>
            <p className="text-xs text-ink-muted mt-0.5 m-0">Barangay Bacong Daycare Center</p>
          </div>
        </div>

        {sessionState === 'checking' && (
          <p className="text-xs text-ink-muted m-0">Checking your recovery link…</p>
        )}

        {sessionState === 'missing' && (
          <div className="space-y-4">
            <div className="p-3.5 bg-danger-light border border-danger-border rounded-2xl flex items-start gap-3 text-xs text-danger font-semibold">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>
                This password reset link has expired or was already used. Request a new one from
                the sign-in page.
              </span>
            </div>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full py-3.5 px-6 rounded-2xl bg-primary text-white font-bold text-xs shadow-md hover:bg-primary-hover transition-colors cursor-pointer border-none"
            >
              Back to Sign In
            </button>
          </div>
        )}

        {sessionState === 'ready' && done && (
          <div className="p-3.5 bg-primary-light border border-primary-border rounded-2xl flex items-start gap-3 text-xs text-primary font-semibold">
            <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
            <span>Password updated. Taking you to your portal…</span>
          </div>
        )}

        {sessionState === 'ready' && !done && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 bg-danger-light border border-danger-border rounded-2xl flex items-start gap-3 text-xs text-danger font-semibold">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="reset-new-password" className="block text-xs font-bold text-ink mb-1.5">
                New Password
              </label>
              <div className="relative">
                <input
                  id="reset-new-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 pr-12 rounded-2xl border border-line bg-white text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary-display"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink cursor-pointer border-none bg-transparent"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[11px] text-ink-muted mt-1.5 m-0">{PASSWORD_RULES.summary}</p>
            </div>

            <div>
              <label htmlFor="reset-confirm-password" className="block text-xs font-bold text-ink mb-1.5">
                Confirm New Password
              </label>
              <input
                id="reset-confirm-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary-display"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 px-6 rounded-2xl bg-primary text-white font-bold text-xs shadow-md hover:bg-primary-hover transition-colors cursor-pointer border-none disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save New Password'}
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
