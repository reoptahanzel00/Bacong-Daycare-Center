'use client';

import React from 'react';
import { Bell, X, AlertTriangle, Megaphone, CheckCircle2, PhoneCall, Sparkles } from 'lucide-react';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  channel: string;
  severity: string;
  read: boolean;
  timestamp: string;
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllAsRead: () => void;
}

export default function NotificationDrawer({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
}: NotificationDrawerProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute right-8 top-16 w-96 bg-white rounded-3xl border border-line shadow-2xl z-50 overflow-hidden text-left" suppressHydrationWarning>
      
      {/* Drawer Header */}
      <div className="p-4 border-b border-line bg-canvas flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-primary" />
          <h3 className="text-sm font-bold text-ink m-0">Parent & System Notifications</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onMarkAllAsRead}
            className="text-[11px] font-bold text-primary hover:underline cursor-pointer border-none bg-transparent"
            suppressHydrationWarning
          >
            Mark all as read
          </button>
          <button onClick={onClose} className="text-ink-subtle hover:text-ink p-1 border-none bg-transparent cursor-pointer">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Notification Stream */}
      <div className="max-h-96 overflow-y-auto p-3 space-y-2.5">
        {notifications.length > 0 ? (
          notifications.map((n) => {
            const isAbsence = n.type === 'consecutive_absences';
            const isNotice = n.type === 'announcement';

            return (
              <div
                key={n.id}
                className={`p-3 rounded-2xl border text-xs transition-all ${
                  isAbsence
                    ? 'bg-danger-light border-danger-border'
                    : isNotice
                    ? 'bg-warn-light border-warn-border'
                    : 'bg-canvas border-line'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-xl bg-white shadow-sm flex-shrink-0">
                    {isAbsence && <AlertTriangle size={16} className="text-danger" />}
                    {isNotice && <Megaphone size={16} className="text-warn" />}
                    {!isAbsence && !isNotice && <Sparkles size={16} className="text-primary" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-ink truncate">{n.title}</span>
                      <span className="text-[10px] text-ink-subtle">{n.timestamp}</span>
                    </div>

                    <p className="text-ink-soft leading-relaxed m-0 text-[11px]">{n.message}</p>

                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-black/5 text-[10px]">
                      <span className="font-semibold text-ink-muted flex items-center gap-1">
                        <PhoneCall size={10} />
                        {n.channel}
                      </span>
                      {isAbsence && (
                        <span className="px-2 py-0.5 rounded-full bg-danger text-white font-bold">
                          Action Required
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-6 text-center text-xs text-ink-subtle">
            <CheckCircle2 size={24} className="mx-auto mb-2 text-primary" />
            No unread notifications
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
