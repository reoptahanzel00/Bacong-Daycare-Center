'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface ToastProps {
  toast: { message: string; type?: string } | null;
  onClose: () => void;
}

export default function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  const isDanger = toast.type === 'danger';

  return (
    <div
      // Success is polite, failure interrupts: a worker who is told the
      // register did not save needs to hear it before they walk away from the
      // screen. Without a live region the toast was drawn and never announced,
      // and it is the only way this app reports a failed save.
      role={isDanger ? 'alert' : 'status'}
      aria-live={isDanger ? 'assertive' : 'polite'}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.85rem 1.25rem',
        background: 'white',
        borderRadius: '9999px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
        border: `1px solid ${isSuccess ? 'var(--success)' : isDanger ? 'var(--danger)' : 'var(--primary)'}`,
      }}
    >
      {isSuccess && <CheckCircle2 size={20} color="var(--success)" />}
      {isDanger && <AlertCircle size={20} color="var(--danger)" />}
      {!isSuccess && !isDanger && <Info size={20} color="var(--primary)" />}
      
      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)' }}>
        {toast.message}
      </span>

      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        style={{ marginLeft: '0.5rem', color: 'var(--text-light)', cursor: 'pointer' }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
