'use client';

import React, { useState } from 'react';
import { X, UserCheck, Save, AlertCircle } from 'lucide-react';
import type { MockUser, UserRole } from '@/contexts/DaycareContext';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MockUser) => void;
}

export default function UserModal({ isOpen, onClose, onSave }: UserModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'worker' | 'official' | 'barangay_admin' | 'parent'>('worker');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const passwordValid = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/.test(password);

  const generatePassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%^&*';
    const all = upper + lower + digits + symbols;
    const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
    // Guarantee one of each required class, then pad with random characters.
    const base = [pick(upper), pick(lower), pick(digits), pick(symbols)];
    for (let i = 0; i < 8; i++) base.push(pick(all));
    setPassword(base.sort(() => Math.random() - 0.5).join(''));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError('Please fill in both full name and email address.');
      return;
    }
    if (!passwordValid) {
      setError('Password must be at least 8 characters and include uppercase, lowercase, and a number.');
      return;
    }

    setError('');

    try {
      const response = await fetch('/api/users/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: name.trim(),
          email: email.trim(),
          role,
          password: password.trim(),
        }),
      });

      const resData = await response.json();

      if (!response.ok) {
        setError(resData.error || 'Failed to create user in Supabase Auth.');
        return;
      }

      const payload = {
        id: resData.user?.id || `USR-${Date.now().toString().slice(-4)}`,
        name,
        email,
        role,
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0]
      };

      onSave(payload);
      setName('');
      setEmail('');
      setError('');
      onClose();
    } catch {
      setError('Network error while provisioning account. Saved locally.');
      onSave({
        id: `USR-${Date.now().toString().slice(-4)}`,
        name,
        email,
        role,
        status: 'active',
        createdAt: new Date().toISOString().split('T')[0]
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn" suppressHydrationWarning>
      <div className="bg-white rounded-3xl shadow-2xl border border-line w-full max-w-lg p-6 space-y-5 animate-scaleUp">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-light text-primary flex items-center justify-center font-bold shrink-0">
              <UserCheck size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-ink m-0">Provision User Account</h3>
              <p className="text-xs text-ink-muted m-0">
                Barangay Admin User Management & RBAC Access Provisioning
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-ink-subtle hover:bg-canvas hover:text-ink border-none bg-transparent cursor-pointer transition-all"
            suppressHydrationWarning
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="bg-danger-light border border-danger-border text-danger p-3 rounded-2xl text-xs flex items-center gap-2 font-semibold">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="space-y-1">
            <label htmlFor="srccomponentsusermodal-full-name-1" className="text-xs font-bold text-ink-soft">Full Name *</label>
            <input id="srccomponentsusermodal-full-name-1"
              type="text"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
              placeholder="e.g. Admin Josephine Mercado"
              value={name}
              onChange={(e) => setName(e.target.value)}
              suppressHydrationWarning
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="srccomponentsusermodal-email-address-2" className="text-xs font-bold text-ink-soft">Email Address *</label>
            <input id="srccomponentsusermodal-email-address-2"
              type="email"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
              placeholder="e.g. admin.bacong@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              suppressHydrationWarning
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="srccomponentsusermodal-assign-role-3" className="text-xs font-bold text-ink-soft">Assign Role *</label>
            <select id="srccomponentsusermodal-assign-role-3"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              suppressHydrationWarning
            >
              <option value="worker">Lead Daycare Worker (Teacher)</option>
              <option value="official">Barangay Official (Council Oversight)</option>
              <option value="barangay_admin">Barangay Admin (System Provisioner)</option>
              <option value="parent">Parent / Guardian</option>
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="srccomponentsusermodal-temporary-password-4" className="text-xs font-bold text-ink-soft">Temporary Password *</label>
            <div className="flex gap-2">
              <input id="srccomponentsusermodal-temporary-password-4"
                type="text"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
                placeholder="Min 8 chars, with upper, lower & number"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                suppressHydrationWarning
              />
              <button
                type="button"
                onClick={generatePassword}
                className="shrink-0 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-primary border border-primary-display/30 hover:bg-primary-light transition-all cursor-pointer bg-transparent"
                suppressHydrationWarning
              >
                Generate
              </button>
            </div>
            <p className="text-[10px] text-ink-subtle font-semibold">
              The user will be prompted to change this on first login. Share it with them securely.
            </p>
          </div>

          <div className="pt-4 border-t border-line flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-ink-muted border border-line hover:bg-canvas transition-all cursor-pointer border-none bg-transparent"
              suppressHydrationWarning
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-primary hover:bg-primary-hover transition-all flex items-center gap-2 shadow-md cursor-pointer border-none"
              suppressHydrationWarning
            >
              <Save size={16} />
              <span>Create Account</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
