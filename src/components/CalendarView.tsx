import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Calendar as CalendarIcon,
  Clock,
  Sparkles,
  Wrench,
  User,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { Booking, AvailabilityBlock, UserProfile } from '../lib/types';
import {
  generateCalendarGrid,
  formatDisplayMonth,
  getTodayString,
  isDateInPast,
  formatDisplayDate,
  CalendarCell,
} from '../lib/dateUtils';

interface CalendarViewProps {
  user: UserProfile;
  bookings: Booking[];
  blocks: AvailabilityBlock[];
  onSelectAvailableDate: (dateStr: string) => void;
  onSelectBookedDate: (booking: Booking) => void;
  onSelectBlockedDate: (block: AvailabilityBlock) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  user,
  bookings,
  blocks,
  onSelectAvailableDate,
  onSelectBookedDate,
  onSelectBlockedDate,
  onRefresh,
  isLoading = false,
}) => {
  // Current local time is Oct 2026 as per metadata
  const todayStr = getTodayString();
  const [currentYear, setCurrentYear] = useState<number>(() => {
    const parts = todayStr.split('-').map(Number);
    return parts[0] || 2026;
  });
  const [currentMonth, setCurrentMonth] = useState<number>(() => {
    const parts = todayStr.split('-').map(Number);
    return parts[1] || 10; // 1-12
  });

  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleJumpToToday = () => {
    const parts = todayStr.split('-').map(Number);
    setCurrentYear(parts[0]);
    setCurrentMonth(parts[1]);
  };

  // Generate grid cells
  const cells = generateCalendarGrid(currentYear, currentMonth);

  // Map occupied dates to bookings and blocks for O(1) lookup
  const confirmedBookings = bookings.filter((b) => b.status === 'Confirmed');
  const activeBlocks = blocks.filter((b) => b.status === 'Active');

  const bookingMap = new Map<string, Booking>();
  for (const b of confirmedBookings) {
    for (const d of b.occupiedDates) {
      bookingMap.set(d, b);
    }
  }

  const blockMap = new Map<string, AvailabilityBlock>();
  for (const blk of activeBlocks) {
    for (const d of blk.occupiedDates) {
      blockMap.set(d, blk);
    }
  }

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Welcome & Resort Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 rounded-2xl p-5 sm:p-7 text-white shadow-xl border border-emerald-800/40 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold uppercase tracking-wider border border-emerald-400/30 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Private Resort Reservation System
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Welcome, {user.displayName}
            </h1>
            <p className="text-emerald-200/80 text-sm mt-1 max-w-xl">
              Select any green available date on the calendar below to create your single or multi-day reservation.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => onSelectAvailableDate(todayStr)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              Book Dates
            </button>
            <button
              onClick={onRefresh}
              title="Refresh availability"
              className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-emerald-300 border border-slate-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Calendar Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        
        {/* Month Navigation & Controls Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {formatDisplayMonth(currentYear, currentMonth)}
              </h2>
              <span className="text-xs text-slate-500">Asia/Dhaka Resort Time (UTC+6)</span>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <button
              onClick={handleJumpToToday}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold shadow-xs transition-colors"
            >
              Current Month
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrevMonth}
                aria-label="Previous Month"
                className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 shadow-xs transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleNextMonth}
                aria-label="Next Month"
                className="p-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 hover:text-slate-900 shadow-xs transition-colors cursor-pointer"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid Container */}
        <div className="p-3 sm:p-6">
          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
            {weekdays.map((day, idx) => (
              <div
                key={day}
                className={`text-center py-2 text-xs font-bold uppercase tracking-wider ${
                  idx === 0 || idx === 6 ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.charAt(0)}</span>
              </div>
            ))}
          </div>

          {/* Day Cells Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {cells.map((cell) => {
              const booking = bookingMap.get(cell.dateString);
              const block = blockMap.get(cell.dateString);
              const isPast = cell.isPast;
              const isBooked = !!booking;
              const isBlocked = !!block;
              const isAvailable = !isPast && !isBooked && !isBlocked && cell.isCurrentMonth;
              const isUserBooking = isBooked && booking.ownerUid === user.uid;

              // Compute cell classes based on Section 4 colour rules:
              // GREEN: Available (light green bg, dark green text)
              // RED: Booked (red bg, high contrast text)
              // PAST: Visually muted (not available for new booking, but past bookings remain visible)
              // BLOCKED: Amber/maintenance

              let cellClasses = 'relative h-16 sm:h-24 p-1.5 sm:p-2 rounded-xl transition-all flex flex-col justify-between text-left select-none ';

              if (isBooked) {
                // RED — Booked
                cellClasses += 'bg-rose-600 text-white font-medium hover:bg-rose-700 shadow-xs cursor-pointer ';
                if (isUserBooking) {
                  cellClasses += 'ring-2 ring-rose-400 ring-offset-1 ';
                }
              } else if (isBlocked) {
                // BLOCKED — Maintenance
                cellClasses += 'bg-amber-100 text-amber-950 border border-amber-300 hover:bg-amber-200/80 cursor-pointer ';
              } else if (isPast) {
                // PAST — Unavailable
                cellClasses += 'bg-slate-100 text-slate-400 border border-slate-200/60 cursor-not-allowed opacity-75 ';
              } else if (isAvailable) {
                // GREEN — Available
                cellClasses += 'bg-emerald-100/90 text-emerald-950 border border-emerald-300 hover:bg-emerald-200 hover:shadow-sm cursor-pointer font-medium active:scale-98 ';
              } else {
                // Trailing/leading month days that are not current month
                cellClasses += 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed opacity-50 ';
              }

              return (
                <div
                  key={cell.dateString}
                  onClick={() => {
                    if (isBooked) {
                      onSelectBookedDate(booking!);
                    } else if (isBlocked) {
                      onSelectBlockedDate(block!);
                    } else if (isAvailable) {
                      onSelectAvailableDate(cell.dateString);
                    }
                  }}
                  onMouseEnter={() => setHoveredDate(cell.dateString)}
                  onMouseLeave={() => setHoveredDate(null)}
                  className={cellClasses}
                >
                  {/* Day Number and Badges */}
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs sm:text-sm font-bold rounded-md px-1 py-0.5 ${
                        cell.isToday
                          ? isBooked
                            ? 'bg-white text-rose-700 font-extrabold'
                            : 'bg-emerald-700 text-white font-extrabold'
                          : ''
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {/* Today indicator */}
                    {cell.isToday && (
                      <span className="hidden sm:inline-block text-[10px] font-extrabold tracking-wider uppercase px-1 rounded bg-black/20">
                        Today
                      </span>
                    )}

                    {/* User's own booking star/badge */}
                    {isUserBooking && (
                      <span className="w-2 h-2 rounded-full bg-white shadow-xs" title="Your Booking" />
                    )}
                  </div>

                  {/* Cell Content / Status Labels */}
                  <div className="mt-auto overflow-hidden">
                    {isBooked ? (
                      <div className="truncate">
                        <span className="block text-[10px] sm:text-xs font-semibold truncate leading-tight">
                          {booking!.contactName}
                        </span>
                        <span className="hidden sm:block text-[9px] text-rose-100 opacity-90 truncate">
                          {booking!.category} ({booking!.numberOfPeople}p)
                        </span>
                      </div>
                    ) : isBlocked ? (
                      <div className="truncate flex items-center gap-1 text-amber-900">
                        <Wrench className="w-3 h-3 shrink-0" />
                        <span className="hidden sm:inline text-[10px] font-semibold truncate">
                          {block!.reason}
                        </span>
                        <span className="sm:hidden text-[9px] font-bold">Maint.</span>
                      </div>
                    ) : isPast ? (
                      <span className="text-[10px] text-slate-400 font-normal">Past</span>
                    ) : isAvailable ? (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] sm:text-xs font-semibold text-emerald-800">
                          Available
                        </span>
                        <span className="hidden sm:inline text-[10px] text-emerald-600 font-medium">
                          Click to book
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend Below the Calendar (Section 4 Requirement) */}
        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50/70">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
            <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Calendar Legend:
            </span>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              {/* Green: Available */}
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-emerald-100 border border-emerald-300" />
                <span className="text-slate-700 font-medium">Available for Booking</span>
              </div>
              {/* Red: Booked */}
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-rose-600 shadow-xs" />
                <span className="text-slate-700 font-medium">Booked / Occupied</span>
              </div>
              {/* Blue: Selection */}
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-blue-50 border-2 border-blue-600" />
                <span className="text-slate-700 font-medium">Selected Dates</span>
              </div>
              {/* Gray: Past */}
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-slate-200 border border-slate-300" />
                <span className="text-slate-500 font-medium">Past Dates (Unavailable)</span>
              </div>
              {/* Amber: Maintenance */}
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-md bg-amber-100 border border-amber-300" />
                <span className="text-amber-900 font-medium">Maintenance Block</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
