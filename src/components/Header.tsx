'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UserCheck, Shield, GraduationCap, Heart, Search, Bell, School, Lock, Unlock, Menu } from 'lucide-react';
import NotificationDrawer from '@/components/NotificationDrawer';
import type { Notification } from '@/services/notificationService';
import type { UserRole } from '@/contexts/DaycareContext';

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
  onRoleChange,
  searchQuery,
  onSearchChange,
  onOpenMobileNav
}: HeaderProps) {
  const [currentDateStr, setCurrentDateStr] = useState('Today');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDemoUnlocked, setIsDemoUnlocked] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setIsLoadingNotifications(true);
    try {
      const { fetchNotifications: fetchNotifs } = await import('@/services/notificationService');
      const data = await fetchNotifs();
      setNotifications(data);
    } catch {
      // Fallback silent — show empty drawer
    } finally {
      setIsLoadingNotifications(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    setCurrentDateStr(
      new Date().toLocaleDateString('en-PH', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    );
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const roles = [
    { id: 'worker', label: 'Daycare Worker', icon: GraduationCap, color: '#2F8F8A' },
    { id: 'official', label: 'Barangay Official', icon: Shield, color: '#F5B942' },
    { id: 'barangay_admin', label: 'Barangay Admin', icon: UserCheck, color: '#6366F1' },
    { id: 'parent', label: 'Parent / Guardian', icon: Heart, color: '#F2896B' },
  ];

  const handleRolePillClick = (roleId: string) => {
    if (!isDemoUnlocked && roleId !== currentRole) {
      alert(`Role switching is currently LOCKED to your authenticated session (${currentRole.toUpperCase()}). Unlock Capstone Demo Mode to switch roles during evaluation.`);
      return;
    }
    onRoleChange(roleId as UserRole);
  };

  return (
    <header className="header-bar bg-white border-b border-[#E6E4DF] px-4 sm:px-8 py-3.5 flex items-center justify-between sticky top-0 z-40 shadow-sm relative">
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
        <div className="relative w-64">
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

      <div className="flex items-center gap-4">
        
        {/* Capstone Demo Mode Lock/Unlock Toggle */}
        <button
          onClick={() => setIsDemoUnlocked(!isDemoUnlocked)}
          className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
            isDemoUnlocked
              ? 'bg-[#FEF8EC] text-[#8A5D00] border-[#F5DAA0]'
              : 'bg-[#EBF5F4] text-[#2F8F8A] border-[#2F8F8A]/30'
          }`}
          title={isDemoUnlocked ? 'Demo Mode Active: Click to Lock Role Switching' : 'Strict RBAC Active: Click to Unlock Demo Switcher'}
          suppressHydrationWarning
        >
          {isDemoUnlocked ? <Unlock size={14} /> : <Lock size={14} />}
          <span>{isDemoUnlocked ? 'Demo Unlocked' : 'RBAC Locked'}</span>
        </button>

        {/* Role Switcher Rail */}
        <div className="role-bar bg-[#EAE6DF] p-1.5 rounded-full inline-flex gap-1 items-center">
          {roles.map((r) => {
            const Icon = r.icon;
            const isActive = currentRole === r.id;
            const isDisabled = !isDemoUnlocked && !isActive;

            return (
              <button
                key={r.id}
                onClick={() => handleRolePillClick(r.id)}
                className={`role-pill px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-white text-[#2F8F8A] shadow-sm'
                    : isDisabled
                    ? 'opacity-40 cursor-not-allowed text-[#9B9B9B]'
                    : 'text-[#6B6B6B] hover:text-[#2B2B2B]'
                }`}
                disabled={isDisabled}
                suppressHydrationWarning
              >
                <Icon size={14} color={isActive ? r.color : 'inherit'} />
                <span>{r.label}</span>
              </button>
            );
          })}
        </div>

        {/* Notification Bell */}
        <div
          onClick={() => setIsDrawerOpen(!isDrawerOpen)}
          className="relative cursor-pointer p-2.5 rounded-full bg-[#F5F3EF] hover:bg-[#EAE6DF] transition-all"
          title="Parent & System Notifications"
        >
          <Bell size={18} className="text-[#6B6B6B]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-[#F2896B] text-white text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white">
              {unreadCount}
            </span>
          )}
        </div>

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
