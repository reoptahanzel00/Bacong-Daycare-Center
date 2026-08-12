'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { X, Link2, UserPlus, Save, AlertCircle, RefreshCw } from 'lucide-react';
import { useDaycare } from '@/contexts/DaycareContext';
import { fetchPupils, type PupilRow } from '@/services/pupilService';

interface LinkParentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/;

export default function LinkParentModal({ isOpen, onClose }: LinkParentModalProps) {
  const { users, showToast } = useDaycare();

  const [pupils, setPupils] = useState<PupilRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPupilId, setSelectedPupilId] = useState('');
  const [selectedGuardianId, setSelectedGuardianId] = useState('');
  const [mode, setMode] = useState<'existing' | 'create'>('existing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const userEmailById = useMemo(() => new Map(users.map(u => [u.id, u.email])), [users]);

  const loadPupils = async (preserveSelections = false) => {
    setLoading(true);
    const res = await fetchPupils('enrolled');
    if (res.ok && res.pupils.length > 0) {
      setPupils(res.pupils);
      if (!preserveSelections && !selectedPupilId) {
        setSelectedPupilId(res.pupils[0].id);
      }
      setError('');
    } else {
      setPupils([]);
      setError('Could not load the pupil roster. Please try again.');
    }
    setLoading(false);
  };

  // Load the roster once on mount. The parent remounts this modal via `key`
  // whenever it opens, so state is always fresh without sync effects.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchPupils('enrolled');
      if (cancelled) return;
      if (res.ok && res.pupils.length > 0) {
        setPupils(res.pupils);
        setSelectedPupilId(res.pupils[0].id);
        setSelectedGuardianId(res.pupils[0].guardian?.[0]?.id || '');
        setError('');
      } else {
        setError('Could not load the pupil roster. Please try again.');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedPupil = pupils.find(p => p.id === selectedPupilId);
  const selectedGuardian = selectedPupil?.guardian?.find(g => g.id === selectedGuardianId);
  const linkedEmail = selectedGuardian?.user_id ? userEmailById.get(selectedGuardian.user_id) : undefined;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPupilId || !selectedGuardianId) {
      setError('Select a pupil and guardian first.');
      return;
    }
    if (!email.trim()) {
      setError('Enter the parent email address.');
      return;
    }
    if (mode === 'create' && !PASSWORD_RE.test(password)) {
      setError('Password must be at least 8 characters with uppercase, lowercase, and a number.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/users/link-parent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pupil_id: selectedPupilId,
          guardian_id: selectedGuardianId,
          mode,
          email: email.trim(),
          password: mode === 'create' ? password.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to link parent account.');
        return;
      }
      showToast(data.message || 'Parent account linked!', 'success');
      setEmail('');
      setPassword('');
      await loadPupils(true);
    } catch {
      setError('Network error while linking the account.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn" suppressHydrationWarning>
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E6E4DF] w-full max-w-lg p-6 space-y-5 animate-scaleUp">
        <div className="flex items-center justify-between border-b border-[#E6E4DF] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EBF5F4] text-[#2F8F8A] flex items-center justify-center font-bold shrink-0">
              <Link2 size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#2B2B2B] m-0">Link Parent Account</h3>
              <p className="text-xs text-[#6B6B6B] m-0">
                Connect a guardian to their child&apos;s parent login
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full text-[#9B9B9B] hover:bg-[#FAF8F5] hover:text-[#2B2B2B] border-none bg-transparent cursor-pointer transition-all" suppressHydrationWarning>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="bg-[#FFEBEE] border border-[#FFCDD2] text-[#D32F2F] p-3 rounded-2xl text-xs flex items-center gap-2 font-semibold">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#4A4A4A]">Select Pupil *</label>
              <select
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]/30 focus:border-[#2F8F8A] bg-[#FAF8F5] focus:bg-white"
                value={selectedPupilId}
                onChange={(e) => {
                  setSelectedPupilId(e.target.value);
                  const next = pupils.find(p => p.id === e.target.value);
                  setSelectedGuardianId(next?.guardian?.[0]?.id || '');
                }}
                disabled={loading}
                suppressHydrationWarning
              >
                <option value="">{loading ? 'Loading pupils...' : 'Select pupil'}</option>
                {pupils.map((p) => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.id})</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#4A4A4A]">Guardian *</label>
              <select
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]/30 focus:border-[#2F8F8A] bg-[#FAF8F5] focus:bg-white"
                value={selectedGuardianId}
                onChange={(e) => setSelectedGuardianId(e.target.value)}
                disabled={!selectedPupil}
                suppressHydrationWarning
              >
                <option value="">Select guardian</option>
                {(selectedPupil?.guardian || []).map((g) => (
                  <option key={g.id || g.full_name} value={g.id}>{g.full_name} ({g.relationship})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E6E4DF] text-xs flex items-center justify-between">
            <span className="text-[#6B6B6B]">Current status</span>
            {linkedEmail ? (
              <span className="badge badge-success font-bold">Linked to {linkedEmail}</span>
            ) : (
              <span className="badge badge-warning font-bold">No parent account linked yet</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('existing')}
              className={`flex-1 px-3 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer border-none ${mode === 'existing' ? 'bg-[#2F8F8A] text-white shadow-sm' : 'bg-[#FAF8F5] text-[#6B6B6B] hover:bg-[#EAE6DF]'}`}
              suppressHydrationWarning
            >
              Link Existing Account
            </button>
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`flex-1 px-3 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer border-none ${mode === 'create' ? 'bg-[#2F8F8A] text-white shadow-sm' : 'bg-[#FAF8F5] text-[#6B6B6B] hover:bg-[#EAE6DF]'}`}
              suppressHydrationWarning
            >
              <UserPlus size={14} className="inline mr-1" />
              Create New Account
            </button>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[#4A4A4A]">
              {mode === 'existing' ? 'Parent Account Email *' : 'New Parent Email *'}
            </label>
            <input
              type="email"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]/30 focus:border-[#2F8F8A] bg-[#FAF8F5] focus:bg-white"
              placeholder={mode === 'existing' ? 'e.g. parent@bacong.gov.ph' : 'e.g. maria.santos@gmail.com'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              suppressHydrationWarning
            />
          </div>

          {mode === 'create' && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#4A4A4A]">Temporary Password *</label>
              <input
                type="text"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]/30 focus:border-[#2F8F8A] bg-[#FAF8F5] focus:bg-white"
                placeholder="Min 8 chars, with upper, lower & number"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                suppressHydrationWarning
              />
              <p className="text-[10px] text-[#9B9B9B] font-semibold">
                The guardian logs in with this email and password.
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-[#E6E4DF] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-[#6B6B6B] border border-[#E6E4DF] hover:bg-[#FAF8F5] transition-all cursor-pointer bg-transparent"
              suppressHydrationWarning
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#2F8F8A] hover:bg-[#1D605D] transition-all flex items-center gap-2 shadow-md cursor-pointer border-none disabled:opacity-50"
              suppressHydrationWarning
            >
              {submitting ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{submitting ? 'Linking...' : 'Link Account'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
