import React, { useState } from 'react';
import { AlertTriangle, Trash2, X, Check, Calendar } from 'lucide-react';
import { Booking } from '../lib/types';
import { formatDisplayDate } from '../lib/dateUtils';
import { api } from '../lib/api';

interface CancelConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  onCancellationSuccess: (cancelledBooking: Booking) => void;
}

export const CancelConfirmationModal: React.FC<CancelConfirmationModalProps> = ({
  isOpen,
  onClose,
  booking,
  onCancellationSuccess,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !booking) return null;

  const handleConfirmCancel = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.cancelBooking(booking.bookingId);
      onCancellationSuccess(res.booking);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel reservation. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        <div className="p-6">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>

          <h3 className="text-lg font-bold text-slate-900 tracking-tight">
            Confirm Reservation Cancellation?
          </h3>

          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Cancelling will <strong>immediately release</strong> the reserved dates (
            <span className="font-semibold text-slate-900">
              {formatDisplayDate(booking.startDate)} — {formatDisplayDate(booking.endDate)}
            </span>
            ), making them available for other guests to book on the calendar.
          </p>

          <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
            <strong>Note:</strong> Your reservation record will be preserved in your booking history under the &ldquo;Cancelled&rdquo; filter for future reference.
          </div>

          {error && (
            <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-sm font-semibold transition-colors cursor-pointer"
            >
              Keep Booking
            </button>

            <button
              type="button"
              onClick={handleConfirmCancel}
              disabled={isLoading}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  Confirm Cancellation
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
