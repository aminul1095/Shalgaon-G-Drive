import { Booking, AvailabilityBlock, UserProfile, ActivityLog } from './types';

export const GOOGLE_DRIVE_FOLDER_ID = '13_ZUlzz1QLq145OZ_93zOd29fcBCVew5';
export const GOOGLE_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${GOOGLE_DRIVE_FOLDER_ID}?usp=sharing`;
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

/**
 * Generates formatted CSV string of all resort bookings for the shared folder
 */
export function generateBookingsCsv(bookings: Booking[]): string {
  const headers = ['Booking ID', 'Contact Name', 'Category', 'Number of Guests', 'Check-In', 'Check-Out', 'Status', 'Occupied Dates', 'Created At'];
  const rows = bookings.map((b) => [
    b.bookingId,
    `"${b.contactName.replace(/"/g, '""')}"`,
    b.category,
    b.numberOfPeople,
    b.startDate,
    b.endDate,
    b.status,
    `"${b.occupiedDates.join(', ')}"`,
    b.createdAt,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
}

/**
 * Downloads a database backup file locally or to drop into the shared Drive folder
 */
export function downloadDatabaseJsonFile(data: any, filename: string = 'database.json') {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads a CSV spreadsheet file of bookings ready to open or drop into Drive
 */
export function downloadBookingsCsvFile(bookings: Booking[], filename: string = 'Shalgaon_Resort_Reservations.csv') {
  const csv = generateBookingsCsv(bookings);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
