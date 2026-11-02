import React from 'react';
import {
  X,
  Calendar,
  User,
  Users,
  Tag,
  Clock,
  ShieldCheck,
  Edit3,
  Trash2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Hash,
} from 'lucide-react';
import { Booking, UserProfile } from '../lib/types';
import { formatDisplayDate } from '../lib/dateUtils';

interface BookingDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  currentUser: UserProfile;
  onEdit: (booking: Booking) => void;
  onCancelRequest: (booking: Booking) => void;
}

export const BookingDetailsModal: React.FC<BookingDetailsModalProps> = ({
  isOpen,
  onClose,
  booking,
  currentUser,
  onEdit,
  onCancelRequest,
}) => {
  if (!isOpen || !booking) return null;

  const isOwner = booking.ownerUid === currentUser.uid;
  const isAdmin = currentUser.role === 'admin';
  const canModify = (isOwner || isAdmin) && booking.status === 'Confirmed';

  const totalNights = booking.occupiedDates.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${booking.status === 'Confirmed' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'bg-slate-800 text-slate-400'}`}>
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Reservation Details
              </h2>
              <span className="text-xs text-slate-400">ID: {booking.bookingId}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Status Badge */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Booking Status
            </span>
            {booking.status === 'Confirmed' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                Confirmed &amp; Occupied
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                <XCircle className="w-3.5 h-3.5" />
                Cancelled
              </span>
            )}
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {/* Contact Name */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <span className="text-xs font-medium text-slate-400 block mb-1">
                Booking Contact Name
              </span>
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <User className="w-4 h-4 text-emerald-600" />
                <span>{booking.contactName}</span>
              </div>
            </div>

            {/* Category */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <span className="text-xs font-medium text-slate-400 block mb-1">
                Category of People
              </span>
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Tag className="w-4 h-4 text-emerald-600" />
                <span>{booking.category}</span>
                {booking.otherCategoryDescription && (
                  <span className="text-xs text-slate-500 font-normal">
                    ({booking.otherCategoryDescription})
                  </span>
                )}
              </div>
            </div>

            {/* Guests */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <span className="text-xs font-medium text-slate-400 block mb-1">
                Number of People
              </span>
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>{booking.numberOfPeople} Guests</span>
              </div>
            </div>

            {/* Total Duration */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <span className="text-xs font-medium text-slate-400 block mb-1">
                Reservation Duration
              </span>
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Clock className="w-4 h-4 text-emerald-600" />
                <span>{totalNights} {totalNights === 1 ? 'Day' : 'Days'}</span>
              </div>
            </div>
          </div>

          {/* Dates Highlight Box */}
          <div className="bg-rose-50/60 border border-rose-200/80 rounded-xl p-4 space-y-1.5">
            <span className="text-xs font-semibold text-rose-900 uppercase tracking-wider block">
              Occupied Dates Range
            </span>
            <div className="text-base font-bold text-rose-950 flex flex-wrap items-center gap-2">
              <span>{formatDisplayDate(booking.startDate)}</span>
              <span className="text-rose-400 font-normal">→</span>
              <span>{formatDisplayDate(booking.endDate)}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1.5">
              {booking.occupiedDates.map((d) => (
                <span
                  key={d}
                  className="px-2 py-0.5 rounded-md bg-white/80 border border-rose-200 text-rose-800 text-xs font-medium"
                >
                  {formatDisplayDate(d)}
                </span>
              ))}
            </div>
          </div>

          {/* Ownership Status Notice */}
          <div className="text-xs">
            {isOwner ? (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  You are the <strong>original owner</strong> of this reservation. You may edit or cancel it.
                </span>
              </div>
            ) : isAdmin ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  You are viewing this reservation with <strong>Administrator privileges</strong>.
                </span>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                <span>
                  View-only mode. Only the reservation owner or administrator may edit or cancel this booking.
                </span>
              </div>
            )}
          </div>

          {/* Actions Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors"
            >
              Close
            </button>

            {/* Owner/Admin Action Controls */}
            {canModify && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    onClose();
                    onCancelRequest(booking);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Cancel Booking
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onEdit(booking);
                  }}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Edit3 className="w-4 h-4" />
                  Edit Booking
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
