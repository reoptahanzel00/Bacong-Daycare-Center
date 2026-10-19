'use client';

import React from 'react';
import { formatLocalTimestamp } from '@/lib/dates';
import { BellRing, X, CalendarX, CheckCircle2, AlertCircle, Info, Star, Mail, Monitor, ChevronRight, FileText, ClipboardList } from 'lucide-react';
import type { Notification as NotificationItem } from '@/services/notificationService';

/**
 * Icon and tint per kind of notification, so an approval, a returned
 * enrollment and an absence alert are told apart at a glance instead of all
 * sharing one generic icon.
 */
function notificationLook(n: NotificationItem) {
  const title = n.title.toUpperCase();
  if (n.type === 'consecutive_absences') {
    return { Icon: CalendarX, iconClass: 'text-danger', boxClass: 'bg-danger-light border-danger-border' };
  }
  if (n.type === 'enrollment' && title.includes('APPROVED')) {
    return { Icon: CheckCircle2, iconClass: 'text-[#2E7D32]', boxClass: 'bg-[#F4FBF4] border-[#A5D6A7]' };
  }
  if (title.includes('EXCUSE')) {
    return { Icon: FileText, iconClass: 'text-warn', boxClass: 'bg-warn-light border-warn-border' };
  }
  if (title.startsWith('NEW ENROLLMENT') || title.includes('RESUBMITTED')) {
    return { Icon: ClipboardList, iconClass: 'text-primary', boxClass: 'bg-primary-light border-primary-display/30' };
  }
  if (n.type === 'enrollment' || n.severity === 'medium') {
    return { Icon: AlertCircle, iconClass: 'text-warn', boxClass: 'bg-warn-light border-warn-border' };
  }
  if (n.type === 'milestone') {
    return { Icon: Star, iconClass: 'text-accent-yellow', boxClass: 'bg-canvas border-line' };
  }
  return { Icon: Info, iconClass: 'text-primary', boxClass: 'bg-canvas border-line' };
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  /** False until the first load finishes, so "No notifications" is not shown prematurely. */
  loaded: boolean;
  /** The last refresh failed; what is listed may be out of date. */
  loadFailed: boolean;
  onMarkAllAsRead: () => void;
  onOpenNotification: (n: NotificationItem) => void;
  /** Whether opening this entry leads somewhere (otherwise it only marks it read). */
  canOpen: (n: NotificationItem) => boolean;
}

export default function NotificationDrawer({
  isOpen,
  onClose,
  notifications,
  loaded,
  loadFailed,
  onMarkAllAsRead,
  onOpenNotification,
  canOpen,
}: NotificationDrawerProps) {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      role="dialog"
      aria-label="Notifications"
      className="absolute right-2 sm:right-8 top-16 w-[calc(100vw-1rem)] sm:w-96 bg-white rounded-3xl border border-line shadow-2xl z-50 overflow-hidden text-left"
      suppressHydrationWarning
    >

      {/* Drawer Header */}
      <div className="p-4 border-b border-line bg-canvas flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BellRing size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-ink m-0">Notifications</h3>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-accent-coral-strong text-white text-[10px] font-bold">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onMarkAllAsRead}
            disabled={unreadCount === 0}
            className="text-[11px] font-bold text-primary hover:underline cursor-pointer border-none bg-transparent disabled:text-ink-subtle disabled:no-underline disabled:cursor-default"
            suppressHydrationWarning
          >
            Mark all as read
          </button>
          <button onClick={onClose} aria-label="Close" className="text-ink-subtle hover:text-ink p-1 border-none bg-transparent cursor-pointer">
            <X size={16} />
          </button>
        </div>
      </div>

      {loadFailed && (
        <div role="status" className="px-4 py-2 bg-warn-light border-b border-warn-border text-[11px] text-ink-soft">
          Could not refresh notifications. Showing the last ones loaded.
        </div>
      )}

      {/* Notification Stream */}
      <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto p-3 space-y-2.5">
        {notifications.length > 0 ? (
          notifications.map((n) => {
            const isAbsence = n.type === 'consecutive_absences';
            const { Icon, iconClass, boxClass } = notificationLook(n);
            const opens = canOpen(n);

            // The feed carried `read` all along and rendered every entry the
            // same, so a parent opening the drawer after an absence alert had
            // no way to tell the new alert from last month's, and "Mark all as
            // read" only ever cleared the badge on the bell.
            return (
              <button
                type="button"
                key={n.id}
                onClick={() => onOpenNotification(n)}
                className={`block w-full text-left p-3 rounded-2xl border text-xs transition-all cursor-pointer hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${boxClass} ${n.read ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-white shadow-sm flex-shrink-0">
                    <Icon size={16} className={iconClass} aria-hidden="true" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <span className={`min-w-0 break-words ${n.read ? 'font-semibold text-ink-soft' : 'font-bold text-ink'}`}>
                        {!n.read && (
                          <span
                            aria-hidden="true"
                            className="inline-block w-1.5 h-1.5 rounded-full bg-primary align-middle mr-1.5"
                          />
                        )}
                        {n.title}
                        {!n.read && <span className="sr-only"> (unread)</span>}
                      </span>
                      <span className="text-[10px] text-ink-subtle shrink-0">{formatLocalTimestamp(n.timestamp) || n.timestamp}</span>
                    </div>

                    <span className="block text-ink-soft leading-relaxed text-[11px]">{n.message}</span>

                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-black/5 text-[10px]">
                      <span className="font-semibold text-ink-muted flex items-center gap-1">
                        {n.channel === 'EMAIL' ? <Mail size={10} aria-hidden="true" /> : <Monitor size={10} aria-hidden="true" />}
                        {n.channel === 'EMAIL' ? 'Portal and email' : 'Portal'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        {isAbsence && (
                          <span className="px-2 py-0.5 rounded-full bg-danger text-white font-bold">
                            Action Required
                          </span>
                        )}
                        {opens && (
                          <span className="font-bold text-primary flex items-center">
                            Open <ChevronRight size={12} aria-hidden="true" />
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        ) : !loaded ? (
          <div className="p-6 text-center text-xs text-ink-subtle">Loading notifications…</div>
        ) : (
          <div className="p-6 text-center text-xs text-ink-subtle">
            <CheckCircle2 size={24} className="mx-auto mb-2 text-primary" />
            No notifications yet
            <p className="m-0 mt-1 text-[11px]">Updates about enrollments, excuse letters, absences and progress will appear here.</p>
          </div>
        )}
      </div>

      {/* Drawer Footer */}
      <div className="p-2.5 bg-canvas border-t border-line text-center text-[10px] text-ink-subtle">
        Data Privacy Act (RA 10173) Protected Communications
      </div>
    </div>
  );
}
