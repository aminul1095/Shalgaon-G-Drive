import React, { useState } from 'react';
import {
  Calendar,
  Search,
  Filter,
  Eye,
  Edit3,
  Trash2,
  Clock,
  Users,
  Tag,
  CheckCircle,
  XCircle,
  PlusCircle,
} from 'lucide-react';
import { Booking, UserProfile } from '../lib/types';
import { formatDisplayDate, getTodayString } from '../lib/dateUtils';

interface MyBookingsViewProps {
  currentUser: UserProfile;
  bookings: Booking[];
  onViewBooking: (booking: Booking) => void;
  onEditBooking: (booking: Booking) => void;
  onCancelBooking: (booking: Booking) => void;
  onNewBookingClick: () => void;
}

type BookingFilterTab = 'all' | 'upcoming' | 'past' | 'cancelled';

export const MyBookingsView: React.FC<MyBookingsViewProps> = ({
  currentUser,
  bookings,
  onViewBooking,
  onEditBooking,
  onCancelBooking,
  onNewBookingClick,
}) => {
  const [activeTab, setActiveTab] = useState<BookingFilterTab>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const todayStr = getTodayString();

  // Filter bookings owned by this user
  const userBookings = bookings.filter((b) => b.ownerUid === currentUser.uid);

  // Categorize
  const upcomingBookings = userBookings.filter(
    (b) => b.status === 'Confirmed' && b.endDate >= todayStr
  );
  const pastBookings = userBookings.filter(
    (b) => b.status === 'Confirmed' && b.endDate < todayStr
  );
  const cancelledBookings = userBookings.filter((b) => b.status === 'Cancelled');

  let filteredList = userBookings;
  if (activeTab === 'upcoming') filteredList = upcomingBookings;
  else if (activeTab === 'past') filteredList = pastBookings;
  else if (activeTab === 'cancelled') filteredList = cancelledBookings;

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    filteredList = filteredList.filter(
      (b) =>
        b.bookingId.toLowerCase().includes(q) ||
        b.contactName.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.startDate.includes(q) ||
        b.endDate.includes(q)
    );
  }

  // Sort: upcoming nearest first, past latest first
  filteredList.sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            My Reservations
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your personal private resort bookings, view itinerary details, or make updates.
          </p>
        </div>

        <button
          onClick={onNewBookingClick}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-md transition-all self-start sm:self-auto cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          Create New Booking
        </button>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Bookings ({userBookings.length})
          </button>

          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'upcoming'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Upcoming ({upcomingBookings.length})
          </button>

          <button
            onClick={() => setActiveTab('past')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'past'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Past ({pastBookings.length})
          </button>

          <button
            onClick={() => setActiveTab('cancelled')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === 'cancelled'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Cancelled ({cancelledBookings.length})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by ID or name..."
            className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
        </div>
      </div>

      {/* Bookings List */}
      {filteredList.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center mb-4">
            <Calendar className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Reservations Found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            {activeTab === 'all'
              ? 'You do not have any bookings yet. Head to the calendar to select available dates!'
              : `No ${activeTab} reservations matched your search filter.`}
          </p>
          <button
            onClick={onNewBookingClick}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            Book Your Stay
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map((b) => {
            const isConfirmed = b.status === 'Confirmed';
            const isPast = b.endDate < todayStr;
            const canModify = isConfirmed && !isPast;
            const duration = b.occupiedDates.length;

            return (
              <div
                key={b.bookingId}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: ID & Status */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">
                      {b.bookingId}
                    </span>

                    {isConfirmed ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                        Confirmed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                        <XCircle className="w-3.5 h-3.5" />
                        Cancelled
                      </span>
                    )}
                  </div>

                  {/* Dates Range */}
                  <div className="py-3">
                    <div className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <span>{formatDisplayDate(b.startDate)}</span>
                      <span className="text-slate-400 font-normal">→</span>
                      <span>{formatDisplayDate(b.endDate)}</span>
                    </div>
                    <span className="text-xs text-slate-500 mt-0.5 block">
                      {duration} {duration === 1 ? 'day' : 'consecutive days'} reserved
                    </span>
                  </div>

                  {/* Meta Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs py-2 bg-slate-50 rounded-xl px-3 border border-slate-100 mb-4">
                    <div>
                      <span className="text-slate-400 block">Contact:</span>
                      <span className="font-semibold text-slate-800 truncate block">
                        {b.contactName}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Party Size:</span>
                      <span className="font-semibold text-slate-800">
                        {b.numberOfPeople} {b.numberOfPeople === 1 ? 'Guest' : 'Guests'} ({b.category})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    onClick={() => onViewBooking(b)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Details
                  </button>

                  {canModify && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onEditBooking(b)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => onCancelBooking(b)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
