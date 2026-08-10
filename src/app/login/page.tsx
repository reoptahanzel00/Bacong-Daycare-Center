'use client';

import React, { useState } from 'react';
import { School, GraduationCap, Shield, UserCheck, Heart, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const testAccounts = [
    { role: 'Daycare Worker', email: 'worker@bacong.gov.ph', icon: GraduationCap, color: '#2F8F8A' },
    { role: 'Barangay Official', email: 'official@bacong.gov.ph', icon: Shield, color: '#F5B942' },
    { role: 'Barangay Admin', email: 'admin@bacong.gov.ph', icon: UserCheck, color: '#6366F1' },
    { role: 'Parent / Guardian', email: 'parent@bacong.gov.ph', icon: Heart, color: '#F2896B' },
  ];

  const handleSelectAccount = (accEmail: string) => {
    setEmail(accEmail);
    setPassword('Password123!');
    setErrorMessage(null);
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

      let userRole: 'worker' | 'official' | 'barangay_admin' | 'parent' = 'worker';
      const cleanEmail = email.trim().toLowerCase();

      if (data?.user) {
        const metaRole = data.user.user_metadata?.role;
        const { data: profile } = await supabase
          .from('users')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profile?.role && ['worker', 'official', 'barangay_admin', 'parent'].includes(profile.role)) {
          userRole = profile.role;
        } else if (metaRole && ['worker', 'official', 'barangay_admin', 'parent'].includes(metaRole)) {
          userRole = metaRole;
        } else if (cleanEmail.includes('official')) {
          userRole = 'official';
        } else if (cleanEmail.includes('admin')) {
          userRole = 'barangay_admin';
        } else if (cleanEmail.includes('parent')) {
          userRole = 'parent';
        } else if (cleanEmail.includes('worker')) {
          userRole = 'worker';
        }
      } else {
        if (cleanEmail.includes('official')) userRole = 'official';
        else if (cleanEmail.includes('admin')) userRole = 'barangay_admin';
        else if (cleanEmail.includes('parent')) userRole = 'parent';
      }

      localStorage.setItem('bacong_auth_role', userRole);

      // Successful login -> Redirect to main dashboard
      router.push('/');
      router.refresh();
    } catch {
      setErrorMessage('Unable to connect to authentication server. Please check your connection.');
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

        {/* Right Side: Real Login Form */}
        <div className="p-8 md:p-10 flex flex-col justify-between space-y-6">
          <div>
            <h2 className="text-xl font-bold text-[#2B2B2B] m-0">Sign In to Your Account</h2>
            <p className="text-xs text-[#6B6B6B] mt-1 m-0">
              Enter your registered Barangay email address and password to access your portal.
            </p>

            {/* Quick Test Account Fill Buttons */}
            <div className="mt-4 p-3 bg-[#FAF8F5] rounded-2xl border border-[#E6E4DF]">
              <div className="text-[10px] font-extrabold text-[#9B9B9B] uppercase tracking-wider mb-2">
                Quick Fill Test Account (Password: Password123!)
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {testAccounts.map((acc) => {
                  const Icon = acc.icon;
                  return (
                    <button
                      key={acc.email}
                      type="button"
                      onClick={() => handleSelectAccount(acc.email)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white border border-[#E6E4DF] hover:border-[#2F8F8A] text-[11px] font-bold text-[#2B2B2B] transition-all cursor-pointer text-left truncate"
                    >
                      <Icon size={13} style={{ color: acc.color }} />
                      <span className="truncate">{acc.role.split(' ')[0]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Error Banner */}
            {errorMessage && (
              <div className="mt-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-700 font-semibold animate-shake">
                <AlertCircle size={18} className="shrink-0 text-rose-600" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Login Form */}
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
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 rounded-2xl border border-[#E6E4DF] bg-white text-xs font-semibold text-[#2B2B2B] focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]"
                />
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
