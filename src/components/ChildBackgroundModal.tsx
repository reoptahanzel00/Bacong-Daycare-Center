'use client';

import React, { useState } from 'react';
import { X, Save, BookOpen, AlertCircle } from 'lucide-react';
import type { ChildBackground } from '@/services/eccdService';

interface ChildBackgroundModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (fields: Partial<Omit<ChildBackground, 'pupil_id' | 'updated_by' | 'updated_at'>>) => void;
  initial?: ChildBackground | null;
  childName?: string;
}

const FIELDS: Array<{
  key: keyof Omit<ChildBackground, 'pupil_id' | 'updated_by' | 'updated_at'>;
  label: string;
  placeholder: string;
}> = [
  {
    key: 'child_background',
    label: "Child's background",
    placeholder: 'e.g. behavior / health / etc.',
  },
  {
    key: 'family_environment',
    label: 'Family environment',
    placeholder: 'e.g. health of family members / family problems / economic conditions / etc.',
  },
  {
    key: 'stimulating_activities',
    label: "Parents' stimulating activities for the child",
    placeholder: 'What are the activities/things that the parents do to help stimulate the child\'s development?',
  },
  {
    key: 'home_environment',
    label: 'Home environment',
    placeholder: 'e.g. facilities / type of house / household items / interaction / etc.',
  },
  {
    key: 'others',
    label: 'Others',
    placeholder: 'Additional notes, descriptions and observations...',
  },
];

export default function ChildBackgroundModal({
  isOpen,
  onClose,
  onSave,
  initial,
  childName,
}: ChildBackgroundModalProps) {
  const [formData, setFormData] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const f of FIELDS) out[f.key] = initial?.[f.key] || '';
    return out;
  });
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hasAny = FIELDS.some((f) => formData[f.key]?.trim());
    if (!hasAny) {
      setError('Please fill in at least one field — or close the form if there is nothing to share yet.');
      return;
    }
    const payload: Partial<Omit<ChildBackground, 'pupil_id' | 'updated_by' | 'updated_at'>> = {};
    for (const f of FIELDS) {
      const v = formData[f.key]?.trim();
      if (v) payload[f.key] = v;
    }
    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn" suppressHydrationWarning>
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E6E4DF] w-full max-w-xl p-6 space-y-5 animate-scaleUp">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6E4DF] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EBF5F4] text-[#247571] flex items-center justify-center font-bold shrink-0">
              <BookOpen size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#2B2B2B] m-0">
                Child & Family Background
              </h3>
              <p className="text-xs text-[#6B6B6B] m-0">
                ECCD Form Section 2{childName ? ` — ${childName}` : ''} • Official DepEd checklist record
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-[#707070] hover:bg-[#FAF8F5] hover:text-[#2B2B2B] border-none bg-transparent cursor-pointer transition-all"
            suppressHydrationWarning
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-[11px] text-[#6B6B6B] leading-relaxed m-0 bg-[#FEF8EC] border border-[#F5DAA0] rounded-2xl p-3">
          To the examiner: please fill out the spaces below for additional information.
          Write down your notes, descriptions and observations on the following points.
        </p>

        {error && (
          <div className="flex items-center gap-2 text-xs font-bold text-[#C62828] bg-[#FFEBEE] border border-[#FFCDD2] rounded-2xl px-3 py-2">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-xs font-bold text-[#2B2B2B] block">{field.label}</label>
              <textarea
                value={formData[field.key]}
                onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                placeholder={field.placeholder}
                rows={field.key === 'others' ? 2 : 3}
                maxLength={2000}
                className="w-full px-3 py-2.5 rounded-2xl border border-[#E6E4DF] bg-[#FAF8F5] text-sm text-[#2B2B2B] outline-none focus:border-[#2F8F8A] focus:ring-2 focus:ring-[#2F8F8A]/20 transition-all resize-y"
              />
            </div>
          ))}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E6E4DF]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-2xl text-xs font-bold text-[#6B6B6B] bg-[#FAF8F5] hover:bg-[#EAE6DF] border-none cursor-pointer transition-all"
              suppressHydrationWarning
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-2xl text-xs font-bold text-white bg-[#247571] hover:bg-[#1D605D] border-none cursor-pointer shadow-md transition-all flex items-center gap-1.5"
              suppressHydrationWarning
            >
              <Save size={14} />
              Save Background
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
