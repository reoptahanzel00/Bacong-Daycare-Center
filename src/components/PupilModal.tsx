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
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E6E4DF] w-full max-w-lg p-6 space-y-5 animate-scaleUp">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6E4DF] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EBF5F4] text-[#2F8F8A] flex items-center justify-center font-bold shrink-0">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#2B2B2B] m-0">
                {pupilToEdit ? 'Edit Pupil Profile' : 'Enroll New Daycare Pupil'}
              </h3>
              <p className="text-xs text-[#6B6B6B] m-0">
                Barangay Bacong Daycare Official Record Entry
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

        {error && (
          <div className="bg-[#FFEBEE] border border-[#FFCDD2] text-[#D32F2F] p-3 rounded-2xl text-xs flex items-center gap-2 font-semibold">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#4A4A4A]">First Name *</label>
              <input
                type="text"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]/30 focus:border-[#2F8F8A] bg-[#FAF8F5] focus:bg-white"
                placeholder="e.g. Mateo"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                suppressHydrationWarning
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#4A4A4A]">Last Name *</label>
              <input
                type="text"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]/30 focus:border-[#2F8F8A] bg-[#FAF8F5] focus:bg-white"
                placeholder="e.g. Santos"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                suppressHydrationWarning
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#4A4A4A]">Date of Birth</label>
              <input
                type="date"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]/30 focus:border-[#2F8F8A] bg-[#FAF8F5] focus:bg-white"
                value={formData.birthDate}
                onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                suppressHydrationWarning
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#4A4A4A]">Sex</label>
              <select
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]/30 focus:border-[#2F8F8A] bg-[#FAF8F5] focus:bg-white"
                value={formData.sex}
                onChange={(e) => setFormData({ ...formData, sex: e.target.value })}
                suppressHydrationWarning
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#4A4A4A]">Status</label>
              <select
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]/30 focus:border-[#2F8F8A] bg-[#FAF8F5] focus:bg-white"
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
            <label className="text-xs font-bold text-[#4A4A4A]">Barangay Address</label>
            <input
              type="text"
              className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]/30 focus:border-[#2F8F8A] bg-[#FAF8F5] focus:bg-white"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              suppressHydrationWarning
            />
          </div>

          <div className="pt-2 border-t border-[#E6E4DF] space-y-3">
            <h4 className="text-xs font-extrabold text-[#2F8F8A] uppercase tracking-wider m-0">Guardian Details</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-[#4A4A4A]">Guardian Full Name *</label>
                <input
                  type="text"
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]/30 focus:border-[#2F8F8A] bg-[#FAF8F5] focus:bg-white"
                  placeholder="e.g. Maria Santos"
                  value={formData.guardianName}
                  onChange={(e) => setFormData({ ...formData, guardianName: e.target.value })}
                  suppressHydrationWarning
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-[#4A4A4A]">Relationship</label>
                <select
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]/30 focus:border-[#2F8F8A] bg-[#FAF8F5] focus:bg-white"
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  suppressHydrationWarning
                >
                  <option value="Mother">Mother</option>
                  <option value="Father">Father</option>
                  <option value="Grandparent">Grandparent</option>
                  <option value="Guardian">Legal Guardian</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-[#4A4A4A]">Guardian Contact Phone</label>
              <input
                type="text"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#2F8F8A]/30 focus:border-[#2F8F8A] bg-[#FAF8F5] focus:bg-white"
                placeholder="e.g. 0917-123-4567"
                value={formData.guardianPhone}
                onChange={(e) => setFormData({ ...formData, guardianPhone: e.target.value })}
                suppressHydrationWarning
              />
            </div>
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
              className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-[#2F8F8A] hover:bg-[#1D605D] transition-all flex items-center gap-2 shadow-md cursor-pointer border-none"
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
