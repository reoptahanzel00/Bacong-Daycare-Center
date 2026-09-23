'use client';

import React, { useState, useMemo } from 'react';
import { 
  Key, 
  Plus, 
  Link2,
  History, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle,
  Shield,
} from 'lucide-react';
import { useDaycare, type MockUser, type MockAuditLog } from '@/contexts/DaycareContext';
import { resetUserPassword } from '@/services/usersService';
import { errorText } from '@/lib/apiError';

interface AdminViewProps {
  users: MockUser[];
  auditLogs: MockAuditLog[];
  activeTab?: string;
  onOpenUserModal: () => void;
  onLinkParent?: () => void;
  onToggleUserStatus?: (userId: string) => void;
}

const AUDIT_PAGE_SIZE = 8;

export default function AdminView({ 
  users, 
  auditLogs, 
  activeTab = 'users', 
  onOpenUserModal, 
  onLinkParent,
  onToggleUserStatus 
}: AdminViewProps) {
  const { showToast, settings, saveSettings } = useDaycare();

  // Local draft of the centre settings so typing does not write on every key.
  //
  // The draft has to follow the settings it was seeded from. It used to be
  // seeded once at mount and never again: when the centre row had not arrived
  // yet (a failed read during the server render, say) the admin got a form of
  // empty boxes that stayed empty after the real values loaded - and saving it
  // wrote those blanks over the worker and barangay-captain names that every
  // signed DSWD Form 1 is printed with. Re-syncing during render rather than in
  // an effect is React's documented way to adjust state when an input changes,
  // and avoids the extra pass an effect would cost.
  const [settingsDraft, setSettingsDraft] = useState(settings);
  const [syncedSettings, setSyncedSettings] = useState(settings);
  if (settings !== syncedSettings) {
    setSyncedSettings(settings);
    setSettingsDraft(settings);
  }
  const [savingSettings, setSavingSettings] = useState(false);

  const [filterRole, setFilterRole] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [resetSent, setResetSent] = useState<Record<string, boolean>>({});
  const [resetLinks, setResetLinks] = useState<Record<string, string>>({});

  const filteredUsers = useMemo(() => {
    const needle = userSearch.toLowerCase();
    return users.filter(u => {
      const matchesRole = filterRole === 'all' || u.role === filterRole;
      const matchesSearch = needle === '' ||
        (u.name || u.fullName || '').toLowerCase().includes(needle) ||
        (u.email || '').toLowerCase().includes(needle);
      return matchesRole && matchesSearch;
    });
  }, [users, filterRole, userSearch]);

  const totalAuditPages = Math.ceil(auditLogs.length / AUDIT_PAGE_SIZE);
  const paginatedAuditLogs = useMemo(
    () => auditLogs.slice((auditPage - 1) * AUDIT_PAGE_SIZE, auditPage * AUDIT_PAGE_SIZE),
    [auditLogs, auditPage]
  );

  const handleResetPassword = async (userId: string, userEmail: string) => {
    const res = await resetUserPassword(userId);
    if (res.success) {
      setResetLinks(prev => ({ ...prev, [userId]: res.reset_link || '' }));
      setResetSent(prev => ({ ...prev, [userId]: true }));
      showToast(`Reset link generated for ${userEmail}!`, 'success');
      setTimeout(() => setResetSent(prev => ({ ...prev, [userId]: false })), 6000);
    } else {
      showToast(`Could not reset ${userEmail}: ${errorText(res.error, 'unknown error')}`, 'danger');
    }
  };

  return (
    <div className="space-y-6" suppressHydrationWarning>
      
      {/* Admin Hero Banner */}
      <div className="card bg-gradient-to-br from-[#6366F1] via-[#4F46E5] to-primary-display text-white p-6 rounded-3xl shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white m-0 tracking-tight">
              User Accounts & Audit Trail 🛡️
            </h1>
            <p className="text-xs md:text-sm text-white/90 mt-1.5 leading-relaxed max-w-2xl m-0">
              Create and manage user accounts, review the audit trail, and set the centre details printed on DSWD Form 1.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onLinkParent}
              className="btn btn-secondary font-bold shrink-0 border-none bg-white/15 text-white hover:bg-white/25"
              suppressHydrationWarning
            >
              <Link2 size={16} />
              <span>Link Parent Accounts</span>
            </button>
            <button
              onClick={onOpenUserModal}
              className="btn btn-warning font-bold shrink-0 shadow-md"
              suppressHydrationWarning
            >
              <Plus size={18} />
              <span>Provision User Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: User Account Provisioning */}
      {(activeTab === 'users' || activeTab === 'overview' || activeTab === 'user_management') && (
        <div className="card bg-white p-5 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
            <div>
              <h3 className="text-base font-bold text-ink m-0">System User Accounts ({users.length})</h3>
              <span className="text-xs text-ink-muted">Managed accounts with Row-Level Security permissions</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name or email..."
                  aria-label="Search accounts by name or email"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-full border border-line bg-canvas text-xs focus:outline-none focus:border-primary-display w-44"
                  suppressHydrationWarning
                />
              </div>
              <span className="font-bold text-ink-muted text-xs">Role:</span>
              <select
                aria-label="Filter accounts by role"
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-3 py-1.5 rounded-full border border-line bg-canvas text-xs font-semibold focus:outline-none"
                suppressHydrationWarning
              >
                <option value="all">All System Roles</option>
                <option value="worker">Daycare Worker</option>
                <option value="official">Barangay Official</option>
                <option value="parent">Parent / Guardian</option>
              </select>
            </div>
          </div>

          <div className="table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>User Full Name</th>
                  <th>Email Address</th>
                  <th>Assigned Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="font-bold text-ink">{u.fullName || u.name}</td>
                    <td className="text-ink-muted">{u.email}</td>
                    <td>
                      <span className="badge badge-primary">{u.role.replace('_', ' ')}</span>
                    </td>
                    <td>
                      <button
                        onClick={() => onToggleUserStatus && onToggleUserStatus(u.id)}
                        className={`badge border-none cursor-pointer ${
                          u.status === 'active' ? 'badge-success' : 'badge-danger'
                        }`}
                      >
                        {u.status || 'Active'}
                      </button>
                    </td>
                    <td>
                      <div className="flex flex-col items-start gap-1">
                        <button
                          onClick={() => handleResetPassword(u.id, u.email)}
                          className={`btn btn-sm gap-1.5 transition-all ${
                            resetSent[u.id]
                              ? 'bg-primary-light text-primary border-primary-display/30'
                              : 'btn-secondary'
                          }`}
                          title={resetSent[u.id] ? 'Reset link generated!' : 'Generate password reset link'}
                          suppressHydrationWarning
                        >
                          {resetSent[u.id] ? <CheckCircle size={14} /> : <Key size={14} />}
                          <span>{resetSent[u.id] ? 'Generated!' : 'Reset Pass'}</span>
                        </button>
                        {resetLinks[u.id] && (
                          <a
                            href={resetLinks[u.id]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-primary underline max-w-[180px] truncate"
                            title={resetLinks[u.id]}
                            suppressHydrationWarning
                          >
                            Open reset link
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: System Security Audit Trail */}
      {activeTab === 'audit_logs' && (
        <div className="card bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-primary">
              <History size={20} />
              <h3 className="text-base font-bold text-ink m-0">System Security Audit Log Trail</h3>
            </div>
            <span className="text-xs text-ink-subtle">Real-time mutation telemetry ({auditLogs.length} entries)</span>
          </div>

          <div className="space-y-2.5 pr-1">
            {paginatedAuditLogs.map((log) => (
              <div key={log.id} className="p-3 rounded-2xl border border-line bg-canvas flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white text-primary border border-line flex items-center justify-center font-bold flex-shrink-0">
                    {log.action.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-ink">{log.action}</div>
                    <div className="text-ink-muted text-[11px] mt-0.5">{log.details}</div>
                    <div className="text-[10px] text-ink-subtle mt-0.5">{log.userName}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-[11px] font-semibold text-primary block">{log.target}</span>
                  <span className="text-[10px] text-ink-subtle">{log.timestamp}</span>
                </div>
              </div>
            ))}
          </div>

          {totalAuditPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-line text-xs">
              <span className="text-ink-subtle">Page {auditPage} of {totalAuditPages} • {auditLogs.length} total entries</span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setAuditPage(p => Math.max(1, p - 1))}
                  disabled={auditPage === 1}
                  className="p-1.5 rounded-full hover:bg-[#F5F3EF] disabled:opacity-40 transition-all cursor-pointer border-none bg-transparent"
                  suppressHydrationWarning
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  onClick={() => setAuditPage(p => Math.min(totalAuditPages, p + 1))}
                  disabled={auditPage === totalAuditPages}
                  className="p-1.5 rounded-full hover:bg-[#F5F3EF] disabled:opacity-40 transition-all cursor-pointer border-none bg-transparent"
                  suppressHydrationWarning
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Data Privacy RA 10173 & RLS Security Audit Panel */}
      {activeTab === 'security' && (
        <div className="card bg-white p-5 space-y-5 mb-6">
          <div>
            <h3 className="text-lg font-extrabold text-ink m-0">Centre &amp; Signatories</h3>
            <p className="text-xs text-ink-muted mt-1 m-0">
              These names appear on DSWD Form 1, which is signed and submitted. Keep them current
              &mdash; the barangay captain changes with elections.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="settings-center-name" className="block text-xs font-bold text-ink mb-1.5">
                Daycare Centre Name
              </label>
              <input
                id="settings-center-name"
                type="text"
                value={settingsDraft.center_name}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, center_name: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold bg-canvas focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="settings-worker-name" className="block text-xs font-bold text-ink mb-1.5">
                Lead Daycare Worker
              </label>
              <input
                id="settings-worker-name"
                type="text"
                value={settingsDraft.daycare_worker_name}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, daycare_worker_name: e.target.value })}
                placeholder="Full name as it should be signed"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold bg-canvas focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="settings-captain-name" className="block text-xs font-bold text-ink mb-1.5">
                Barangay Captain
              </label>
              <input
                id="settings-captain-name"
                type="text"
                value={settingsDraft.barangay_captain_name}
                onChange={(e) => setSettingsDraft({ ...settingsDraft, barangay_captain_name: e.target.value })}
                placeholder="Noting official on DSWD Form 1"
                className="w-full px-3.5 py-2.5 rounded-2xl border border-line text-xs font-semibold bg-canvas focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={savingSettings}
              onClick={async () => {
                setSavingSettings(true);
                await saveSettings(settingsDraft);
                setSavingSettings(false);
              }}
              className="btn btn-primary text-xs font-bold disabled:opacity-50"
            >
              {savingSettings ? 'Saving…' : 'Save Centre Settings'}
            </button>
            <span className="text-[11px] text-ink-muted">
              Reports generated after saving will carry these names.
            </span>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="card bg-white p-5 space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={18} className="text-primary" />
              <span className="text-xs font-bold uppercase tracking-wider text-primary">
                Data Privacy Act of 2012 (RA 10173)
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-ink m-0">Who can see what</h3>
            <p className="text-xs text-ink-muted mt-1 m-0">
              The system has three roles. These rules are enforced by the database (Row-Level Security)
              and checked again by the server on every request.
            </p>
          </div>

          <div className="space-y-2 text-xs">
            {[
              { role: 'Daycare Worker', rule: 'Enrolls, records attendance and ECCD evaluations, and sees every child’s record. Manages user accounts, the audit trail and these settings.' },
              { role: 'Barangay Official', rule: 'Sees summarized enrollment and attendance figures only — never an individual child’s record.' },
              { role: 'Parent / Guardian', rule: 'Sees only the records of their own linked children.' },
            ].map((row) => (
              <div key={row.role} className="p-3 rounded-2xl bg-canvas border border-line">
                <strong className="text-ink">{row.role}</strong>
                <div className="text-[11px] text-ink-muted mt-0.5">{row.rule}</div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
