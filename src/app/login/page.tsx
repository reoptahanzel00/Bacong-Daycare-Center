'use client';

import React, { useState } from 'react';
import { School, GraduationCap, Shield, UserCheck, Heart, ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('teresa.cruz@bacong.gov.ph');
  const [password, setPassword] = useState('••••••••••••');
  const [selectedRole, setSelectedRole] = useState<'worker' | 'official' | 'barangay_admin' | 'parent'>('worker');
  const [loading, setLoading] = useState(false);

  const rolePresets = [
    {
      id: 'worker',
      title: 'Daycare Worker',
      email: 'teresa.cruz@bacong.gov.ph',
      icon: GraduationCap,
      color: '#2F8F8A',
      desc: 'Attendance register, milestone evaluation, pupil roster',
    },
    {
      id: 'official',
      title: 'Barangay Official',
      email: 'captain.santos@bacong.gov.ph',
      icon: Shield,
      color: '#F5B942',
      desc: 'Executive metrics dashboard, DSWD Form 1 PDF reports',
    },
    {
      id: 'barangay_admin',
      title: 'Barangay Admin',
      email: 'admin.mercado@bacong.gov.ph',
      icon: UserCheck,
      color: '#6366F1',
      desc: 'User account provisioning & System Audit Log trail',
    },
    {
      id: 'parent',
      title: 'Parent / Guardian',
      email: 'maria.santos@gmail.com',
      icon: Heart,
      color: '#F2896B',
      desc: 'Read-only child attendance, report card & daycare notices',
    },
  ];

  const handleSelectPreset = (preset: typeof rolePresets[0]) => {
    setSelectedRole(preset.id as any);
    setEmail(preset.email);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
      router.push('/');
    }, 600);
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
              <span>Role-Based Access Control (RBAC)</span>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form & Role Presets */}
        <div className="p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-[#2B2B2B] m-0">Sign In to Account</h2>
                <span className="text-xs text-[#6B6B6B]">Select a role preset or enter credentials</span>
              </div>
              <div className="p-2 rounded-xl bg-[#F5F3EF] text-[#2F8F8A]">
                <Lock size={20} />
              </div>
            </div>

            {/* Capstone Role Presets */}
            <div className="mb-6 space-y-2">
              <label className="text-xs font-bold text-[#6B6B6B] uppercase tracking-wider block">
                Capstone Demo Role Presets
              </label>
              <div className="grid grid-cols-2 gap-2">
                {rolePresets.map((preset) => {
                  const Icon = preset.icon;
                  const isSelected = selectedRole === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-[#2F8F8A] bg-[#EBF5F4] shadow-sm'
                          : 'border-[#E6E4DF] hover:bg-[#FAF8F5]'
                      }`}
                      suppressHydrationWarning
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <Icon size={18} color={preset.color} />
                        {isSelected && <CheckCircle2 size={14} color="var(--primary)" />}
                      </div>
                      <div className="text-xs font-bold text-[#2B2B2B]">{preset.title}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#2B2B2B] block mb-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E6E4DF] text-sm focus:outline-none focus:border-[#2F8F8A]"
                  required
                  suppressHydrationWarning
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2B2B2B] block mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-[#E6E4DF] text-sm focus:outline-none focus:border-[#2F8F8A]"
                  required
                  suppressHydrationWarning
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-full bg-[#2F8F8A] text-white font-bold text-sm hover:bg-[#247571] transition-all flex items-center justify-center gap-2 shadow-md"
                suppressHydrationWarning
              >
                <span>{loading ? 'Authenticating Session...' : 'Sign In & Launch Dashboard'}</span>
                <ArrowRight size={18} />
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-[#E6E4DF] text-center text-xs text-[#9B9B9B]">
            Republic of the Philippines • Barangay Bacong System
          </div>
        </div>

      </div>
    </div>
  );
}
