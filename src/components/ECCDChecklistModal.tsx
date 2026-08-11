'use client';

import React, { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Award, Save } from 'lucide-react';
import { ECCD_DOMAINS, ECCDRating, EvaluationType } from '@/data/eccdChecklist';
import type { MockPupil } from '@/contexts/DaycareContext';

interface ECCDChecklistModalProps {
  isOpen: boolean;
  onClose: () => void;
  pupil: MockPupil | null;
  onSaveEvaluation: (pupilId: string, evalType: EvaluationType, ratings: Record<string, ECCDRating>) => void;
}

export default function ECCDChecklistModal({
  isOpen,
  onClose,
  pupil,
  onSaveEvaluation
}: ECCDChecklistModalProps) {
  const [evalType, setEvalType] = useState<EvaluationType>('baseline');
  const [activeDomainIndex, setActiveDomainIndex] = useState(0);
  const [ratings, setRatings] = useState<Record<string, ECCDRating>>({});
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen || !pupil) return null;

  const currentDomain = ECCD_DOMAINS[activeDomainIndex];
  const totalItems = ECCD_DOMAINS.reduce((acc, d) => acc + d.items.length, 0);
  const ratedCount = Object.keys(ratings).filter(k => ratings[k] !== null).length;
  const progressPercent = Math.round((ratedCount / totalItems) * 100);

  const handleRatingChange = (itemId: string, rating: ECCDRating) => {
    setRatings(prev => ({ ...prev, [itemId]: prev[itemId] === rating ? null : rating }));
  };

  const handleQuickMarkDomain = (rating: ECCDRating) => {
    const updated = { ...ratings };
    currentDomain.items.forEach(item => {
      updated[item.id] = rating;
    });
    setRatings(updated);
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      onSaveEvaluation(pupil.id, evalType, ratings);
      setIsSaving(false);
      onClose();
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4" suppressHydrationWarning>
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-scaleUp">
        
        {/* Modal Header */}
        <div className="bg-[#FAF8F5] border-b border-[#E6E4DF] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#2F8F8A] text-white flex items-center justify-center shadow-md">
              <Award size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-[#2B2B2B] m-0">ECCD Milestone Evaluation</h3>
                <span className="bg-[#2F8F8A]/10 text-[#2F8F8A] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                  DepEd / DSWD Form 1
                </span>
              </div>
              <p className="text-xs text-[#6B6B6B] m-0">
                Pupil: <strong className="text-[#2B2B2B]">{pupil.firstName} {pupil.lastName}</strong> ({pupil.id})
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 text-[#9B9B9B] hover:text-[#2B2B2B] rounded-full hover:bg-white border-none bg-transparent cursor-pointer">
            <X size={20} />
          </button>
        </div>

        {/* Evaluation Type Switcher & Overall Progress */}
        <div className="px-6 py-3 bg-white border-b border-[#E6E4DF] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-[#FAF8F5] p-1 rounded-2xl border border-[#E6E4DF]">
            <button
              onClick={() => setEvalType('baseline')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border-none cursor-pointer ${
                evalType === 'baseline' ? 'bg-[#2F8F8A] text-white shadow-sm' : 'text-[#6B6B6B] hover:bg-white'
              }`}
            >
              1st Evaluation (Baseline)
            </button>
            <button
              onClick={() => setEvalType('summative')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all border-none cursor-pointer ${
                evalType === 'summative' ? 'bg-[#2F8F8A] text-white shadow-sm' : 'text-[#6B6B6B] hover:bg-white'
              }`}
            >
              2nd Evaluation (Summative)
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[10px] font-bold text-[#9B9B9B] uppercase">Checked Items</div>
              <div className="text-xs font-extrabold text-[#2F8F8A]">{ratedCount} / {totalItems} ({progressPercent}%)</div>
            </div>
            <div className="w-24 h-2.5 bg-[#E6E4DF] rounded-full overflow-hidden">
              <div className="h-full bg-[#2F8F8A] transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>
        </div>

        {/* Domain Tabs Navigation */}
        <div className="flex items-center gap-1.5 px-6 pt-3 bg-white overflow-x-auto border-b border-[#E6E4DF]">
          {ECCD_DOMAINS.map((domain, idx) => {
            const domainRated = domain.items.filter(i => ratings[i.id]).length;
            const isActive = activeDomainIndex === idx;

            return (
              <button
                key={domain.id}
                onClick={() => setActiveDomainIndex(idx)}
                className={`px-3 py-2 rounded-t-2xl text-xs font-bold transition-all border-b-2 whitespace-nowrap cursor-pointer border-t-0 border-x-0 ${
                  isActive
                    ? 'border-[#2F8F8A] text-[#2F8F8A] bg-[#FAF8F5]'
                    : 'border-transparent text-[#6B6B6B] hover:bg-gray-50'
                }`}
              >
                <span>{domain.shortLabel}</span>
                <span className={`ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] ${
                  domainRated === domain.items.length ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {domainRated}/{domain.items.length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Items List Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: currentDomain.color }} />
              <h4 className="text-sm font-bold text-[#2B2B2B] m-0">{currentDomain.label}</h4>
              <span className="text-xs text-[#9B9B9B]">({currentDomain.items.length} items)</span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-[#9B9B9B] font-medium">Quick Mark Domain:</span>
              <button onClick={() => handleQuickMarkDomain('P')} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg font-bold border border-emerald-200 hover:bg-emerald-100 cursor-pointer">
                All Passed (P)
              </button>
              <button onClick={() => handleQuickMarkDomain('O')} className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-lg font-bold border border-amber-200 hover:bg-amber-100 cursor-pointer">
                All On Track (O)
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {currentDomain.items.map((item) => {
              const currentRating = ratings[item.id];

              return (
                <div key={item.id} className="p-3.5 rounded-2xl bg-[#FAF8F5] border border-[#E6E4DF] flex items-center justify-between gap-4 hover:border-[#2F8F8A]/40 transition-all">
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-bold text-[#2F8F8A] bg-white border border-[#E6E4DF] px-2 py-0.5 rounded-lg shrink-0">
                      #{item.number}
                    </span>
                    <p className="text-xs font-medium text-[#2B2B2B] m-0 leading-relaxed">
                      {item.description}
                    </p>
                  </div>

                  {/* Rating P/O/R Pill Selector */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleRatingChange(item.id, 'P')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                        currentRating === 'P'
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                          : 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50'
                      }`}
                    >
                      P
                    </button>
                    <button
                      onClick={() => handleRatingChange(item.id, 'O')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                        currentRating === 'O'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50'
                      }`}
                    >
                      O
                    </button>
                    <button
                      onClick={() => handleRatingChange(item.id, 'R')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all cursor-pointer ${
                        currentRating === 'R'
                          ? 'bg-rose-500 text-white border-rose-500 shadow-sm'
                          : 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50'
                      }`}
                    >
                      R
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer Controls */}
        <div className="bg-[#FAF8F5] border-t border-[#E6E4DF] px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              disabled={activeDomainIndex === 0}
              onClick={() => setActiveDomainIndex(prev => prev - 1)}
              className="px-4 py-2 rounded-2xl bg-white border border-[#E6E4DF] text-xs font-bold text-[#2B2B2B] hover:bg-gray-50 disabled:opacity-40 cursor-pointer flex items-center gap-1"
            >
              <ChevronLeft size={16} /> Previous Domain
            </button>
            <button
              disabled={activeDomainIndex === ECCD_DOMAINS.length - 1}
              onClick={() => setActiveDomainIndex(prev => prev + 1)}
              className="px-4 py-2 rounded-2xl bg-white border border-[#E6E4DF] text-xs font-bold text-[#2B2B2B] hover:bg-gray-50 disabled:opacity-40 cursor-pointer flex items-center gap-1"
            >
              Next Domain <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-5 py-2.5 rounded-2xl bg-white border border-[#E6E4DF] text-xs font-bold text-[#6B6B6B] hover:bg-gray-50 cursor-pointer">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-6 py-2.5 rounded-2xl bg-[#2F8F8A] text-white text-xs font-bold shadow-md hover:bg-[#1D605D] transition-all cursor-pointer flex items-center gap-2"
            >
              <Save size={16} />
              {isSaving ? 'Saving Evaluation...' : 'Save Milestone Evaluation'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
