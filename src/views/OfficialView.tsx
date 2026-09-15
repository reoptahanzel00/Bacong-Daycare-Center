'use client';

import React, { useEffect, useState } from 'react';
import {
  Users,
  CheckCircle2,
  BarChart3,
  PieChart,
  ClipboardCheck,
  BellRing,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { fetchDashboardSummary, type DashboardSummary } from '@/services/reportsService';

interface OfficialViewProps {
  activeTab?: string;
}

/**
 * Barangay Executive Dashboard.
 *
 * Follows the capstone paper: barangay officials "view summarized enrollment
 * and attendance reports" through "high-level graphical summaries and
 * enrollment metrics". Every figure here comes from /api/reports/summary,
 * which returns counts only — no child is named or identifiable on this page.
 * Individual records, DSWD Form 1 and absence follow-up stay with the Daycare
 * Worker.
 */
export default function OfficialView({ activeTab = 'overview' }: OfficialViewProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetchDashboardSummary();
      if (cancelled) return;
      setSummary(res.summary);
      setError(res.ok ? null : res.error ?? 'Summary unavailable.');
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-6" suppressHydrationWarning>

      {/* Executive Hero Banner */}
      <div className="card bg-gradient-to-br from-[#1E3A8A] via-primary-hover to-primary-display text-white p-6 rounded-3xl shadow-lg">
        <h1 className="text-xl md:text-2xl font-extrabold text-white m-0 tracking-tight">
          Barangay Executive Dashboard 🏛️
        </h1>
        <p className="text-xs md:text-sm text-white/90 mt-1.5 leading-relaxed max-w-2xl m-0">
          Summarized enrollment and attendance figures for the Barangay Bacong Daycare Center.
          Individual children&apos;s records are kept by the Daycare Worker.
        </p>
      </div>

      {!summary ? (
        <div className="card bg-white p-10 flex items-center justify-center gap-2 text-xs font-bold">
          {error ? (
            <span role="alert" className="flex items-center gap-2 text-danger">
              <AlertTriangle size={18} /> {error}
            </span>
          ) : (
            <span className="flex items-center gap-2 text-primary">
              <Loader2 size={18} className="animate-spin" /> Loading summary...
            </span>
          )}
        </div>
      ) : (
        <>
          {(activeTab === 'overview' || activeTab === 'dashboard') && <Overview summary={summary} />}
          {activeTab === 'consecutive_absences' && <Absences summary={summary} />}
        </>
      )}
    </div>
  );
}

function percent(part: number, whole: number): number {
  return whole ? Math.round((part / whole) * 100) : 0;
}

function Overview({ summary }: { summary: DashboardSummary }) {
  const { enrollment, attendance, eccd } = summary;
  const totalAttendance = attendance.present + attendance.late + attendance.absent;

  const bars: Array<{ label: string; count: number; className: string; barClass: string }> = [
    { label: 'Present', count: attendance.present, className: 'text-primary', barClass: 'bg-primary' },
    { label: 'Late', count: attendance.late, className: 'text-warn', barClass: 'bg-warn-fill' },
    { label: 'Absent', count: attendance.absent, className: 'text-danger', barClass: 'bg-accent-coral-strong' },
  ];

  return (
    <>
      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric icon={<Users size={22} />} tone="bg-primary-light text-primary" value={String(enrollment.enrolled)}
          label={`Enrolled (${enrollment.pending} pending, ${enrollment.archived} archived)`} />
        <Metric icon={<CheckCircle2 size={22} />} tone="bg-[#EBF8FF] text-[#2B6CB0]"
          value={attendance.rate === null ? '—' : `${attendance.rate}%`}
          label={`Attendance rate${attendance.schoolYear ? ` • ${attendance.schoolYear}` : ''}`} />
        <Metric icon={<PieChart size={22} />} tone="bg-warn-light text-warn"
          value={`${enrollment.male} M / ${enrollment.female} F`} label="Enrolled by sex" />
        <Metric icon={<ClipboardCheck size={22} />} tone="bg-danger-light text-danger"
          value={`${eccd.round1} / ${eccd.round2} / ${eccd.round3}`} label="Children assessed (ECCD 1st / 2nd / 3rd)" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sex ratio */}
        <div className="card bg-white p-5">
          <div className="flex items-center gap-2 mb-4 text-primary">
            <PieChart size={20} />
            <h3 className="text-sm font-bold text-ink m-0">Enrolled Pupils by Sex</h3>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Male', count: enrollment.male, color: '#3B82F6' },
              { label: 'Female', count: enrollment.female, color: '#EC4899' },
            ].map((row) => (
              <div key={row.label}>
                <div className="flex justify-between text-xs font-bold text-ink-soft mb-1.5">
                  <span>{row.label} ({row.count})</span>
                  <span>{percent(row.count, enrollment.enrolled)}%</span>
                </div>
                <div className="w-full h-3 bg-line-strong rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${percent(row.count, enrollment.enrolled)}%`, backgroundColor: row.color }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Attendance ratio */}
        <div className="card bg-white p-5">
          <div className="flex items-center gap-2 mb-4 text-primary">
            <BarChart3 size={20} />
            <h3 className="text-sm font-bold text-ink m-0">
              Attendance Status{attendance.schoolYear ? ` — ${attendance.schoolYear}` : ''}
            </h3>
          </div>
          <div className="space-y-3.5 text-xs">
            {bars.map((b) => (
              <div key={b.label} className="flex items-center gap-3">
                <span className={`w-16 font-bold ${b.className}`}>{b.label}</span>
                <div className="flex-1 h-3 bg-line-strong rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${b.barClass}`}
                    style={{ width: `${percent(b.count, totalAttendance)}%` }}></div>
                </div>
                <span className="font-extrabold text-ink w-10 text-right">{b.count}</span>
              </div>
            ))}
            <p className="text-[11px] text-ink-subtle m-0 pt-1">
              Today ({attendance.today.date}): {attendance.today.present} present, {attendance.today.late} late,{' '}
              {attendance.today.absent} absent.
            </p>
          </div>
        </div>
      </div>

      {/* Enrollment summary by age */}
      <div className="card bg-white p-5">
        <div className="mb-4">
          <h3 className="text-base font-bold text-ink m-0">Enrollment Summary</h3>
          <span className="text-xs text-ink-muted">Enrolled children by age (counts only)</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {enrollment.ageBrackets.map((b) => (
            <div key={b.label} className="p-4 rounded-3xl border border-line bg-canvas">
              <div className="text-2xl font-extrabold text-primary">{b.count}</div>
              <div className="text-xs text-ink-muted mt-1">{b.label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Absences({ summary }: { summary: DashboardSummary }) {
  const { absences } = summary;
  return (
    <div className="card bg-white p-5 space-y-4">
      <div className="flex items-center gap-2 text-danger">
        <BellRing size={18} />
        <span className="text-xs font-bold uppercase tracking-wider">Frequent Absences</span>
      </div>
      <div className="p-5 rounded-3xl border border-danger-border bg-danger-light flex items-center gap-4">
        <div className="text-3xl font-extrabold text-danger">{absences.frequent}</div>
        <p className="text-xs text-ink-soft m-0 leading-relaxed">
          enrolled {absences.frequent === 1 ? 'child has' : 'children have'} {absences.threshold} or more
          consecutive absences. Their parents are notified automatically, and follow-up is handled
          by the Daycare Worker.
        </p>
      </div>
    </div>
  );
}

function Metric({ icon, tone, value, label }: { icon: React.ReactNode; tone: string; value: string; label: string }) {
  return (
    <div className="card flex items-center gap-3.5 p-4 bg-white border border-line">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${tone}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xl font-extrabold text-ink leading-none">{value}</div>
        <div className="text-xs text-ink-muted mt-1">{label}</div>
      </div>
    </div>
  );
}
