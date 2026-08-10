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
  LogOut 
} from 'lucide-react';
import { useRouter } from 'next/navigation';

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
          { id: 'announcements', label: 'Daycare Notices', icon: Megaphone },
        ];
      case 'barangay_admin':
        return [
          { id: 'users', label: 'User Provisioning', icon: UserCheck },
          { id: 'audit_logs', label: 'System Audit Logs', icon: ShieldCheck },
          { id: 'announcements', label: 'Daycare Notices', icon: Megaphone },
        ];
      case 'parent':
        return [
          { id: 'child', label: 'My Child Portal', icon: Heart },
          { id: 'announcements', label: 'Daycare Notices', icon: Megaphone },
        ];
      case 'worker':
      default:
        return [
          { id: 'dashboard', label: 'Daily Register', icon: CalendarCheck },
          { id: 'pupils', label: 'Enrolled Pupils', icon: Users },
          { id: 'progress', label: '4-Domain ECCD', icon: TrendingUp },
          { id: 'announcements', label: 'Daycare Notices', icon: Megaphone },
        ];
    }
  };

  const navItems = getNavItems();

  const handleLogout = () => {
    if (confirm('Are you sure you want to sign out of your session?')) {
      router.push('/login');
    }
  };

  return (
    <aside className="w-64 shrink-0 bg-white border-r border-[#E6E4DF] h-[calc(100vh-65px)] sticky top-[65px] flex flex-col justify-between p-4 shadow-sm z-30" suppressHydrationWarning>
      
      {/* Navigation Links */}
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] font-bold text-[#9B9B9B] uppercase tracking-wider">
          {currentRole.replace('_', ' ')} Navigation
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-3 transition-all cursor-pointer border-none text-left ${
                isActive
                  ? 'bg-[#EBF5F4] text-[#2F8F8A] shadow-sm'
                  : 'text-[#6B6B6B] hover:bg-[#FAF8F5] hover:text-[#2B2B2B]'
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
