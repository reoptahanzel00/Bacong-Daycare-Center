'use client';

import React, { useEffect, useState } from 'react';
import {
  Heart, 
  TrendingUp, 
  AlertTriangle, 
  PhoneCall, 
  Download, 
  BookOpen,
  MessageSquare,
  Activity,
  Image as ImageIcon,
  FolderCheck,
  Send,
  Clock,
  CheckCircle,
} from 'lucide-react';
import Image from 'next/image';
import { DEFAULT_AVATAR } from '@/data/mockData';
import { ECCD_DOMAINS } from '@/data/eccdChecklist';
import { fetchEccdRatings } from '@/services/eccdService';
import { submitParentNote } from '@/services/parentNotesService';
import { useDaycare, type MockPupil, type MockAttendance, type MockProgress, type MockAnnouncement } from '@/contexts/DaycareContext';

interface ParentViewProps {
  pupils: MockPupil[];
  attendance: MockAttendance[];
  progress: MockProgress[];
  announcements: MockAnnouncement[];
  activeTab?: string;
  onOpenDSWDReportModal?: () => void;
}

export default function ParentView({ 
  pupils, 
  attendance, 
  progress, 
  announcements, 
  activeTab = 'child',
  onOpenDSWDReportModal 
}: ParentViewProps) {
  const { showToast, logAuditAction } = useDaycare();

  // Multi-child selection state
  const [selectedChildId, setSelectedChildId] = useState<string>(pupils[0]?.id || 'PUP-2026-001');
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Record<string, boolean>>({});

  // 109-Item ECCD Checklist Viewer State
  const [selectedDomainId, setSelectedDomainId] = useState<string>('gross_motor');
  const [childRatings, setChildRatings] = useState<Record<string, 'P' | 'O' | 'R'>>({});

  // Direct Teacher Message / Absence Note Form State
  const [absenceReason, setAbsenceReason] = useState<string>('Illness / Medical');
  const [absenceDate, setAbsenceDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [guardianNotes, setGuardianNotes] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('0917-888-9900');
  interface ParentSubmittedNote {
    id: string;
    date: string;
    reason: string;
    notes: string;
    phone: string;
    status: string;
    teacherReply?: string;
    submittedAt: string;
  }

  const [submittedNotes, setSubmittedNotes] = useState<ParentSubmittedNote[]>([
    {
      id: 'NOTE-101',
      date: '2026-02-09',
      reason: 'Doctor Visit / Checkup',
      notes: 'Maria had her routine 4-year-old pediatric checkup and immunization update at Barangay Bacong Health Center.',
      phone: '0917-888-9900',
      status: 'Excused & Acknowledged',
      teacherReply: 'Thank you for updating us! Record has been marked as excused absence.',
      submittedAt: 'Feb 9, 2026 07:45 AM',
    }
  ]);

  // Active Linked Child Record
  const child = pupils.find(p => p.id === selectedChildId) || pupils[0];

  const childAttendance = attendance.filter(a => a.pupil_id === child?.id);

  // Load the child's real ECCD checklist ratings from the evaluation tool.
  useEffect(() => {
    if (!child?.id) return;
    let cancelled = false;
    (async () => {
      const res = await fetchEccdRatings();
      if (cancelled || !res.ok) return;
      const mapped: Record<string, 'P' | 'O' | 'R'> = {};
      for (const row of res.ratings) {
        if (row.pupil_id !== child.id) continue;
        if (row.status_rating === 'Present') mapped[row.milestone_code] = 'P';
        else if (row.status_rating === 'In_Progress') mapped[row.milestone_code] = 'O';
        else if (row.status_rating === 'Not_Yet_Observed') mapped[row.milestone_code] = 'R';
      }
      setChildRatings(mapped);
    })();
    return () => { cancelled = true; };
  }, [child?.id]);

  const presentCount = childAttendance.filter(a => a.status === 'present').length;
  const lateCount = childAttendance.filter(a => a.status === 'late').length;
  const absentCount = childAttendance.filter(a => a.status === 'absent').length;
  const totalAtt = childAttendance.length;

  const rate = totalAtt ? Math.round(((presentCount + lateCount) / totalAtt) * 100) : 100;
  const childProgress = progress.filter(p => p.pupil_id === child?.id);

  const handleAcknowledgeAlert = (alertId: string) => {
    setAcknowledgedAlerts(prev => ({ ...prev, [alertId]: true }));
    showToast('Absence alert acknowledgment registered for Teacher Teresa Cruz.', 'info');
    logAuditAction('Acknowledged Attendance Advisory', child?.id || 'PUP-001', 'Parent acknowledged automated absence alert.');
  };

  const handleSendAbsenceNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guardianNotes.trim()) {
      alert('Please enter a brief note explaining the absence or special request.');
      return;
    }
    if (!child?.id) return;

    const newNote = {
      id: `NOTE-${Date.now().toString().slice(-4)}`,
      date: absenceDate,
      reason: absenceReason,
      notes: guardianNotes,
      phone: contactPhone,
      status: 'Pending Teacher Review',
      submittedAt: new Date().toLocaleString('sv').replace('T', ' '),
    };

    setSubmittedNotes(prev => [newNote, ...prev]);
    setGuardianNotes('');

    // Persist to the real parent-notes inbox (best-effort).
    const res = await submitParentNote({
      pupil_id: child.id,
      date: absenceDate,
      reason: absenceReason,
      notes: guardianNotes,
      phone: contactPhone,
    });
    if (res.success) {
      showToast(`Absence note for ${absenceDate} sent to Teacher Teresa!`, 'success');
    } else {
      showToast(`Note saved locally — could not reach the daycare server.`, 'warning');
    }
    logAuditAction('Submitted Absence Note', child?.id || 'PUP-001', `Reason: ${absenceReason} for date ${absenceDate}`);
  };

  const getRatingProgressPercent = (rating?: string) => {
    switch (rating) {
      case 'Demonstrates Mastery':
      case 'Mastered':
      case 'P':
        return 100;
      case 'Developing':
      case 'O':
        return 75;
      case 'Needs Practice':
      case 'R':
        return 45;
      default:
        return 60;
    }
  };

  // 109-Item ECCD Checklist active domain
  const activeDomain = ECCD_DOMAINS.find(d => d.id === selectedDomainId) || ECCD_DOMAINS[0];
  const domainRatedItems = activeDomain.items.filter(i => childRatings[i.id]);
  const domainMasteredItems = domainRatedItems.filter(i => childRatings[i.id] === 'P');
  const domainMasteryPct = domainRatedItems.length > 0
    ? Math.round((domainMasteredItems.length / domainRatedItems.length) * 100)
    : null;

  // Classroom photo gallery items
  const galleryPhotos = [
    {
      id: 1,
      title: 'Art & Fine Motor Station',
      date: 'Feb 10, 2026',
      tag: 'Fine Motor Domain',
      src: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=600&q=80',
      caption: 'Children practicing color recognition, paper folding, and crayon palmar grip during station activity.'
    },
    {
      id: 2,
      title: 'Nutritional Snack & Manners',
      date: 'Feb 09, 2026',
      tag: 'Self-Help Domain',
      src: 'https://images.unsplash.com/photo-1577896851231-70ef18881754?auto=format&fit=crop&w=600&q=80',
      caption: 'Morning healthy snack session focusing on handwashing, utensil holding, and table etiquette.'
    },
    {
      id: 3,
      title: 'Storytelling & Receptive Language',
      date: 'Feb 06, 2026',
      tag: 'Language Domain',
      src: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=600&q=80',
      caption: 'Interactive storytelling circle with Teacher Teresa reading Tagalog early literacy picture books.'
    },
    {
      id: 4,
      title: 'Outdoor Movement & Balance Games',
      date: 'Feb 04, 2026',
      tag: 'Gross Motor Domain',
      src: 'https://images.unsplash.com/photo-1472162072942-cd5147eb3902?auto=format&fit=crop&w=600&q=80',
      caption: 'Barangay daycare playground games practicing hopping, walking backward, and balance beams.'
    }
  ];

  return (
    <div className="space-y-6 pb-12" suppressHydrationWarning>
      
      {/* Top Linked Child Selection Rail */}
      <div className="bg-white p-4 rounded-3xl border border-[#E6E4DF] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#FFEBEE] text-[#F2896B] flex items-center justify-center font-bold shrink-0">
            <Heart size={20} />
          </div>
          <div>
            <div className="text-[10px] font-bold text-[#9B9B9B] uppercase tracking-wider">
              Data Privacy Act (RA 10173) Linked Children
            </div>
            <h3 className="text-sm font-extrabold text-[#2B2B2B] m-0">Family Portal Child Switcher</h3>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          {pupils.slice(0, 3).map((p) => {
            const isSelected = p.id === selectedChildId;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedChildId(p.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#F2896B] text-white border-[#F2896B] shadow-sm'
                    : 'bg-[#FAF8F5] text-[#2B2B2B] border-[#E6E4DF] hover:border-[#F2896B]'
                }`}
              >
                <Image src={p.avatar || DEFAULT_AVATAR} alt={p.firstName} width={24} height={24} className="w-6 h-6 rounded-full object-cover shrink-0" />
                <span>{p.firstName} {p.lastName}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-[#EAE6DF] text-[#6B6B6B]'}`}>
                  {p.id}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: Main Child Profile View */}
      {activeTab === 'child' && (
        <>
          {/* Top Child Hero Card */}
          <div className="card bg-gradient-to-br from-[#F2896B] via-[#E87556] to-[#D96B4D] text-white p-6 rounded-3xl shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
              <div className="flex items-center gap-4">
                <Image
                  src={child?.avatar || 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=150&q=80'}
                  alt={child?.firstName || 'Child avatar'}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white/40 shadow-md shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Heart size={16} className="text-white" />
                    <span className="text-xs font-bold uppercase tracking-wider text-white/90">
                      Parent Portal • Active Linked Child
                    </span>
                  </div>
                  <h2 className="text-xl md:text-2xl font-extrabold text-white m-0 tracking-tight">
                    {child?.firstName} {child?.lastName}
                  </h2>
                  <p className="text-xs text-white/90 mt-1 m-0">
                    ID: <strong>{child?.id}</strong> • Sex: <strong>{child?.sex}</strong> • DOB: <strong>{child?.birthDate}</strong> (4 yrs old)
                  </p>
                  <p className="text-xs text-white/85 mt-0.5 m-0">
                    Assigned Daycare Class: <strong>Barangay Bacong Daycare Room A</strong> • Lead Teacher: <strong>Teacher Teresa Cruz</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                {onOpenDSWDReportModal && (
                  <button
                    onClick={onOpenDSWDReportModal}
                    className="btn btn-secondary btn-sm bg-white text-[#D96B4D] font-bold border-none shadow-md"
                    suppressHydrationWarning
                  >
                    <Download size={16} />
                    <span>Download Report Card</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            <div className="card bg-[#EBF5F4] border border-[#2F8F8A]/20 p-4">
              <div className="text-2xl font-extrabold text-[#2F8F8A]">{rate}%</div>
              <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mt-1">Attendance Rate</div>
            </div>
            <div className="card bg-[#EBF8FF] border border-[#2B6CB0]/20 p-4">
              <div className="text-2xl font-extrabold text-[#2B6CB0]">{presentCount}</div>
              <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mt-1">Days Present</div>
            </div>
            <div className="card bg-[#FEF8EC] border border-[#F5B942]/30 p-4">
              <div className="text-2xl font-extrabold text-[#8A5D00]">{lateCount}</div>
              <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mt-1">Days Late</div>
            </div>
            <div className="card bg-[#FFEBEE] border border-[#FFCDD2] p-4">
              <div className="text-2xl font-extrabold text-[#D32F2F]">{absentCount}</div>
              <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mt-1">Days Absent</div>
            </div>
          </div>

          {/* Interactive Consecutive Absence Alert Warning */}
          {absentCount >= 2 && !acknowledgedAlerts['ABS-001'] && (
            <div className="p-4 rounded-3xl bg-[#FFEBEE] border border-[#FFCDD2] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-sm">
              <div className="flex items-start gap-3">
                <AlertTriangle size={22} className="text-[#D32F2F] shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-[#D32F2F] text-sm">Attendance Advisory Alert</div>
                  <p className="text-[#4A4A4A] m-0 mt-0.5 leading-relaxed">
                    {child?.firstName} has accumulated absences. Automated SMS alert telemetry sent to primary guardian ({child?.guardian?.phone || '0917-888-9900'}).
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleAcknowledgeAlert('ABS-001')}
                className="btn btn-sm text-white bg-[#D32F2F] hover:bg-[#B71C1C] font-bold shrink-0 shadow-sm"
                suppressHydrationWarning
              >
                Acknowledge Alert
              </button>
            </div>
          )}

          {/* Daycare Daily Schedule Timeline */}
          <div className="card bg-white p-5 space-y-4 border border-[#E6E4DF]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[#2F8F8A]">
                <Clock size={20} />
                <h3 className="text-base font-bold text-[#2B2B2B] m-0">Daycare Center Daily Schedule Routine</h3>
              </div>
              <span className="badge badge-primary">Barangay Bacong Daycare</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-[#EBF5F4] border border-[#2F8F8A]/20 space-y-1">
                <span className="font-extrabold text-[#2F8F8A] block">08:00 AM - 08:30 AM</span>
                <div className="font-bold text-[#2B2B2B]">Circle Time</div>
                <p className="text-[11px] text-[#6B6B6B] m-0">Arrival, flag ceremony, national anthem & greeting.</p>
              </div>

              <div className="p-3 rounded-2xl bg-[#FEF8EC] border border-[#F5B942]/30 space-y-1">
                <span className="font-extrabold text-[#8A5D00] block">08:30 AM - 09:30 AM</span>
                <div className="font-bold text-[#2B2B2B]">ECCD Stations</div>
                <p className="text-[11px] text-[#6B6B6B] m-0">4-Domain learning stations (fine motor & language).</p>
              </div>

              <div className="p-3 rounded-2xl bg-[#EBF8FF] border border-[#2B6CB0]/20 space-y-1">
                <span className="font-extrabold text-[#2B6CB0] block">09:30 AM - 10:00 AM</span>
                <div className="font-bold text-[#2B2B2B]">Healthy Snack</div>
                <p className="text-[11px] text-[#6B6B6B] m-0">Supervised handwashing & nutritional table manners.</p>
              </div>

              <div className="p-3 rounded-2xl bg-[#F3E8FF] border border-[#8B5CF6]/20 space-y-1">
                <span className="font-extrabold text-[#8B5CF6] block">10:00 AM - 11:15 AM</span>
                <div className="font-bold text-[#2B2B2B]">Storytelling & Play</div>
                <p className="text-[11px] text-[#6B6B6B] m-0">Outdoor gross motor movement & Tagalog stories.</p>
              </div>

              <div className="p-3 rounded-2xl bg-[#FFEBEE] border border-[#FFCDD2] space-y-1">
                <span className="font-extrabold text-[#D32F2F] block">11:15 AM - 11:30 AM</span>
                <div className="font-bold text-[#2B2B2B]">Dismissal</div>
                <p className="text-[11px] text-[#6B6B6B] m-0">Pack-up, prayer, and authorized guardian pick-up.</p>
              </div>
            </div>
          </div>

          {/* Main Grid: Progress Evaluation & Attendance Log */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 4-Domain Progress Overview */}
            <div className="card bg-white p-5 lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#2F8F8A]">
                  <TrendingUp size={20} />
                  <h3 className="text-base font-bold text-[#2B2B2B] m-0">
                    {child?.firstName}&rsquo;s 4-Domain Progress Summary
                  </h3>
                </div>
                <span className="badge badge-primary">{childProgress.length} Domains Evaluated</span>
              </div>

              <div className="space-y-4">
                {childProgress.map((item) => {
                  const percent = getRatingProgressPercent(item.rating);
                  return (
                    <div key={item.id} className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#2B2B2B] text-sm">{item.domain}</span>
                          <span className="px-2.5 py-0.5 rounded-full font-bold bg-[#EBF5F4] text-[#2F8F8A] text-[10px]">
                            {item.rating}
                          </span>
                        </div>
                        <span className="text-[11px] text-[#9B9B9B] font-semibold">{item.date}</span>
                      </div>

                      <div className="w-full h-2.5 bg-[#EAE6DF] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#2F8F8A] to-[#1D605D] rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>

                      <p className="text-xs text-[#4A4A4A] leading-relaxed m-0 pt-1">{item.notes}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sidebar: Teacher Contact & Attendance History */}
            <div className="space-y-6">
              
              <div className="card bg-white p-5 space-y-3 border border-[#E6E4DF]">
                <div className="flex items-center gap-2 text-[#2F8F8A]">
                  <PhoneCall size={18} />
                  <h4 className="text-sm font-bold text-[#2B2B2B] m-0">Lead Teacher Contact</h4>
                </div>
                <div className="p-3 rounded-2xl bg-[#FAF8F5] border border-[#E6E4DF] text-xs space-y-1.5">
                  <div className="font-bold text-[#2B2B2B]">Teacher Teresa Cruz</div>
                  <div className="text-[#6B6B6B]">Lead Daycare Worker • Barangay Bacong</div>
                  <div className="text-[#2F8F8A] font-semibold flex items-center gap-1">
                    <PhoneCall size={12} /> 0917-000-1122
                  </div>
                </div>
              </div>

              <div className="card bg-white p-5 space-y-3 border border-[#E6E4DF]">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-[#2B2B2B] m-0">Recent Attendance Log</h4>
                  <span className="text-[10px] text-[#9B9B9B]">Daily register</span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {childAttendance.length > 0 ? (
                    childAttendance.map((a, idx) => (
                      <div key={idx} className="p-2.5 rounded-2xl border border-[#E6E4DF] bg-[#FAF8F5] flex items-center justify-between text-xs">
                        <span className="font-bold text-[#2B2B2B]">{a.date}</span>
                        <span className={`badge ${
                          a.status === 'present' ? 'badge-primary' : a.status === 'late' ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {a.status.toUpperCase()}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center text-xs text-[#9B9B9B] p-4 bg-[#FAF8F5] rounded-2xl border border-[#E6E4DF]">
                      Attendance logged via daily register.
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        </>
      )}

      {/* TAB 2: 109-Item DepEd ECCD Domain Checklist Viewer */}
      {activeTab === 'eccd_checklist' && (
        <div className="card bg-white p-5 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <BookOpen size={18} className="text-[#2F8F8A]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#2F8F8A]">
                  DepEd / DSWD Early Childhood Development Standard
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#2B2B2B] m-0">
                109-Item Official ECCD Domain Checklist Viewer
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1 m-0">
                Detailed skill breakdown for <strong>{child?.firstName} {child?.lastName}</strong> across 7 developmental domains.
              </p>
            </div>
            <span className="badge badge-primary shrink-0 font-bold">109 Items Total</span>
          </div>

          {/* Domain Selection Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {ECCD_DOMAINS.map((dom) => {
              const isSelected = dom.id === selectedDomainId;
              return (
                <button
                  key={dom.id}
                  onClick={() => setSelectedDomainId(dom.id)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all cursor-pointer border-none shrink-0 flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#2F8F8A] text-white shadow-md'
                      : 'bg-[#FAF8F5] text-[#6B6B6B] hover:bg-[#EAE6DF]'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dom.color }}></span>
                  <span>{dom.shortLabel}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-[#EAE6DF] text-[#6B6B6B]'}`}>
                    {dom.items.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active Domain Hero Card */}
          <div className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: activeDomain.color }}></span>
                <h4 className="text-base font-extrabold text-[#2B2B2B] m-0">{activeDomain.label}</h4>
              </div>
              <p className="text-xs text-[#6B6B6B] mt-1 m-0">
                Assessing {activeDomain.items.length} DepEd competency metrics for age 4 early childhood milestones.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <span className="text-xs font-extrabold text-[#2F8F8A]">
                  {domainMasteryPct !== null ? `${domainMasteryPct}% Domain Mastery` : 'No ratings yet'}
                </span>
                <span className="text-[10px] text-[#9B9B9B] block">
                  {domainRatedItems.length} of {activeDomain.items.length} items rated
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-[#EBF5F4] text-[#2F8F8A] flex items-center justify-center font-bold text-sm">
                {domainMasteryPct ?? '—'}
              </div>
            </div>
          </div>

          {/* Checklist Items Grid */}
          <div className="space-y-2.5">
            {activeDomain.items.map((item) => {
              const currentRating = childRatings[item.id];
              const ratingTag = currentRating === 'P'
                ? 'Mastered (P)'
                : currentRating === 'O'
                  ? 'Developing (O)'
                  : currentRating === 'R'
                    ? 'Needs Practice (R)'
                    : 'Not Rated';
              const tagClass = currentRating === 'P'
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : currentRating === 'O'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : currentRating === 'R'
                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                    : 'bg-gray-50 text-gray-500 border border-gray-200';

              return (
                <div key={item.id} className="p-3.5 rounded-2xl border border-[#E6E4DF] bg-white hover:border-[#2F8F8A] transition-all flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-xl bg-[#FAF8F5] border border-[#E6E4DF] text-[#2F8F8A] font-extrabold flex items-center justify-center shrink-0">
                      {item.number}
                    </span>
                    <div>
                      <div className="font-bold text-[#2B2B2B] leading-snug">{item.description}</div>
                      <span className="text-[10px] text-[#9B9B9B]">Item Code: {item.id}</span>
                    </div>
                  </div>

                  <span className={`px-3 py-1 rounded-full font-extrabold text-[11px] shrink-0 ${tagClass}`}>
                    {ratingTag}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: Direct Teacher Messaging & Absence Excusal Form */}
      {activeTab === 'parent_notes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Form Side */}
          <div className="card bg-white p-5 space-y-4 border border-[#E6E4DF] lg:col-span-1">
            <div className="flex items-center gap-2 text-[#2F8F8A]">
              <MessageSquare size={20} />
              <h3 className="text-base font-bold text-[#2B2B2B] m-0">Submit Absence Notice</h3>
            </div>
            <p className="text-xs text-[#6B6B6B] m-0 leading-relaxed">
              Send an absence excusal note or medical advisory directly to Teacher Teresa for <strong>{child?.firstName}</strong>.
            </p>

            <form onSubmit={handleSendAbsenceNote} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#2B2B2B] mb-1">Reason for Absence</label>
                <select
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] bg-[#FAF8F5] text-xs font-semibold focus:outline-none focus:border-[#2F8F8A]"
                >
                  <option value="Illness / Fever">Illness / Fever</option>
                  <option value="Doctor Visit / Checkup">Doctor Visit / Checkup</option>
                  <option value="Family Emergency">Family Emergency</option>
                  <option value="Out of Town / Travel">Out of Town / Travel</option>
                  <option value="Weather / Typhoon Warning">Weather / Typhoon Warning</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2B2B2B] mb-1">Date of Absence</label>
                <input
                  type="date"
                  value={absenceDate}
                  onChange={(e) => setAbsenceDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] bg-[#FAF8F5] text-xs font-semibold focus:outline-none focus:border-[#2F8F8A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2B2B2B] mb-1">Guardian Contact Phone</label>
                <input
                  type="text"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] bg-[#FAF8F5] text-xs font-semibold focus:outline-none focus:border-[#2F8F8A]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#2B2B2B] mb-1">Detailed Explanation Note</label>
                <textarea
                  rows={3}
                  value={guardianNotes}
                  onChange={(e) => setGuardianNotes(e.target.value)}
                  placeholder="Explain symptoms, doctor recommendations, or pickup instructions..."
                  className="w-full px-3.5 py-2.5 rounded-2xl border border-[#E6E4DF] bg-[#FAF8F5] text-xs font-semibold focus:outline-none focus:border-[#2F8F8A]"
                ></textarea>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-2xl bg-[#2F8F8A] text-white font-bold text-xs shadow-md hover:bg-[#1D605D] transition-all flex items-center justify-center gap-2 border-none cursor-pointer"
              >
                <Send size={16} />
                <span>Submit Notice to Teacher</span>
              </button>
            </form>
          </div>

          {/* History Log Side */}
          <div className="card bg-white p-5 space-y-4 border border-[#E6E4DF] lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#2B2B2B] m-0">Submitted Guardian Notices Log</h3>
                <span className="text-xs text-[#6B6B6B]">History of absence notes and teacher responses</span>
              </div>
              <span className="badge badge-primary">{submittedNotes.length} Submitted Notes</span>
            </div>

            <div className="space-y-3">
              {submittedNotes.map((note) => (
                <div key={note.id} className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#2F8F8A] text-sm">{note.reason}</span>
                      <span className="badge badge-warning text-[10px]">{note.date}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                      {note.status}
                    </span>
                  </div>

                  <p className="text-xs text-[#4A4A4A] leading-relaxed m-0">{note.notes}</p>

                  {note.teacherReply && (
                    <div className="p-3 rounded-2xl bg-white border border-[#2F8F8A]/30 text-xs space-y-1 mt-2">
                      <div className="font-bold text-[#2F8F8A] flex items-center gap-1.5">
                        <CheckCircle size={14} /> Teacher Teresa Cruz Replied:
                      </div>
                      <p className="text-[#4A4A4A] m-0 italic">{note.teacherReply}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-[#E6E4DF] text-[10px] text-[#9B9B9B]">
                    <span>Submitted: {note.submittedAt}</span>
                    <span>Contact: {note.phone}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* TAB 4: Nutritional & Growth Tracker */}
      {activeTab === 'health_tracker' && (
        <div className="card bg-white p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Activity size={18} className="text-[#2F8F8A]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#2F8F8A]">
                  Barangay Health Center Integration
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#2B2B2B] m-0">
                Nutritional Status & Growth Telemetry
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1 m-0">
                Height, Weight, and BMI metrics recorded by daycare staff and barangay health workers.
              </p>
            </div>
            <span className="badge badge-success font-bold">Normal Status</span>
          </div>

          {/* Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="card bg-[#EBF5F4] border border-[#2F8F8A]/20 p-4">
              <div className="text-2xl font-extrabold text-[#2F8F8A]">14.5 kg</div>
              <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mt-1">Weight-for-Age (Normal)</div>
            </div>

            <div className="card bg-[#EBF8FF] border border-[#2B6CB0]/20 p-4">
              <div className="text-2xl font-extrabold text-[#2B6CB0]">98.5 cm</div>
              <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mt-1">Height-for-Age (Normal)</div>
            </div>

            <div className="card bg-[#FEF8EC] border border-[#F5B942]/30 p-4">
              <div className="text-2xl font-extrabold text-[#8A5D00]">14.9 BMI</div>
              <div className="text-[10px] font-bold text-[#6B6B6B] uppercase tracking-wider mt-1">Weight-for-Height (Healthy)</div>
            </div>
          </div>

          {/* Immunization Verification List */}
          <div className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-3">
            <h4 className="text-sm font-bold text-[#2B2B2B] m-0">Barangay Health Center Immunization Checklist</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-white border border-[#E6E4DF] flex items-center justify-between">
                <span className="font-bold text-[#2B2B2B]">BCG Vaccine</span>
                <span className="badge badge-success">Verified ✅</span>
              </div>
              <div className="p-3 rounded-2xl bg-white border border-[#E6E4DF] flex items-center justify-between">
                <span className="font-bold text-[#2B2B2B]">DPT Booster</span>
                <span className="badge badge-success">Verified ✅</span>
              </div>
              <div className="p-3 rounded-2xl bg-white border border-[#E6E4DF] flex items-center justify-between">
                <span className="font-bold text-[#2B2B2B]">Oral Polio Vaccine</span>
                <span className="badge badge-success">Verified ✅</span>
              </div>
              <div className="p-3 rounded-2xl bg-white border border-[#E6E4DF] flex items-center justify-between">
                <span className="font-bold text-[#2B2B2B]">Measles / MMR</span>
                <span className="badge badge-success">Verified ✅</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Classroom Moments & Photo Gallery */}
      {activeTab === 'gallery' && (
        <div className="card bg-white p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ImageIcon size={18} className="text-[#2F8F8A]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#2F8F8A]">
                  Classroom Learning Activity Feed
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#2B2B2B] m-0">
                Classroom Moments & Learning Gallery
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1 m-0">
                Visual highlights of daily activities at Barangay Bacong Daycare Center.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {galleryPhotos.map((photo) => (
              <div
                key={photo.id}
                className="group rounded-3xl border border-[#E6E4DF] bg-white overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer space-y-3"
              >
                <div className="h-44 overflow-hidden relative">
                  <Image
                    src={photo.src}
                    alt={photo.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-all duration-500"
                  />
                  <span className="absolute top-3 right-3 badge badge-primary text-[10px]">
                    {photo.tag}
                  </span>
                </div>
                <div className="p-4 space-y-1">
                  <h4 className="text-sm font-bold text-[#2B2B2B] m-0">{photo.title}</h4>
                  <span className="text-[10px] text-[#9B9B9B]">{photo.date}</span>
                  <p className="text-xs text-[#6B6B6B] line-clamp-2 m-0 pt-1">{photo.caption}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: Documents & Requirements Center */}
      {activeTab === 'documents' && (
        <div className="card bg-white p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <FolderCheck size={18} className="text-[#2F8F8A]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#2F8F8A]">
                  Barangay Daycare Compliance Records
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#2B2B2B] m-0">
                Enrollment Document & Requirements Center
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1 m-0">
                Verification status for official DSWD and Barangay Bacong daycare enrollment requirements.
              </p>
            </div>
            {onOpenDSWDReportModal && (
              <button
                onClick={onOpenDSWDReportModal}
                className="btn btn-primary btn-sm font-bold shadow-md"
                suppressHydrationWarning
              >
                <Download size={16} />
                <span>Download Report Card PDF</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-2">
              <div className="flex items-center justify-between">
                <span className="badge badge-success text-[10px]">Verified ✅</span>
              </div>
              <h4 className="text-sm font-bold text-[#2B2B2B] m-0">PSA Birth Certificate</h4>
              <p className="text-xs text-[#6B6B6B] m-0">Official PSA copy on file with Barangay Bacong office.</p>
            </div>

            <div className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-2">
              <div className="flex items-center justify-between">
                <span className="badge badge-success text-[10px]">Verified ✅</span>
              </div>
              <h4 className="text-sm font-bold text-[#2B2B2B] m-0">Barangay Health Card</h4>
              <p className="text-xs text-[#6B6B6B] m-0">Immunization record signed by Barangay Nurse.</p>
            </div>

            <div className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-2">
              <div className="flex items-center justify-between">
                <span className="badge badge-success text-[10px]">Verified ✅</span>
              </div>
              <h4 className="text-sm font-bold text-[#2B2B2B] m-0">2x2 Pupil ID Photos</h4>
              <p className="text-xs text-[#6B6B6B] m-0">Digital photo roster uploaded to pupil profile.</p>
            </div>

            <div className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-2">
              <div className="flex items-center justify-between">
                <span className="badge badge-success text-[10px]">Completed ✅</span>
              </div>
              <h4 className="text-sm font-bold text-[#2B2B2B] m-0">DSWD Family Profile Record</h4>
              <p className="text-xs text-[#6B6B6B] m-0">Socio-economic information verified for DSWD Form 1.</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB 7: Daycare Broadcast Notices Feed */}
      {activeTab === 'announcements' && (
        <div className="card bg-white p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#2B2B2B] m-0">Daycare Notices & Broadcast Feed</h3>
              <span className="text-xs text-[#6B6B6B]">Official announcements broadcasted to Barangay Bacong parents</span>
            </div>
            <span className="badge badge-primary">Data Privacy Protected</span>
          </div>

          <div className="space-y-3.5">
            {announcements.map((notice) => (
              <div key={notice.id} className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#2F8F8A] text-sm">{notice.title}</span>
                  <span className="text-[11px] text-[#9B9B9B] font-semibold">{notice.date}</span>
                </div>
                <p className="text-xs text-[#4A4A4A] leading-relaxed m-0">{notice.content}</p>
                <div className="flex items-center justify-between pt-2 border-t border-[#E6E4DF] text-[10px]">
                  <span className="badge badge-warning">Broadcasted to Parent Portal</span>
                  <span className="text-[#9B9B9B]">Author: Lead Daycare Worker</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
