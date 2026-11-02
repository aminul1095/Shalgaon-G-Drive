import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  FileCode,
  Table,
  FolderCheck,
  ShieldCheck,
  Loader2,
  Info,
} from 'lucide-react';
import { api } from '../lib/api';
import { DriveStatus, GOOGLE_DRIVE_FOLDER_ID, GOOGLE_DRIVE_FOLDER_URL } from '../lib/googleDriveApi';
import { signInWithGoogle, getGoogleAccessToken, getCurrentGoogleUser } from '../lib/firebase';

interface DriveSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

export const DriveSyncModal: React.FC<DriveSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
}) => {
  const [driveStatus, setDriveStatus] = useState<DriveStatus>(api.getDriveStatus());
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = api.subscribeDriveStatus(setDriveStatus);
    return unsub;
  }, []);

  if (!isOpen) return null;

  const googleUser = getCurrentGoogleUser();
  const token = getGoogleAccessToken();

  const handleStartSync = async () => {
    setLocalError(null);
    setSuccessMsg(null);
    setIsProcessing(true);

    try {
      let activeToken = token;
      if (!activeToken) {
        const signResult = await signInWithGoogle();
        if (!signResult) {
          // User closed the popup
          setIsProcessing(false);
          return;
        }
        activeToken = signResult.accessToken;
      }

      await api.syncWithGoogleDrive(activeToken);
      setSuccessMsg('Resort database and Google Sheet successfully uploaded to your Drive folder!');
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      console.error('Drive Sync Error:', err);
      setLocalError(err.message || 'Failed to complete Google Drive sync.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Google Drive Database Manager
              </h2>
              <p className="text-xs text-slate-400">
                Direct synchronization with your Google Drive folder &amp; Sheets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Status banner */}
          <div
            className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
              driveStatus.isConnected
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
            }`}
          >
            {driveStatus.isConnected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            )}
            <div className="text-xs space-y-1">
              <div className="font-semibold text-sm flex items-center gap-2">
                <span>
                  {driveStatus.isConnected ? 'Database Connected & Active' : 'Drive Database Pending Initial Upload'}
                </span>
                <span
                  className={`w-2 h-2 rounded-full ${
                    driveStatus.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                  }`}
                ></span>
              </div>
              <p className="leading-relaxed opacity-90">
                {driveStatus.isConnected
                  ? 'All reservations, guest users, and calendar blocks are actively stored in your Google Drive folder and mirrored to Google Sheets.'
                  : 'Your Google Drive folder is currently waiting for initial database upload. Click the button below to upload the resort database into your folder.'}
              </p>
            </div>
          </div>

          {/* Folder Details Box */}
          <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-400">Target Google Drive Folder:</span>
              <a
                href={GOOGLE_DRIVE_FOLDER_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 underline underline-offset-2"
              >
                <span>Open in Drive</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs text-emerald-300 break-all">
              {GOOGLE_DRIVE_FOLDER_ID}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Primary DB File</span>
                <span className="font-semibold text-white flex items-center gap-1.5 mt-0.5">
                  <FileCode className="w-3.5 h-3.5 text-blue-400" />
                  database.json
                </span>
                {driveStatus.databaseFileId ? (
                  <span className="text-[10px] text-emerald-400 font-medium block mt-1">Uploaded in folder</span>
                ) : (
                  <span className="text-[10px] text-slate-500 block mt-1">Not created yet</span>
                )}
              </div>

              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[11px]">Companion Sheet</span>
                <span className="font-semibold text-white flex items-center gap-1.5 mt-0.5">
                  <Table className="w-3.5 h-3.5 text-emerald-400" />
                  Reservations Sheet
                </span>
                {driveStatus.sheetFileId ? (
                  <span className="text-[10px] text-emerald-400 font-medium block mt-1">Uploaded in folder</span>
                ) : (
                  <span className="text-[10px] text-slate-500 block mt-1">Not created yet</span>
                )}
              </div>
            </div>
          </div>

          {/* Account info */}
          <div className="text-xs text-slate-400 flex items-center justify-between bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
            <span>Google Account Status:</span>
            <span className="font-semibold text-slate-200">
              {googleUser?.email ? googleUser.email : token ? 'Authenticated' : 'Sign-in required to upload'}
            </span>
          </div>

          {/* Error display */}
          {(localError || driveStatus.error) && (
            <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-800 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{localError || driveStatus.error}</div>
            </div>
          )}

          {/* Success display */}
          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-800 text-emerald-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* Sync Activity Logs Console */}
          {driveStatus.syncLogs && driveStatus.syncLogs.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Sync Activity Progress
              </span>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 max-h-36 overflow-y-auto space-y-1">
                {driveStatus.syncLogs.map((logStr, i) => (
                  <div key={i} className="leading-relaxed">
                    {logStr}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {driveStatus.lastSyncTime ? `Last synced at ${driveStatus.lastSyncTime}` : 'Folder waiting for sync'}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>

            <button
              onClick={handleStartSync}
              disabled={isProcessing}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading to Drive...</span>
                </>
              ) : (
                <>
                  <FolderCheck className="w-4 h-4" />
                  <span>{driveStatus.isConnected ? 'Sync & Update Drive Folder' : 'Upload Database to Drive Now'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
