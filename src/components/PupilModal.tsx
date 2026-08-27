'use client';

import React, { useState } from 'react';
import { X, UserPlus, Save, AlertCircle } from 'lucide-react';
import type { MockPupil } from '@/contexts/DaycareContext';

interface PupilModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: MockPupil) => void;
  pupilToEdit?: MockPupil | null;
}

function buildInitialForm(pupil?: MockPupil | null) {
  return {
    firstName: pupil?.firstName || '',
    lastName: pupil?.lastName || '',
    birthDate: pupil?.birthDate || '2021-05-10',
    sex: pupil?.sex || 'Male',
    address: pupil?.address || 'Purok 1, Barangay Bacong',
    enrollmentStatus: pupil?.enrollmentStatus || 'enrolled',
    guardianName: pupil?.guardian?.fullName || '',
    relationship: pupil?.guardian?.relationship || 'Mother',
    guardianPhone: pupil?.guardian?.phone || '0917-123-4567'
  };
}

export default function PupilModal({ isOpen, onClose, onSave, pupilToEdit }: PupilModalProps) {
  // The parent remounts this modal via `key` whenever pupilToEdit / isOpen
  // changes, so the form state is always fresh without a sync effect.
  const [formData, setFormData] = useState(() => buildInitialForm(pupilToEdit));
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.guardianName.trim()) {
      setError('Please fill in all required fields (Pupil First/Last Name and Guardian Name).');
      return;
    }

    const payload = {
      id: pupilToEdit ? pupilToEdit.id : `PUP-2026-00${Math.floor(Math.random() * 90) + 10}`,
      firstName: formData.firstName,
      lastName: formData.lastName,
      birthDate: formData.birthDate,
      sex: formData.sex,
      address: formData.address,
      enrollmentStatus: formData.enrollmentStatus,
      enrollmentDate: pupilToEdit ? pupilToEdit.enrollmentDate : new Date().toISOString().split('T')[0],
      avatar: pupilToEdit ? pupilToEdit.avatar : 'https://images.unsplash.com/photo-1543332164-6e82f355badc?auto=format&fit=crop&w=200&q=80',
      guardian: {
        fullName: formData.guardianName,
        relationship: formData.relationship,
        phone: formData.guardianPhone,
        isPrimary: true
      },
      consecutiveAbsences: pupilToEdit ? pupilToEdit.consecutiveAbsences : 0
    };

    onSave(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn" suppressHydrationWarning>
      <div className="bg-white rounded-3xl shadow-2xl border border-line w-full max-w-lg p-6 space-y-5 animate-scaleUp">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary-light text-primary flex items-center justify-center font-bold shrink-0">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-ink m-0">
                {pupilToEdit ? 'Edit Pupil Profile' : 'Enroll New Daycare Pupil'}
              </h3>
              <p className="text-xs text-ink-muted m-0">
                Barangay Bacong Daycare Official Record Entry
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="srccomponentspupilmodal-first-name-1" className="text-xs font-bold text-ink-soft">First Name *</label>
              <input id="srccomponentspupilmodal-first-name-1"
                type="text"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
                placeholder="e.g. Mateo"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                suppressHydrationWarning
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="srccomponentspupilmodal-last-name-2" className="text-xs font-bold text-ink-soft">Last Name *</label>
              <input id="srccomponentspupilmodal-last-name-2"
                type="text"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
                placeholder="e.g. Santos"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                suppressHydrationWarning
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label htmlFor="srccomponentspupilmodal-date-of-birth-3" className="text-xs font-bold text-ink-soft">Date of Birth</label>
              <input id="srccomponentspupilmodal-date-of-birth-3"
                type="date"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                suppressHydrationWarning
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="srccomponentspupilmodal-sex-4" className="text-xs font-bold text-ink-soft">Sex</label>
              <select id="srccomponentspupilmodal-sex-4"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
                value={formData.sex}
                onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                suppressHydrationWarning
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="srccomponentspupilmodal-status-5" className="text-xs font-bold text-ink-soft">Status</label>
              <select id="srccomponentspupilmodal-status-5"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
                value={formData.enrollmentStatus}
                onChange={(e) => setFormData({ ...formData, enrollmentStatus: e.target.value })}
                suppressHydrationWarning
              >
                <option value="enrolled">Enrolled</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="srccomponentspupilmodal-barangay-address-6" className="text-xs font-bold text-ink-soft">Barangay Address</label>
            <input id="srccomponentspupilmodal-barangay-address-6"
              type="text"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              suppressHydrationWarning
            />
          </div>

          <div className="pt-2 border-t border-line space-y-3">
            <h4 className="text-xs font-extrabold text-primary uppercase tracking-wider m-0">Guardian Details</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label htmlFor="srccomponentspupilmodal-guardian-full-name-7" className="text-xs font-bold text-ink-soft">Guardian Full Name *</label>
                <input id="srccomponentspupilmodal-guardian-full-name-7"
                  type="text"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
                  placeholder="e.g. Maria Santos"
                  value={formData.guardianName}
                  onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                  suppressHydrationWarning
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="srccomponentspupilmodal-relationship-8" className="text-xs font-bold text-ink-soft">Relationship</label>
                <select id="srccomponentspupilmodal-relationship-8"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  suppressHydrationWarning
                >
                  <option value="Mother">Mother</option>
                  <option value="Father">Father</option>
                  <option value="Grandmother">Grandmother</option>
                  <option value="Grandfather">Grandfather</option>
                  <option value="Legal Guardian">Legal Guardian</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="srccomponentspupilmodal-guardian-contact-phone-9" className="text-xs font-bold text-ink-soft">Guardian Contact Phone</label>
              <input id="srccomponentspupilmodal-guardian-contact-phone-9"
                type="text"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary-display/30 focus:border-primary-display bg-canvas focus:bg-white"
                placeholder="e.g. 0917-123-4567"
                value={formData.guardianPhone}
                onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                suppressHydrationWarning
              />
            </div>
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
              <span>{pupilToEdit ? 'Save Changes' : 'Save Enrollment'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
