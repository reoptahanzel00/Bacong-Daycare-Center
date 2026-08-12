'use client';

import React, { useEffect, useState } from 'react';
import { School, ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type UserRole = 'worker' | 'official' | 'barangay_admin' | 'parent';
type AuthMode = 'signin' | 'create';

const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/;

const ROLE_OPTIONS: Array<{ id: UserRole; label: string; hint: string; isPublic: boolean }> = [
  { id: 'parent', label: 'Parent / Guardian', hint: 'For parents and guardians of enrolled pupils.', isPublic: true },
  { id: 'worker', label: 'Daycare Worker', hint: 'Daycare staff who manage registers and evaluations.', isPublic: false },
  { id: 'official', label: 'Barangay Official', hint: 'Read-only oversight for barangay officials.', isPublic: false },
  { id: 'barangay_admin', label: 'Barangay Admin', hint: 'System administrators who provision accounts.', isPublic: false },
];

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>(() =>
    typeof window !== 'undefined' && window.location.hash === '#create' ? 'create' : 'signin'
  );

  // Sign-in state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Create-account state
  const [createRole, setCreateRole] = useState<UserRole>('parent');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<{ message: string; linked: boolean } | null>(null);

  const selectedRole = ROLE_OPTIONS.find((r) => r.id === createRole) || ROLE_OPTIONS[0];

  // Sync the deep link (/register → /login#create) once on the client; the URL
  // hash is an external system not visible during SSR hydration.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#create') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode('create');
    }
  }, []);

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setErrorMessage(null);
    setCreateError(null);
    if (typeof window !== 'undefined') {
      window.location.hash = next === 'create' ? 'create' : '';
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setErrorMessage('Enter your email address first.');
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }
      setErrorMessage(null);
      setResetSent(true);
    } catch {
      setErrorMessage('Unable to send the reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      if (error) {
        setErrorMessage(error.message || 'Invalid email or password. Please check your credentials.');
        setLoading(false);
        return;
      }

      if (data?.user) {
        // The users table is the authoritative source of role. user_metadata is
        // user-editable and must not be trusted for authorization.
        const { data: profile } = await supabase
          .from('users')
          .select('role, status')
          .eq('id', data.user.id)
          .single();

        if (profile?.role && ['worker', 'official', 'barangay_admin', 'parent'].includes(profile.role)) {
          if (profile.status === 'disabled') {
            await supabase.auth.signOut();
            setErrorMessage('This account has been disabled. Please contact the Barangay Admin.');
            setLoading(false);
            return;
          }
          localStorage.setItem('bacong_auth_role', profile.role);
          router.push('/');
          router.refresh();
          return;
        } else {
          // Authenticated in Supabase but no valid profile — fail closed.
          await supabase.auth.signOut();
          setErrorMessage('This account is not provisioned for the daycare system. Please contact the Barangay Admin.');
          setLoading(false);
          return;
        }
      }

      setErrorMessage('Unable to verify your account role. Please try again.');
      setLoading(false);
    } catch {
      setErrorMessage('Unable to connect to authentication server. Please check your connection.');
      setLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!fullName.trim() || !createEmail.trim()) {
      setCreateError('Please fill in your full name and email address.');
      return;
    }
    if (!PASSWORD_RE.test(createPassword)) {
      setCreateError('Password must be at least 8 characters with uppercase, lowercase, and a number.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: createRole,
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: createEmail.trim(),
          password: createPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCreateError(data.error || 'Unable to create your account. Please try again.');
        return;
      }
      setCreateSuccess({ message: data.message, linked: !!data.linked });
    } catch {
      setCreateError('Network error while creating your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center p-6" suppressHydrationWarning>
      <div className="w-full max-w-4xl bg-white rounded-3xl border border-[#E6E4DF] shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2">

        {/* Left Side: Branding */}
        <div className="bg-gradient-to-br from-[#2F8F8A] to-[#1D605D] p-10 color-white flex flex-col justify-between text-white">
          <div>
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-6">
              <School size={32} color="white" />
            </div>
            <span className="text-xs font-bold uppercase tracking-wider text-white/80">
              Barangay Bacong Daycare Center
            </span>
            <h1 className="text-2xl font-bold mt-2 text-white leading-snug">
              Student Progress & Enrollment Tracker
            </h1>
            <p className="text-sm text-white/90 mt-3 leading-relaxed">
              Full-stack early childhood development tracking, daily attendance registers, and DSWD-compliant reporting with Row-Level Security.
            </p>
          </div>

          <div className="space-y-3 pt-8 border-t border-white/20 text-xs text-white/85">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#F5B942]" />
              <span>Data Privacy Act (RA 10173) Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#F5B942]" />
              <span>4 DSWD ECCD Developmental Domains</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-[#F5B942]" />
              <span>Supabase Authentication & Row-Level Security</span>
            </div>
          </div>
        </div>

        {/* Right Side: Unified Auth */}
        <div className="p-8 md:p-10 flex flex-col space-y-6">
          {/* Mode Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-[#FAF8F5] border border-[#E6E4DF] rounded-2xl">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-none ${
                mode === 'signin' ? 'bg-white text-[#2F8F8A] shadow-sm' : 'text-[#6B6B6B] hover:text-[#2B2B2B]'
              }`}
              suppressHydrationWarning
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('create')}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-none ${
                mode === 'create' ? 'bg-white text-[#2F8F8A] shadow-sm' : 'text-[#6B6B6B] hover:text-[#2B2B2B]'
              }`}
              suppressHydrationWarning
            >
              Create Account
            </button>
          </div>

          {mode === 'signin' ? (
            <div className="flex flex-col flex-1">
              <div>
                <h2 className="text-xl font-bold text-[#2B2B2B] m-0">Sign In to Your Account</h2>
                <p className="text-xs text-[#6B6B6B] mt-1 m-0">
                  Your role is detected from your account — the right portal loads automatically.
                </p>
              </div>

              {errorMessage && (
                <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-semibold animate-shake">
                  <AlertCircle size={18} className="shrink-0 text-rose-600" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4 mt-4">
                <div>
                  <label className="block text-xs font-bold text-[#2B2B2B] mb-1.5">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@bacong.gov.ph"
                    className="w-full px-4 py-3 rounded-2xl border border-[#E6E4DF] bg-white text-xs font-semibold text-[#2B2B2B] focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#2B2B2B] mb-1.5">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-4 py-3 pr-12 rounded-2xl border border-[#E6E4DF] bg-white text-xs font-semibold text-[#2B2B2B] focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]"
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
                  <div className="flex items-center justify-between mt-1.5">
                    {resetSent ? (
                      <span className="text-[11px] font-bold text-[#2F8F8A] flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        Reset link sent to your email.
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={loading}
                        className="text-[11px] font-bold text-[#2F8F8A] hover:underline cursor-pointer border-none bg-transparent disabled:opacity-50"
                        suppressHydrationWarning
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-6 rounded-2xl bg-[#2F8F8A] text-white font-bold text-xs shadow-md hover:bg-[#1D605D] transition-all flex items-center justify-center gap-2 cursor-pointer border-none disabled:opacity-50"
                >
                  <span>{loading ? 'Authenticating with Supabase...' : 'Sign In to Portal'}</span>
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col flex-1">
              <div>
                <h2 className="text-xl font-bold text-[#2B2B2B] m-0">Create an Account</h2>
                <p className="text-xs text-[#6B6B6B] mt-1 m-0">
                  Choose your role to see the correct registration form.
                </p>
              </div>

              {createSuccess ? (
                <div className="text-center space-y-4 py-6 mt-2">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#2B2B2B] m-0">Account created!</h3>
                    <p className="text-xs text-[#6B6B6B] mt-2 leading-relaxed m-0">{createSuccess.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#2F8F8A] text-white font-bold text-xs shadow-md hover:bg-[#1D605D] transition-all cursor-pointer border-none"
                    suppressHydrationWarning
                  >
                    Go to Sign In <ArrowRight size={15} />
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateAccount} className="space-y-4 mt-4">
                  {createError && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-semibold">
                      <AlertCircle size={18} className="shrink-0 text-rose-600" />
                      <span>{createError}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-[#2B2B2B] mb-1.5">Select Role *</label>
                    <div className="grid grid-cols-1 gap-1.5">
                      {ROLE_OPTIONS.map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          onClick={() => {
                            setCreateRole(role.id);
                            setCreateError(null);
                          }}
                          className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                            createRole === role.id
                              ? 'border-[#2F8F8A] bg-[#EBF5F4]'
                              : 'border-[#E6E4DF] bg-white hover:border-[#9B9B9B]'
                          }`}
                          suppressHydrationWarning
                        >
                          <span className="block text-xs font-bold text-[#2B2B2B]">{role.label}</span>
                          <span className="block text-[10px] text-[#6B6B6B] mt-0.5">{role.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedRole.isPublic ? (
                    <>
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
                          value={createEmail}
                          onChange={(e) => setCreateEmail(e.target.value)}
                          placeholder="e.g. maria.santos@gmail.com"
                          className="w-full px-4 py-3 rounded-2xl border border-[#E6E4DF] bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-[#2B2B2B] mb-1.5">Password *</label>
                        <div className="relative">
                          <input
                            type={showCreatePassword ? 'text' : 'password'}
                            value={createPassword}
                            onChange={(e) => setCreatePassword(e.target.value)}
                            placeholder="Min 8 chars, with upper, lower & number"
                            className="w-full px-4 py-3 pr-12 rounded-2xl border border-[#E6E4DF] bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCreatePassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9B9B9B] hover:text-[#2B2B2B] cursor-pointer border-none bg-transparent"
                            aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
                            suppressHydrationWarning
                          >
                            {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
                    </>
                  ) : (
                    <div className="p-4 rounded-2xl bg-[#FEF8EC] border border-[#F5DAA0] text-xs space-y-2">
                      <div className="flex items-center gap-2 font-bold text-[#8A5D00]">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>This account type is created by the Barangay Admin</span>
                      </div>
                      <p className="text-[11px] text-[#8A5D00] leading-relaxed m-0">
                        {selectedRole.label} accounts are provisioned by the Barangay Admin to protect
                        system access. Please contact the Barangay IT Administration to have your
                        account created.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCreateRole('parent')}
                        className="text-[11px] font-bold text-[#2F8F8A] hover:underline cursor-pointer border-none bg-transparent"
                        suppressHydrationWarning
                      >
                        ← Register as a Parent instead
                      </button>
                    </div>
                  )}
                </form>
              )}
            </div>
          )}

          <div className="text-center pt-4 border-t border-[#E6E4DF]">
            <p className="text-[11px] text-[#9B9B9B] m-0">
              Need account assistance? Contact <strong className="text-[#2B2B2B]">Barangay Bacong IT Administration</strong>.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
