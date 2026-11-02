import React, { useState, useEffect } from 'react';
import { Calendar, BookOpen, ShieldCheck, LogOut, Palmtree, User, HardDrive, ExternalLink, RefreshCw, Table, UploadCloud } from 'lucide-react';
import { UserProfile } from '../lib/types';
import { api } from '../lib/api';
import { DriveStatus, GOOGLE_DRIVE_FOLDER_ID, GOOGLE_DRIVE_FOLDER_URL } from '../lib/googleDriveApi';

interface NavbarProps {
  user: UserProfile;
  currentTab: 'calendar' | 'my-bookings' | 'admin';
  onSelectTab: (tab: 'calendar' | 'my-bookings' | 'admin') => void;
  onLogout: () => void;
  myBookingsCount: number;
  onOpenDriveModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  currentTab,
  onSelectTab,
  onLogout,
  myBookingsCount,
  onOpenDriveModal,
}) => {
  const isAdmin = user.role === 'admin';
  const [driveStatus, setDriveStatus] = useState<DriveStatus>(api.getDriveStatus());

  useEffect(() => {
    const unsubscribe = api.subscribeDriveStatus((status) => {
      setDriveStatus(status);
    });
    return unsubscribe;
  }, []);

  return (
    <header className="bg-slate-900 text-white shadow-md sticky top-0 z-30 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={() => onSelectTab('calendar')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg ring-1 ring-emerald-400/30">
              <Palmtree className="w-6 h-6" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white block leading-tight">
                Shalgaon
              </span>
              <span className="text-xs text-emerald-400 font-medium tracking-wider uppercase block">
                Private Resort
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            <button
              onClick={() => onSelectTab('calendar')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                currentTab === 'calendar'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Availability Calendar
            </button>

            <button
              onClick={() => onSelectTab('my-bookings')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                currentTab === 'my-bookings'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              My Bookings
              {myBookingsCount > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/40">
                  {myBookingsCount}
                </span>
              )}
            </button>

            {isAdmin && (
              <button
                onClick={() => onSelectTab('admin')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  currentTab === 'admin'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-amber-300 hover:text-amber-100 hover:bg-slate-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Administrator Area
              </button>
            )}
          </nav>

          {/* Right Section: Google Drive DB Status & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Google Drive Status Pill */}
            {driveStatus.isConnected ? (
              <div className="hidden lg:flex items-center bg-slate-950/80 border border-emerald-800/60 rounded-xl px-2.5 py-1.5 gap-2 text-xs">
                <button
                  type="button"
                  onClick={onOpenDriveModal}
                  className="flex items-center gap-1.5 hover:text-emerald-300 cursor-pointer"
                  title="Click to view Drive Database Details & Logs"
                >
                  <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-300 font-medium">Drive DB:</span>
                  <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    Synced
                  </span>
                </button>

                <div className="h-3 w-px bg-slate-700 mx-0.5"></div>

                <a
                  href={GOOGLE_DRIVE_FOLDER_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`Open Google Drive Folder: ${GOOGLE_DRIVE_FOLDER_ID}`}
                  className="text-slate-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                >
                  <span className="text-[11px] font-mono">Folder</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                {driveStatus.sheetFileUrl && (
                  <a
                    href={driveStatus.sheetFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open Synced Google Sheet"
                    className="text-slate-400 hover:text-emerald-300 transition-colors flex items-center gap-1"
                  >
                    <Table className="w-3 h-3 text-emerald-400" />
                    <span className="text-[11px]">Sheet</span>
                  </a>
                )}

                <button
                  onClick={onOpenDriveModal}
                  title="Sync with Google Drive now"
                  className="text-slate-400 hover:text-emerald-300 transition-colors p-0.5 rounded cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${driveStatus.isSyncing ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenDriveModal}
                className="hidden lg:flex items-center bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white font-semibold rounded-xl px-3 py-1.5 gap-1.5 text-xs shadow-md shadow-amber-900/30 transition-all cursor-pointer"
                title="Upload database to your Google Drive folder"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>Upload to Drive Folder</span>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
              </button>
            )}

            {/* User Profile */}
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-sm font-semibold text-slate-100 leading-tight">
                {user.displayName}
              </span>
              <span className="text-xs text-slate-400">
                {isAdmin ? (
                  <span className="text-amber-400 font-medium">Administrator</span>
                ) : (
                  <span>Authorized Guest</span>
                )}
              </span>
            </div>

            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
              <User className="w-4 h-4" />
            </div>

            <button
              onClick={onLogout}
              title="Logout"
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sub-Header for Google Drive link */}
      <div className="lg:hidden bg-slate-950 px-4 py-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-slate-300">
          <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
          <span>Drive Folder:</span>
          <span className="font-mono text-emerald-300 text-[11px]">{GOOGLE_DRIVE_FOLDER_ID.substring(0, 8)}...</span>
        </div>
        <button
          onClick={onOpenDriveModal}
          className="text-amber-300 hover:text-amber-200 font-semibold flex items-center gap-1 text-[11px] bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-800/80"
        >
          <UploadCloud className="w-3 h-3" />
          <span>{driveStatus.isConnected ? 'Manage Drive DB' : 'Upload to Drive'}</span>
        </button>
      </div>

      {/* Mobile Navigation bar */}
      <div className="md:hidden border-t border-slate-800 px-3 py-2 flex items-center justify-around bg-slate-900/95">
        <button
          onClick={() => onSelectTab('calendar')}
          className={`flex flex-col items-center py-1 px-3 rounded-md text-xs font-medium cursor-pointer ${
            currentTab === 'calendar' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4 mb-1" />
          Calendar
        </button>
        <button
          onClick={() => onSelectTab('my-bookings')}
          className={`flex flex-col items-center py-1 px-3 rounded-md text-xs font-medium relative cursor-pointer ${
            currentTab === 'my-bookings' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4 mb-1" />
          My Bookings
          {myBookingsCount > 0 && (
            <span className="absolute -top-1 right-2 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-emerald-500 text-white">
              {myBookingsCount}
            </span>
          )}
        </button>
        {isAdmin && (
          <button
            onClick={() => onSelectTab('admin')}
            className={`flex flex-col items-center py-1 px-3 rounded-md text-xs font-medium cursor-pointer ${
              currentTab === 'admin' ? 'text-amber-400' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4 mb-1" />
            Admin
          </button>
        )}
      </div>
    </header>
  );
};
