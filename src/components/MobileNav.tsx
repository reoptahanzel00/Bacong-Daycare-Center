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
  ShieldCheck,
  Heart, 
  UserCheck, 
  School,
  BellRing,
  BookOpen,
  MessageSquare,
  Activity,
  Image,
  FolderCheck
} from 'lucide-react';
import type { UserRole } from '@/contexts/DaycareContext';
import { ECCD_TOTAL_ITEMS } from '@/data/eccdChecklist';

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
  onTabChange
}: MobileNavProps) {
  if (!isOpen) return null;

  const roleConfigs = {
    worker: {
      title: 'Daycare Worker',
      badge: 'Teacher Workspace',
      items: [
        { id: 'dashboard', label: 'Daily Register', icon: CheckCircle2 },
        { id: 'pupils', label: 'Pupil Roster', icon: Users },
        { id: 'verify', label: 'Verify Enrollments', icon: ShieldCheck },
        { id: 'progress', label: `${ECCD_TOTAL_ITEMS}-Item ECCD Tool`, icon: TrendingUp },
        { id: 'parent_notes_inbox', label: 'Parent Notes Inbox', icon: MessageSquare },
        { id: 'health_entry', label: 'Nutritional Log', icon: Activity },
        { id: 'announcements', label: 'Announcements', icon: Megaphone },
      ]
    },
    official: {
      title: 'Barangay Official',
      badge: 'Oversight View',
      items: [
        { id: 'overview', label: 'Executive Overview', icon: Shield },
        { id: 'reports', label: 'DSWD Form 1 PDF', icon: FileText },
        { id: 'consecutive_absences', label: 'Absence Telemetry', icon: BellRing },
        { id: 'announcements', label: 'Barangay Notices', icon: Megaphone },
      ]
    },
    barangay_admin: {
      title: 'Barangay Admin',
      badge: 'System Governance',
      items: [
        { id: 'users', label: 'User Provisioning', icon: UserCheck },
        { id: 'audit_logs', label: 'Security Audit Trail', icon: FileText },
        { id: 'security', label: 'Data Privacy RLS Audit', icon: Shield },
        { id: 'announcements', label: 'System Notices', icon: Megaphone },
      ]
    },
    parent: {
      title: 'Parent / Guardian',
      badge: 'Family Portal',
      items: [
        { id: 'child', label: 'Child Profile', icon: Heart },
        { id: 'eccd_checklist', label: `${ECCD_TOTAL_ITEMS}-Item ECCD Checklist`, icon: BookOpen },
        { id: 'parent_notes', label: 'Teacher Messages', icon: MessageSquare },
        { id: 'health_tracker', label: 'Nutritional & Growth', icon: Activity },
        { id: 'gallery', label: 'Classroom Moments', icon: Image },
        { id: 'documents', label: 'Requirements', icon: FolderCheck },
        { id: 'announcements', label: 'Daycare Notices', icon: Megaphone },
      ]
    }
  };

  const currentConfig = roleConfigs[currentRole] || roleConfigs.worker;

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
