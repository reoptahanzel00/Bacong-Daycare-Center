'use client';

import React, { useState, useEffect } from 'react';
import { Search, Bell, School, LogOut, Menu } from 'lucide-react';
import NotificationDrawer from '@/components/NotificationDrawer';
import type { Notification } from '@/services/notificationService';
import type { UserRole } from '@/contexts/DaycareContext';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  currentRole: string;
  onRoleChange: (role: UserRole) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  notificationsCount?: number;
  onOpenMobileNav?: () => void;
}

export default function Header({
  currentRole,
  searchQuery,
  onSearchChange,
  onOpenMobileNav
}: HeaderProps) {
  const router = useRouter();
  const currentDateStr = new Date().toLocaleDateString('en-PH', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { fetchNotifications: fetchNotifs } = await import('@/services/notificationService');
        const data = await fetchNotifs();
        if (!cancelled) setNotifications(data);
      } catch {
        // Fallback silent — show empty drawer
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };



  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'official':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'barangay_admin':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'parent':
        return 'bg-[#FFEBEE] text-[#D96B4D] border-[#FFCDD2]';
      case 'worker':
      default:
        return 'bg-[#EBF5F4] text-[#2F8F8A] border-[#2F8F8A]/30';
    }
  };

  return (
    <header className="header-bar bg-white/90 backdrop-blur-md border-b border-[#E6E4DF] px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-sm relative">
      <div className="flex items-center gap-3.5">
        {onOpenMobileNav && (
          <button
            onClick={onOpenMobileNav}
            className="lg:hidden p-2 rounded-xl text-[#2B2B2B] hover:bg-[#FAF8F5] transition-all border-none bg-transparent cursor-pointer"
            aria-label="Open Mobile Navigation"
          >
            <Menu size={22} />
          </button>
        )}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2F8F8A] to-[#1D605D] flex items-center justify-center color-white shadow-md text-white shrink-0">
          <School size={22} />
        </div>
        <div>
          <h2 className="text-sm sm:text-lg font-bold text-[#2B2B2B] leading-tight m-0 truncate max-w-[180px] sm:max-w-none">
            Barangay Bacong Daycare Center
          </h2>
          <span className="text-[10px] sm:text-xs text-[#6B6B6B] font-medium hidden sm:block" suppressHydrationWarning>
            Student Progress & Enrollment Tracker • {currentDateStr}
          </span>
        </div>
      </div>

      {currentRole !== 'parent' && (
        <div className="relative w-48 sm:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search pupils or records..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-full border border-[#E6E4DF] bg-[#FAF8F5] text-xs focus:outline-none focus:border-[#2F8F8A]"
            suppressHydrationWarning
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        
        {/* Role Badge */}
        <div className={`hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold ${getRoleBadgeStyle(currentRole)}`}>
          <span className="w-2 h-2 rounded-full bg-current" />
          <span className="capitalize">{currentRole.replace('_', ' ')} Portal</span>
        </div>

        {/* Notification Bell */}
        <div
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className="relative cursor-pointer p-2 rounded-xl bg-[#FAF8F5] hover:bg-[#EAE6DF] transition-all border border-[#E6E4DF]"
          title="Notifications"
        >
          <Bell size={18} className="text-[#6B6B6B]" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-[#F2896B] text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
              {unreadCount}
            </span>
          )}
        </div>

        {/* Logout Button */}
        <button
          onClick={async () => {
            if (confirm('Are you sure you want to log out of your session?')) {
              try {
                localStorage.removeItem('bacong_auth_role');
                const supabase = createClient();
                await supabase.auth.signOut();
              } catch {}
              router.push('/login');
              router.refresh();
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold transition-all cursor-pointer shadow-xs"
          title="Sign Out of Account"
        >
          <LogOut size={15} />
          <span className="hidden sm:inline">Logout</span>
        </button>

      </div>

      <NotificationDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        notifications={notifications}
        onMarkAllAsRead={handleMarkAllAsRead}
      />
    </header>
  );
}
