import React, { useState, useEffect } from 'react';
import { Palmtree, Eye, EyeOff, User, AlertCircle, Shield, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { UserProfile } from '../lib/types';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [authorizedUsers, setAuthorizedUsers] = useState<{ uid: string; displayName: string; role: string }[]>([]);
  const [selectedUid, setSelectedUid] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Admin access state
  const [showAdminLogin, setShowAdminLogin] = useState<boolean>(false);
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [showAdminPassword, setShowAdminPassword] = useState<boolean>(false);
  const [, setIsAdminInitialized] = useState<boolean>(false);
  const [adminSetupName] = useState<string>('Resort Administrator');
  const [adminSetupSuccessMsg, setAdminSetupSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    loadAuthorizedUsers();
    checkAdminStatus();
  }, []);

  const loadAuthorizedUsers = async () => {
    try {
      const users = await api.getAuthorizedUsers();
      setAuthorizedUsers(users || []);
      if (users && users.length > 0) {
        setSelectedUid(users[0].uid);
      }
    } catch (err) {
      console.error('Failed to load authorized users:', err);
    }
  };

  const checkAdminStatus = async () => {
    try {
      const status = await api.getAdminStatus();
      setIsAdminInitialized(status.initialized);
    } catch (err) {
      console.error('Failed to check admin status:', err);
    }
  };

  const handleGuestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedUid) {
      setError('Please select your name from the authorized guest dropdown.');
      return;
    }

    if (!password) {
      setError('Please enter your access password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.login(selectedUid, password);
      onLoginSuccess(res.user);
    } catch (err: any) {
      setError(err.message || 'Invalid name and password combination. Please verify your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAdminSetupSuccessMsg(null);

    if (!adminPassword || adminPassword.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    setIsLoading(true);
    try {
      try {
        const res = await api.adminLogin(adminPassword);
        onLoginSuccess(res.user);
        return;
      } catch (loginErr: any) {
        if (loginErr.data && loginErr.data.needsSetup) {
          const res = await api.adminSetup(adminPassword, adminSetupName);
          setIsAdminInitialized(true);
          onLoginSuccess(res.user);
          return;
        }
        throw loginErr;
      }
    } catch (err: any) {
      setError(err.message || 'Invalid administrator password. Default master password is AdminSecurePassword2026!');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Resort Logo & Name */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-2xl ring-4 ring-emerald-500/20 mb-5">
          <Palmtree className="w-12 h-12" />
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
          Shalgaon
        </h1>
        <p className="mt-1 text-sm font-medium uppercase tracking-widest text-emerald-400">
          Private Resort Reservation Portal
        </p>
        <p className="mt-2 text-xs text-slate-400">
          Exclusive, invitation-only luxury reservation management
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-slate-900/90 backdrop-blur-xl py-8 px-6 sm:px-10 shadow-2xl rounded-2xl border border-slate-800">
          
          {/* Mode Switcher */}
          <div className="flex rounded-xl bg-slate-950/70 p-1 mb-6 border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setShowAdminLogin(false);
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                !showAdminLogin
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              Guest Pass Login
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAdminLogin(true);
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                showAdminLogin
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Admin Portal
            </button>
          </div>

          {/* Error Message Display */}
          {error && (
            <div className="mb-5 rounded-lg bg-rose-950/60 border border-rose-800/80 p-3.5 text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{error}</div>
            </div>
          )}

          {adminSetupSuccessMsg && (
            <div className="mb-5 rounded-lg bg-emerald-950/60 border border-emerald-800/80 p-3.5 text-emerald-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{adminSetupSuccessMsg}</div>
            </div>
          )}

          {!showAdminLogin ? (
            /* Authorized Guest Login Form */
            <form onSubmit={handleGuestLogin} className="space-y-4">
              <div>
                <label htmlFor="user-select" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Authorized Guest Name
                </label>
                <select
                  id="user-select"
                  value={selectedUid}
                  onChange={(e) => setSelectedUid(e.target.value)}
                  disabled={authorizedUsers.length === 0}
                  className="block w-full rounded-xl border border-slate-700 bg-slate-800/90 py-2.5 pl-3.5 pr-10 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
                >
                  {authorizedUsers.length === 0 ? (
                    <option value="">No authorized guests configured yet</option>
                  ) : (
                    authorizedUsers.map((u) => (
                      <option key={u.uid} value={u.uid}>
                        {u.displayName}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label htmlFor="guest-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Guest Password
                </label>
                <div className="relative">
                  <input
                    id="guest-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter guest password"
                    autoComplete="current-password"
                    disabled={authorizedUsers.length === 0}
                    className="block w-full rounded-xl border border-slate-700 bg-slate-800/90 py-2.5 pl-3.5 pr-11 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading || authorizedUsers.length === 0}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 px-4 text-sm font-semibold text-white shadow-lg hover:from-emerald-500 hover:to-teal-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Sign In as Guest</span>
              </button>
            </form>
          ) : (
            /* Admin Login Form */
            <form onSubmit={handleAdminAuth} className="space-y-4">
              <div>
                <label htmlFor="admin-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Administrator Master Password
                </label>
                <div className="relative">
                  <input
                    id="admin-password"
                    type={showAdminPassword ? 'text' : 'password'}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter admin password"
                    autoComplete="current-password"
                    className="block w-full rounded-xl border border-slate-700 bg-slate-800/90 py-2.5 pl-3.5 pr-11 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdminPassword(!showAdminPassword)}
                    tabIndex={-1}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200"
                  >
                    {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 py-3 px-4 text-sm font-semibold text-white shadow-lg hover:from-amber-500 hover:to-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50 transition-all cursor-pointer"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Sign In to Admin Portal</span>
              </button>
            </form>
          )}

          <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
            <span className="text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Independent standalone database &bull; Deploy anywhere</span>
            </span>
          </div>

        </div>
      </div>
    </div>
  );
};
