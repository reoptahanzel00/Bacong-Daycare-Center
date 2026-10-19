'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Bell, BellRing, School, LogOut, Menu, KeyRound } from 'lucide-react';
import NotificationDrawer from '@/components/NotificationDrawer';
import ChangePasswordModal from '@/components/ChangePasswordModal';
import {
  fetchNotifications,
  markAllRead,
  markRead,
  notificationTab,
  type Notification,
} from '@/services/notificationService';
import { createClient } from '@/lib/supabase/client';
import { clearStoredData } from '@/data/mockData';
import { useRouter } from 'next/navigation';
import { CENTER_TIMEZONE } from '@/lib/dates';

interface HeaderProps {
  currentRole: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenMobileNav?: () => void;
  /** Switches to a tab; used when a notification is opened. */
  onNavigate?: (tab: string) => void;
  /** Announces notifications that arrived since the last refresh. */
  onNewNotification?: (message: string) => void;
}

export default function Header({
  currentRole,
  searchQuery,
  onSearchChange,
  onOpenMobileNav,
  onNavigate,
  onNewNotification,
}: HeaderProps) {
  const router = useRouter();
  // The centre's date, not the reader's. Rendered on the server too, where the
  // runtime is UTC, so without the fixed zone the header announced yesterday
  // for the eight hours after midnight in Manila.
  const currentDateStr = new Date().toLocaleDateString('en-PH', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: CENTER_TIMEZONE,
  });
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [notificationsLoaded, setNotificationsLoaded] = useState(false);
  const [notificationsFailed, setNotificationsFailed] = useState(false);
  // Ids already seen, so a refresh can tell which unread entries are new. Null
  // until the first load: everything in the feed at sign-in is old news.
  const seenIds = useRef<Set<string> | null>(null);
  const bellArea = useRef<HTMLDivElement>(null);
  // Held in a ref so the polling effect does not restart on every render.
  const announceRef = useRef(onNewNotification);
  useEffect(() => {
    announceRef.current = onNewNotification;
  }, [onNewNotification]);

  const loadNotifications = useCallback(async () => {
    const data = await fetchNotifications();
    if (data === null) {
      setNotificationsFailed(true);
      setNotificationsLoaded(true);
      return;
    }
    if (seenIds.current) {
      const fresh = data.filter(n => !n.read && !seenIds.current!.has(n.id));
      if (fresh.length === 1) announceRef.current?.(`New notification: ${fresh[0].title}`);
      else if (fresh.length > 1) announceRef.current?.(`${fresh.length} new notifications`);
    }
    seenIds.current = new Set(data.map(n => n.id));
    setNotifications(data);
    setNotificationsFailed(false);
    setNotificationsLoaded(true);
  }, []);

  // Refresh on a timer while the tab is in view, and at once when the reader
  // comes back to it. The old fixed 45-second poll kept running in background
  // tabs and still left a returning worker looking at a stale bell.
  useEffect(() => {
    // The state is set after the fetch resolves, not synchronously in the
    // effect body; the rule cannot see past the await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadNotifications();
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') loadNotifications();
    }, 30000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadNotifications();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [loadNotifications]);

  // Close the drawer on Escape or a click anywhere outside the bell and drawer.
  useEffect(() => {
    if (!isDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDrawerOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (bellArea.current && !bellArea.current.contains(e.target as Node)) setIsDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [isDrawerOpen]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const toggleDrawer = () => {
    if (!isDrawerOpen) loadNotifications();
    setIsDrawerOpen(!isDrawerOpen);
  };

  const handleMarkAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    // Best-effort; the local state already reflects the read state.
    await markAllRead();
  };

  // Opening an entry marks it read and goes to the page it is about.
  const handleOpenNotification = (n: Notification) => {
    if (!n.read) {
      setNotifications(prev => prev.map(x => (x.id === n.id ? { ...x, read: true } : x)));
      void markRead(n.id);
    }
    const tab = notificationTab(n, currentRole);
    if (tab && onNavigate) {
      onNavigate(tab);
      setIsDrawerOpen(false);
    }
  };



  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
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
        {/* A button, not a div: the bell was unreachable by keyboard and
            announced as nothing, so notifications - including absence alerts -
            could only be opened with a mouse. */}
        {/* Bell and drawer share one wrapper so a click inside either does not
            count as "outside" and close the drawer. Unpositioned on purpose:
            the drawer still anchors to the header. */}
        <div ref={bellArea}>
          <button
            type="button"
            onClick={toggleDrawer}
            aria-haspopup="dialog"
            aria-expanded={isDrawerOpen}
            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            className="relative cursor-pointer p-2 rounded-xl bg-canvas hover:bg-line-strong transition-all border border-line"
            title="Notifications"
          >
            {unreadCount > 0
              ? <BellRing size={18} className="text-accent-coral-strong" />
              : <Bell size={18} className="text-ink-muted" />}
            {unreadCount > 0 && (
              <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 bg-accent-coral-strong text-white text-[10px] font-bold min-w-4 h-4 px-1 rounded-full flex items-center justify-center border border-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <NotificationDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            notifications={notifications}
            loaded={notificationsLoaded}
            loadFailed={notificationsFailed}
            onMarkAllAsRead={handleMarkAllAsRead}
            onOpenNotification={handleOpenNotification}
            canOpen={(n) => onNavigate !== undefined && notificationTab(n, currentRole) !== null}
          />
        </div>

        {/* Change Password */}
        <button
          type="button"
          onClick={() => setIsChangePasswordOpen(true)}
          aria-haspopup="dialog"
          aria-label="Change password"
          title="Change password"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-canvas hover:bg-line-strong text-ink-soft border border-line text-xs font-bold transition-all cursor-pointer"
        >
          <KeyRound size={15} />
          <span className="hidden md:inline">Change password</span>
        </button>

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

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </header>
  );
}
