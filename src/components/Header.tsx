'use client';

import React, { useState, useEffect } from 'react';
import { Search, Bell, School, LogOut, Menu } from 'lucide-react';
import NotificationDrawer from '@/components/NotificationDrawer';
import type { Notification } from '@/services/notificationService';
import { createClient } from '@/lib/supabase/client';
import { clearStoredData } from '@/data/mockData';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  currentRole: string;
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
    const loadNotifications = async () => {
      try {
        const { fetchNotifications: fetchNotifs } = await import('@/services/notificationService');
        const data = await fetchNotifs();
        if (!cancelled) setNotifications(data);
      } catch {
        // Fallback silent — show empty drawer
      }
    };
    loadNotifications();
    const interval = setInterval(loadNotifications, 45000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      const { markAllRead: markAll } = await import('@/services/notificationService');
      await markAll();
    } catch {
      // Best-effort; the local state already reflects the read state.
    }
  };



  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'official':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'barangay_admin':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'parent':
        return 'bg-danger-light text-danger border-danger-border';
      case 'worker':
      default:
        return 'bg-primary-light text-primary border-primary-display/30';
    }
  };

  return (
    <header className="header-bar bg-white/90 backdrop-blur-md border-b border-line px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-sm relative">
      <div className="flex items-center gap-3.5">
        {onOpenMobileNav && (
          <button
            onClick={onOpenMobileNav}
            className="lg:hidden p-2 rounded-xl text-ink hover:bg-canvas transition-all border-none bg-transparent cursor-pointer"
            aria-label="Open Mobile Navigation"
          >
            <Menu size={22} />
          </button>
        )}
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-display to-primary-hover flex items-center justify-center color-white shadow-md text-white shrink-0">
          <School size={22} />
        </div>
        <div>
          <h2 className="text-sm sm:text-lg font-bold text-ink leading-tight m-0 truncate max-w-[180px] sm:max-w-none">
            Barangay Bacong Daycare Center
          </h2>
          <span className="text-[10px] sm:text-xs text-ink-muted font-medium hidden sm:block" suppressHydrationWarning>
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
            aria-label="Search pupils or records"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-full border border-line bg-canvas text-xs focus:outline-none focus:border-primary-display"
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
          className="relative cursor-pointer p-2 rounded-xl bg-canvas hover:bg-line-strong transition-all border border-line"
          title="Notifications"
        >
          <Bell size={18} className="text-ink-muted" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-accent-coral-strong text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
              {unreadCount}
            </span>
          )}
        </div>

        {/* Logout Button */}
        <button
          onClick={async () => {
            // Signing out is immediate and unconfirmed on purpose. These are
            // shared barangay terminals: the cached roster is cleared on the
            // way out, so anything that discourages signing out leaves a
            // child's record on the screen for whoever sits down next.
            try {
              clearStoredData();
              const supabase = createClient();
              await supabase.auth.signOut();
            } catch {}
            router.push('/login');
            router.refresh();
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
