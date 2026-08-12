'use client';

import React, { useState } from 'react';
import { School, ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';

const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/;

export default function RegisterPage() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ message: string; linked: boolean } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim()) {
      setError('Please fill in your full name and email address.');
      return;
    }
    if (!PASSWORD_RE.test(password)) {
      setError('Password must be at least 8 characters with uppercase, lowercase, and a number.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password: password.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Unable to create your account. Please try again.');
        return;
      }
      setSuccess({ message: data.message, linked: !!data.linked });
    } catch {
      setError('Network error while creating your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-6" suppressHydrationWarning>
      <div className="w-full max-w-md">
        <div className="bg-white rounded-3xl border border-[#E6E4DF] shadow-xl overflow-hidden">
          <div className="bg-gradient-to-br from-[#2F8F8A] to-[#1D605D] p-8 text-white text-center">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 mx-auto">
              <School size={30} color="white" />
            </div>
            <h1 className="text-xl font-extrabold m-0 tracking-tight">Parent Account Sign Up</h1>
            <p className="text-xs text-white/80 mt-2 m-0 leading-relaxed">
              Register to view your child&apos;s attendance, milestones, and daycare notices.
            </p>
          </div>

          <div className="p-7">
            {success ? (
              <div className="text-center space-y-4 py-6">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[#2B2B2B] m-0">Account created!</h3>
                  <p className="text-xs text-[#6B6B6B] mt-2 leading-relaxed m-0">{success.message}</p>
                </div>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#2F8F8A] text-white font-bold text-xs shadow-md hover:bg-[#1D605D] transition-all"
                >
                  Go to Sign In <ArrowRight size={15} />
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div className="bg-[#FFEBEE] border border-[#FFCDD2] text-[#D32F2F] p-3 rounded-2xl text-xs flex items-center gap-2 font-semibold">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-[#2B2B2B] mb-1.5">Guardian Full Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Maria Santos"
                    className="w-full px-4 py-3 rounded-2xl border border-[#E6E4DF] bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2B2B2B] mb-1.5">Guardian Contact Phone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 0917-123-4567"
                    className="w-full px-4 py-3 rounded-2xl border border-[#E6E4DF] bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]"
                  />
                  <p className="text-[10px] text-[#9B9B9B] font-semibold mt-1">
                    If this matches your child&apos;s guardian phone, your account is linked automatically.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2B2B2B] mb-1.5">Email Address *</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. maria.santos@gmail.com"
                    className="w-full px-4 py-3 rounded-2xl border border-[#E6E4DF] bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2B2B2B] mb-1.5">Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 8 chars, with upper, lower & number"
                      className="w-full px-4 py-3 pr-12 rounded-2xl border border-[#E6E4DF] bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9B9B] hover:text-[#2B2B2B] cursor-pointer border-none bg-transparent"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      suppressHydrationWarning
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#2F8F8A] text-white font-bold text-xs shadow-md hover:bg-[#1D605D] transition-all flex items-center justify-center gap-2 cursor-pointer border-none disabled:opacity-50"
                >
                  <span>{loading ? 'Creating your account...' : 'Create Parent Account'}</span>
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>
            )}

            <div className="text-center pt-4 border-t border-[#E6E4DF] mt-6">
              <p className="text-[11px] text-[#9B9B9B] m-0">
                Already have an account?{' '}
                <Link href="/login" className="text-[#2F8F8A] font-bold hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
