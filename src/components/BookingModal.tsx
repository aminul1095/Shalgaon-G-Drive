import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Users,
  User,
  Tag,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Booking, AvailabilityBlock, BookingCategory, UserProfile } from '../lib/types';
import {
  getInclusiveDateRange,
  formatDisplayDate,
  getTodayString,
  isDateInPast,
} from '../lib/dateUtils';
import { api } from '../lib/api';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (booking: Booking) => void;
  currentUser: UserProfile;
  initialDate?: string;
  editingBooking?: Booking | null;
  existingBookings: Booking[];
  existingBlocks: AvailabilityBlock[];
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  currentUser,
  initialDate,
  editingBooking,
  existingBookings,
  existingBlocks,
}) => {
  const todayStr = getTodayString();
  const isEditing = !!editingBooking;

  // Form states
  const [contactName, setContactName] = useState<string>('');
  const [category, setCategory] = useState<BookingCategory>('Family');
  const [otherDescription, setOtherDescription] = useState<string>('');
  const [numberOfPeople, setNumberOfPeople] = useState<number>(2);
  const [startDate, setStartDate] = useState<string>(todayStr);
  const [endDate, setEndDate] = useState<string>(todayStr);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Initialize form fields
  useEffect(() => {
    if (editingBooking) {
      setContactName(editingBooking.contactName);
      setCategory(editingBooking.category);
      setOtherDescription(editingBooking.otherCategoryDescription || '');
      setNumberOfPeople(editingBooking.numberOfPeople);
      setStartDate(editingBooking.startDate);
      setEndDate(editingBooking.endDate);
    } else {
      setContactName(currentUser.displayName || '');
      setCategory('Family');
      setOtherDescription('');
      setNumberOfPeople(2);
      const defaultDate = initialDate && !isDateInPast(initialDate) ? initialDate : todayStr;
      setStartDate(defaultDate);
      setEndDate(defaultDate);
    }
    setErrorMessage(null);
  }, [editingBooking, initialDate, currentUser, isOpen]);

  if (!isOpen) return null;

  // Calculate requested date range
  const requestedDates = getInclusiveDateRange(startDate, endDate);
  const totalDays = requestedDates.length;

  // Real-time conflict checking
  const conflictingDates: { date: string; reason: string }[] = [];

  for (const d of requestedDates) {
    if (isDateInPast(d)) {
      conflictingDates.push({ date: d, reason: 'Date is in the past' });
      continue;
    }

    // Check maintenance blocks
    const block = existingBlocks.find(
      (b) => b.status === 'Active' && b.occupiedDates.includes(d)
    );
    if (block) {
      conflictingDates.push({ date: d, reason: `Resort Maintenance: ${block.reason}` });
      continue;
    }

    // Check other bookings (exclude the one currently being edited!)
    const bookingConflict = existingBookings.find(
      (b) =>
        b.status === 'Confirmed' &&
        (!isEditing || b.bookingId !== editingBooking.bookingId) &&
        b.occupiedDates.includes(d)
    );

    if (bookingConflict) {
      conflictingDates.push({
        date: d,
        reason: `Reserved by ${bookingConflict.contactName}`,
      });
    }
  }

  const hasConflicts = conflictingDates.length > 0;

  const handleClearForm = () => {
    setContactName(currentUser.displayName || '');
    setCategory('Family');
    setOtherDescription('');
    setNumberOfPeople(2);
    setStartDate(todayStr);
    setEndDate(todayStr);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    if (!contactName.trim()) {
      setErrorMessage('Booking contact name is required.');
      return;
    }

    if (!numberOfPeople || numberOfPeople <= 0 || !Number.isInteger(Number(numberOfPeople))) {
      setErrorMessage('Number of people must be a positive whole number greater than 0.');
      return;
    }

    if (!startDate || !endDate) {
      setErrorMessage('Please select both starting and ending dates.');
      return;
    }

    if (endDate < startDate) {
      setErrorMessage('Ending date must be on or after the starting date.');
      return;
    }

    if (hasConflicts) {
      setErrorMessage(
        `Selected dates cannot be booked because of conflicts on: ${conflictingDates
          .map((c) => formatDisplayDate(c.date))
          .join(', ')}`
      );
      return;
    }

    setIsLoading(true);
    try {
      const payload = {
        contactName: contactName.trim(),
        category,
        otherCategoryDescription: category === 'Others' ? otherDescription.trim() : undefined,
        numberOfPeople: Number(numberOfPeople),
        startDate,
        endDate,
      };

      let result;
      if (isEditing) {
        result = await api.updateBooking(editingBooking.bookingId, payload);
      } else {
        result = await api.createBooking(payload);
      }

      onSuccess(result.booking);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save reservation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">
                {isEditing ? 'Edit Reservation' : 'New Resort Reservation'}
              </h2>
              <span className="text-xs text-slate-300">
                {isEditing ? `Modifying ${editingBooking.bookingId}` : 'Shalgaon Private Resort'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div className="leading-relaxed font-medium">{errorMessage}</div>
            </div>
          )}

          {/* Field 1: Contact Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Field 1: Booking Contact Name <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Full name for reservation"
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
              />
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Account identity: <strong>{currentUser.displayName}</strong> ({currentUser.uid})
            </p>
          </div>

          {/* Field 2 & 3: Category & Number of People */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Field 2: Category of People <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as BookingCategory)}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-8 text-sm text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                >
                  <option value="Family">Family</option>
                  <option value="Friends">Friends</option>
                  <option value="Others">Others</option>
                </select>
                <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Field 3: Number of People <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max="100"
                  step="1"
                  required
                  value={numberOfPeople}
                  onChange={(e) => setNumberOfPeople(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
                />
                <Users className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Positive whole number of guests</p>
            </div>
          </div>

          {/* Optional description for 'Others' category */}
          {category === 'Others' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Describe Group Details
              </label>
              <input
                type="text"
                value={otherDescription}
                onChange={(e) => setOtherDescription(e.target.value)}
                placeholder="e.g., Corporate Retreat, Photography Workshop"
                className="w-full rounded-xl border border-slate-300 bg-white py-2 px-3 text-sm text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
              />
            </div>
          )}

          {/* Field 4 & 5: Starting Date & Ending Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Field 4: Starting Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                min={todayStr}
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (e.target.value > endDate) {
                    setEndDate(e.target.value);
                  }
                }}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3.5 text-sm text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Field 5: Ending Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                min={startDate || todayStr}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3.5 text-sm text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 focus:outline-none"
              />
            </div>
          </div>

          {/* Conflict Alert Banner if overlapping */}
          {hasConflicts && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Date Range Unavailable:
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                {conflictingDates.map((c, i) => (
                  <li key={i}>
                    <strong>{formatDisplayDate(c.date)}</strong>: {c.reason}
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-amber-700 pt-1">
                Please select different dates that do not overlap with existing confirmed reservations.
              </p>
            </div>
          )}

          {/* Booking Summary Box (Section 5 Requirement) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-700 font-bold uppercase tracking-wider text-[11px] pb-1 border-b border-slate-200">
              <span>Booking Summary</span>
              <span className="text-emerald-700 font-semibold lowercase">
                {totalDays} {totalDays === 1 ? 'day' : 'consecutive days'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <div>
                <span className="text-slate-400 block">Contact Name:</span>
                <span className="font-semibold text-slate-800">{contactName || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Category:</span>
                <span className="font-semibold text-slate-800">{category}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Number of Guests:</span>
                <span className="font-semibold text-slate-800">{numberOfPeople} people</span>
              </div>
              <div>
                <span className="text-slate-400 block">Reservation Period:</span>
                <span className="font-semibold text-slate-800">
                  {formatDisplayDate(startDate)} → {formatDisplayDate(endDate)}
                </span>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 pt-1 italic">
              All dates between starting date and ending date inclusive will be reserved.
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleClearForm}
              className="text-xs text-slate-500 hover:text-slate-800 font-medium underline"
            >
              Clear Form
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
              >
                Cancel / Back
              </button>

              <button
                type="submit"
                disabled={isLoading || hasConflicts || !contactName.trim()}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-md transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    {isEditing ? 'Confirm Changes' : 'Save Booking'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
