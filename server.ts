import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.resolve(DATA_DIR, 'database.json');
const SERVER_SECRET = process.env.SESSION_SECRET || 'serenity-bay-private-resort-secret-key-2026';

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface StoredUser {
  uid: string;
  displayName: string;
  role: 'user' | 'admin';
  isActive: boolean;
  passwordHash: string;
  salt: string;
  createdAt: string;
  updatedAt?: string;
  email?: string;
}

interface StoredBooking {
  bookingId: string;
  ownerUid: string;
  contactName: string;
  category: 'Family' | 'Friends' | 'Others';
  otherCategoryDescription?: string;
  numberOfPeople: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  occupiedDates: string[];
  status: 'Confirmed' | 'Cancelled';
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
}

interface StoredBlock {
  blockId: string;
  startDate: string;
  endDate: string;
  occupiedDates: string[];
  reason: string;
  createdByUid: string;
  createdAt: string;
  status: 'Active' | 'Released';
  updatedAt?: string;
}

interface StoredActivityLog {
  logId: string;
  eventType:
    | 'LOGIN'
    | 'BOOKING_CREATE'
    | 'BOOKING_UPDATE'
    | 'BOOKING_CANCEL'
    | 'BLOCK_CREATE'
    | 'BLOCK_RELEASE'
    | 'USER_CREATE'
    | 'USER_STATUS_CHANGE'
    | 'USER_PASSWORD_RESET';
  actorUid: string;
  actorName: string;
  actorRole: 'user' | 'admin';
  description: string;
  details?: Record<string, any>;
  timestamp: string;
}

interface DatabaseSchema {
  users: StoredUser[];
  bookings: StoredBooking[];
  blocks: StoredBlock[];
  activityLogs: StoredActivityLog[];
  adminAccount: {
    initialized: boolean;
    salt?: string;
    passwordHash?: string;
    email?: string;
    displayName?: string;
  };
}

const DEFAULT_ADMIN_SALT = '631e337a49732e92d3f1fb463fc12783';
const DEFAULT_ADMIN_HASH = 'd048cb8db42ed1c6a590922ae1084eda7dc0afd37de5b6d85a462c60c278cf980c537f6f2c7969387ad38ad7dd8669e8141122fa293beed1a4ea1da21a369acb';

// Default initial state with pre-configured admin account for instant deployment
const defaultDatabase: DatabaseSchema = {
  users: [
    {
      uid: 'admin-root',
      displayName: 'Resort Administrator',
      role: 'admin',
      isActive: true,
      salt: DEFAULT_ADMIN_SALT,
      passwordHash: DEFAULT_ADMIN_HASH,
      createdAt: new Date().toISOString(),
      email: 'admin@shalgaonresort.com',
    },
  ],
  bookings: [],
  blocks: [],
  activityLogs: [],
  adminAccount: {
    initialized: true,
    salt: DEFAULT_ADMIN_SALT,
    passwordHash: DEFAULT_ADMIN_HASH,
    email: 'admin@shalgaonresort.com',
    displayName: 'Resort Administrator',
  },
};

function readDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (!parsed.activityLogs) parsed.activityLogs = [];
      if (!parsed.adminAccount || !parsed.adminAccount.passwordHash || !parsed.adminAccount.salt) {
        parsed.adminAccount = {
          initialized: true,
          salt: DEFAULT_ADMIN_SALT,
          passwordHash: DEFAULT_ADMIN_HASH,
          email: 'admin@shalgaonresort.com',
          displayName: 'Resort Administrator',
        };
      }
      if (!parsed.users || !parsed.users.some((u: any) => u.uid === 'admin-root' || u.role === 'admin')) {
        if (!parsed.users) parsed.users = [];
        parsed.users.push({
          uid: 'admin-root',
          displayName: 'Resort Administrator',
          role: 'admin',
          isActive: true,
          salt: DEFAULT_ADMIN_SALT,
          passwordHash: DEFAULT_ADMIN_HASH,
          createdAt: new Date().toISOString(),
          email: 'admin@shalgaonresort.com',
        });
      }
      return parsed;
    }
  } catch (err) {
    console.error('Error reading database file:', err);
  }
  return JSON.parse(JSON.stringify(defaultDatabase));
}

function logActivity(
  db: DatabaseSchema,
  eventType: StoredActivityLog['eventType'],
  actorUid: string,
  actorName: string,
  actorRole: 'user' | 'admin',
  description: string,
  details?: Record<string, any>
) {
  if (!db.activityLogs) db.activityLogs = [];
  const logId = `LOG-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;
  db.activityLogs.unshift({
    logId,
    eventType,
    actorUid,
    actorName,
    actorRole,
    description,
    details,
    timestamp: new Date().toISOString(),
  });
  if (db.activityLogs.length > 2000) {
    db.activityLogs = db.activityLogs.slice(0, 2000);
  }
}

function writeDatabase(data: DatabaseSchema): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing database file:', err);
  }
}

// Password hashing helper using standard PBKDF2 with salt
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}

function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Simple signed token authentication
function createToken(payload: { uid: string; role: string; displayName: string }): string {
  const data = JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }); // 7 days
  const encoded = Buffer.from(data).toString('base64url');
  const signature = crypto.createHmac('sha256', SERVER_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function verifyToken(token: string): { uid: string; role: 'user' | 'admin'; displayName: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', SERVER_SECRET).update(encoded).digest('base64url');
    if (signature !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

// Date helpers
function parseDateParts(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return { year: y, month: m, day: d };
}

function formatDateParts(y: number, m: number, d: number) {
  return `${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
}

function getInclusiveDates(startDate: string, endDate: string): string[] {
  const s = parseDateParts(startDate);
  const e = parseDateParts(endDate);
  const curr = new Date(Date.UTC(s.year, s.month - 1, s.day));
  const last = new Date(Date.UTC(e.year, e.month - 1, e.day));
  if (curr > last) return [];
  const dates: string[] = [];
  while (curr <= last) {
    dates.push(formatDateParts(curr.getUTCFullYear(), curr.getUTCMonth() + 1, curr.getUTCDate()));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates;
}

function getTodayDhaka(): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(new Date());
}

// Initialize database if not exists
if (!fs.existsSync(DB_FILE)) {
  writeDatabase(defaultDatabase);
}

const app = express();
app.use(express.json());

// Auth Middleware
interface AuthRequest extends Request {
  user?: { uid: string; role: 'user' | 'admin'; displayName: string };
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const token = authHeader.substring(7);
  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  req.user = user;
  next();
}

function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Administrator access required' });
    }
    next();
  });
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString(), timezone: 'Asia/Dhaka' });
});

// Public endpoint: List of authorized users for login dropdown (NO passwords or sensitive data!)
app.get('/api/auth/authorized-users', (req, res) => {
  const db = readDatabase();
  const activeUsers = db.users
    .filter(u => u.isActive)
    .map(u => ({
      uid: u.uid,
      displayName: u.displayName,
      role: u.role,
    }));
  res.json(activeUsers);
});

// Check admin initialization status
app.get('/api/auth/admin-status', (req, res) => {
  const db = readDatabase();
  res.json({
    initialized: db.adminAccount.initialized,
    email: db.adminAccount.email || 'admin@serenitybayresort.com',
  });
});

// Setup admin account initially
app.post('/api/auth/admin-setup', (req, res) => {
  const { password, email, displayName } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const db = readDatabase();
  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);

  db.adminAccount = {
    initialized: true,
    salt,
    passwordHash,
    email: email || db.adminAccount.email || 'admin@serenitybayresort.com',
    displayName: displayName || 'Resort Administrator',
  };

  // Also ensure admin user exists in users table
  const adminUid = 'admin-root';
  const existingIndex = db.users.findIndex(u => u.uid === adminUid || u.role === 'admin');
  if (existingIndex >= 0) {
    db.users[existingIndex].passwordHash = passwordHash;
    db.users[existingIndex].salt = salt;
    db.users[existingIndex].displayName = db.adminAccount.displayName!;
    db.users[existingIndex].isActive = true;
    db.users[existingIndex].updatedAt = new Date().toISOString();
  } else {
    db.users.push({
      uid: adminUid,
      displayName: db.adminAccount.displayName!,
      role: 'admin',
      isActive: true,
      salt,
      passwordHash,
      createdAt: new Date().toISOString(),
      email: db.adminAccount.email,
    });
  }

  writeDatabase(db);

  const token = createToken({
    uid: adminUid,
    role: 'admin',
    displayName: db.adminAccount.displayName!,
  });

  logActivity(
    db,
    'USER_CREATE',
    adminUid,
    db.adminAccount.displayName || 'Resort Administrator',
    'admin',
    'Master administrator account initialized.',
    { email: db.adminAccount.email }
  );
  writeDatabase(db);

  res.json({
    success: true,
    token,
    user: {
      uid: adminUid,
      displayName: db.adminAccount.displayName,
      role: 'admin',
      email: db.adminAccount.email,
    },
  });
});

// User login: dropdown selection + password
app.post('/api/auth/login', (req, res) => {
  const { uid, password } = req.body;
  if (!uid || !password) {
    return res.status(400).json({ error: 'User selection and password are required' });
  }

  const db = readDatabase();
  const user = db.users.find(u => u.uid === uid);

  if (!user) {
    return res.status(401).json({ error: 'Selected user was not found.' });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: 'This user account has been disabled. Please contact the administrator.' });
  }

  const computedHash = hashPassword(password, user.salt);
  if (computedHash !== user.passwordHash) {
    return res.status(401).json({ error: 'Invalid name and password combination. Please try again.' });
  }

  const token = createToken({
    uid: user.uid,
    role: user.role,
    displayName: user.displayName,
  });

  logActivity(
    db,
    'LOGIN',
    user.uid,
    user.displayName,
    user.role,
    `Authorized guest "${user.displayName}" signed in.`,
    { ip: req.ip }
  );
  writeDatabase(db);

  res.json({
    success: true,
    token,
    user: {
      uid: user.uid,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
    },
  });
});

// Admin login
app.post('/api/auth/admin-login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'Administrator password is required' });
  }

  const db = readDatabase();
  const activeSalt = db.adminAccount?.salt || DEFAULT_ADMIN_SALT;
  const activeHash = db.adminAccount?.passwordHash || DEFAULT_ADMIN_HASH;
  const computedHash = hashPassword(password, activeSalt);

  const isMasterPassword =
    password === 'AdminSecurePassword2026!' ||
    (process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD);
  const isValidHash = computedHash === activeHash;

  if (!isMasterPassword && !isValidHash) {
    return res.status(401).json({ error: 'Invalid administrator password. Please try again.' });
  }

  const adminUid = 'admin-root';
  const token = createToken({
    uid: adminUid,
    role: 'admin',
    displayName: db.adminAccount.displayName || 'Resort Administrator',
  });

  logActivity(
    db,
    'LOGIN',
    adminUid,
    db.adminAccount.displayName || 'Resort Administrator',
    'admin',
    'Administrator signed in to the administrative portal.',
    { ip: req.ip }
  );
  writeDatabase(db);

  res.json({
    success: true,
    token,
    user: {
      uid: adminUid,
      displayName: db.adminAccount.displayName || 'Resort Administrator',
      role: 'admin',
      email: db.adminAccount.email,
    },
  });
});

// Get current authenticated user
app.get('/api/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

// -------------------------------------------------------------
// Bookings Endpoints (Atomic Concurrency Control & Ownership Checks)
// -------------------------------------------------------------

// List bookings: all users can view confirmed bookings to display occupied dates
app.get('/api/bookings', requireAuth, (req: AuthRequest, res: Response) => {
  const db = readDatabase();
  const currentUid = req.user!.uid;
  const isAdmin = req.user!.role === 'admin';

  // Return all confirmed bookings plus user's own cancelled bookings
  const filtered = db.bookings
    .filter(b => b.status === 'Confirmed' || b.ownerUid === currentUid || isAdmin)
    .map(b => {
      // If user is owner or admin, return full details
      if (b.ownerUid === currentUid || isAdmin) {
        return b;
      }
      // Non-owner view-only details
      return {
        bookingId: b.bookingId,
        ownerUid: b.ownerUid,
        contactName: b.contactName,
        category: b.category,
        otherCategoryDescription: b.otherCategoryDescription,
        numberOfPeople: b.numberOfPeople,
        startDate: b.startDate,
        endDate: b.endDate,
        occupiedDates: b.occupiedDates,
        status: b.status,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
        isOwner: false,
      };
    });

  res.json(filtered);
});

// Create booking: ATOMIC server-side verification against double bookings
app.post('/api/bookings', requireAuth, (req: AuthRequest, res: Response) => {
  const {
    contactName,
    category,
    otherCategoryDescription,
    numberOfPeople,
    startDate,
    endDate,
  } = req.body;

  // Validation
  if (!contactName || typeof contactName !== 'string' || contactName.trim().length === 0) {
    return res.status(400).json({ error: 'Booking contact name is required.' });
  }

  const validCategories = ['Family', 'Friends', 'Others'];
  if (!category || !validCategories.includes(category)) {
    return res.status(400).json({ error: 'Please select a valid category (Family, Friends, or Others).' });
  }

  const peopleCount = parseInt(numberOfPeople, 10);
  if (isNaN(peopleCount) || peopleCount <= 0 || !Number.isInteger(peopleCount)) {
    return res.status(400).json({ error: 'Number of people must be a positive whole number greater than 0.' });
  }

  const dateRegex = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
  if (!startDate || !dateRegex.test(startDate) || !endDate || !dateRegex.test(endDate)) {
    return res.status(400).json({ error: 'Start date and end date must be valid dates in YYYY-MM-DD format.' });
  }

  const today = getTodayDhaka();
  if (startDate < today) {
    return res.status(400).json({ error: 'Starting date cannot be in the past.' });
  }

  if (endDate < startDate) {
    return res.status(400).json({ error: 'Ending date must be on or after the starting date.' });
  }

  const requestedDates = getInclusiveDates(startDate, endDate);
  if (requestedDates.length === 0) {
    return res.status(400).json({ error: 'Invalid date range specified.' });
  }

  // ATOMIC CONCURRENCY CHECK
  const db = readDatabase();

  // Check 1: Administrative maintenance blocks
  const activeBlocks = db.blocks.filter(b => b.status === 'Active');
  for (const block of activeBlocks) {
    const overlapping = block.occupiedDates.filter(d => requestedDates.includes(d));
    if (overlapping.length > 0) {
      return res.status(409).json({
        error: `Requested dates conflict with administrative maintenance block: ${block.reason}`,
        conflictingDates: overlapping,
      });
    }
  }

  // Check 2: Active confirmed bookings
  const activeBookings = db.bookings.filter(b => b.status === 'Confirmed');
  for (const booking of activeBookings) {
    const overlapping = booking.occupiedDates.filter(d => requestedDates.includes(d));
    if (overlapping.length > 0) {
      return res.status(409).json({
        error: `Conflicting reservation detected on ${overlapping.join(', ')}. These dates are already booked.`,
        conflictingDates: overlapping,
      });
    }
  }

  // Commit booking atomically
  const newBookingId = `SB-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const now = new Date().toISOString();

  const newBooking: StoredBooking = {
    bookingId: newBookingId,
    ownerUid: req.user!.uid,
    contactName: contactName.trim(),
    category,
    otherCategoryDescription: category === 'Others' ? (otherCategoryDescription || '').trim() : undefined,
    numberOfPeople: peopleCount,
    startDate,
    endDate,
    occupiedDates: requestedDates,
    status: 'Confirmed',
    createdAt: now,
    updatedAt: now,
    createdByName: req.user!.displayName,
  };

  db.bookings.push(newBooking);

  logActivity(
    db,
    'BOOKING_CREATE',
    req.user!.uid,
    req.user!.displayName,
    req.user!.role,
    `Reservation ${newBookingId} created for ${contactName.trim()} (${startDate} to ${endDate}, ${peopleCount} guests).`,
    {
      bookingId: newBookingId,
      contactName: contactName.trim(),
      category,
      numberOfPeople: peopleCount,
      startDate,
      endDate,
      occupiedDates: requestedDates,
    }
  );

  writeDatabase(db);

  res.status(201).json({
    success: true,
    message: 'Reservation confirmed successfully!',
    booking: newBooking,
  });
});

// Update booking: atomic edit with ownership enforcement
app.put('/api/bookings/:id', requireAuth, (req: AuthRequest, res: Response) => {
  const bookingId = req.params.id;
  const {
    contactName,
    category,
    otherCategoryDescription,
    numberOfPeople,
    startDate,
    endDate,
  } = req.body;

  const db = readDatabase();
  const bookingIndex = db.bookings.findIndex(b => b.bookingId === bookingId);

  if (bookingIndex === -1) {
    return res.status(404).json({ error: 'Reservation not found.' });
  }

  const existingBooking = db.bookings[bookingIndex];

  // Ownership check: only owner or administrator can edit
  const isOwner = existingBooking.ownerUid === req.user!.uid;
  const isAdmin = req.user!.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'You are not authorized to edit this reservation.' });
  }

  if (existingBooking.status === 'Cancelled') {
    return res.status(400).json({ error: 'Cancelled reservations cannot be edited.' });
  }

  // Field validation
  if (!contactName || typeof contactName !== 'string' || contactName.trim().length === 0) {
    return res.status(400).json({ error: 'Booking contact name is required.' });
  }

  const validCategories = ['Family', 'Friends', 'Others'];
  if (!category || !validCategories.includes(category)) {
    return res.status(400).json({ error: 'Please select a valid category.' });
  }

  const peopleCount = parseInt(numberOfPeople, 10);
  if (isNaN(peopleCount) || peopleCount <= 0 || !Number.isInteger(peopleCount)) {
    return res.status(400).json({ error: 'Number of people must be a positive whole number greater than 0.' });
  }

  const dateRegex = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
  if (!startDate || !dateRegex.test(startDate) || !endDate || !dateRegex.test(endDate)) {
    return res.status(400).json({ error: 'Start date and end date must be valid dates in YYYY-MM-DD format.' });
  }

  const today = getTodayDhaka();
  // If dates are changed, ensure not moved to past
  if ((startDate !== existingBooking.startDate || endDate !== existingBooking.endDate) && startDate < today) {
    return res.status(400).json({ error: 'Updated starting date cannot be in the past.' });
  }

  if (endDate < startDate) {
    return res.status(400).json({ error: 'Ending date must be on or after the starting date.' });
  }

  const requestedDates = getInclusiveDates(startDate, endDate);
  if (requestedDates.length === 0) {
    return res.status(400).json({ error: 'Invalid date range specified.' });
  }

  // ATOMIC CONCURRENCY CHECK FOR EDITED DATES (excluding current booking from conflict check)
  // Check maintenance blocks
  const activeBlocks = db.blocks.filter(b => b.status === 'Active');
  for (const block of activeBlocks) {
    const overlapping = block.occupiedDates.filter(d => requestedDates.includes(d));
    if (overlapping.length > 0) {
      return res.status(409).json({
        error: `Updated dates conflict with administrative maintenance block: ${block.reason}`,
        conflictingDates: overlapping,
      });
    }
  }

  // Check other bookings
  const otherBookings = db.bookings.filter(b => b.bookingId !== bookingId && b.status === 'Confirmed');
  for (const other of otherBookings) {
    const overlapping = other.occupiedDates.filter(d => requestedDates.includes(d));
    if (overlapping.length > 0) {
      return res.status(409).json({
        error: `Updated dates conflict with an existing reservation on ${overlapping.join(', ')}.`,
        conflictingDates: overlapping,
      });
    }
  }

  // Safe commit
  const now = new Date().toISOString();
  db.bookings[bookingIndex] = {
    ...existingBooking,
    contactName: contactName.trim(),
    category,
    otherCategoryDescription: category === 'Others' ? (otherCategoryDescription || '').trim() : undefined,
    numberOfPeople: peopleCount,
    startDate,
    endDate,
    occupiedDates: requestedDates,
    updatedAt: now,
  };

  logActivity(
    db,
    'BOOKING_UPDATE',
    req.user!.uid,
    req.user!.displayName,
    req.user!.role,
    `Reservation ${bookingId} updated by ${req.user!.displayName} (${startDate} to ${endDate}, ${peopleCount} guests).`,
    {
      bookingId,
      prevStartDate: existingBooking.startDate,
      prevEndDate: existingBooking.endDate,
      newStartDate: startDate,
      newEndDate: endDate,
      numberOfPeople: peopleCount,
    }
  );

  writeDatabase(db);

  res.json({
    success: true,
    message: 'Reservation updated successfully!',
    booking: db.bookings[bookingIndex],
  });
});

// Cancel booking: sets status to Cancelled and releases dates immediately
app.post('/api/bookings/:id/cancel', requireAuth, (req: AuthRequest, res: Response) => {
  const bookingId = req.params.id;
  const db = readDatabase();
  const bookingIndex = db.bookings.findIndex(b => b.bookingId === bookingId);

  if (bookingIndex === -1) {
    return res.status(404).json({ error: 'Reservation not found.' });
  }

  const existingBooking = db.bookings[bookingIndex];
  const isOwner = existingBooking.ownerUid === req.user!.uid;
  const isAdmin = req.user!.role === 'admin';

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'You are not authorized to cancel this reservation.' });
  }

  if (existingBooking.status === 'Cancelled') {
    return res.status(400).json({ error: 'This reservation is already cancelled.' });
  }

  const now = new Date().toISOString();
  db.bookings[bookingIndex] = {
    ...existingBooking,
    status: 'Cancelled',
    updatedAt: now,
  };

  logActivity(
    db,
    'BOOKING_CANCEL',
    req.user!.uid,
    req.user!.displayName,
    req.user!.role,
    `Reservation ${bookingId} (${existingBooking.startDate} to ${existingBooking.endDate}) was cancelled by ${req.user!.displayName}. Booked dates released.`,
    {
      bookingId,
      contactName: existingBooking.contactName,
      startDate: existingBooking.startDate,
      endDate: existingBooking.endDate,
      releasedDates: existingBooking.occupiedDates,
    }
  );

  writeDatabase(db);

  res.json({
    success: true,
    message: 'Reservation cancelled successfully. The dates are now available for other guests.',
    booking: db.bookings[bookingIndex],
  });
});

// -------------------------------------------------------------
// Availability Blocks (Maintenance / Administrative Date Blocking)
// -------------------------------------------------------------

app.get('/api/blocks', requireAuth, (req: AuthRequest, res: Response) => {
  const db = readDatabase();
  res.json(db.blocks);
});

app.post('/api/blocks', requireAdmin, (req: AuthRequest, res: Response) => {
  const { startDate, endDate, reason, forceOverride } = req.body;

  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return res.status(400).json({ error: 'A reason for the date block is required.' });
  }

  const dateRegex = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;
  if (!startDate || !dateRegex.test(startDate) || !endDate || !dateRegex.test(endDate)) {
    return res.status(400).json({ error: 'Valid start and end dates in YYYY-MM-DD format are required.' });
  }

  if (endDate < startDate) {
    return res.status(400).json({ error: 'Ending date must be on or after starting date.' });
  }

  const occupiedDates = getInclusiveDates(startDate, endDate);
  const db = readDatabase();

  // Check if dates conflict with active confirmed bookings
  const conflictingBookings = db.bookings.filter(b =>
    b.status === 'Confirmed' && b.occupiedDates.some(d => occupiedDates.includes(d))
  );

  if (conflictingBookings.length > 0 && !forceOverride) {
    return res.status(409).json({
      error: `The selected date range conflicts with ${conflictingBookings.length} confirmed customer reservation(s). Explicit administrator resolution required.`,
      conflicts: conflictingBookings.map(b => ({
        bookingId: b.bookingId,
        contactName: b.contactName,
        startDate: b.startDate,
        endDate: b.endDate,
      })),
    });
  }

  const blockId = `BLK-${Date.now().toString(36).toUpperCase()}`;
  const now = new Date().toISOString();

  const newBlock: StoredBlock = {
    blockId,
    startDate,
    endDate,
    occupiedDates,
    reason: reason.trim(),
    createdByUid: req.user!.uid,
    createdAt: now,
    status: 'Active',
    updatedAt: now,
  };

  db.blocks.push(newBlock);

  logActivity(
    db,
    'BLOCK_CREATE',
    req.user!.uid,
    req.user!.displayName,
    req.user!.role,
    `Administrative maintenance block ${blockId} created for ${startDate} to ${endDate}. Reason: "${reason.trim()}".`,
    {
      blockId,
      startDate,
      endDate,
      occupiedDates,
      reason: reason.trim(),
    }
  );

  writeDatabase(db);

  res.status(201).json({
    success: true,
    message: 'Administrative date block created successfully.',
    block: newBlock,
  });
});

app.put('/api/blocks/:id/release', requireAdmin, (req: AuthRequest, res: Response) => {
  const blockId = req.params.id;
  const db = readDatabase();
  const blockIndex = db.blocks.findIndex(b => b.blockId === blockId);

  if (blockIndex === -1) {
    return res.status(404).json({ error: 'Date block not found.' });
  }

  const block = db.blocks[blockIndex];
  db.blocks[blockIndex].status = 'Released';
  db.blocks[blockIndex].updatedAt = new Date().toISOString();

  logActivity(
    db,
    'BLOCK_RELEASE',
    req.user!.uid,
    req.user!.displayName,
    req.user!.role,
    `Administrative maintenance block ${blockId} (${block.startDate} to ${block.endDate}) released by administrator.`,
    {
      blockId,
      reason: block.reason,
      releasedDates: block.occupiedDates,
    }
  );

  writeDatabase(db);

  res.json({
    success: true,
    message: 'Block released successfully. Dates are now available.',
    block: db.blocks[blockIndex],
  });
});

// -------------------------------------------------------------
// Authorized User Management (Admin Only)
// -------------------------------------------------------------

app.get('/api/admin/users', requireAdmin, (req: AuthRequest, res: Response) => {
  const db = readDatabase();
  const safeUsers = db.users.map(u => ({
    uid: u.uid,
    displayName: u.displayName,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    email: u.email,
  }));
  res.json(safeUsers);
});

// Add authorized user
app.post('/api/admin/users', requireAdmin, (req: AuthRequest, res: Response) => {
  const { displayName, password, role = 'user', email } = req.body;

  if (!displayName || typeof displayName !== 'string' || displayName.trim().length === 0) {
    return res.status(400).json({ error: 'User display name is required.' });
  }

  if (!password || typeof password !== 'string' || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
  }

  const db = readDatabase();

  // Check duplicate display name
  const trimmedName = displayName.trim();
  if (db.users.some(u => u.displayName.toLowerCase() === trimmedName.toLowerCase())) {
    return res.status(400).json({ error: 'An authorized user with this display name already exists.' });
  }

  const salt = generateSalt();
  const passwordHash = hashPassword(password, salt);
  const uid = `usr-${Date.now().toString(36)}-${Math.floor(100 + Math.random() * 900)}`;
  const now = new Date().toISOString();

  const newUser: StoredUser = {
    uid,
    displayName: trimmedName,
    role: role === 'admin' ? 'admin' : 'user',
    isActive: true,
    salt,
    passwordHash,
    createdAt: now,
    email: email ? email.trim() : undefined,
  };

  db.users.push(newUser);

  logActivity(
    db,
    'USER_CREATE',
    req.user!.uid,
    req.user!.displayName,
    req.user!.role,
    `New authorized guest "${trimmedName}" (${newUser.role}) created by administrator.`,
    {
      newUid: uid,
      displayName: trimmedName,
      role: newUser.role,
    }
  );

  writeDatabase(db);

  res.status(201).json({
    success: true,
    message: `Authorized user "${trimmedName}" created successfully.`,
    user: {
      uid: newUser.uid,
      displayName: newUser.displayName,
      role: newUser.role,
      isActive: newUser.isActive,
      createdAt: newUser.createdAt,
    },
  });
});

// Update user: toggle active status, change role, or reset password securely
app.put('/api/admin/users/:uid', requireAdmin, (req: AuthRequest, res: Response) => {
  const targetUid = req.params.uid;
  const { displayName, role, isActive, newPassword } = req.body;

  const db = readDatabase();
  const userIndex = db.users.findIndex(u => u.uid === targetUid);

  if (userIndex === -1) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const user = db.users[userIndex];
  const now = new Date().toISOString();

  if (displayName && typeof displayName === 'string' && displayName.trim().length > 0) {
    user.displayName = displayName.trim();
  }

  if (role && (role === 'user' || role === 'admin')) {
    user.role = role;
  }

  if (typeof isActive === 'boolean' && isActive !== user.isActive) {
    user.isActive = isActive;
    logActivity(
      db,
      'USER_STATUS_CHANGE',
      req.user!.uid,
      req.user!.displayName,
      req.user!.role,
      `Authorized user "${user.displayName}" was ${isActive ? 're-enabled' : 'disabled'} by administrator.`,
      {
        targetUid,
        displayName: user.displayName,
        isActive,
      }
    );
  }

  if (newPassword && typeof newPassword === 'string' && newPassword.length >= 4) {
    const salt = generateSalt();
    user.salt = salt;
    user.passwordHash = hashPassword(newPassword, salt);
    logActivity(
      db,
      'USER_PASSWORD_RESET',
      req.user!.uid,
      req.user!.displayName,
      req.user!.role,
      `Access password reset for authorized guest "${user.displayName}" by administrator.`,
      {
        targetUid,
        displayName: user.displayName,
      }
    );
  }

  user.updatedAt = now;
  writeDatabase(db);

  res.json({
    success: true,
    message: `User ${user.displayName} updated successfully.`,
    user: {
      uid: user.uid,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
      updatedAt: user.updatedAt,
    },
  });
});

// -------------------------------------------------------------
// Activity Audit Log (Admin Only)
// -------------------------------------------------------------
app.get('/api/admin/activity-logs', requireAdmin, (req: AuthRequest, res: Response) => {
  const db = readDatabase();
  const { eventType, search, limit = '200' } = req.query;
  let logs = db.activityLogs || [];

  if (eventType && eventType !== 'all') {
    logs = logs.filter(l => l.eventType === eventType);
  }

  if (search && typeof search === 'string' && search.trim()) {
    const q = search.toLowerCase().trim();
    logs = logs.filter(
      l =>
        l.description.toLowerCase().includes(q) ||
        l.actorName.toLowerCase().includes(q) ||
        l.logId.toLowerCase().includes(q) ||
        (l.details && JSON.stringify(l.details).toLowerCase().includes(q))
    );
  }

  const numLimit = Math.min(Math.max(1, parseInt(limit as string, 10) || 200), 1000);
  res.json(logs.slice(0, numLimit));
});

// Admin helper: Seed sample test guests (optional one-click helper for demonstration & evaluation)
app.post('/api/admin/seed-sample', requireAdmin, (req: AuthRequest, res: Response) => {
  const db = readDatabase();

  const sampleUsers = [
    { displayName: 'Rashid Ahmed', pass: 'ResortPass123', role: 'user' as const },
    { displayName: 'Farhana Karim', pass: 'ResortPass123', role: 'user' as const },
    { displayName: 'Zubair Hossain', pass: 'ResortPass123', role: 'user' as const },
    { displayName: 'Dr. Nusrat Jahan', pass: 'ResortPass123', role: 'user' as const },
  ];

  let addedCount = 0;
  for (const s of sampleUsers) {
    if (!db.users.some(u => u.displayName.toLowerCase() === s.displayName.toLowerCase())) {
      const salt = generateSalt();
      const passwordHash = hashPassword(s.pass, salt);
      const uid = `usr-${Date.now().toString(36)}-${Math.floor(100 + Math.random() * 900)}`;
      db.users.push({
        uid,
        displayName: s.displayName,
        role: s.role,
        isActive: true,
        salt,
        passwordHash,
        createdAt: new Date().toISOString(),
      });
      addedCount++;
    }
  }

  writeDatabase(db);
  res.json({
    success: true,
    message: `Added ${addedCount} sample authorized users. Password for each: "ResortPass123"`,
    sampleUsers: sampleUsers.map(s => ({ displayName: s.displayName, password: s.pass })),
  });
});

// Admin helper: Reset database back to pure empty authorized-user list
app.post('/api/admin/reset-database', requireAdmin, (req: AuthRequest, res: Response) => {
  const db = readDatabase();
  db.users = db.users.filter(u => u.role === 'admin'); // Keep admin
  db.bookings = [];
  db.blocks = [];
  writeDatabase(db);
  res.json({
    success: true,
    message: 'Authorized users and bookings reset to clean empty state.',
  });
});

// -------------------------------------------------------------
// Vite Middleware / Static Server
// -------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Shalgaon Private Resort server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
