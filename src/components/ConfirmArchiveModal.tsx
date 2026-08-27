'use client';

import React from 'react';
import { X, AlertTriangle, Archive } from 'lucide-react';

interface ConfirmArchiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pupilName: string;
}

export default function ConfirmArchiveModal({
  isOpen,
  onClose,
  onConfirm,
  pupilName
}: ConfirmArchiveModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn" suppressHydrationWarning>
      <div className="bg-white rounded-3xl shadow-2xl border border-line w-full max-w-md p-6 space-y-5 animate-scaleUp">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-danger-light text-danger flex items-center justify-center font-bold shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-ink m-0">Confirm Soft-Archive</h3>
              <p className="text-xs text-ink-muted m-0">
                Pupil Record Soft-Deletion Confirmation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-ink-subtle hover:bg-canvas hover:text-ink border-none bg-transparent cursor-pointer transition-all"
            suppressHydrationWarning
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-ink-soft leading-relaxed m-0">
            Are you sure you want to soft-archive the record for <strong className="text-ink">{pupilName}</strong>?
          </p>
          <div className="p-3 rounded-2xl bg-warn-light border border-warn-border text-[11px] text-warn font-semibold">
            ⚠️ Archiving changes enrollment status to &quot;archived&quot;. Record remains audit-traceable in system logs.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-line flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-full text-xs font-bold text-ink-muted border border-line hover:bg-canvas transition-all cursor-pointer border-none bg-transparent"
            suppressHydrationWarning
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-danger hover:bg-[#B71C1C] transition-all flex items-center gap-2 shadow-md cursor-pointer border-none"
            suppressHydrationWarning
          >
            <Archive size={16} />
            <span>Soft-Archive Record</span>
          </button>
        </div>

      </div>
    </div>
  );
}
