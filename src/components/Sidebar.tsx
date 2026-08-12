'use client';

import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  TrendingUp, 
  CalendarCheck, 
  Megaphone, 
  ShieldCheck, 
  FileText, 
  UserCheck, 
  Heart, 
  LogOut,
  BookOpen,
  MessageSquare,
  Activity,
  Image,
  FolderCheck,
  BellRing,
  Shield,
  Utensils
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ECCD_TOTAL_ITEMS } from '@/data/eccdChecklist';

interface SidebarProps {
  currentRole: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function Sidebar({ currentRole, activeTab, onTabChange }: SidebarProps) {
  const router = useRouter();

  // Role-specific nav items definition
  const getNavItems = () => {
    switch (currentRole) {
      case 'official':
        return [
          { id: 'overview', label: 'Executive Dashboard', icon: LayoutDashboard },
          { id: 'reports', label: 'DSWD Form 1 PDF', icon: FileText },
          { id: 'consecutive_absences', label: 'Absence Telemetry Alerts', icon: BellRing },
          { id: 'feeding_program', label: 'Feeding Program Tracker', icon: Utensils },
          { id: 'announcements', label: 'Daycare Notices', icon: Megaphone },
        ];
      case 'barangay_admin':
        return [
          { id: 'users', label: 'User Provisioning', icon: UserCheck },
          { id: 'audit_logs', label: 'System Security Audit', icon: ShieldCheck },
          { id: 'security', label: 'Data Privacy RLS Audit', icon: Shield },
          { id: 'announcements', label: 'System Notices', icon: Megaphone },
        ];
      case 'parent':
        return [
          { id: 'child', label: 'My Child Portal', icon: Heart },
          { id: 'eccd_checklist', label: `${ECCD_TOTAL_ITEMS}-Item ECCD Checklist`, icon: BookOpen },
          { id: 'parent_notes', label: 'Teacher Messages & Notes', icon: MessageSquare },
          { id: 'health_tracker', label: 'Nutritional & Growth Tracker', icon: Activity },
          { id: 'gallery', label: 'Classroom Moments', icon: Image },
          { id: 'documents', label: 'Documents & Requirements', icon: FolderCheck },
          { id: 'announcements', label: 'Daycare Notices', icon: Megaphone },
        ];
      case 'worker':
      default:
        return [
          { id: 'dashboard', label: 'Daily Register', icon: CalendarCheck },
          { id: 'pupils', label: 'Enrolled Pupils', icon: Users },
          { id: 'progress', label: `${ECCD_TOTAL_ITEMS}-Item ECCD Tool`, icon: TrendingUp },
          { id: 'parent_notes_inbox', label: 'Parent Notes Inbox', icon: MessageSquare },
          { id: 'health_entry', label: 'Nutritional Growth Log', icon: Activity },
          { id: 'announcements', label: 'Daycare Notices', icon: Megaphone },
        ];
    }
  };

  const navItems = getNavItems();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to sign out of your session?')) {
      try {
        localStorage.removeItem('bacong_auth_role');
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch {}
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <aside className="hidden lg:flex w-64 shrink-0 bg-white border-r border-[#E6E4DF] h-[calc(100vh-65px)] sticky top-[65px] flex-col justify-between p-4 shadow-sm z-30" suppressHydrationWarning>
      
      {/* Navigation Links */}
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] font-extrabold text-[#9B9B9B] uppercase tracking-wider flex items-center justify-between">
          <span>{currentRole.replace('_', ' ')} Rail</span>
          <span className="w-2 h-2 rounded-full bg-[#2F8F8A] animate-pulse"></span>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-3 transition-all duration-200 cursor-pointer border-none text-left ${
                isActive
                  ? 'bg-[#EBF5F4] text-[#2F8F8A] shadow-sm translate-x-1'
                  : 'text-[#6B6B6B] hover:bg-[#FAF8F5] hover:text-[#2B2B2B] hover:translate-x-1'
              }`}
              suppressHydrationWarning
            >
              <Icon size={18} className={isActive ? 'text-[#2F8F8A]' : 'text-[#9B9B9B]'} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Footer Sign Out Button */}
      <div className="pt-4 border-t border-[#E6E4DF]">
        <button
          onClick={handleLogout}
          className="w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold text-[#D32F2F] bg-[#FFEBEE] hover:bg-[#FFCDD2] transition-all flex items-center gap-3 border-none cursor-pointer"
          suppressHydrationWarning
        >
          <LogOut size={18} />
          <span>Sign Out Session</span>
        </button>
      </div>

    </aside>
  );
}
