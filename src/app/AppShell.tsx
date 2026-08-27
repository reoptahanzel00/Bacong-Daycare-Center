'use client';

import React from 'react';
import { DaycareProvider, useDaycare, type InitialAppState } from '@/contexts/DaycareContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileNav from '@/components/MobileNav';
import Toast from '@/components/Toast';
import OfflineIndicator from '@/components/OfflineIndicator';
import PupilModal from '@/components/PupilModal';
import ProgressModal from '@/components/ProgressModal';
import AnnouncementModal from '@/components/AnnouncementModal';
import UserModal from '@/components/UserModal';
import LinkParentModal from '@/components/LinkParentModal';
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
    currentRole, activeTab, setActiveTab, searchQuery, setSearchQuery,
    pupils, attendance, progress, announcements, users, auditLogs,
    handleSavePupil, handleArchivePupil, handleEditPupil, handleSaveAttendance,
    handleSaveProgress, handleSaveAnnouncement, handleSaveUser, handleToggleUserStatus,
    toast, setToast,
    isMobileNavOpen, setIsMobileNavOpen,
    isPupilModalOpen, setIsPupilModalOpen, pupilToEdit, setPupilToEdit,
    isProgressModalOpen, setIsProgressModalOpen,
    isAnnouncementModalOpen, setIsAnnouncementModalOpen,
    isUserModalOpen, setIsUserModalOpen,
    isLinkParentModalOpen, setIsLinkParentModalOpen,
    linkParentOpenCount, setLinkParentOpenCount,
    isDSWDReportModalOpen, setIsDSWDReportModalOpen,
  } = useDaycare();

  return (
    <div className="min-h-screen flex flex-col bg-canvas" suppressHydrationWarning>

      {/* Full-width sticky header */}
      <Header
        currentRole={currentRole}
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
                activeTab={activeTab}
                announcements={announcements}
                onOpenDSWDReportModal={() => setIsDSWDReportModalOpen(true)}
              />
            )}

            {currentRole === 'barangay_admin' && (
              <AdminView
                users={users}
                auditLogs={auditLogs}
                activeTab={activeTab}
                announcements={announcements}
                onOpenUserModal={() => setIsUserModalOpen(true)}
                onLinkParent={() => {
                  setIsLinkParentModalOpen(true);
                  setLinkParentOpenCount(c => c + 1);
                }}
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
              />
            )}
          </ErrorBoundary>
        </main>
      </div>

      {/* Global toast notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Offline indicator */}
      <OfflineIndicator />

      {/* All modals — mounted once at root level, opened via context state */}
      <PupilModal
        key={`${pupilToEdit?.id ?? 'new'}::${isPupilModalOpen}`}
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
      />

      <LinkParentModal
        key={linkParentOpenCount}
        isOpen={isLinkParentModalOpen}
        onClose={() => setIsLinkParentModalOpen(false)}
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
 * AppShell — client entry point.
 *
 * Receives the session and the first screen's rows already resolved on the
 * server, so DaycareProvider seeds its state synchronously and the roster is
 * present on first paint instead of arriving from an effect.
 */
export default function AppShell({ initial }: { initial: InitialAppState }) {
  return (
    <DaycareProvider initial={initial}>
      <AppContent />
    </DaycareProvider>
  );
}
