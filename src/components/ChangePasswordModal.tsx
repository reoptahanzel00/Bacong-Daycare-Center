'use client';

import React, { useState } from 'react';
import { X, KeyRound, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { checkPassword, PASSWORD_RULES } from '@/lib/password';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-line bg-canvas text-sm text-ink focus:outline-none focus:border-primary-display';

/**
 * Lets a signed-in parent or Daycare Worker change their own password. The
 * current password is asked for first; a forgotten password is reset from the
 * sign-in page instead.
 */
export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const close = () => {
    setCurrent('');
    setNext('');
    setConfirm('');
    setError(null);
    setDone(false);
    setSaving(false);
    onClose();
  };
  const dialogProps = useModalA11y(isOpen, close);

  if (!isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const problem = !current
      ? 'Enter your current password.'
      : checkPassword(next) ??
        (next !== confirm
          ? 'The two new passwords do not match.'
          : next === current
            ? 'The new password must be different from the current one.'
            : null);
    if (problem) {
      setError(problem);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Could not change the password. Please try again.');
        return;
      }
      setDone(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch {
      setError('Could not change the password. Please check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div {...dialogProps} className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-line w-full max-w-md p-6 space-y-5 animate-scaleUp">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-light text-primary flex items-center justify-center shrink-0">
              <KeyRound size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-ink m-0">Change Password</h3>
              <p className="text-xs text-ink-muted m-0">{PASSWORD_RULES.summary}</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="p-2 rounded-full text-ink-subtle hover:bg-canvas hover:text-ink border-none bg-transparent cursor-pointer transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {done ? (
          <div className="space-y-4">
            <div role="status" className="p-3.5 bg-primary-light border border-primary-border rounded-2xl flex items-start gap-3 text-xs text-primary font-semibold">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
              <span>
                Your password has been changed. Any other device signed in to this account has been signed out;
                use the new password the next time you sign in.
              </span>
            </div>
            <div className="flex justify-end">
              <button type="button" className="btn btn-primary" onClick={close}>Done</button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4" noValidate>
            {error && (
              <div role="alert" className="p-3.5 bg-danger-light border border-danger-border rounded-2xl flex items-start gap-3 text-xs text-danger font-semibold">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div>
              <label htmlFor="cp-current" className="block text-xs font-bold text-ink mb-1.5">Current password</label>
              <input id="cp-current" type="password" autoComplete="current-password" value={current}
                onChange={(e) => setCurrent(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="cp-new" className="block text-xs font-bold text-ink mb-1.5">New password</label>
              <input id="cp-new" type="password" autoComplete="new-password" value={next}
                onChange={(e) => setNext(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="cp-confirm" className="block text-xs font-bold text-ink mb-1.5">Confirm new password</label>
              <input id="cp-confirm" type="password" autoComplete="new-password" value={confirm}
                onChange={(e) => setConfirm(e.target.value)} className={inputClass} />
            </div>
            <div className="pt-2 flex items-center justify-end gap-3">
              <button type="button" className="btn btn-secondary" onClick={close} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Change Password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
