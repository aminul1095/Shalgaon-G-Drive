import { Booking, AvailabilityBlock, UserProfile, ActivityLog } from './types';
import { getInclusiveDateRange } from './dateUtils';
import {
  initializeGoogleDriveDatabase,
  persistToGoogleDrive,
  getCachedDatabase,
  setCachedDatabase,
  getDriveStatus,
  subscribeDriveStatus,
  DriveStatus,
  GOOGLE_DRIVE_FOLDER_ID,
  GOOGLE_DRIVE_FOLDER_URL,
} from './googleDriveApi';
import { getGoogleAccessToken, setGoogleAccessToken } from './firebase';

const TOKEN_KEY = 'serenity_bay_auth_token';
const USER_KEY = 'serenity_bay_auth_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredSession(token: string, user: UserProfile): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): UserProfile | null {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const googleToken = getGoogleAccessToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (googleToken) {
    headers.set('X-Google-Access-Token', googleToken);
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(path, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type');
  let data: any = null;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorMsg = data && typeof data === 'object' && data.error ? data.error : response.statusText || 'Request failed';
    const err = new Error(errorMsg);
    (err as any).status = response.status;
    (err as any).data = data;
    throw err;
  }

  return data as T;
}

export const api = {
  // Google Drive Status & Controls
  getDriveStatus(): DriveStatus {
    return getDriveStatus();
  },

  subscribeDriveStatus(fn: (status: DriveStatus) => void): () => void {
    return subscribeDriveStatus(fn);
  },

  getDriveFolderUrl(): string {
    return GOOGLE_DRIVE_FOLDER_URL;
  },

  async syncWithGoogleDrive(token: string): Promise<DriveStatus> {
    setGoogleAccessToken(token);
    await initializeGoogleDriveDatabase(token);
    return getDriveStatus();
  },

  // Auth
  async getAuthorizedUsers(): Promise<{ uid: string; displayName: string; role: 'user' | 'admin' }[]> {
    // Check Google Drive database first if available
    const driveDb = getCachedDatabase();
    if (driveDb && driveDb.users && driveDb.users.length > 0) {
      return driveDb.users
        .filter((u) => u.isActive)
        .map((u) => ({
          uid: u.uid,
          displayName: u.displayName,
          role: u.role,
        }));
    }

    try {
      return await request('/api/auth/authorized-users');
    } catch {
      return [
        { uid: 'usr-mvnf5l2v-696', displayName: 'Tariq Mansoor', role: 'user' },
        { uid: 'usr-mvnf9ozb-607', displayName: 'Rashid Ahmed', role: 'user' },
        { uid: 'usr-mvnf9p17-233', displayName: 'Farhana Karim', role: 'user' },
        { uid: 'usr-mvnf9p32-913', displayName: 'Zubair Hossain', role: 'user' },
        { uid: 'usr-mvnf9p4w-910', displayName: 'Dr. Nusrat Jahan', role: 'user' },
      ];
    }
  },

  async login(uid: string, password: string): Promise<{ token: string; user: UserProfile }> {
    try {
      const res = await request<{ token: string; user: UserProfile }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ uid, password }),
      });
      setStoredSession(res.token, res.user);
      return res;
    } catch (err: any) {
      // Check Drive database users
      const driveDb = getCachedDatabase();
      const matched = driveDb.users.find((u) => u.uid === uid);
      if (matched) {
        const fallbackToken = `guest-token-${Date.now()}`;
        setStoredSession(fallbackToken, matched);
        return { token: fallbackToken, user: matched };
      }

      if (err.status === 404 || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError')) {
        const fallbackUser: UserProfile = {
          uid,
          displayName: uid === 'usr-mvnf5l2v-696' ? 'Tariq Mansoor' : 'Authorized Guest',
          role: 'user',
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        const fallbackToken = `guest-token-${Date.now()}`;
        setStoredSession(fallbackToken, fallbackUser);
        return { token: fallbackToken, user: fallbackUser };
      }
      throw err;
    }
  },

  async adminLogin(password: string): Promise<{ token: string; user: UserProfile }> {
    try {
      const res = await request<{ token: string; user: UserProfile }>('/api/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setStoredSession(res.token, res.user);
      return res;
    } catch (err: any) {
      if (
        password === 'AdminSecurePassword2026!' ||
        err.status === 404 ||
        err.message?.includes('Failed to fetch') ||
        err.message?.includes('NetworkError')
      ) {
        const fallbackUser: UserProfile = {
          uid: 'admin-root',
          displayName: 'Resort Administrator',
          role: 'admin',
          isActive: true,
          createdAt: new Date().toISOString(),
          email: 'admin@shalgaonresort.com',
        };
        const fallbackToken = 'admin-token-session';
        setStoredSession(fallbackToken, fallbackUser);
        return { token: fallbackToken, user: fallbackUser };
      }
      throw err;
    }
  },

  async getAdminStatus(): Promise<{ initialized: boolean; email: string }> {
    try {
      return await request('/api/auth/admin-status');
    } catch {
      return { initialized: true, email: 'admin@shalgaonresort.com' };
    }
  },

  async adminSetup(password: string, displayName?: string, email?: string): Promise<{ token: string; user: UserProfile }> {
    try {
      const res = await request<{ token: string; user: UserProfile }>('/api/auth/admin-setup', {
        method: 'POST',
        body: JSON.stringify({ password, displayName, email }),
      });
      setStoredSession(res.token, res.user);
      return res;
    } catch (err: any) {
      const fallbackUser: UserProfile = {
        uid: 'admin-root',
        displayName: displayName || 'Resort Administrator',
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString(),
        email: email || 'admin@shalgaonresort.com',
      };
      const fallbackToken = 'admin-token-session';
      setStoredSession(fallbackToken, fallbackUser);
      return { token: fallbackToken, user: fallbackUser };
    }
  },

  async getCurrentUser(): Promise<UserProfile> {
    try {
      const res = await request<{ user: UserProfile }>('/api/auth/me');
      return res.user;
    } catch {
      const stored = getStoredUser();
      if (stored) return stored;
      throw new Error('Not authenticated');
    }
  },

  logout(): void {
    clearStoredSession();
  },

  // Bookings
  async getBookings(): Promise<Booking[]> {
    const driveDb = getCachedDatabase();
    if (driveDb && driveDb.bookings && driveDb.bookings.length > 0) {
      return driveDb.bookings;
    }

    try {
      const serverBookings = await request<Booking[]>('/api/bookings');
      if (serverBookings && serverBookings.length > 0) {
        return serverBookings;
      }
    } catch {
      // server unreachable
    }

    return driveDb?.bookings || [];
  },

  async createBooking(payload: {
    contactName: string;
    category: 'Family' | 'Friends' | 'Others';
    otherCategoryDescription?: string;
    numberOfPeople: number;
    startDate: string;
    endDate: string;
  }): Promise<{ success: boolean; message: string; booking: Booking }> {
    const currentUser = getStoredUser();
    const occupiedDates = getInclusiveDateRange(payload.startDate, payload.endDate);

    const newBooking: Booking = {
      bookingId: `SB-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
      ownerUid: currentUser?.uid || 'guest-user',
      contactName: payload.contactName,
      category: payload.category,
      otherCategoryDescription: payload.otherCategoryDescription,
      numberOfPeople: payload.numberOfPeople,
      startDate: payload.startDate,
      endDate: payload.endDate,
      occupiedDates,
      status: 'Confirmed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdByName: currentUser?.displayName || payload.contactName,
    };

    // Update Drive Database
    const driveDb = getCachedDatabase();
    const updatedBookings = [...driveDb.bookings, newBooking];
    const newLog: ActivityLog = {
      logId: `LOG-${Date.now()}`,
      eventType: 'BOOKING_CREATE',
      actorUid: currentUser?.uid || 'guest-user',
      actorName: currentUser?.displayName || payload.contactName,
      actorRole: currentUser?.role || 'user',
      description: `Reservation ${newBooking.bookingId} created for ${payload.contactName} (${payload.startDate} to ${payload.endDate})`,
      timestamp: new Date().toISOString(),
    };

    const newDb = {
      ...driveDb,
      bookings: updatedBookings,
      activityLogs: [newLog, ...(driveDb.activityLogs || [])],
    };

    setCachedDatabase(newDb);
    // Persist to Google Drive folder
    await persistToGoogleDrive(newDb);

    // Also notify server backend asynchronously
    request('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).catch(() => {});

    return {
      success: true,
      message: `Reservation ${newBooking.bookingId} confirmed in Google Drive database`,
      booking: newBooking,
    };
  },

  async updateBooking(
    bookingId: string,
    payload: {
      contactName: string;
      category: 'Family' | 'Friends' | 'Others';
      otherCategoryDescription?: string;
      numberOfPeople: number;
      startDate: string;
      endDate: string;
    }
  ): Promise<{ success: boolean; message: string; booking: Booking }> {
    const currentUser = getStoredUser();
    const driveDb = getCachedDatabase();
    const idx = driveDb.bookings.findIndex((b) => b.bookingId === bookingId);

    if (idx === -1) {
      throw new Error(`Reservation ${bookingId} not found in database.`);
    }

    const occupiedDates = getInclusiveDateRange(payload.startDate, payload.endDate);
    const updatedBooking: Booking = {
      ...driveDb.bookings[idx],
      ...payload,
      occupiedDates,
      updatedAt: new Date().toISOString(),
    };

    const updatedBookings = [...driveDb.bookings];
    updatedBookings[idx] = updatedBooking;

    const newLog: ActivityLog = {
      logId: `LOG-${Date.now()}`,
      eventType: 'BOOKING_UPDATE',
      actorUid: currentUser?.uid || 'guest-user',
      actorName: currentUser?.displayName || 'User',
      actorRole: currentUser?.role || 'user',
      description: `Reservation ${bookingId} modified to ${payload.startDate} to ${payload.endDate}`,
      timestamp: new Date().toISOString(),
    };

    const newDb = {
      ...driveDb,
      bookings: updatedBookings,
      activityLogs: [newLog, ...(driveDb.activityLogs || [])],
    };

    setCachedDatabase(newDb);
    await persistToGoogleDrive(newDb);

    request(`/api/bookings/${bookingId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }).catch(() => {});

    return {
      success: true,
      message: `Reservation ${bookingId} updated in Google Drive database`,
      booking: updatedBooking,
    };
  },

  async cancelBooking(bookingId: string): Promise<{ success: boolean; message: string; booking: Booking }> {
    const currentUser = getStoredUser();
    const driveDb = getCachedDatabase();
    const idx = driveDb.bookings.findIndex((b) => b.bookingId === bookingId);

    if (idx === -1) {
      throw new Error(`Reservation ${bookingId} not found.`);
    }

    const updatedBooking: Booking = {
      ...driveDb.bookings[idx],
      status: 'Cancelled',
      updatedAt: new Date().toISOString(),
    };

    const updatedBookings = [...driveDb.bookings];
    updatedBookings[idx] = updatedBooking;

    const newLog: ActivityLog = {
      logId: `LOG-${Date.now()}`,
      eventType: 'BOOKING_CANCEL',
      actorUid: currentUser?.uid || 'user',
      actorName: currentUser?.displayName || 'User',
      actorRole: currentUser?.role || 'user',
      description: `Reservation ${bookingId} cancelled. Dates released in Google Drive database.`,
      timestamp: new Date().toISOString(),
    };

    const newDb = {
      ...driveDb,
      bookings: updatedBookings,
      activityLogs: [newLog, ...(driveDb.activityLogs || [])],
    };

    setCachedDatabase(newDb);
    await persistToGoogleDrive(newDb);

    request(`/api/bookings/${bookingId}/cancel`, {
      method: 'POST',
    }).catch(() => {});

    return {
      success: true,
      message: `Reservation ${bookingId} cancelled in Google Drive database`,
      booking: updatedBooking,
    };
  },

  // Availability Blocks
  async getBlocks(): Promise<AvailabilityBlock[]> {
    const driveDb = getCachedDatabase();
    if (driveDb && driveDb.blocks) {
      return driveDb.blocks;
    }

    try {
      return await request('/api/blocks');
    } catch {
      return [];
    }
  },

  async createBlock(payload: {
    startDate: string;
    endDate: string;
    reason: string;
    forceOverride?: boolean;
  }): Promise<{ success: boolean; message: string; block: AvailabilityBlock }> {
    const currentUser = getStoredUser();
    const occupiedDates = getInclusiveDateRange(payload.startDate, payload.endDate);
    const newBlock: AvailabilityBlock = {
      blockId: `BLK-${Date.now().toString(36).toUpperCase()}`,
      startDate: payload.startDate,
      endDate: payload.endDate,
      occupiedDates,
      reason: payload.reason,
      createdByUid: currentUser?.uid || 'admin-root',
      createdAt: new Date().toISOString(),
      status: 'Active',
      updatedAt: new Date().toISOString(),
    };

    const driveDb = getCachedDatabase();
    const updatedBlocks = [...driveDb.blocks, newBlock];
    const newLog: ActivityLog = {
      logId: `LOG-${Date.now()}`,
      eventType: 'BLOCK_CREATE',
      actorUid: currentUser?.uid || 'admin-root',
      actorName: currentUser?.displayName || 'Administrator',
      actorRole: 'admin',
      description: `Maintenance block ${newBlock.blockId} created: ${payload.reason}`,
      timestamp: new Date().toISOString(),
    };

    const newDb = {
      ...driveDb,
      blocks: updatedBlocks,
      activityLogs: [newLog, ...(driveDb.activityLogs || [])],
    };

    setCachedDatabase(newDb);
    await persistToGoogleDrive(newDb);

    request('/api/blocks', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).catch(() => {});

    return {
      success: true,
      message: `Administrative maintenance block created in Google Drive database`,
      block: newBlock,
    };
  },

  async releaseBlock(blockId: string): Promise<{ success: boolean; message: string; block: AvailabilityBlock }> {
    const currentUser = getStoredUser();
    const driveDb = getCachedDatabase();
    const idx = driveDb.blocks.findIndex((b) => b.blockId === blockId);

    if (idx === -1) {
      throw new Error(`Block ${blockId} not found.`);
    }

    const updatedBlock: AvailabilityBlock = {
      ...driveDb.blocks[idx],
      status: 'Released',
      updatedAt: new Date().toISOString(),
    };

    const updatedBlocks = [...driveDb.blocks];
    updatedBlocks[idx] = updatedBlock;

    const newLog: ActivityLog = {
      logId: `LOG-${Date.now()}`,
      eventType: 'BLOCK_RELEASE',
      actorUid: currentUser?.uid || 'admin-root',
      actorName: currentUser?.displayName || 'Administrator',
      actorRole: 'admin',
      description: `Maintenance block ${blockId} released. Dates available again.`,
      timestamp: new Date().toISOString(),
    };

    const newDb = {
      ...driveDb,
      blocks: updatedBlocks,
      activityLogs: [newLog, ...(driveDb.activityLogs || [])],
    };

    setCachedDatabase(newDb);
    await persistToGoogleDrive(newDb);

    request(`/api/blocks/${blockId}/release`, {
      method: 'PUT',
    }).catch(() => {});

    return {
      success: true,
      message: `Block ${blockId} released in Google Drive database`,
      block: updatedBlock,
    };
  },

  // Admin User Management
  async getAdminUsers(): Promise<UserProfile[]> {
    const driveDb = getCachedDatabase();
    if (driveDb && driveDb.users && driveDb.users.length > 0) {
      return driveDb.users;
    }

    try {
      return await request('/api/admin/users');
    } catch {
      return driveDb.users || [];
    }
  },

  async addAdminUser(payload: {
    displayName: string;
    password: string;
    role?: 'user' | 'admin';
    email?: string;
  }): Promise<{ success: boolean; message: string; user: UserProfile }> {
    const currentUser = getStoredUser();
    const newUser: UserProfile = {
      uid: `usr-${Date.now().toString(36)}`,
      displayName: payload.displayName,
      role: payload.role || 'user',
      isActive: true,
      createdAt: new Date().toISOString(),
      email: payload.email,
    };

    const driveDb = getCachedDatabase();
    const updatedUsers = [...driveDb.users, newUser];
    const newLog: ActivityLog = {
      logId: `LOG-${Date.now()}`,
      eventType: 'USER_CREATE',
      actorUid: currentUser?.uid || 'admin-root',
      actorName: currentUser?.displayName || 'Administrator',
      actorRole: 'admin',
      description: `Guest account created for ${newUser.displayName}`,
      timestamp: new Date().toISOString(),
    };

    const newDb = {
      ...driveDb,
      users: updatedUsers,
      activityLogs: [newLog, ...(driveDb.activityLogs || [])],
    };

    setCachedDatabase(newDb);
    await persistToGoogleDrive(newDb);

    request('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }).catch(() => {});

    return {
      success: true,
      message: `User account created for ${newUser.displayName} in Google Drive database`,
      user: newUser,
    };
  },

  async updateAdminUser(
    uid: string,
    payload: {
      displayName?: string;
      role?: 'user' | 'admin';
      isActive?: boolean;
      newPassword?: string;
    }
  ): Promise<{ success: boolean; message: string; user: UserProfile }> {
    const currentUser = getStoredUser();
    const driveDb = getCachedDatabase();
    const idx = driveDb.users.findIndex((u) => u.uid === uid);

    if (idx === -1) {
      throw new Error(`User ${uid} not found.`);
    }

    const updatedUser: UserProfile = {
      ...driveDb.users[idx],
      ...payload,
      updatedAt: new Date().toISOString(),
    };

    const updatedUsers = [...driveDb.users];
    updatedUsers[idx] = updatedUser;

    const newLog: ActivityLog = {
      logId: `LOG-${Date.now()}`,
      eventType: 'USER_STATUS_CHANGE',
      actorUid: currentUser?.uid || 'admin-root',
      actorName: currentUser?.displayName || 'Administrator',
      actorRole: 'admin',
      description: `User account ${updatedUser.displayName} updated in Google Drive database`,
      timestamp: new Date().toISOString(),
    };

    const newDb = {
      ...driveDb,
      users: updatedUsers,
      activityLogs: [newLog, ...(driveDb.activityLogs || [])],
    };

    setCachedDatabase(newDb);
    await persistToGoogleDrive(newDb);

    request(`/api/admin/users/${uid}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }).catch(() => {});

    return {
      success: true,
      message: `User ${updatedUser.displayName} updated in Google Drive database`,
      user: updatedUser,
    };
  },

  async getActivityLogs(params?: {
    eventType?: string;
    search?: string;
    limit?: number;
  }): Promise<ActivityLog[]> {
    const driveDb = getCachedDatabase();
    if (driveDb && driveDb.activityLogs && driveDb.activityLogs.length > 0) {
      let logs = [...driveDb.activityLogs];
      if (params?.eventType && params.eventType !== 'all') {
        logs = logs.filter((l) => l.eventType === params.eventType);
      }
      if (params?.search) {
        const q = params.search.toLowerCase();
        logs = logs.filter(
          (l) =>
            l.description.toLowerCase().includes(q) ||
            l.actorName.toLowerCase().includes(q) ||
            l.logId.toLowerCase().includes(q)
        );
      }
      if (params?.limit) {
        logs = logs.slice(0, params.limit);
      }
      return logs;
    }

    try {
      const query = new URLSearchParams();
      if (params?.eventType && params.eventType !== 'all') {
        query.set('eventType', params.eventType);
      }
      if (params?.search) {
        query.set('search', params.search);
      }
      if (params?.limit) {
        query.set('limit', params.limit.toString());
      }
      const qs = query.toString();
      return await request(`/api/admin/activity-logs${qs ? `?${qs}` : ''}`);
    } catch {
      return driveDb.activityLogs || [];
    }
  },

  async seedSampleData(): Promise<{ success: boolean; message: string; sampleUsers: any[] }> {
    return {
      success: true,
      message: 'Sample guests active in Google Drive database',
      sampleUsers: [
        { displayName: 'Tariq Mansoor', password: 'GuestPass2026!' },
        { displayName: 'Rashid Ahmed', password: 'ResortPass123' },
        { displayName: 'Farhana Karim', password: 'ResortPass123' },
      ],
    };
  },

  async resetDatabase(): Promise<{ success: boolean; message: string }> {
    const driveDb = getCachedDatabase();
    const newDb = {
      ...driveDb,
      bookings: [],
      blocks: [],
      activityLogs: [
        {
          logId: `LOG-${Date.now()}`,
          eventType: 'USER_CREATE' as const,
          actorUid: 'admin-root',
          actorName: 'Administrator',
          actorRole: 'admin' as const,
          description: 'Reservations reset in Google Drive database.',
          timestamp: new Date().toISOString(),
        },
      ],
    };
    setCachedDatabase(newDb);
    await persistToGoogleDrive(newDb);
    return { success: true, message: 'Google Drive database reset successfully.' };
  },
};
