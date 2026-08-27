'use client';

import React, { useEffect, useState } from 'react';
import { School, ArrowRight, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type UserRole = 'worker' | 'official' | 'barangay_admin' | 'parent';
type AuthMode = 'signin' | 'create';

const PASSWORD_RE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d).{8,}$/;

type Handedness = 'right' | 'left' | 'both' | 'not_yet_established';

interface ChildProfileForm {
  firstName: string;
  lastName: string;
  birthDate: string;
  sex: 'Male' | 'Female';
  barangay: string;
  municipality: string;
  province: string;
  region: string;
  handedness: Handedness;
  currentlyStudying: boolean;
  schoolName: string;
  relationship: 'Mother' | 'Father' | 'Grandmother' | 'Grandfather' | 'Legal Guardian';
  fatherName: string;
  fatherAge: string;
  fatherOccupation: string;
  fatherEducation: string;
  motherName: string;
  motherAge: string;
  motherOccupation: string;
  motherEducation: string;
  siblingsCount: string;
  birthOrder: string;
}

const EMPTY_CHILD: ChildProfileForm = {
  firstName: '',
  lastName: '',
  birthDate: '',
  sex: 'Male',
  barangay: '',
  municipality: '',
  province: '',
  region: '',
  handedness: 'right',
  currentlyStudying: false,
  schoolName: '',
  relationship: 'Mother',
  fatherName: '',
  fatherAge: '',
  fatherOccupation: '',
  fatherEducation: '',
  motherName: '',
  motherAge: '',
  motherOccupation: '',
  motherEducation: '',
  siblingsCount: '',
  birthOrder: '',
};

const HANDEDNESS_OPTIONS: Array<{ value: Handedness; label: string }> = [
  { value: 'right', label: 'Right' },
  { value: 'left', label: 'Left' },
  { value: 'both', label: 'Both' },
  { value: 'not_yet_established', label: 'Not yet established' },
];

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
  const [children, setChildren] = useState<ChildProfileForm[]>([{ ...EMPTY_CHILD }]);

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
    setChildren([{ ...EMPTY_CHILD }]);
    if (typeof window !== 'undefined') {
      window.location.hash = next === 'create' ? 'create' : '';
    }
  };

  const updateChild = (index: number, patch: Partial<ChildProfileForm>) => {
    setChildren((prev) => prev.map((child, i) => (i === index ? { ...child, ...patch } : child)));
  };

  const addChild = () => {
    setChildren((prev) => (prev.length >= 5 ? prev : [...prev, { ...EMPTY_CHILD }]));
  };

  const removeChild = (index: number) => {
    setChildren((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
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
      // Server-side sign-in: rate-limited and returns the verified profile/role.
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password: password,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        localStorage.removeItem('bacong_auth_role');
        setErrorMessage(data.error || 'Invalid email or password. Please check your credentials.');
        setLoading(false);
        return;
      }

      if (data?.user?.role) {
        // The users table is the authoritative source of role. user_metadata is
        // user-editable and must not be trusted for authorization.
        localStorage.setItem('bacong_auth_role', data.user.role);
        router.push('/');
        router.refresh();
        return;
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
    if (createRole === 'parent' && !phone.trim()) {
      setCreateError('Please provide a guardian contact phone number.');
      return;
    }
    if (!PASSWORD_RE.test(createPassword)) {
      setCreateError('Password must be at least 8 characters with uppercase, lowercase, and a number.');
      return;
    }
    if (createRole === 'parent') {
      const incomplete = children.findIndex((child) => {
        const coreMissing =
          !child.firstName.trim() ||
          !child.lastName.trim() ||
          !child.birthDate ||
          !child.barangay.trim() ||
          !child.municipality.trim() ||
          !child.province.trim() ||
          !child.region.trim();
        const studyingMissing = child.currentlyStudying && !child.schoolName.trim();
        return coreMissing || studyingMissing;
      });
      if (incomplete !== -1) {
        setCreateError(
          `Child #${incomplete + 1}: please complete the required sociodemographic fields (name, birth date, sex, address, and school name if currently studying).`
        );
        return;
      }
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
          password: createPassword,
          children: createRole === 'parent'
            ? children.map((child) => ({
                firstName: child.firstName.trim(),
                lastName: child.lastName.trim(),
                birthDate: child.birthDate,
                sex: child.sex,
                barangay: child.barangay.trim(),
                municipality: child.municipality.trim(),
                province: child.province.trim(),
                region: child.region.trim(),
                handedness: child.handedness,
                currentlyStudying: child.currentlyStudying,
                schoolName: child.schoolName.trim() || null,
                relationship: child.relationship,
                fatherName: child.fatherName.trim() || null,
                fatherAge: child.fatherAge ? Number(child.fatherAge) : null,
                fatherOccupation: child.fatherOccupation.trim() || null,
                fatherEducation: child.fatherEducation.trim() || null,
                motherName: child.motherName.trim() || null,
                motherAge: child.motherAge ? Number(child.motherAge) : null,
                motherOccupation: child.motherOccupation.trim() || null,
                motherEducation: child.motherEducation.trim() || null,
                siblingsCount: child.siblingsCount ? Number(child.siblingsCount) : null,
                birthOrder: child.birthOrder.trim() || null,
              }))
            : undefined,
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
    <div className="min-h-screen bg-canvas flex items-center justify-center p-6" suppressHydrationWarning>
      <div className={`w-full bg-white rounded-3xl border border-line shadow-xl overflow-hidden grid grid-cols-1 md:grid-cols-2 ${mode === 'create' ? 'max-w-5xl' : 'max-w-4xl'}`}>

        {/* Left Side: Branding */}
        <div className="bg-gradient-to-br from-primary-display to-primary-hover p-10 color-white flex flex-col justify-between text-white">
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
              <CheckCircle2 size={16} className="text-warn-fill" />
              <span>Data Privacy Act (RA 10173) Compliant</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-warn-fill" />
              <span>4 DSWD ECCD Developmental Domains</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-warn-fill" />
              <span>Supabase Authentication & Row-Level Security</span>
            </div>
          </div>
        </div>

        {/* Right Side: Unified Auth */}
        <div className="p-8 md:p-10 flex flex-col space-y-6">
          {/* Mode Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-canvas border border-line rounded-2xl">
            <button
              type="button"
              onClick={() => switchMode('signin')}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-none ${
                mode === 'signin' ? 'bg-white text-primary shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
              suppressHydrationWarning
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('create')}
              className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-none ${
                mode === 'create' ? 'bg-white text-primary shadow-sm' : 'text-ink-muted hover:text-ink'
              }`}
              suppressHydrationWarning
            >
              Create Account
            </button>
          </div>

          {mode === 'signin' ? (
            <div className="flex flex-col flex-1">
              <div>
                <h2 className="text-xl font-bold text-ink m-0">Sign In to Your Account</h2>
                <p className="text-xs text-ink-muted mt-1 m-0">
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
                  <label htmlFor="srcapploginpage-email-address-1" className="block text-xs font-bold text-ink mb-1.5">Email Address</label>
                  <input id="srcapploginpage-email-address-1"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@bacong.gov.ph"
                    className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-xs font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-primary-display"
                  />
                </div>

                <div>
                  <label htmlFor="srcapploginpage-password-2" className="block text-xs font-bold text-ink mb-1.5">Password</label>
                  <div className="relative">
                    <input id="srcapploginpage-password-2"
                      type={showPassword ? 'text' : 'password'}
                      required
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
                      suppressHydrationWarning
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    {resetSent ? (
                      <span className="text-[11px] font-bold text-primary flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        Reset link sent to your email.
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={loading}
                        className="text-[11px] font-bold text-primary hover:underline cursor-pointer border-none bg-transparent disabled:opacity-50"
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
                  className="w-full py-3.5 px-6 rounded-2xl bg-primary text-white font-bold text-xs shadow-md hover:bg-primary-hover transition-all flex items-center justify-center gap-2 cursor-pointer border-none disabled:opacity-50"
                >
                  <span>{loading ? 'Authenticating with Supabase...' : 'Sign In to Portal'}</span>
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>
            </div>
          ) : (
            <div className="flex flex-col flex-1">
              <div>
                <h2 className="text-xl font-bold text-ink m-0">Create an Account</h2>
                <p className="text-xs text-ink-muted mt-1 m-0">
                  Choose your role to see the correct registration form.
                </p>
              </div>

              {createSuccess ? (
                <div className="text-center space-y-4 py-6 mt-2">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-ink m-0">Account created!</h3>
                    <p className="text-xs text-ink-muted mt-2 leading-relaxed m-0">{createSuccess.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => switchMode('signin')}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white font-bold text-xs shadow-md hover:bg-primary-hover transition-all cursor-pointer border-none"
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
                    {/* A choice built from buttons is still a radio group: without
                        these roles a screen reader announces four unrelated buttons
                        and never says which one is chosen. */}
                    <label id="signup-role-label" className="block text-xs font-bold text-ink mb-1.5">Select Role *</label>
                    <div className="grid grid-cols-1 gap-1.5" role="radiogroup" aria-labelledby="signup-role-label">
                      {ROLE_OPTIONS.map((role) => (
                        <button
                          key={role.id}
                          type="button"
                          role="radio"
                          aria-checked={createRole === role.id}
                          onClick={() => {
                            setCreateRole(role.id);
                            setCreateError(null);
                          }}
                          className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                            createRole === role.id
                              ? 'border-primary-display bg-primary-light'
                              : 'border-line bg-white hover:border-ink-subtle'
                          }`}
                          suppressHydrationWarning
                        >
                          <span className="block text-xs font-bold text-ink">{role.label}</span>
                          <span className="block text-[10px] text-ink-muted mt-0.5">{role.hint}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {selectedRole.isPublic ? (
                    <>
                      <div>
                        <label htmlFor="srcapploginpage-guardian-full-name-3" className="block text-xs font-bold text-ink mb-1.5">Guardian Full Name *</label>
                        <input id="srcapploginpage-guardian-full-name-3"
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="e.g. Maria Santos"
                          className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                        />
                      </div>

                      <div>
                        <label htmlFor="srcapploginpage-guardian-contact-phone-4" className="block text-xs font-bold text-ink mb-1.5">Guardian Contact Phone *</label>
                        <input id="srcapploginpage-guardian-contact-phone-4"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="e.g. 0917-123-4567"
                          className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                        />
                        <p className="text-[10px] text-ink-subtle font-semibold mt-1">
                          Used for your guardian record and daycare contact.
                        </p>
                      </div>

                      <div>
                        <label htmlFor="srcapploginpage-email-address-5" className="block text-xs font-bold text-ink mb-1.5">Email Address *</label>
                        <input id="srcapploginpage-email-address-5"
                          type="email"
                          value={createEmail}
                          onChange={(e) => setCreateEmail(e.target.value)}
                          placeholder="e.g. maria.santos@gmail.com"
                          className="w-full px-4 py-3 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                        />
                      </div>

                      <div>
                        <label htmlFor="srcapploginpage-password-6" className="block text-xs font-bold text-ink mb-1.5">Password *</label>
                        <div className="relative">
                          <input id="srcapploginpage-password-6"
                            type={showCreatePassword ? 'text' : 'password'}
                            value={createPassword}
                            onChange={(e) => setCreatePassword(e.target.value)}
                            placeholder="Min 8 chars, with upper, lower & number"
                            className="w-full px-4 py-3 pr-12 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                          />
                          <button
                            type="button"
                            onClick={() => setShowCreatePassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink cursor-pointer border-none bg-transparent"
                            aria-label={showCreatePassword ? 'Hide password' : 'Show password'}
                            suppressHydrationWarning
                          >
                            {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      {/* Sociodemographic Profile (ECCD Form Section 1) */}
                      <div className="pt-2 border-t border-line">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-extrabold text-ink m-0">Child&apos;s Sociodemographic Profile</h3>
                            <p className="text-[10px] text-ink-muted m-0 mt-0.5">
                              ECCD Form Section 1 — a Daycare Worker verifies this before enrollment.
                            </p>
                          </div>
                          {children.length > 1 && (
                            <span className="text-[10px] font-bold text-primary shrink-0">
                              {children.length} of 5 children
                            </span>
                          )}
                        </div>

                        {children.map((child, index) => (
                          <div
                            key={index}
                            className="mt-3 p-4 rounded-2xl border border-line bg-canvas space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-primary">
                                Child #{index + 1}
                              </span>
                              {children.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeChild(index)}
                                  className="text-[10px] font-bold text-danger hover:underline cursor-pointer border-none bg-transparent"
                                  suppressHydrationWarning
                                >
                                  Remove child
                                </button>
                              )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label htmlFor="srcapploginpage-first-name-7" className="block text-[10px] font-bold text-ink mb-1">First Name *</label>
                                <input id="srcapploginpage-first-name-7"
                                  type="text"
                                  value={child.firstName}
                                  onChange={(e) => updateChild(index, { firstName: e.target.value })}
                                  placeholder="Child&apos;s first name"
                                  className="w-full px-3 py-2.5 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                />
                              </div>
                              <div>
                                <label htmlFor="srcapploginpage-last-name-8" className="block text-[10px] font-bold text-ink mb-1">Last Name *</label>
                                <input id="srcapploginpage-last-name-8"
                                  type="text"
                                  value={child.lastName}
                                  onChange={(e) => updateChild(index, { lastName: e.target.value })}
                                  placeholder="Child&apos;s last name"
                                  className="w-full px-3 py-2.5 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div>
                                <label htmlFor="srcapploginpage-date-of-birth-9" className="block text-[10px] font-bold text-ink mb-1">Date of Birth *</label>
                                <input id="srcapploginpage-date-of-birth-9"
                                  type="date"
                                  value={child.birthDate}
                                  onChange={(e) => updateChild(index, { birthDate: e.target.value })}
                                  className="w-full px-3 py-2.5 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                />
                              </div>
                              <div>
                                <label htmlFor="srcapploginpage-sex-10" className="block text-[10px] font-bold text-ink mb-1">Sex *</label>
                                <select id="srcapploginpage-sex-10"
                                  value={child.sex}
                                  onChange={(e) => updateChild(index, { sex: e.target.value as 'Male' | 'Female' })}
                                  className="w-full px-3 py-2.5 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                >
                                  <option value="Male">Male</option>
                                  <option value="Female">Female</option>
                                </select>
                              </div>
                              <div>
                                <label htmlFor="srcapploginpage-relationship-11" className="block text-[10px] font-bold text-ink mb-1">Relationship *</label>
                                <select id="srcapploginpage-relationship-11"
                                  value={child.relationship}
                                  onChange={(e) =>
                                    updateChild(index, {
                                      relationship: e.target.value as ChildProfileForm['relationship'],
                                    })
                                  }
                                  className="w-full px-3 py-2.5 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                >
                                  <option value="Mother">Mother</option>
                                  <option value="Father">Father</option>
                                  <option value="Grandmother">Grandmother</option>
                                  <option value="Grandfather">Grandfather</option>
                                  <option value="Legal Guardian">Legal Guardian</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label htmlFor="srcapploginpage-address-12" className="block text-[10px] font-bold text-ink mb-1">Address *</label>
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                <input id="srcapploginpage-address-12"
                                  type="text"
                                  value={child.barangay}
                                  onChange={(e) => updateChild(index, { barangay: e.target.value })}
                                  placeholder="Barangay"
                                  className="w-full px-3 py-2.5 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                />
                                <input
                                  type="text"
                                  value={child.municipality}
                                  onChange={(e) => updateChild(index, { municipality: e.target.value })}
                                  placeholder="Municipality / City"
                                  className="w-full px-3 py-2.5 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                />
                                <input
                                  type="text"
                                  value={child.province}
                                  onChange={(e) => updateChild(index, { province: e.target.value })}
                                  placeholder="Province"
                                  className="w-full px-3 py-2.5 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                />
                                <input
                                  type="text"
                                  value={child.region}
                                  onChange={(e) => updateChild(index, { region: e.target.value })}
                                  placeholder="Region"
                                  className="w-full px-3 py-2.5 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                />
                              </div>
                            </div>

                            <div>
                              <label id={`child-${index}-handedness-label`} className="block text-[10px] font-bold text-ink mb-1">Handedness *</label>
                              <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`child-${index}-handedness-label`}>
                                {HANDEDNESS_OPTIONS.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={child.handedness === option.value}
                                    onClick={() => updateChild(index, { handedness: option.value })}
                                    className={`px-3 py-2 rounded-2xl border text-[11px] font-bold transition-all cursor-pointer ${
                                      child.handedness === option.value
                                        ? 'border-primary-display bg-primary-light text-primary'
                                        : 'border-line bg-white text-ink-muted hover:border-ink-subtle'
                                    }`}
                                    suppressHydrationWarning
                                  >
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label id={`child-${index}-studying-label`} className="block text-[10px] font-bold text-ink mb-1">
                                  Is the child presently studying? *
                                </label>
                                <div className="flex gap-2" role="radiogroup" aria-labelledby={`child-${index}-studying-label`}>
                                  <button
                                    type="button"
                                    role="radio"
                                    aria-checked={child.currentlyStudying}
                                    onClick={() => updateChild(index, { currentlyStudying: true })}
                                    className={`flex-1 px-3 py-2 rounded-2xl border text-[11px] font-bold transition-all cursor-pointer ${
                                      child.currentlyStudying
                                        ? 'border-primary-display bg-primary-light text-primary'
                                        : 'border-line bg-white text-ink-muted hover:border-ink-subtle'
                                    }`}
                                    suppressHydrationWarning
                                  >
                                    Yes
                                  </button>
                                  <button
                                    type="button"
                                    role="radio"
                                    aria-checked={!child.currentlyStudying}
                                    onClick={() => updateChild(index, { currentlyStudying: false, schoolName: '' })}
                                    className={`flex-1 px-3 py-2 rounded-2xl border text-[11px] font-bold transition-all cursor-pointer ${
                                      !child.currentlyStudying
                                        ? 'border-primary-display bg-primary-light text-primary'
                                        : 'border-line bg-white text-ink-muted hover:border-ink-subtle'
                                    }`}
                                    suppressHydrationWarning
                                  >
                                    No
                                  </button>
                                </div>
                              </div>
                              {child.currentlyStudying && (
                                <div>
                                  <label htmlFor="srcapploginpage-name-of-school-learning-13" className="block text-[10px] font-bold text-ink mb-1">
                                    Name of school / learning center *
                                  </label>
                                  <input id="srcapploginpage-name-of-school-learning-13"
                                    type="text"
                                    value={child.schoolName}
                                    onChange={(e) => updateChild(index, { schoolName: e.target.value })}
                                    placeholder="e.g. Bacong Daycare Center"
                                    className="w-full px-3 py-2.5 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                  />
                                </div>
                              )}
                            </div>

                            {/* Optional parent + sibling details */}
                            <details className="text-[11px]">
                              <summary className="cursor-pointer font-bold text-primary">
                                Parent &amp; sibling details (optional)
                              </summary>
                              <div className="mt-3 space-y-3">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={child.fatherName}
                                    onChange={(e) => updateChild(index, { fatherName: e.target.value })}
                                    placeholder="Father&apos;s name"
                                    className="w-full px-3 py-2 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                  />
                                  <input
                                    type="number"
                                    min={0}
                                    max={120}
                                    value={child.fatherAge}
                                    onChange={(e) => updateChild(index, { fatherAge: e.target.value })}
                                    placeholder="Father&apos;s age"
                                    className="w-full px-3 py-2 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                  />
                                  <input
                                    type="text"
                                    value={child.fatherOccupation}
                                    onChange={(e) => updateChild(index, { fatherOccupation: e.target.value })}
                                    placeholder="Father&apos;s occupation"
                                    className="w-full px-3 py-2 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                  />
                                  <input
                                    type="text"
                                    value={child.fatherEducation}
                                    onChange={(e) => updateChild(index, { fatherEducation: e.target.value })}
                                    placeholder="Father&apos;s educational attainment"
                                    className="w-full px-3 py-2 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                  />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <input
                                    type="text"
                                    value={child.motherName}
                                    onChange={(e) => updateChild(index, { motherName: e.target.value })}
                                    placeholder="Mother&apos;s name"
                                    className="w-full px-3 py-2 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                  />
                                  <input
                                    type="number"
                                    min={0}
                                    max={120}
                                    value={child.motherAge}
                                    onChange={(e) => updateChild(index, { motherAge: e.target.value })}
                                    placeholder="Mother&apos;s age"
                                    className="w-full px-3 py-2 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                  />
                                  <input
                                    type="text"
                                    value={child.motherOccupation}
                                    onChange={(e) => updateChild(index, { motherOccupation: e.target.value })}
                                    placeholder="Mother&apos;s occupation"
                                    className="w-full px-3 py-2 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                  />
                                  <input
                                    type="text"
                                    value={child.motherEducation}
                                    onChange={(e) => updateChild(index, { motherEducation: e.target.value })}
                                    placeholder="Mother&apos;s educational attainment"
                                    className="w-full px-3 py-2 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                  />
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <input
                                    type="number"
                                    min={0}
                                    max={50}
                                    value={child.siblingsCount}
                                    onChange={(e) => updateChild(index, { siblingsCount: e.target.value })}
                                    placeholder="Number of siblings"
                                    className="w-full px-3 py-2 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                  />
                                  <input
                                    type="text"
                                    value={child.birthOrder}
                                    onChange={(e) => updateChild(index, { birthOrder: e.target.value })}
                                    placeholder="Birth order (1st, 2nd, 3rd...)"
                                    className="w-full px-3 py-2 rounded-2xl border border-line bg-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display"
                                  />
                                </div>
                              </div>
                            </details>
                          </div>
                        ))}

                        {children.length < 5 && (
                          <button
                            type="button"
                            onClick={addChild}
                            className="mt-3 w-full py-2.5 rounded-2xl border border-dashed border-primary-display/40 text-[11px] font-bold text-primary bg-primary-light/50 hover:bg-primary-light transition-all cursor-pointer"
                            suppressHydrationWarning
                          >
                            + Add another child (max 5)
                          </button>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3.5 px-6 rounded-2xl bg-primary text-white font-bold text-xs shadow-md hover:bg-primary-hover transition-all flex items-center justify-center gap-2 cursor-pointer border-none disabled:opacity-50"
                      >
                        <span>{loading ? 'Creating your account...' : 'Submit for Verification'}</span>
                        {!loading && <ArrowRight size={16} />}
                      </button>
                    </>
                  ) : (
                    <div className="p-4 rounded-2xl bg-warn-light border border-warn-border text-xs space-y-2">
                      <div className="flex items-center gap-2 font-bold text-warn">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>This account type is created by the Barangay Admin</span>
                      </div>
                      <p className="text-[11px] text-warn leading-relaxed m-0">
                        {selectedRole.label} accounts are provisioned by the Barangay Admin to protect
                        system access. Please contact the Barangay IT Administration to have your
                        account created.
                      </p>
                      <button
                        type="button"
                        onClick={() => setCreateRole('parent')}
                        className="text-[11px] font-bold text-primary hover:underline cursor-pointer border-none bg-transparent"
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

          <div className="text-center pt-4 border-t border-line">
            <p className="text-[11px] text-ink-subtle m-0">
              Need account assistance? Contact <strong className="text-ink">Barangay Bacong IT Administration</strong>.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
