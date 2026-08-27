'use client';

import React from 'react';
import { X } from 'lucide-react';
import Image from 'next/image';
import { DEFAULT_AVATAR } from '@/data/mockData';
import type { MockPupil, MockAttendance, MockProgress } from '@/contexts/DaycareContext';

interface PupilDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  pupil: MockPupil | null;
  attendanceRecords: MockAttendance[];
  progressRecords: MockProgress[];
  onOpenProgressModal?: () => void;
}

export default function PupilDetailModal({
  isOpen,
  onClose,
  pupil,
  attendanceRecords,
  progressRecords,
  onOpenProgressModal
}: PupilDetailModalProps) {
  if (!isOpen || !pupil) return null;

  const childAttendance = attendanceRecords.filter(a => a.pupil_id === pupil.id);
  const presentCount = childAttendance.filter(a => a.status === 'present').length;
  const lateCount = childAttendance.filter(a => a.status === 'late').length;
  const absentCount = childAttendance.filter(a => a.status === 'absent').length;
  const childProgress = progressRecords.filter(p => p.pupil_id === pupil.id);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fadeIn" suppressHydrationWarning>
      <div className="bg-white rounded-3xl shadow-2xl border border-line w-full max-w-2xl p-6 space-y-5 animate-scaleUp">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <Image src={pupil.avatar || DEFAULT_AVATAR} alt={pupil.firstName} width={48} height={48} className="w-12 h-12 rounded-2xl object-cover border border-line shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-ink m-0">{pupil.firstName} {pupil.lastName}</h3>
                <span className="badge badge-primary">{pupil.id}</span>
                <span className="badge badge-success">Enrolled</span>
              </div>
              <p className="text-xs text-ink-muted m-0 mt-0.5">
                Barangay Bacong Daycare Official Pupil Profile
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

        {/* Demographic & Guardian Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-3xl bg-canvas border border-line space-y-2 text-xs">
            <h4 className="font-extrabold text-primary uppercase tracking-wider text-[10px] m-0">Demographics</h4>
            <div><strong className="text-ink">Sex:</strong> {pupil.sex}</div>
            <div><strong className="text-ink">Date of Birth:</strong> {pupil.birthDate} (4 yrs old)</div>
            <div><strong className="text-ink">Barangay Address:</strong> {pupil.address}</div>
            <div><strong className="text-ink">Enrollment Date:</strong> {pupil.enrollmentDate}</div>
          </div>

          <div className="p-4 rounded-3xl bg-canvas border border-line space-y-2 text-xs">
            <h4 className="font-extrabold text-primary uppercase tracking-wider text-[10px] m-0">Guardian Contact</h4>
            <div><strong className="text-ink">Full Name:</strong> {pupil.guardian?.fullName}</div>
            <div><strong className="text-ink">Relationship:</strong> {pupil.guardian?.relationship}</div>
            <div><strong className="text-ink">Phone:</strong> {pupil.guardian?.phone}</div>
            <div><strong className="text-ink">Primary Guardian:</strong> Yes</div>
          </div>
        </div>

        {/* Attendance Stat Strip */}
        <div className="p-4 rounded-3xl bg-warn-light border border-warn-border flex items-center justify-between text-xs">
          <div>
            <span className="font-bold text-warn">Attendance Register Record</span>
            <div className="text-ink-muted text-[11px] mt-0.5">
              <strong className="text-primary">{presentCount} Present</strong> • {lateCount} Late • {absentCount} Absent
            </div>
          </div>
          <span className="badge badge-warning font-bold">Consecutive Absences: {pupil.consecutiveAbsences || 0}</span>
        </div>

        {/* 4-Domain ECCD Progress Timeline */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-ink uppercase tracking-wider m-0">4-Domain ECCD Progress Milestone Records</h4>
            {onOpenProgressModal && (
              <button
                onClick={() => { onClose(); onOpenProgressModal(); }}
                className="btn btn-secondary btn-sm text-[11px] py-1 px-2.5"
                suppressHydrationWarning
              >
                + Record Milestone
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {childProgress.length > 0 ? (
              childProgress.map((p) => (
                <div key={p.id} className="p-3 rounded-2xl border border-line bg-canvas space-y-1 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink">{p.domain}</span>
                      <span className="px-2 py-0.5 rounded-full font-bold bg-primary-light text-primary text-[10px]">{p.rating}</span>
                    </div>
                    <span className="text-[10px] text-ink-subtle">{p.date}</span>
                  </div>
                  <p className="text-ink-soft text-[11px] m-0">{p.notes}</p>
                </div>
              ))
            ) : (
              <div className="text-center text-xs text-ink-subtle p-4 bg-canvas rounded-2xl border border-line">
                No milestone evaluations recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-line flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-primary hover:bg-primary-hover transition-all border-none cursor-pointer shadow-md"
            suppressHydrationWarning
          >
            Close Profile
          </button>
        </div>

      </div>
    </div>
  );
}
