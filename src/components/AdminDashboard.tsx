import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Users,
  Calendar,
  Wrench,
  Search,
  Plus,
  Key,
  UserX,
  UserCheck,
  Trash2,
  Edit3,
  Eye,
  CheckCircle2,
  AlertTriangle,
  History,
  Sparkles,
  RefreshCw,
  FileText,
  Lock,
  Activity,
  ChevronDown,
  ChevronUp,
  Download,
  UserPlus,
  KeyRound,
  LogIn,
  XCircle,
  HardDrive,
  ExternalLink,
  Table,
} from 'lucide-react';
import { Booking, AvailabilityBlock, UserProfile, ActivityLog } from '../lib/types';
import { formatDisplayDate, getTodayString } from '../lib/dateUtils';
import { api } from '../lib/api';
import { GOOGLE_DRIVE_FOLDER_ID, GOOGLE_DRIVE_FOLDER_URL, DriveStatus } from '../lib/googleDriveApi';
import { getGoogleAccessToken, signInWithGoogle } from '../lib/firebase';

interface AdminDashboardProps {
  currentUser: UserProfile;
  bookings: Booking[];
  blocks: AvailabilityBlock[];
  onRefreshData: () => void;
  onViewBooking: (booking: Booking) => void;
  onEditBooking: (booking: Booking) => void;
  onCancelBooking: (booking: Booking) => void;
  onOpenBookingModal: () => void;
  onOpenDriveModal?: () => void;
}

type AdminSubTab = 'bookings' | 'users' | 'blocks' | 'history';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  bookings,
  blocks,
  onRefreshData,
  onViewBooking,
  onEditBooking,
  onCancelBooking,
  onOpenBookingModal,
  onOpenDriveModal,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<AdminSubTab>('bookings');
  const [adminUsers, setAdminUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState<boolean>(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);

  // Activity Log State
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [logFilterCategory, setLogFilterCategory] = useState<string>('all');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());

  // User management form state
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserPassword, setNewUserPassword] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<'user' | 'admin'>('user');
  const [isAddingUser, setIsAddingUser] = useState<boolean>(false);

  // Password reset modal state
  const [resettingUser, setResettingUser] = useState<UserProfile | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState<string>('');

  // Date block form state
  const todayStr = getTodayString();
  const [blockStartDate, setBlockStartDate] = useState<string>(todayStr);
  const [blockEndDate, setBlockEndDate] = useState<string>(todayStr);
  const [blockReason, setBlockReason] = useState<string>('');
  const [isBlockingDates, setIsBlockingDates] = useState<boolean>(false);
  const [blockConflicts, setBlockConflicts] = useState<any[] | null>(null);

  // Bookings filter state
  const [bookingSearch, setBookingSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'Confirmed' | 'Cancelled'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Google Drive state
  const [driveStatus, setDriveStatus] = useState<DriveStatus>(api.getDriveStatus());
  const [isSyncingDrive, setIsSyncingDrive] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = api.subscribeDriveStatus(setDriveStatus);
    return unsubscribe;
  }, []);

  const handleSyncDrive = async () => {
    setIsSyncingDrive(true);
    setActionErrorMsg(null);
    setActionSuccessMsg(null);
    try {
      let token = getGoogleAccessToken();
      if (!token) {
        const res = await signInWithGoogle();
        token = res?.accessToken || null;
      }
      if (token) {
        await api.syncWithGoogleDrive(token);
        setActionSuccessMsg('Resort database and Google Sheet successfully synced with Google Drive!');
        onRefreshData();
        loadUsers();
      }
    } catch (err: any) {
      if (err?.code !== 'auth/popup-closed-by-user' && err?.code !== 'auth/cancelled-popup-request') {
        setActionErrorMsg(err.message || 'Failed to sync with Google Drive folder.');
      }
    } finally {
      setIsSyncingDrive(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadActivityLogs();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'history') {
      loadActivityLogs();
    }
  }, [activeSubTab]);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const users = await api.getAdminUsers();
      setAdminUsers(users);
    } catch (err: any) {
      console.error('Failed to load users for admin:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadActivityLogs = async () => {
    setIsLoadingLogs(true);
    try {
      const logs = await api.getActivityLogs({ limit: 300 });
      setActivityLogs(logs || []);
    } catch (err: any) {
      console.error('Failed to load activity logs:', err);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const toggleExpandLog = (logId: string) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const handleExportLogs = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activityLogs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `shalgaon_audit_log_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionErrorMsg(null);
    setActionSuccessMsg(null);

    if (!newUserName.trim() || !newUserPassword.trim()) {
      setActionErrorMsg('Please provide both a display name and an initial password.');
      return;
    }

    setIsAddingUser(true);
    try {
      const res = await api.addAdminUser({
        displayName: newUserName.trim(),
        password: newUserPassword.trim(),
        role: newUserRole,
      });
      setActionSuccessMsg(res.message);
      setNewUserName('');
      setNewUserPassword('');
      loadUsers();
      onRefreshData();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to add user.');
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleToggleUserActive = async (user: UserProfile) => {
    setActionErrorMsg(null);
    setActionSuccessMsg(null);
    try {
      const res = await api.updateAdminUser(user.uid, { isActive: !user.isActive });
      setActionSuccessMsg(res.message);
      loadUsers();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to update user status.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingUser || !newPasswordVal.trim()) return;

    setActionErrorMsg(null);
    setActionSuccessMsg(null);
    try {
      const res = await api.updateAdminUser(resettingUser.uid, { newPassword: newPasswordVal.trim() });
      setActionSuccessMsg(`Password securely reset for ${resettingUser.displayName}.`);
      setResettingUser(null);
      setNewPasswordVal('');
      loadUsers();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to reset password.');
    }
  };

  const handleCreateBlock = async (force = false) => {
    setActionErrorMsg(null);
    setActionSuccessMsg(null);
    setBlockConflicts(null);

    if (!blockReason.trim()) {
      setActionErrorMsg('Please state a reason for this maintenance block.');
      return;
    }

    setIsBlockingDates(true);
    try {
      const res = await api.createBlock({
        startDate: blockStartDate,
        endDate: blockEndDate,
        reason: blockReason.trim(),
        forceOverride: force,
      });
      setActionSuccessMsg(res.message);
      setBlockReason('');
      onRefreshData();
    } catch (err: any) {
      if (err.data && err.data.conflicts) {
        setBlockConflicts(err.data.conflicts);
      }
      setActionErrorMsg(err.message || 'Failed to create date block.');
    } finally {
      setIsBlockingDates(false);
    }
  };

  const handleReleaseBlock = async (blockId: string) => {
    setActionErrorMsg(null);
    setActionSuccessMsg(null);
    try {
      const res = await api.releaseBlock(blockId);
      setActionSuccessMsg(res.message);
      onRefreshData();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to release block.');
    }
  };

  const handleQuickSeed = async () => {
    setActionErrorMsg(null);
    setActionSuccessMsg(null);
    try {
      const res = await api.seedSampleData();
      setActionSuccessMsg(res.message);
      loadUsers();
      onRefreshData();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to seed sample guests.');
    }
  };

  const handleResetToClean = async () => {
    if (!window.confirm('Reset database back to a clean state with an empty authorized-user list?')) return;
    setActionErrorMsg(null);
    setActionSuccessMsg(null);
    try {
      const res = await api.resetDatabase();
      setActionSuccessMsg(res.message);
      loadUsers();
      onRefreshData();
    } catch (err: any) {
      setActionErrorMsg(err.message || 'Failed to reset database.');
    }
  };

  // Filtered bookings
  let displayedBookings = bookings;
  if (statusFilter !== 'all') {
    displayedBookings = displayedBookings.filter((b) => b.status === statusFilter);
  }
  if (categoryFilter !== 'all') {
    displayedBookings = displayedBookings.filter((b) => b.category === categoryFilter);
  }
  if (bookingSearch.trim()) {
    const q = bookingSearch.toLowerCase().trim();
    displayedBookings = displayedBookings.filter(
      (b) =>
        b.bookingId.toLowerCase().includes(q) ||
        b.contactName.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.startDate.includes(q) ||
        b.endDate.includes(q)
    );
  }
  displayedBookings.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const confirmedCount = bookings.filter((b) => b.status === 'Confirmed').length;
  const activeBlocksCount = blocks.filter((b) => b.status === 'Active').length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Admin Header with Resort Security Badge */}
      <div className="bg-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold uppercase tracking-wider border border-amber-500/30 mb-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Resort Administrator Portal
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Administrative Management
          </h1>
          <p className="text-slate-400 text-sm mt-1 max-w-2xl">
            Manage authorized guest accounts, create maintenance date blocks, review reservation logs, and enforce resort policies.
          </p>
        </div>

        {/* Quick action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleQuickSeed}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Populate test guests for evaluation"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Seed Sample Guests
          </button>
          <button
            onClick={onOpenBookingModal}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            Admin Reservation
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">×</button>
        </div>
      )}

      {actionErrorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="font-medium">{actionErrorMsg}</span>
          </div>
          <button onClick={() => setActionErrorMsg(null)} className="text-rose-700 hover:text-rose-900 font-bold">×</button>
        </div>
      )}

      {/* Google Drive Database Status Panel */}
      <div className={`rounded-2xl p-5 border shadow-lg text-white ${
        driveStatus.isConnected
          ? 'bg-gradient-to-r from-slate-900 via-slate-900 to-emerald-950/90 border-emerald-800/60'
          : 'bg-gradient-to-r from-slate-900 via-slate-900 to-amber-950/90 border-amber-800/60'
      }`}>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 mt-0.5 ${
              driveStatus.isConnected
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                : 'bg-amber-500/20 border-amber-500/40 text-amber-400'
            }`}>
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  {driveStatus.isConnected ? 'Google Drive Database Synced' : 'Google Drive Database Pending Upload'}
                </h2>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  driveStatus.isConnected
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    driveStatus.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}></span>
                  {driveStatus.isConnected ? 'Connected' : 'Upload Needed'}
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                Primary Database: <code className="text-emerald-300 font-mono">database.json</code> &bull; Synced Spreadsheet: <code className="text-emerald-300 font-mono">Shalgaon_Resort_Reservations</code>
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                <span>Folder ID:</span>
                <span className="font-mono text-emerald-300">{GOOGLE_DRIVE_FOLDER_ID}</span>
                {driveStatus.lastSyncTime && (
                  <span className="text-slate-500">&bull; Last synced: {driveStatus.lastSyncTime}</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={onOpenDriveModal || handleSyncDrive}
              className={`px-4 py-2 rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-all cursor-pointer ${
                driveStatus.isConnected
                  ? 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-700/60'
                  : 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingDrive ? 'animate-spin' : ''}`} />
              <span>{driveStatus.isConnected ? 'Manage & Sync Drive' : 'Upload Database to Drive Now'}</span>
            </button>

            <a
              href={GOOGLE_DRIVE_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-colors"
            >
              <span>Open Drive Folder</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {driveStatus.sheetFileUrl && (
              <a
                href={driveStatus.sheetFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3.5 py-2 rounded-xl bg-teal-700 hover:bg-teal-600 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-colors"
              >
                <Table className="w-3.5 h-3.5" />
                <span>View Google Sheet</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Active Bookings
          </span>
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {confirmedCount}
          </span>
          <span className="text-xs text-emerald-600 font-medium block mt-1">Confirmed stays</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Authorized Guests
          </span>
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {adminUsers.length}
          </span>
          <span className="text-xs text-slate-500 font-medium block mt-1">Authorized accounts</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Active Maintenance Blocks
          </span>
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {activeBlocksCount}
          </span>
          <span className="text-xs text-amber-600 font-medium block mt-1">Dates blocked</span>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-1">
            Total History Records
          </span>
          <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">
            {bookings.length}
          </span>
          <span className="text-xs text-slate-500 font-medium block mt-1">All time bookings</span>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-6 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('bookings')}
            className={`py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'bookings'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Calendar className="w-4 h-4" />
            All Reservations ({bookings.length})
          </button>

          <button
            onClick={() => setActiveSubTab('users')}
            className={`py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'users'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            Authorized User Management ({adminUsers.length})
          </button>

          <button
            onClick={() => setActiveSubTab('blocks')}
            className={`py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'blocks'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Wrench className="w-4 h-4" />
            Maintenance &amp; Date Blocking ({blocks.length})
          </button>

          <button
            onClick={() => setActiveSubTab('history')}
            className={`py-3 text-sm font-bold border-b-2 whitespace-nowrap transition-colors flex items-center gap-2 cursor-pointer ${
              activeSubTab === 'history'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Activity className="w-4 h-4" />
            Activity Log ({activityLogs.length})
          </button>
        </nav>
      </div>

      {/* SUB-TAB 1: ALL BOOKINGS */}
      {activeSubTab === 'bookings' && (
        <div className="space-y-4">
          {/* Filters & Search */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Statuses</option>
                <option value="Confirmed">Confirmed Only</option>
                <option value="Cancelled">Cancelled Only</option>
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white py-2 px-3 text-xs text-slate-700 focus:outline-none focus:border-amber-500"
              >
                <option value="all">All Categories</option>
                <option value="Family">Family</option>
                <option value="Friends">Friends</option>
                <option value="Others">Others</option>
              </select>
            </div>

            <div className="relative w-full md:w-72">
              <input
                type="text"
                value={bookingSearch}
                onChange={(e) => setBookingSearch(e.target.value)}
                placeholder="Search contact, ID, date..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          {/* Bookings Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Booking ID</th>
                    <th className="py-3 px-4">Contact Name</th>
                    <th className="py-3 px-4">Dates</th>
                    <th className="py-3 px-4">Category &amp; Guests</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {displayedBookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No reservations found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    displayedBookings.map((b) => (
                      <tr key={b.bookingId} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{b.bookingId}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900">{b.contactName}</td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-800">
                            {formatDisplayDate(b.startDate)} → {formatDisplayDate(b.endDate)}
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            {b.occupiedDates.length} days
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {b.category} • {b.numberOfPeople} people
                        </td>
                        <td className="py-3 px-4">
                          {b.status === 'Confirmed' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              Confirmed
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800">
                              Cancelled
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                          <button
                            onClick={() => onViewBooking(b)}
                            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {b.status === 'Confirmed' && (
                            <>
                              <button
                                onClick={() => onEditBooking(b)}
                                className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                                title="Edit Reservation"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => onCancelBooking(b)}
                                className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 cursor-pointer"
                                title="Cancel Reservation"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: AUTHORIZED USER MANAGEMENT */}
      {activeSubTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Add User Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs lg:col-span-1 h-fit space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Users className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-bold text-slate-900">Add Authorized Guest</h3>
            </div>

            <form onSubmit={handleAddUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Full Display Name *
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g., Tariq Mansoor"
                  className="w-full rounded-xl border border-slate-300 py-2.5 px-3 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Initial Access Password *
                </label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Create secure access password"
                  className="w-full rounded-xl border border-slate-300 py-2.5 px-3 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Securely hashed with random salt (never stored in plaintext).
                </span>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Role
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 py-2 px-3 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                >
                  <option value="user">Authorized Guest (Standard)</option>
                  <option value="admin">Administrator (Full Control)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isAddingUser}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isAddingUser ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Save Authorized Guest
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={handleResetToClean}
                className="text-[11px] text-rose-600 hover:text-rose-800 underline font-medium cursor-pointer"
              >
                Reset to Empty Guest List
              </button>
            </div>
          </div>

          {/* User List Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Authorized Users Directory</h3>
              <span className="text-xs text-slate-500">{adminUsers.length} total registered accounts</span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {adminUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 block">{u.displayName}</span>
                        <span className="text-[11px] font-mono text-slate-400">{u.uid}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            u.role === 'admin'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {u.role === 'admin' ? 'Administrator' : 'Guest'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {u.isActive ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => setResettingUser(u)}
                          className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-950 hover:bg-slate-100 cursor-pointer"
                          title="Reset Password"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleUserActive(u)}
                          className={`p-1.5 rounded-lg border cursor-pointer ${
                            u.isActive
                              ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                              : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={u.isActive ? 'Disable Access' : 'Re-enable Access'}
                        >
                          {u.isActive ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: MAINTENANCE & DATE BLOCKING */}
      {activeSubTab === 'blocks' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Block Form */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs lg:col-span-1 h-fit space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Wrench className="w-5 h-5 text-amber-600" />
              <h3 className="text-base font-bold text-slate-900">Block Dates for Maintenance</h3>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Start Date *
                </label>
                <input
                  type="date"
                  value={blockStartDate}
                  onChange={(e) => setBlockStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 py-2.5 px-3 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                  End Date *
                </label>
                <input
                  type="date"
                  min={blockStartDate}
                  value={blockEndDate}
                  onChange={(e) => setBlockEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 py-2.5 px-3 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Maintenance Reason *
                </label>
                <input
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="e.g., Annual Pool Deep Clean, Villa Repainting"
                  className="w-full rounded-xl border border-slate-300 py-2.5 px-3 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              {blockConflicts && blockConflicts.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 space-y-2">
                  <div className="font-bold flex items-center gap-1.5 text-amber-950">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Conflict with Existing Bookings:
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    {blockConflicts.map((c: any) => (
                      <li key={c.bookingId}>
                        <strong>{c.contactName}</strong> ({formatDisplayDate(c.startDate)} → {formatDisplayDate(c.endDate)})
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-amber-800">
                    Explicit administrator resolution required. Choose to proceed with override or cancel.
                  </p>
                  <button
                    onClick={() => handleCreateBlock(true)}
                    className="w-full py-2 bg-amber-700 text-white rounded-lg font-bold hover:bg-amber-800 transition-colors cursor-pointer"
                  >
                    Confirm &amp; Apply Override Block
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => handleCreateBlock(false)}
                disabled={isBlockingDates || !blockReason.trim()}
                className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isBlockingDates ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Lock Out Dates
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Blocked Dates List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs lg:col-span-2 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Active &amp; Past Maintenance Blocks</h3>
              <span className="text-xs text-slate-500">{blocks.length} total blocks</span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Date Range</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {blocks.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-400">
                        No maintenance blocks have been created.
                      </td>
                    </tr>
                  ) : (
                    blocks.map((blk) => (
                      <tr key={blk.blockId} className="hover:bg-slate-50/60">
                        <td className="py-3 px-4 font-semibold text-slate-900">{blk.reason}</td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-800">
                            {formatDisplayDate(blk.startDate)} → {formatDisplayDate(blk.endDate)}
                          </span>
                          <span className="text-[11px] text-slate-400 block">
                            {blk.occupiedDates.length} days blocked
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {blk.status === 'Active' ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              Active Block
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-500">
                              Released
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {blk.status === 'Active' && (
                            <button
                              onClick={() => handleReleaseBlock(blk.blockId)}
                              className="px-3 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold text-xs cursor-pointer"
                            >
                              Release Block
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: ACTIVITY LOG & AUDIT TRAIL */}
      {activeSubTab === 'history' && (
        <div className="space-y-4">
          {/* Controls Bar: Filters, Search, Refresh, Export */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 text-xs">
              <button
                onClick={() => setLogFilterCategory('all')}
                className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  logFilterCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Activities
              </button>
              <button
                onClick={() => setLogFilterCategory('logins')}
                className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  logFilterCategory === 'logins'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                User Logins
              </button>
              <button
                onClick={() => setLogFilterCategory('bookings')}
                className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  logFilterCategory === 'bookings'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Booking Updates
              </button>
              <button
                onClick={() => setLogFilterCategory('blocks')}
                className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  logFilterCategory === 'blocks'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Admin Blocks
              </button>
              <button
                onClick={() => setLogFilterCategory('users')}
                className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  logFilterCategory === 'users'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                User Management
              </button>
            </div>

            {/* Search & Actions */}
            <div className="flex items-center gap-2">
              <div className="relative w-full md:w-64">
                <input
                  type="text"
                  value={logSearchQuery}
                  onChange={(e) => setLogSearchQuery(e.target.value)}
                  placeholder="Search logs by keyword..."
                  className="w-full rounded-xl border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>

              <button
                onClick={loadActivityLogs}
                title="Refresh log entries"
                className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin' : ''}`} />
              </button>

              <button
                onClick={handleExportLogs}
                title="Export complete audit trail to JSON"
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>
            </div>
          </div>

          {/* Activity Log Feed */}
          {(() => {
            let filteredLogs = activityLogs;

            if (logFilterCategory === 'logins') {
              filteredLogs = filteredLogs.filter((l) => l.eventType === 'LOGIN');
            } else if (logFilterCategory === 'bookings') {
              filteredLogs = filteredLogs.filter((l) =>
                ['BOOKING_CREATE', 'BOOKING_UPDATE', 'BOOKING_CANCEL'].includes(l.eventType)
              );
            } else if (logFilterCategory === 'blocks') {
              filteredLogs = filteredLogs.filter((l) =>
                ['BLOCK_CREATE', 'BLOCK_RELEASE'].includes(l.eventType)
              );
            } else if (logFilterCategory === 'users') {
              filteredLogs = filteredLogs.filter((l) =>
                ['USER_CREATE', 'USER_STATUS_CHANGE', 'USER_PASSWORD_RESET'].includes(l.eventType)
              );
            }

            if (logSearchQuery.trim()) {
              const q = logSearchQuery.toLowerCase().trim();
              filteredLogs = filteredLogs.filter(
                (l) =>
                  l.description.toLowerCase().includes(q) ||
                  l.actorName.toLowerCase().includes(q) ||
                  l.logId.toLowerCase().includes(q) ||
                  l.eventType.toLowerCase().includes(q) ||
                  (l.details && JSON.stringify(l.details).toLowerCase().includes(q))
              );
            }

            if (filteredLogs.length === 0) {
              return (
                <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
                    <Activity className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">No Activity Logs Found</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    {logSearchQuery || logFilterCategory !== 'all'
                      ? 'No events match the selected category filter or search query.'
                      : 'Activity logs will populate automatically as users sign in, make reservations, or update administrative blocks.'}
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-2.5">
                {filteredLogs.map((log) => {
                  const isExpanded = expandedLogIds.has(log.logId);

                  // Event badge styling
                  let badgeBg = 'bg-slate-100 text-slate-800 border-slate-200';
                  let icon = <Activity className="w-3.5 h-3.5" />;
                  let categoryLabel = 'System Event';

                  if (log.eventType === 'LOGIN') {
                    badgeBg = 'bg-blue-100 text-blue-800 border-blue-200';
                    icon = <LogIn className="w-3.5 h-3.5 text-blue-600" />;
                    categoryLabel = 'User Login';
                  } else if (log.eventType === 'BOOKING_CREATE') {
                    badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                    icon = <Calendar className="w-3.5 h-3.5 text-emerald-600" />;
                    categoryLabel = 'New Booking';
                  } else if (log.eventType === 'BOOKING_UPDATE') {
                    badgeBg = 'bg-amber-100 text-amber-800 border-amber-200';
                    icon = <Edit3 className="w-3.5 h-3.5 text-amber-600" />;
                    categoryLabel = 'Booking Update';
                  } else if (log.eventType === 'BOOKING_CANCEL') {
                    badgeBg = 'bg-rose-100 text-rose-800 border-rose-200';
                    icon = <XCircle className="w-3.5 h-3.5 text-rose-600" />;
                    categoryLabel = 'Booking Cancelled';
                  } else if (log.eventType === 'BLOCK_CREATE') {
                    badgeBg = 'bg-orange-100 text-orange-800 border-orange-200';
                    icon = <Wrench className="w-3.5 h-3.5 text-orange-600" />;
                    categoryLabel = 'Maintenance Block';
                  } else if (log.eventType === 'BLOCK_RELEASE') {
                    badgeBg = 'bg-teal-100 text-teal-800 border-teal-200';
                    icon = <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />;
                    categoryLabel = 'Block Released';
                  } else if (log.eventType === 'USER_CREATE') {
                    badgeBg = 'bg-indigo-100 text-indigo-800 border-indigo-200';
                    icon = <UserPlus className="w-3.5 h-3.5 text-indigo-600" />;
                    categoryLabel = 'User Account Created';
                  } else if (log.eventType === 'USER_STATUS_CHANGE') {
                    badgeBg = 'bg-purple-100 text-purple-800 border-purple-200';
                    icon = <Users className="w-3.5 h-3.5 text-purple-600" />;
                    categoryLabel = 'User Status Toggled';
                  } else if (log.eventType === 'USER_PASSWORD_RESET') {
                    badgeBg = 'bg-cyan-100 text-cyan-800 border-cyan-200';
                    icon = <KeyRound className="w-3.5 h-3.5 text-cyan-600" />;
                    categoryLabel = 'Password Reset';
                  }

                  const localTime = new Date(log.timestamp).toLocaleString('en-US', {
                    timeZone: 'Asia/Dhaka',
                    dateStyle: 'medium',
                    timeStyle: 'medium',
                  });

                  return (
                    <div
                      key={log.logId}
                      className="bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all p-3.5 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        {/* Event Category & Actor */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border ${badgeBg}`}
                          >
                            {icon}
                            {categoryLabel}
                          </span>

                          <span className="font-mono text-[10px] text-slate-400 font-semibold">
                            {log.logId}
                          </span>

                          <span className="text-slate-300 hidden sm:inline">•</span>

                          <span className="font-semibold text-slate-800 flex items-center gap-1">
                            {log.actorName}
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                                log.actorRole === 'admin'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {log.actorRole}
                            </span>
                          </span>
                        </div>

                        {/* Timestamp in Asia/Dhaka */}
                        <div className="text-slate-400 text-[11px] font-mono shrink-0">
                          {localTime} (Asia/Dhaka)
                        </div>
                      </div>

                      {/* Main Description */}
                      <p className="mt-2 text-slate-700 font-medium leading-relaxed">
                        {log.description}
                      </p>

                      {/* Expandable Details Accordion */}
                      {log.details && Object.keys(log.details).length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => toggleExpandLog(log.logId)}
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="w-3 h-3" />
                                Hide Context Metadata
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3" />
                                Inspect Audit Context Payload
                              </>
                            )}
                          </button>

                          {isExpanded && (
                            <pre className="mt-2 p-3 bg-slate-900 text-slate-200 rounded-lg text-[10px] font-mono overflow-x-auto leading-normal">
                              {JSON.stringify(
                                {
                                  logId: log.logId,
                                  eventType: log.eventType,
                                  actorUid: log.actorUid,
                                  actorRole: log.actorRole,
                                  timestampIso: log.timestamp,
                                  ...log.details,
                                },
                                null,
                                2
                              )}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Secure Reset Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                <Key className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Reset Password for {resettingUser.displayName}
              </h3>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-600 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  placeholder="Enter new secure password"
                  className="w-full rounded-xl border border-slate-300 py-2.5 px-3 text-xs text-slate-900 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setResettingUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold shadow-xs"
                >
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
