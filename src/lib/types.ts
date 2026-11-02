export interface UserProfile {
  uid: string;
  displayName: string;
  role: 'user' | 'admin';
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  email?: string;
}

export type BookingCategory = 'Family' | 'Friends' | 'Others';
export type BookingStatus = 'Confirmed' | 'Cancelled';

export interface Booking {
  bookingId: string;
  ownerUid: string;
  contactName: string;
  category: BookingCategory;
  otherCategoryDescription?: string;
  numberOfPeople: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  occupiedDates: string[]; // ['2026-10-28', '2026-10-29', ...]
  status: BookingStatus;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
}

export interface AvailabilityBlock {
  blockId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  occupiedDates: string[];
  reason: string;
  createdByUid: string;
  createdAt: string;
  status: 'Active' | 'Released';
  updatedAt?: string;
}

export interface CalendarDayInfo {
  dateString: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isBooked: boolean;
  isBlocked: boolean;
  booking?: Booking;
  block?: AvailabilityBlock;
}

export type ActivityEventType =
  | 'LOGIN'
  | 'BOOKING_CREATE'
  | 'BOOKING_UPDATE'
  | 'BOOKING_CANCEL'
  | 'BLOCK_CREATE'
  | 'BLOCK_RELEASE'
  | 'USER_CREATE'
  | 'USER_STATUS_CHANGE'
  | 'USER_PASSWORD_RESET';

export interface ActivityLog {
  logId: string;
  eventType: ActivityEventType;
  actorUid: string;
  actorName: string;
  actorRole: 'user' | 'admin';
  description: string;
  details?: Record<string, any>;
  timestamp: string;
}

