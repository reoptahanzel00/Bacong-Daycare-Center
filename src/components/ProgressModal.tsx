'use client';

import React, { useState } from 'react';
import { X, TrendingUp, Save, AlertCircle } from 'lucide-react';
import type { MockPupil, MockProgress } from '@/contexts/DaycareContext';

interface ProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MockProgress) => void;
  pupils: MockPupil[];
}

export default function ProgressModal({ isOpen, onClose, onSave, pupils }: ProgressModalProps) {
  const [selectedPupilId, setSelectedPupilId] = useState(pupils[0]?.id || 'PUP-2026-001');
  const [domain, setDomain] = useState('Motor Skills');
  const [rating, setRating] = useState('Developing');
  const [notes, setNotes] = useState('');
  const [evalDate, setEvalDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      setError('Please provide milestone observation notes.');
      return;
    }

    const payload = {
      id: `PRG-${Date.now().toString().slice(-4)}`,
      pupil_id: selectedPupilId,
      domain,
      rating,
      notes,
      date: evalDate
    };

    onSave(payload);
    setNotes('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn" suppressHydrationWarning>
      <div className="bg-white rounded-3xl shadow-2xl border border-line w-full max-w-lg p-6 space-y-5 animate-scaleUp">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-danger-light text-danger flex items-center justify-center font-bold shrink-0">
              <TrendingUp size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-ink m-0">Record 4-Domain Milestone</h3>
              <p className="text-xs text-ink-muted m-0">
                Early Childhood Development (ECCD) Observation Log
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
            <label htmlFor="srccomponentsprogressmodal-select-enrolled-pupil-1" className="text-xs font-bold text-ink-soft">Select Enrolled Pupil *</label>
            <select id="srccomponentsprogressmodal-select-enrolled-pupil-1"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
              value={selectedPupilId}
              onChange={(e) => setSelectedPupilId(e.target.value)}
              suppressHydrationWarning
            >
              {pupils.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName} ({p.id})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="srccomponentsprogressmodal-eccd-domain-2" className="text-xs font-bold text-ink-soft">ECCD Domain *</label>
              <select id="srccomponentsprogressmodal-eccd-domain-2"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                suppressHydrationWarning
              >
                <option value="Motor Skills">Gross & Fine Motor Skills</option>
                <option value="Language & Communication">Language & Communication</option>
                <option value="Socio-Emotional">Socio-Emotional Development</option>
                <option value="Self-Help & Cognitive">Self-Help & Cognitive</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="srccomponentsprogressmodal-observation-rating-3" className="text-xs font-bold text-ink-soft">Observation Rating *</label>
              <select id="srccomponentsprogressmodal-observation-rating-3"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                suppressHydrationWarning
              >
                <option value="Demonstrates Mastery">Demonstrates Mastery</option>
                <option value="Developing">Developing / Progressing</option>
                <option value="Needs Practice">Needs Practice / Assistance</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="srccomponentsprogressmodal-evaluation-date-4" className="text-xs font-bold text-ink-soft">Evaluation Date</label>
            <input id="srccomponentsprogressmodal-evaluation-date-4"
              type="date"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
              value={evalDate}
              onChange={(e) => setEvalDate(e.target.value)}
              suppressHydrationWarning
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="srccomponentsprogressmodal-observation-notes-behavioral-checklist-5" className="text-xs font-bold text-ink-soft">Observation Notes & Behavioral Checklist *</label>
            <textarea id="srccomponentsprogressmodal-observation-notes-behavioral-checklist-5"
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white resize-none"
              placeholder="e.g. Pupil demonstrates confidence during group drawing and story circle..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              suppressHydrationWarning
            />
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
              <Save size={16} />
              <span>Record Milestone</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
