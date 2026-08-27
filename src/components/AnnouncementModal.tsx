'use client';

import React, { useState } from 'react';
import { X, Megaphone, Send, AlertCircle } from 'lucide-react';
import type { MockAnnouncement } from '@/contexts/DaycareContext';

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MockAnnouncement) => void;
}

export default function AnnouncementModal({ isOpen, onClose, onSave }: AnnouncementModalProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) {
      setError('Please fill in both the notice title and broadcast content.');
      return;
    }

    const payload = {
      id: `ANN-${Date.now().toString().slice(-4)}`,
      title,
      content,
      date,
      author: 'Teacher Teresa Cruz'
    };

    onSave(payload);
    setTitle('');
    setContent('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn" suppressHydrationWarning>
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E6E4DF] w-full max-w-lg p-6 space-y-5 animate-scaleUp">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6E4DF] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#FEF8EC] text-[#8A5D00] flex items-center justify-center font-bold shrink-0">
              <Megaphone size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#2B2B2B] m-0">Publish Daycare Notice</h3>
              <p className="text-xs text-[#6B6B6B] m-0">
                Broadcast official daycare updates to parent portal
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

        {error && (
          <div className="bg-[#FFEBEE] border border-[#FFCDD2] text-[#C62828] p-3 rounded-2xl text-xs flex items-center gap-2 font-semibold">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#4A4A4A]">Notice Title *</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]/30 focus:border-[#2F8F8A] bg-[#FAF8F5] focus:bg-white"
              placeholder="e.g. Nutrition Month Culminating Activity & Feeding Schedule"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              suppressHydrationWarning
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[#4A4A4A]">Publish Date</label>
            <input
              type="date"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]/30 focus:border-[#2F8F8A] bg-[#FAF8F5] focus:bg-white"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              suppressHydrationWarning
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[#4A4A4A]">Broadcast Message Body *</label>
            <textarea
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]/30 focus:border-[#2F8F8A] bg-[#FAF8F5] focus:bg-white resize-none"
              placeholder="Provide event details, schedule times, or parent guidelines..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              suppressHydrationWarning
            />
          </div>

          <div className="p-3 rounded-2xl bg-[#EBF5F4] border border-[#2F8F8A]/20 text-[11px] text-[#247571] font-semibold">
            📢 Notice will be immediately broadcasted to all linked parent portal accounts.
          </div>

          <div className="pt-4 border-t border-[#E6E4DF] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-[#6B6B6B] border border-[#E6E4DF] hover:bg-[#FAF8F5] transition-all cursor-pointer border-none bg-transparent"
              suppressHydrationWarning
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#247571] hover:bg-[#1D605D] transition-all flex items-center gap-2 shadow-md cursor-pointer border-none"
              suppressHydrationWarning
            >
              <Send size={16} />
              <span>Broadcast Notice</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
