import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/LoginScreen';
import { CalendarView } from './components/CalendarView';
import { BookingModal } from './components/BookingModal';
import { BookingDetailsModal } from './components/BookingDetailsModal';
import { CancelConfirmationModal } from './components/CancelConfirmationModal';
import { DriveSyncModal } from './components/DriveSyncModal';
import { MyBookingsView } from './components/MyBookingsView';
import { AdminDashboard } from './components/AdminDashboard';
import { Booking, AvailabilityBlock, UserProfile } from './lib/types';
import { api, getStoredUser, clearStoredSession } from './lib/api';
import { testConnection, initGoogleAuth, googleLogout } from './lib/firebase';
import { DriveStatus } from './lib/googleDriveApi';
import { CheckCircle2, AlertCircle, X, HardDrive } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(getStoredUser());
  const [currentTab, setCurrentTab] = useState<'calendar' | 'my-bookings' | 'admin'>('calendar');
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [driveStatus, setDriveStatus] = useState<DriveStatus>(api.getDriveStatus());

  // Modals state
  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState<boolean>(false);
  const [selectedInitialDate, setSelectedInitialDate] = useState<string | undefined>();
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const [detailsModalBooking, setDetailsModalBooking] = useState<Booking | null>(null);
  const [cancelModalBooking, setCancelModalBooking] = useState<Booking | null>(null);

  // Toast notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 5000);
  };

  // Test Firebase connection on mount as requested by skill
  useEffect(() => {
    testConnection().catch(() => {});
    const unsubDrive = api.subscribeDriveStatus(setDriveStatus);
    const unsub = initGoogleAuth(
      async (_user, token) => {
        try {
          await api.syncWithGoogleDrive(token);
        } catch {
          // ignore
        }
      },
      () => {}
    );
    return () => {
      unsub();
      unsubDrive();
    };
  }, []);

  // Fetch bookings and blocks
  const refreshData = useCallback(async () => {
    if (!currentUser) return;
    setIsLoading(true);
    try {
      const [fetchedBookings, fetchedBlocks] = await Promise.all([
        api.getBookings(),
        api.getBlocks(),
      ]);
      setBookings(fetchedBookings || []);
      setBlocks(fetchedBlocks || []);
    } catch (err: any) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      refreshData();
      // Polling for live calendar updates across multi-users (every 10 seconds)
      const interval = setInterval(refreshData, 10000);
      return () => clearInterval(interval);
    }
  }, [currentUser, refreshData]);

  // Handle Logout
  const handleLogout = () => {
    googleLogout().catch(() => {});
    api.logout();
    setCurrentUser(null);
    setCurrentTab('calendar');
    setBookings([]);
    setBlocks([]);
    showToast('success', 'You have been logged out securely.');
  };

  // Handle login success
  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setCurrentTab('calendar');
    showToast('success', `Welcome to Shalgaon, ${user.displayName}!`);
  };

  // Calendar click actions
  const handleSelectAvailableDate = (dateStr: string) => {
    setSelectedInitialDate(dateStr);
    setEditingBooking(null);
    setIsBookingModalOpen(true);
  };

  const handleSelectBookedDate = (booking: Booking) => {
    setDetailsModalBooking(booking);
  };

  const handleSelectBlockedDate = (block: AvailabilityBlock) => {
    showToast('error', `Date unavailable: Administrative Maintenance (${block.reason})`);
  };

  // Modal handlers
  const handleStartEdit = (booking: Booking) => {
    setEditingBooking(booking);
    setIsBookingModalOpen(true);
  };

  const handleStartCancel = (booking: Booking) => {
    setCancelModalBooking(booking);
  };

  const handleBookingSaved = (savedBooking: Booking) => {
    showToast('success', `Reservation ${savedBooking.bookingId} saved successfully!`);
    refreshData();
  };

  const handleBookingCancelled = (cancelledBooking: Booking) => {
    showToast('success', `Reservation ${cancelledBooking.bookingId} was cancelled. Dates are now available.`);
    refreshData();
  };

  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const myBookingsCount = bookings.filter(
    (b) => b.ownerUid === currentUser.uid && b.status === 'Confirmed'
  ).length;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-md w-full animate-in slide-in-from-top-4 duration-200">
          <div
            className={`p-4 rounded-2xl shadow-xl border flex items-center justify-between gap-3 text-xs font-semibold ${
              toast.type === 'success'
                ? 'bg-emerald-950 text-emerald-200 border-emerald-800'
                : 'bg-rose-950 text-rose-200 border-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {toast.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{toast.message}</span>
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Navbar */}
      <Navbar
        user={currentUser}
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onLogout={handleLogout}
        myBookingsCount={myBookingsCount}
        onOpenDriveModal={() => setIsDriveModalOpen(true)}
      />

      {/* Google Drive Upload Advisory Banner if not yet connected */}
      {!driveStatus.isConnected && (
        <div className="bg-amber-950/70 border-b border-amber-800/80 px-4 py-2.5 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Google Drive Folder (<code className="font-mono bg-black/40 px-1.5 py-0.5 rounded text-amber-300">13_ZUlzz1QLq145OZ_93zOd29fcBCVew5</code>) is pending initial database upload.
            </span>
          </div>
          <button
            onClick={() => setIsDriveModalOpen(true)}
            className="px-3.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs transition-colors cursor-pointer shrink-0 shadow-xs"
          >
            Upload Database to Drive Now
          </button>
        </div>
      )}

      {/* Main App Content Area */}
      <main className="flex-1 pb-16">
        {currentTab === 'calendar' && (
          <CalendarView
            user={currentUser}
            bookings={bookings}
            blocks={blocks}
            onSelectAvailableDate={handleSelectAvailableDate}
            onSelectBookedDate={handleSelectBookedDate}
            onSelectBlockedDate={handleSelectBlockedDate}
            onRefresh={refreshData}
            isLoading={isLoading}
          />
        )}

        {currentTab === 'my-bookings' && (
          <MyBookingsView
            currentUser={currentUser}
            bookings={bookings}
            onViewBooking={handleSelectBookedDate}
            onEditBooking={handleStartEdit}
            onCancelBooking={handleStartCancel}
            onNewBookingClick={() => {
              setSelectedInitialDate(undefined);
              setEditingBooking(null);
              setIsBookingModalOpen(true);
            }}
          />
        )}

        {currentTab === 'admin' && (
          <AdminDashboard
            currentUser={currentUser}
            bookings={bookings}
            blocks={blocks}
            onRefreshData={refreshData}
            onViewBooking={handleSelectBookedDate}
            onEditBooking={handleStartEdit}
            onCancelBooking={handleStartCancel}
            onOpenBookingModal={() => {
              setSelectedInitialDate(undefined);
              setEditingBooking(null);
              setIsBookingModalOpen(true);
            }}
            onOpenDriveModal={() => setIsDriveModalOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <p>Shalgaon Private Resort &copy; 2026. All rights reserved. Private Booking &amp; Reservation System.</p>
      </footer>

      {/* Drive Sync & Upload Modal */}
      <DriveSyncModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        onSyncComplete={refreshData}
      />

      {/* Booking Create/Edit Modal */}
      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => {
          setIsBookingModalOpen(false);
          setEditingBooking(null);
        }}
        onSuccess={handleBookingSaved}
        currentUser={currentUser}
        initialDate={selectedInitialDate}
        editingBooking={editingBooking}
        existingBookings={bookings}
        existingBlocks={blocks}
      />

      {/* View Booking Details Modal */}
      <BookingDetailsModal
        isOpen={!!detailsModalBooking}
        onClose={() => setDetailsModalBooking(null)}
        booking={detailsModalBooking}
        currentUser={currentUser}
        onEdit={handleStartEdit}
        onCancelRequest={handleStartCancel}
      />

      {/* Cancellation Confirmation Modal */}
      <CancelConfirmationModal
        isOpen={!!cancelModalBooking}
        onClose={() => setCancelModalBooking(null)}
        booking={cancelModalBooking}
        onCancellationSuccess={handleBookingCancelled}
      />
    </div>
  );
}
