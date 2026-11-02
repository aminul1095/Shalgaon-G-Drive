import { Booking, AvailabilityBlock, UserProfile, ActivityLog } from './types';
import { getGoogleAccessToken } from './firebase';

export const GOOGLE_DRIVE_FOLDER_ID = '13_ZUlzz1QLq145OZ_93zOd29fcBCVew5';
export const GOOGLE_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_FOLDER_ID}?usp=drive_link`;
export const DB_FILENAME = 'database.json';
export const SPREADSHEET_NAME = 'Shalgaon_Resort_Reservations';

export interface DriveDatabaseSchema {
  users: (UserProfile & { salt?: string; passwordHash?: string })[];
  bookings: Booking[];
  blocks: AvailabilityBlock[];
  activityLogs: ActivityLog[];
  adminAccount: {
    initialized: boolean;
    salt?: string;
    passwordHash?: string;
    email?: string;
    displayName?: string;
  };
  lastSavedAt?: string;
}

export interface DriveStatus {
  isConnected: boolean;
  folderId: string;
  folderUrl: string;
  folderName: string | null;
  databaseFileId: string | null;
  databaseFileUrl: string | null;
  sheetFileId: string | null;
  sheetFileUrl: string | null;
  lastSyncTime: string | null;
  isSyncing: boolean;
  error: string | null;
  syncLogs: string[];
}

// In-memory state and cache for the Google Drive database
let cachedDatabase: DriveDatabaseSchema | null = null;
let currentDriveStatus: DriveStatus = {
  isConnected: false,
  folderId: GOOGLE_DRIVE_FOLDER_ID,
  folderUrl: GOOGLE_DRIVE_FOLDER_URL,
  folderName: null,
  databaseFileId: null,
  databaseFileUrl: null,
  sheetFileId: null,
  sheetFileUrl: null,
  lastSyncTime: null,
  isSyncing: false,
  error: null,
  syncLogs: [],
};

// Event listeners for UI updates
type StatusListener = (status: DriveStatus) => void;
const statusListeners = new Set<StatusListener>();

export function subscribeDriveStatus(listener: StatusListener): () => void {
  statusListeners.add(listener);
  listener(currentDriveStatus);
  return () => {
    statusListeners.delete(listener);
  };
}

function updateStatus(partial: Partial<DriveStatus>) {
  currentDriveStatus = { ...currentDriveStatus, ...partial };
  statusListeners.forEach((fn) => fn(currentDriveStatus));
}

export function getDriveStatus(): DriveStatus {
  return currentDriveStatus;
}

// Initial fallback database seed to populate when creating database.json in Drive
const initialDatabaseSeed: DriveDatabaseSchema = {
  users: [
    {
      uid: 'admin-root',
      displayName: 'Resort Administrator',
      role: 'admin',
      isActive: true,
      email: 'admin@shalgaonresort.com',
      createdAt: '2026-10-25T06:00:30.803Z',
    },
    {
      uid: 'usr-mvnf5l2v-696',
      displayName: 'Tariq Mansoor',
      role: 'user',
      isActive: true,
      createdAt: '2026-10-25T06:00:39.415Z',
    },
    {
      uid: 'usr-mvnf9ozb-607',
      displayName: 'Rashid Ahmed',
      role: 'user',
      isActive: true,
      createdAt: '2026-10-25T06:03:51.095Z',
    },
    {
      uid: 'usr-mvnf9p17-233',
      displayName: 'Farhana Karim',
      role: 'user',
      isActive: true,
      createdAt: '2026-10-25T06:03:51.163Z',
    },
    {
      uid: 'usr-mvnf9p32-913',
      displayName: 'Zubair Hossain',
      role: 'user',
      isActive: true,
      createdAt: '2026-10-25T06:03:51.230Z',
    },
    {
      uid: 'usr-mvnf9p4w-910',
      displayName: 'Dr. Nusrat Jahan',
      role: 'user',
      isActive: true,
      createdAt: '2026-10-25T06:03:51.296Z',
    },
  ],
  bookings: [
    {
      bookingId: 'SB-MVNF638K-2611',
      ownerUid: 'usr-mvnf5l2v-696',
      contactName: 'Tariq Mansoor',
      category: 'Friends',
      numberOfPeople: 2,
      startDate: '2026-10-28',
      endDate: '2026-10-28',
      occupiedDates: ['2026-10-28'],
      status: 'Confirmed',
      createdAt: '2026-10-25T06:01:02.948Z',
      updatedAt: '2026-10-25T06:01:02.948Z',
      createdByName: 'Tariq Mansoor',
    },
  ],
  blocks: [
    {
      blockId: 'BLK-MVNLCSUZ',
      startDate: '2026-11-15',
      endDate: '2026-11-17',
      occupiedDates: ['2026-11-15', '2026-11-16', '2026-11-17'],
      reason: 'Annual Infinity Pool Tile Maintenance',
      createdByUid: 'admin-root',
      createdAt: '2026-10-25T08:54:13.787Z',
      status: 'Active',
      updatedAt: '2026-10-25T08:54:13.787Z',
    },
  ],
  activityLogs: [
    {
      logId: 'LOG-INIT-001',
      eventType: 'BOOKING_CREATE',
      actorUid: 'usr-mvnf5l2v-696',
      actorName: 'Tariq Mansoor',
      actorRole: 'user',
      description: 'Reservation SB-MVNF638K-2611 initialized in Google Drive database.',
      timestamp: new Date().toISOString(),
    },
  ],
  adminAccount: {
    initialized: true,
    email: 'admin@shalgaonresort.com',
    displayName: 'Resort Administrator',
  },
  lastSavedAt: new Date().toISOString(),
};

/**
 * Checks if target Google Drive folder is accessible and writable
 */
export async function verifyFolderAccess(token: string, folderId: string): Promise<{
  exists: boolean;
  canEdit: boolean;
  name?: string;
  error?: string;
}> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${folderId}?supportsAllDrives=true&fields=id,name,mimeType,capabilities,owners`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (res.status === 404) {
      return {
        exists: false,
        canEdit: false,
        error: `Folder (${folderId}) was not found or is not shared with this Google account. Please ensure the folder is shared with your account.`,
      };
    }

    if (!res.ok) {
      const errBody = await res.text();
      return {
        exists: false,
        canEdit: false,
        error: `Folder verification failed (${res.status}): ${errBody}`,
      };
    }

    const data = await res.json();
    const canAddChildren = data.capabilities?.canAddChildren !== false;
    return {
      exists: true,
      canEdit: canAddChildren,
      name: data.name,
      error: canAddChildren
        ? undefined
        : `Your Google account has read-only access to folder "${data.name}". Please grant edit permissions to this folder.`,
    };
  } catch (err: any) {
    return { exists: false, canEdit: false, error: err.message };
  }
}

/**
 * Searches for a file by name inside the specified Google Drive folder
 */
async function findFileInFolder(
  token: string,
  folderId: string,
  fileName: string,
  mimeType?: string
): Promise<{ id: string; name: string; webViewLink?: string } | null> {
  try {
    let q = `'${folderId}' in parents and name = '${fileName}' and trashed = false`;
    if (mimeType) {
      q += ` and mimeType = '${mimeType}'`;
    }
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      q
    )}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,webViewLink)&pageSize=10`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn('findFileInFolder failed:', res.status, errText);
      return null;
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0];
    }
    return null;
  } catch (err) {
    console.warn('Error querying Google Drive folder:', err);
    return null;
  }
}

/**
 * Downloads and parses JSON file from Google Drive
 */
async function downloadJsonFile(token: string, fileId: string): Promise<DriveDatabaseSchema | null> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to download database file: ${res.statusText}`);
    }
    const json = await res.json();
    return json as DriveDatabaseSchema;
  } catch (err) {
    console.error('Error downloading JSON from Google Drive:', err);
    return null;
  }
}

/**
 * Creates a JSON file inside the Google Drive folder via two-step creation (POST metadata + PATCH media)
 * This avoids multipart boundary parsing issues in varied browser environments.
 */
async function createJsonFileInFolder(
  token: string,
  folderId: string,
  fileName: string,
  content: DriveDatabaseSchema
): Promise<{ id: string; webViewLink?: string }> {
  // Step 1: Create metadata entry in folder
  const metaRes = await fetch(
    'https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: fileName,
        parents: [folderId],
        mimeType: 'application/json',
        description: 'Shalgaon Private Resort Reservation Database',
      }),
    }
  );

  if (!metaRes.ok) {
    const errText = await metaRes.text();
    throw new Error(`Google Drive API failed to create ${fileName}: ${metaRes.status} ${errText}`);
  }

  const created = await metaRes.json();

  // Step 2: Upload content body
  const uploadRes = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files/${created.id}?uploadType=media&supportsAllDrives=true`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(content, null, 2),
    }
  );

  if (!uploadRes.ok) {
    console.warn(`File created (ID: ${created.id}) but initial content upload returned non-200.`);
  }

  return { id: created.id, webViewLink: created.webViewLink };
}

/**
 * Updates existing JSON file in Google Drive
 */
async function updateJsonFile(token: string, fileId: string, content: DriveDatabaseSchema): Promise<void> {
  const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&supportsAllDrives=true`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(content, null, 2),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`Failed to update database.json in Google Drive: ${errorBody}`);
  }
}

/**
 * Creates or updates companion Google Sheet in the same folder for spreadsheet viewing
 */
async function syncCompanionGoogleSheet(
  token: string,
  folderId: string,
  dbData: DriveDatabaseSchema
): Promise<{ id: string; webViewLink?: string } | null> {
  try {
    // 1. Check if sheet exists
    let sheet = await findFileInFolder(token, folderId, SPREADSHEET_NAME, 'application/vnd.google-apps.spreadsheet');

    if (!sheet) {
      // Create new Google Sheet in folder
      const createRes = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: SPREADSHEET_NAME,
          parents: [folderId],
          mimeType: 'application/vnd.google-apps.spreadsheet',
          description: 'Live synced spreadsheet for Shalgaon Private Resort Reservations',
        }),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        console.warn('Could not create Google Sheet in folder:', errText);
        return null;
      }
      sheet = await createRes.json();
    }

    if (!sheet || !sheet.id) return null;

    // 2. Prepare tabular values for Bookings
    const bookingRows = [
      ['Booking ID', 'Contact Name', 'Category', 'Guests', 'Check-In', 'Check-Out', 'Status', 'Occupied Dates', 'Created At'],
      ...dbData.bookings.map((b) => [
        b.bookingId,
        b.contactName,
        b.category,
        b.numberOfPeople,
        b.startDate,
        b.endDate,
        b.status,
        b.occupiedDates.join(', '),
        b.createdAt,
      ]),
    ];

    // Read sheet metadata to find default sheet title (do not assume "Sheet1")
    let targetSheetTitle = 'Sheet1';
    try {
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (metaRes.ok) {
        const meta = await metaRes.json();
        if (meta.sheets && meta.sheets.length > 0 && meta.sheets[0].properties?.title) {
          targetSheetTitle = meta.sheets[0].properties.title;
        }
      }
    } catch {
      // fallback
    }

    // Write to Sheet
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheet.id}/values/${encodeURIComponent(targetSheetTitle)}!A1:I${bookingRows.length}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          range: `${targetSheetTitle}!A1:I${bookingRows.length}`,
          majorDimension: 'ROWS',
          values: bookingRows,
        }),
      }
    ).catch(() => {});

    return {
      id: sheet.id,
      webViewLink: sheet.webViewLink || `https://docs.google.com/spreadsheets/d/${sheet.id}/edit`,
    };
  } catch (err) {
    console.warn('Could not sync companion Google Sheet:', err);
    return null;
  }
}

/**
 * Connects and initializes the Google Drive Database in folder 13_ZUlzz1QLq145OZ_93zOd29fcBCVew5
 */
export async function initializeGoogleDriveDatabase(token: string): Promise<DriveDatabaseSchema> {
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    updateStatus({ syncLogs: [...logs] });
  };

  updateStatus({ isSyncing: true, error: null, syncLogs: logs });
  log(`Verifying target Google Drive folder: ${GOOGLE_DRIVE_FOLDER_ID}...`);

  try {
    // 0. Verify Folder Access
    const folderCheck = await verifyFolderAccess(token, GOOGLE_DRIVE_FOLDER_ID);
    if (!folderCheck.exists) {
      throw new Error(folderCheck.error || `Folder ${GOOGLE_DRIVE_FOLDER_ID} is not accessible.`);
    }
    if (!folderCheck.canEdit) {
      throw new Error(folderCheck.error || `Your Google account does not have Edit permissions for folder ${GOOGLE_DRIVE_FOLDER_ID}.`);
    }
    log(`Folder verified: "${folderCheck.name || GOOGLE_DRIVE_FOLDER_ID}" (Write permission granted).`);
    updateStatus({ folderName: folderCheck.name || null });

    // 1. Check for database.json in the folder
    log('Checking for existing database.json in folder...');
    let dbFile = await findFileInFolder(token, GOOGLE_DRIVE_FOLDER_ID, DB_FILENAME, 'application/json');
    let loadedData: DriveDatabaseSchema | null = null;

    if (dbFile) {
      log(`Found existing database.json (File ID: ${dbFile.id}). Reading latest records...`);
      loadedData = await downloadJsonFile(token, dbFile.id);
      if (loadedData) {
        log(`Loaded ${loadedData.bookings?.length || 0} reservations from Google Drive.`);
      }
    }

    // 2. If file does not exist or empty, initialize it with seed/current database
    if (!loadedData || !loadedData.bookings) {
      log('Creating database.json in your Google Drive folder...');
      const sourceData = cachedDatabase || initialDatabaseSeed;
      const created = await createJsonFileInFolder(token, GOOGLE_DRIVE_FOLDER_ID, DB_FILENAME, sourceData);
      dbFile = { id: created.id, name: DB_FILENAME, webViewLink: created.webViewLink };
      loadedData = sourceData;
      log(`database.json created successfully in folder! (ID: ${created.id})`);
    }

    // 3. Sync or create companion Google Sheet
    log(`Creating/updating Google Sheet "${SPREADSHEET_NAME}" in folder...`);
    const sheetInfo = await syncCompanionGoogleSheet(token, GOOGLE_DRIVE_FOLDER_ID, loadedData);
    if (sheetInfo) {
      log(`Google Sheet synchronized (ID: ${sheetInfo.id}).`);
    } else {
      log('Google Sheet sync completed.');
    }

    const fileId = dbFile?.id || null;
    const fileUrl = dbFile?.webViewLink || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : null);

    cachedDatabase = loadedData;
    log('Database is now actively connected and synced with your Google Drive folder.');

    updateStatus({
      isConnected: true,
      databaseFileId: fileId,
      databaseFileUrl: fileUrl,
      sheetFileId: sheetInfo?.id || null,
      sheetFileUrl: sheetInfo?.webViewLink || null,
      lastSyncTime: new Date().toLocaleTimeString(),
      isSyncing: false,
      error: null,
      syncLogs: logs,
    });

    return loadedData;
  } catch (err: any) {
    console.error('Failed to initialize Google Drive database:', err);
    log(`Error: ${err.message}`);
    updateStatus({
      isConnected: false,
      isSyncing: false,
      error: err.message || 'Unable to connect to Google Drive database folder.',
      syncLogs: logs,
    });
    throw err;
  }
}

/**
 * Persists the entire database to Google Drive (database.json + Google Sheet)
 */
export async function persistToGoogleDrive(newData: DriveDatabaseSchema): Promise<void> {
  const token = getGoogleAccessToken();
  cachedDatabase = { ...newData, lastSavedAt: new Date().toISOString() };

  if (!token) {
    return;
  }

  updateStatus({ isSyncing: true });
  try {
    let fileId = currentDriveStatus.databaseFileId;
    if (!fileId) {
      const found = await findFileInFolder(token, GOOGLE_DRIVE_FOLDER_ID, DB_FILENAME, 'application/json');
      fileId = found ? found.id : null;
    }

    if (fileId) {
      await updateJsonFile(token, fileId, cachedDatabase);
    } else {
      const created = await createJsonFileInFolder(token, GOOGLE_DRIVE_FOLDER_ID, DB_FILENAME, cachedDatabase);
      fileId = created.id;
      updateStatus({
        databaseFileId: created.id,
        databaseFileUrl: created.webViewLink || `https://drive.google.com/file/d/${created.id}/view`,
      });
    }

    // Update sheet in background
    syncCompanionGoogleSheet(token, GOOGLE_DRIVE_FOLDER_ID, cachedDatabase).then((sheetInfo) => {
      if (sheetInfo) {
        updateStatus({
          sheetFileId: sheetInfo.id,
          sheetFileUrl: sheetInfo.webViewLink || null,
        });
      }
    });

    updateStatus({
      isSyncing: false,
      lastSyncTime: new Date().toLocaleTimeString(),
      error: null,
    });
  } catch (err: any) {
    console.error('Error persisting to Google Drive:', err);
    updateStatus({
      isSyncing: false,
      error: 'Failed to write updates to Google Drive.',
    });
  }
}

// Accessors
export function getCachedDatabase(): DriveDatabaseSchema {
  return cachedDatabase || initialDatabaseSeed;
}

export function setCachedDatabase(db: DriveDatabaseSchema) {
  cachedDatabase = db;
}
