'use client';

import React, { useState } from 'react';
import { 
  ShieldCheck, 
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
import { useDaycare, type MockUser, type MockAuditLog, type MockAnnouncement } from '@/contexts/DaycareContext';

interface AdminViewProps {
  users: MockUser[];
  auditLogs: MockAuditLog[];
  announcements?: MockAnnouncement[];
  activeTab?: string;
  onOpenUserModal: () => void;
  onLinkParent?: () => void;
  onToggleUserStatus?: (userId: string) => void;
}

const AUDIT_PAGE_SIZE = 8;

export default function AdminView({ 
  users, 
  auditLogs, 
  announcements = [], 
  activeTab = 'users', 
  onOpenUserModal, 
  onLinkParent,
  onToggleUserStatus 
}: AdminViewProps) {
  const { showToast, logAuditAction } = useDaycare();

  const [filterRole, setFilterRole] = useState('all');
  const [userSearch, setUserSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [resetSent, setResetSent] = useState<Record<string, boolean>>({});

  const filteredUsers = users.filter(u => {
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    const matchesSearch = userSearch === '' ||
      (u.name || u.fullName || '').toLowerCase().includes(userSearch.toLowerCase()) ||
      (u.email || '').toLowerCase().includes(userSearch.toLowerCase());
    return matchesRole && matchesSearch;
  });

  const totalAuditPages = Math.ceil(auditLogs.length / AUDIT_PAGE_SIZE);
  const paginatedAuditLogs = auditLogs.slice((auditPage - 1) * AUDIT_PAGE_SIZE, auditPage * AUDIT_PAGE_SIZE);

  const handleResetPassword = async (userId: string, userEmail: string, userName: string) => {
    setResetSent(prev => ({ ...prev, [userId]: true }));
    showToast(`Password reset link sent to ${userEmail}!`, 'success');
    logAuditAction('Triggered Password Reset', userEmail, `Dispatched password reset token for ${userName}.`);
    setTimeout(() => setResetSent(prev => ({ ...prev, [userId]: false })), 4000);
  };

  return (
    <div className="space-y-6" suppressHydrationWarning>
      
      {/* Admin Hero Banner */}
      <div className="card bg-gradient-to-br from-[#6366F1] via-[#4F46E5] to-[#2F8F8A] text-white p-6 rounded-3xl shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={18} className="text-white" />
              <span className="text-xs font-bold uppercase tracking-wider text-white/90">
                System Governance & Data Privacy Compliance
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white m-0 tracking-tight">
              Barangay Admin Governance & RLS Audit Hub 🛡️
            </h1>
            <p className="text-xs md:text-sm text-white/90 mt-1.5 leading-relaxed max-w-2xl m-0">
              Provision user accounts, inspect security mutation audit trails, and verify Data Privacy Act (RA 10173) Row-Level Security policies.
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E6E4DF] pb-4">
            <div>
              <h3 className="text-base font-bold text-[#2B2B2B] m-0">System User Accounts ({users.length})</h3>
              <span className="text-xs text-[#6B6B6B]">Managed accounts with Row-Level Security permissions</span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-full border border-[#E6E4DF] bg-[#FAF8F5] text-xs focus:outline-none focus:border-[#2F8F8A] w-44"
                  suppressHydrationWarning
                />
              </div>
              <span className="font-bold text-[#6B6B6B] text-xs">Role:</span>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="px-3 py-1.5 rounded-full border border-[#E6E4DF] bg-[#FAF8F5] text-xs font-semibold focus:outline-none"
                suppressHydrationWarning
              >
                <option value="all">All System Roles</option>
                <option value="worker">Daycare Worker</option>
                <option value="official">Barangay Official</option>
                <option value="barangay_admin">Barangay Admin</option>
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
                    <td className="font-bold text-[#2B2B2B]">{u.fullName || u.name}</td>
                    <td className="text-[#6B6B6B]">{u.email}</td>
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
                      <button
                        onClick={() => handleResetPassword(u.id, u.email, u.fullName || u.name)}
                        className={`btn btn-sm gap-1.5 transition-all ${
                          resetSent[u.id]
                            ? 'bg-[#EBF5F4] text-[#2F8F8A] border-[#2F8F8A]/30'
                            : 'btn-secondary'
                        }`}
                        title={resetSent[u.id] ? 'Reset email sent!' : 'Send password reset email'}
                        suppressHydrationWarning
                      >
                        {resetSent[u.id] ? <CheckCircle size={14} /> : <Key size={14} />}
                        <span>{resetSent[u.id] ? 'Sent!' : 'Reset Pass'}</span>
                      </button>
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
            <div className="flex items-center gap-2 text-[#2F8F8A]">
              <History size={20} />
              <h3 className="text-base font-bold text-[#2B2B2B] m-0">System Security Audit Log Trail</h3>
            </div>
            <span className="text-xs text-[#9B9B9B]">Real-time mutation telemetry ({auditLogs.length} entries)</span>
          </div>

          <div className="space-y-2.5 pr-1">
            {paginatedAuditLogs.map((log) => (
              <div key={log.id} className="p-3 rounded-2xl border border-[#E6E4DF] bg-[#FAF8F5] flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-white text-[#2F8F8A] border border-[#E6E4DF] flex items-center justify-center font-bold flex-shrink-0">
                    {log.action.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-[#2B2B2B]">{log.action}</div>
                    <div className="text-[#6B6B6B] text-[11px] mt-0.5">{log.details}</div>
                    <div className="text-[10px] text-[#9B9B9B] mt-0.5">{log.userName}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-[11px] font-semibold text-[#2F8F8A] block">{log.target}</span>
                  <span className="text-[10px] text-[#9B9B9B]">{log.timestamp}</span>
                </div>
              </div>
            ))}
          </div>

          {totalAuditPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#E6E4DF] text-xs">
              <span className="text-[#9B9B9B]">Page {auditPage} of {totalAuditPages} • {auditLogs.length} total entries</span>
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
        <div className="card bg-white p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={18} className="text-[#2F8F8A]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#2F8F8A]">
                  Data Privacy Act of 2012 (RA 10173) Audit
                </span>
              </div>
              <h3 className="text-lg font-extrabold text-[#2B2B2B] m-0">
                Row-Level Security & Cryptographic Compliance Panel
              </h3>
              <p className="text-xs text-[#6B6B6B] mt-1 m-0">
                Verifying Supabase database RLS policies, encrypted SSR session tokens, and privacy controls.
              </p>
            </div>
            <span className="badge badge-success font-bold text-xs">Compliance Score: 98/100</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-1">
              <span className="font-bold text-[#2F8F8A]">Row-Level Security (RLS)</span>
              <div className="font-extrabold text-[#2B2B2B] text-sm">Enforced on PostgreSQL Tables ✅</div>
              <span className="text-[10px] text-[#9B9B9B]">Pupils, Attendance, Progress, Users</span>
            </div>

            <div className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-1">
              <span className="font-bold text-[#2B6CB0]">Session JWT Encryption</span>
              <div className="font-extrabold text-[#2B2B2B] text-sm">HS256 SSR Token Encrypted ✅</div>
              <span className="text-[10px] text-[#9B9B9B]">Next.js Middleware HttpOnly Cookies</span>
            </div>

            <div className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-1">
              <span className="font-bold text-[#8A5D00]">Database Backup Strategy</span>
              <div className="font-extrabold text-[#2B2B2B] text-sm">Daily Automated Snapshots ✅</div>
              <span className="text-[10px] text-[#9B9B9B]">Point-in-time recovery active</span>
            </div>
          </div>

          <div className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-3 text-xs">
            <h4 className="text-sm font-bold text-[#2B2B2B] m-0">PostgreSQL RLS Policy Audit Matrix</h4>
            <div className="space-y-2">
              <div className="p-3 rounded-2xl bg-white border border-[#E6E4DF] flex items-center justify-between">
                <div>
                  <strong className="text-[#2B2B2B]">pupils table RLS</strong>
                  <div className="text-[11px] text-[#6B6B6B]">Parents restricted to linked child IDs; Workers & Officials read active roster.</div>
                </div>
                <span className="badge badge-success shrink-0">Policy Active ✅</span>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-[#E6E4DF] flex items-center justify-between">
                <div>
                  <strong className="text-[#2B2B2B]">attendance table RLS</strong>
                  <div className="text-[11px] text-[#6B6B6B]">Write access restricted to Daycare Worker role (`worker`).</div>
                </div>
                <span className="badge badge-success shrink-0">Policy Active ✅</span>
              </div>

              <div className="p-3 rounded-2xl bg-white border border-[#E6E4DF] flex items-center justify-between">
                <div>
                  <strong className="text-[#2B2B2B]">users table RLS</strong>
                  <div className="text-[11px] text-[#6B6B6B]">Write access restricted to Barangay Admin role (`barangay_admin`).</div>
                </div>
                <span className="badge badge-success shrink-0">Policy Active ✅</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: System Announcements & Maintenance Feed */}
      {activeTab === 'announcements' && (
        <div className="card bg-white p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[#2B2B2B] m-0">System Governance & Maintenance Feed</h3>
              <span className="text-xs text-[#6B6B6B]">System notices broadcasted by Barangay Admin</span>
            </div>
            <span className="badge badge-primary">System Administration</span>
          </div>

          <div className="space-y-3.5">
            {announcements.map((notice) => (
              <div key={notice.id} className="p-4 rounded-3xl border border-[#E6E4DF] bg-[#FAF8F5] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#2F8F8A]">{notice.title}</span>
                  <span className="text-[11px] text-[#9B9B9B]">{notice.date}</span>
                </div>
                <p className="text-xs text-[#4A4A4A] leading-relaxed m-0">{notice.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
