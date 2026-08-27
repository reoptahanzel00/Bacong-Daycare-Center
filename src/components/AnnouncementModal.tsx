'use client';

import { useDaycare } from '@/contexts/DaycareContext';
import React, { useState } from 'react';
import { X, Megaphone, Send, AlertCircle } from 'lucide-react';
import type { MockAnnouncement } from '@/contexts/DaycareContext';

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MockAnnouncement) => void;
}

export default function AnnouncementModal({ isOpen, onClose, onSave }: AnnouncementModalProps) {
  // The server resolves the author from the verified session when it stores the
  // notice; the optimistic local copy uses the same person rather than a name
  // baked into the component.
  const { currentUserName } = useDaycare();
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
      author: currentUserName || 'Daycare Worker'
    };

    onSave(payload);
    setTitle('');
    setContent('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn" suppressHydrationWarning>
      <div className="bg-white rounded-3xl shadow-2xl border border-line w-full max-w-lg p-6 space-y-5 animate-scaleUp">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-warn-light text-warn flex items-center justify-center font-bold shrink-0">
              <Megaphone size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-ink m-0">Publish Daycare Notice</h3>
              <p className="text-xs text-ink-muted m-0">
                Broadcast official daycare updates to parent portal
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

        {error && (
          <div className="bg-danger-light border border-danger-border text-danger p-3 rounded-2xl text-xs flex items-center gap-2 font-semibold">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="space-y-1">
            <label htmlFor="srccomponentsannouncementmodal-notice-title-1" className="text-xs font-bold text-ink-soft">Notice Title *</label>
            <input id="srccomponentsannouncementmodal-notice-title-1"
              type="text"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
              placeholder="e.g. Nutrition Month Culminating Activity & Feeding Schedule"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              suppressHydrationWarning
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="srccomponentsannouncementmodal-publish-date-2" className="text-xs font-bold text-ink-soft">Publish Date</label>
            <input id="srccomponentsannouncementmodal-publish-date-2"
              type="date"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              suppressHydrationWarning
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="srccomponentsannouncementmodal-broadcast-message-body-3" className="text-xs font-bold text-ink-soft">Broadcast Message Body *</label>
            <textarea id="srccomponentsannouncementmodal-broadcast-message-body-3"
              rows={4}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white resize-none"
              placeholder="Provide event details, schedule times, or parent guidelines..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              suppressHydrationWarning
            />
          </div>

          <div className="p-3 rounded-2xl bg-primary-light border border-primary-display/20 text-[11px] text-primary font-semibold">
            📢 Notice will be immediately broadcasted to all linked parent portal accounts.
          </div>

          <div className="pt-4 border-t border-line flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full text-xs font-bold text-ink-muted border border-line hover:bg-canvas transition-all cursor-pointer border-none bg-transparent"
              suppressHydrationWarning
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-primary hover:bg-primary-hover transition-all flex items-center gap-2 shadow-md cursor-pointer border-none"
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
