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
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E6E4DF] w-full max-w-md p-6 space-y-5 animate-scaleUp">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6E4DF] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FFEBEE] text-[#D32F2F] flex items-center justify-center font-bold shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#2B2B2B] m-0">Confirm Soft-Archive</h3>
              <p className="text-xs text-[#6B6B6B] m-0">
                Pupil Record Soft-Deletion Confirmation
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#9B9B9B] hover:bg-[#FAF8F5] hover:text-[#2B2B2B] border-none bg-transparent cursor-pointer transition-all"
            suppressHydrationWarning
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-3">
          <p className="text-xs text-[#4A4A4A] leading-relaxed m-0">
            Are you sure you want to soft-archive the record for <strong className="text-[#2B2B2B]">{pupilName}</strong>?
          </p>
          <div className="p-3 rounded-2xl bg-[#FEF8EC] border border-[#F5DAA0] text-[11px] text-[#8A5D00] font-semibold">
            ⚠️ Archiving changes enrollment status to "archived". Record remains audit-traceable in system logs.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-[#E6E4DF] flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-full text-xs font-bold text-[#6B6B6B] border border-[#E6E4DF] hover:bg-[#FAF8F5] transition-all cursor-pointer border-none bg-transparent"
            suppressHydrationWarning
          >
            Cancel
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#D32F2F] hover:bg-[#B71C1C] transition-all flex items-center gap-2 shadow-md cursor-pointer border-none"
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
