'use client';

import React from 'react';
import { DaycareProvider, useDaycare } from '@/contexts/DaycareContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import Toast from '@/components/Toast';
import PupilModal from '@/components/PupilModal';
import ProgressModal from '@/components/ProgressModal';
import AnnouncementModal from '@/components/AnnouncementModal';
import UserModal from '@/components/UserModal';
import DSWDReportModal from '@/components/DSWDReportModal';

import WorkerView from '@/views/WorkerView';
import OfficialView from '@/views/OfficialView';
import AdminView from '@/views/AdminView';
import ParentView from '@/views/ParentView';

/**
 * AppContent — consumes DaycareContext and renders the role-based view.
 * All state is managed by DaycareProvider — this component is purely presentational.
 */
function AppContent() {
  const {
    currentRole, setCurrentRole, activeTab, setActiveTab, searchQuery, setSearchQuery,
    pupils, attendance, progress, announcements, users, auditLogs,
    handleSavePupil, handleArchivePupil, handleEditPupil, handleSaveAttendance,
    handleSaveProgress, handleSaveAnnouncement, handleSaveUser, handleToggleUserStatus,
    toast, setToast,
    isMobileNavOpen, setIsMobileNavOpen,
    isPupilModalOpen, setIsPupilModalOpen, pupilToEdit, setPupilToEdit,
    isProgressModalOpen, setIsProgressModalOpen,
    isAnnouncementModalOpen, setIsAnnouncementModalOpen,
    isUserModalOpen, setIsUserModalOpen,
    isDSWDReportModalOpen, setIsDSWDReportModalOpen,
  } = useDaycare();

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5]" suppressHydrationWarning>

      {/* Full-width sticky header */}
      <Header
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenMobileNav={() => setIsMobileNavOpen(true)}
      />

      {/* Mobile navigation drawer overlay */}
      <MobileNav
        isOpen={isMobileNavOpen}
        onClose={() => setIsMobileNavOpen(false)}
        currentRole={currentRole}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRoleChange={setCurrentRole}
      />

      {/* Main body flex rail: sidebar + scrollable content */}
      <div className="flex flex-1 min-h-0">
        <Sidebar
          currentRole={currentRole}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />

        <main className="flex-1 min-w-0 p-6 overflow-y-auto">
          {/* ErrorBoundary prevents full-app crash if a view throws */}
          <ErrorBoundary>
            {currentRole === 'worker' && (
              <WorkerView
                activeTab={activeTab}
                pupils={pupils}
                attendance={attendance}
                progress={progress}
                announcements={announcements}
                searchQuery={searchQuery}
                onOpenPupilModal={() => { setPupilToEdit(null); setIsPupilModalOpen(true); }}
                onOpenProgressModal={() => setIsProgressModalOpen(true)}
                onOpenAnnouncementModal={() => setIsAnnouncementModalOpen(true)}
                onOpenDSWDReportModal={() => setIsDSWDReportModalOpen(true)}
                onSaveAttendance={handleSaveAttendance}
                onArchivePupil={handleArchivePupil}
                onEditPupil={handleEditPupil}
              />
            )}

            {currentRole === 'official' && (
              <OfficialView
                pupils={pupils}
                attendance={attendance}
                progress={progress}
                onOpenDSWDReportModal={() => setIsDSWDReportModalOpen(true)}
              />
            )}

            {currentRole === 'barangay_admin' && (
              <AdminView
                users={users}
                auditLogs={auditLogs}
                onOpenUserModal={() => setIsUserModalOpen(true)}
                onToggleUserStatus={handleToggleUserStatus}
              />
            )}

            {currentRole === 'parent' && (
              <ParentView
                pupils={pupils}
                attendance={attendance}
                progress={progress}
                announcements={announcements}
                activeTab={activeTab}
                onOpenDSWDReportModal={() => setIsDSWDReportModalOpen(true)}
              />
            )}
          </ErrorBoundary>
        </main>
      </div>

      {/* Global toast notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* All modals — mounted once at root level, opened via context state */}
      <PupilModal
        isOpen={isPupilModalOpen}
        onClose={() => { setIsPupilModalOpen(false); setPupilToEdit(null); }}
        onSave={handleSavePupil}
        pupilToEdit={pupilToEdit}
      />

      <ProgressModal
        isOpen={isProgressModalOpen}
        onClose={() => setIsProgressModalOpen(false)}
        onSave={handleSaveProgress}
        pupils={pupils.filter(p => p.enrollmentStatus === 'enrolled')}
      />

      <AnnouncementModal
        isOpen={isAnnouncementModalOpen}
        onClose={() => setIsAnnouncementModalOpen(false)}
        onSave={handleSaveAnnouncement}
      />

      <UserModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        onSave={handleSaveUser}
        pupils={pupils.filter(p => p.enrollmentStatus === 'enrolled')}
      />

      <DSWDReportModal
        isOpen={isDSWDReportModalOpen}
        onClose={() => setIsDSWDReportModalOpen(false)}
        pupils={pupils}
        attendance={attendance}
        progress={progress}
      />
    </div>
  );
}

/**
 * Home — root page entry point.
 * Wraps AppContent in DaycareProvider so all state is available application-wide.
 */
export default function Home() {
  return (
    <DaycareProvider>
      <AppContent />
    </DaycareProvider>
  );
}
