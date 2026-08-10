'use client';

import React from 'react';
import { 
  X, 
  Users, 
  CheckCircle2, 
  TrendingUp, 
  Megaphone, 
  FileText, 
  Shield, 
  Heart, 
  UserCheck, 
  School,
  Calendar,
  BellRing,
  Sparkles
} from 'lucide-react';
import type { UserRole } from '@/contexts/DaycareContext';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onRoleChange?: (role: UserRole) => void;
}

export default function MobileNav({
  isOpen,
  onClose,
  currentRole,
  activeTab,
  onTabChange,
  onRoleChange
}: MobileNavProps) {
  if (!isOpen) return null;

  const roleConfigs = {
    worker: {
      title: 'Daycare Worker',
      badge: 'Teacher Portal',
      items: [
        { id: 'pupils', label: 'Pupil Roster', icon: Users },
        { id: 'attendance', label: 'Daily Attendance', icon: CheckCircle2 },
        { id: 'progress', label: 'ECCD Progress', icon: TrendingUp },
        { id: 'announcements', label: 'Announcements', icon: Megaphone },
      ]
    },
    official: {
      title: 'Barangay Official',
      badge: 'Oversight View',
      items: [
        { id: 'overview', label: 'Executive Overview', icon: Shield },
        { id: 'attendance_logs', label: 'Attendance Logs', icon: CheckCircle2 },
        { id: 'consecutive_absences', label: 'Absence Telemetry', icon: BellRing },
      ]
    },
    barangay_admin: {
      title: 'Barangay Admin',
      badge: 'System Governance',
      items: [
        { id: 'overview', label: 'Admin Dashboard', icon: UserCheck },
        { id: 'user_management', label: 'User Provisioning', icon: Users },
        { id: 'audit_logs', label: 'Audit Trail', icon: FileText },
      ]
    },
    parent: {
      title: 'Parent / Guardian',
      badge: 'Family Portal',
      items: [
        { id: 'child', label: 'Child Profile', icon: Heart },
        { id: 'attendance', label: 'Attendance Calendar', icon: Calendar },
        { id: 'progress', label: 'Milestone Progress', icon: TrendingUp },
        { id: 'announcements', label: 'Daycare Notices', icon: Megaphone },
      ]
    }
  };

  const currentConfig = roleConfigs[currentRole] || roleConfigs.worker;

  const rolesList: { id: UserRole; label: string; icon: any }[] = [
    { id: 'worker', label: 'Daycare Worker', icon: Users },
    { id: 'official', label: 'Barangay Official', icon: Shield },
    { id: 'barangay_admin', label: 'Barangay Admin', icon: UserCheck },
    { id: 'parent', label: 'Parent Portal', icon: Heart },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden flex" suppressHydrationWarning>
      {/* Backdrop overlay click handler */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Slide-out drawer panel */}
      <div className="relative w-80 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col p-6 space-y-6 z-10 overflow-y-auto animate-slideRight">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-[#E6E4DF] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2F8F8A] to-[#1D605D] flex items-center justify-center text-white font-bold shadow-md">
              <School size={20} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[#2B2B2B] leading-tight m-0">Bacong Daycare</h3>
              <p className="text-[10px] font-semibold text-[#2F8F8A] uppercase tracking-wider m-0">
                {currentConfig.badge}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#9B9B9B] hover:bg-[#FAF8F5] hover:text-[#2B2B2B] transition-all border-none bg-transparent cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Section */}
        <div className="space-y-1.5 flex-1">
          <div className="text-[10px] font-extrabold text-[#9B9B9B] uppercase tracking-wider px-3 mb-2">
            Navigation Menu
          </div>
          {currentConfig.items.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onTabChange(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left border-none cursor-pointer ${
                  isActive
                    ? 'bg-[#2F8F8A] text-white shadow-md'
                    : 'bg-transparent text-[#4A4A4A] hover:bg-[#FAF8F5]'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-white' : 'text-[#6B6B6B]'} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Demo Role Switcher Section */}
        {onRoleChange && (
          <div className="border-t border-[#E6E4DF] pt-4 space-y-2">
            <div className="text-[10px] font-extrabold text-[#9B9B9B] uppercase tracking-wider px-3">
              Switch Portal Role (Demo)
            </div>
            <div className="grid grid-cols-2 gap-2">
              {rolesList.map((r) => {
                const Icon = r.icon;
                const isSelected = currentRole === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      onRoleChange(r.id);
                      onClose();
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#2F8F8A]/10 border-[#2F8F8A] text-[#2F8F8A]'
                        : 'bg-[#FAF8F5] border-[#E6E4DF] text-[#6B6B6B] hover:bg-white'
                    }`}
                  >
                    <Icon size={14} />
                    <span className="truncate">{r.label.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer info */}
        <div className="border-t border-[#E6E4DF] pt-4 text-center">
          <p className="text-[10px] font-semibold text-[#9B9B9B] m-0">
            Barangay Bacong Daycare v1.0 • RA 10173 Compliant
          </p>
        </div>

      </div>
    </div>
  );
}
