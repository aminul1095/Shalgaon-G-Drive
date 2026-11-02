/**
 * Date utility functions for Shalgaon Resort
 * Uses clean string-based YYYY-MM-DD representations to avoid timezone shifts.
 */

// Timezone: Asia/Dhaka (UTC+6)
export const RESORT_TIMEZONE = 'Asia/Dhaka';

export function getTodayString(): string {
  const now = new Date();
  // Format as YYYY-MM-DD in Asia/Dhaka
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: RESORT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now);
}

export function parseDateString(dateStr: string): { year: number; month: number; day: number } {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10), // 1-12
    day: parseInt(dayStr, 10),
  };
}

export function formatDateString(year: number, month: number, day: number): string {
  const y = year.toString().padStart(4, '0');
  const m = month.toString().padStart(2, '0');
  const d = day.toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes('-')) return dateStr;
  const { year, month, day } = parseDateString(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = months[month - 1] || '';
  return `${day.toString().padStart(2, '0')} ${monthName} ${year}`;
}

export function formatDisplayMonth(year: number, month: number): string {
  // month is 1-12
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return `${monthNames[month - 1]} ${year}`;
}

/**
 * Returns list of all inclusive date strings between startDate and endDate
 */
export function getInclusiveDateRange(startDateStr: string, endDateStr: string): string[] {
  const dates: string[] = [];
  const start = parseDateString(startDateStr);
  const end = parseDateString(endDateStr);

  const curr = new Date(Date.UTC(start.year, start.month - 1, start.day));
  const last = new Date(Date.UTC(end.year, end.month - 1, end.day));

  if (curr > last) {
    return [];
  }

  while (curr <= last) {
    const y = curr.getUTCFullYear();
    const m = curr.getUTCMonth() + 1;
    const d = curr.getUTCDate();
    dates.push(formatDateString(y, m, d));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return dates;
}

export function isDateInPast(dateStr: string): boolean {
  const today = getTodayString();
  return dateStr < today;
}

export function getDaysInMonth(year: number, month: number): number {
  // month is 1-12
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function getFirstWeekdayOfMonth(year: number, month: number): number {
  // month is 1-12, returns 0 for Sunday, 1 for Monday, etc.
  return new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
}

export interface CalendarCell {
  dateString: string;
  dayNumber: number;
  month: number; // 1-12
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
}

export function generateCalendarGrid(year: number, month: number): CalendarCell[] {
  const today = getTodayString();
  const daysInCurrentMonth = getDaysInMonth(year, month);
  const firstWeekday = getFirstWeekdayOfMonth(year, month); // 0 (Sun) to 6 (Sat)

  const cells: CalendarCell[] = [];

  // Previous month trailing days
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const dateStr = formatDateString(prevYear, prevMonth, day);
    cells.push({
      dateString: dateStr,
      dayNumber: day,
      month: prevMonth,
      year: prevYear,
      isCurrentMonth: false,
      isToday: dateStr === today,
      isPast: dateStr < today,
    });
  }

  // Current month days
  for (let day = 1; day <= daysInCurrentMonth; day++) {
    const dateStr = formatDateString(year, month, day);
    cells.push({
      dateString: dateStr,
      dayNumber: day,
      month,
      year,
      isCurrentMonth: true,
      isToday: dateStr === today,
      isPast: dateStr < today,
    });
  }

  // Next month leading days to fill remaining week grid (up to multiple of 7)
  const remaining = (7 - (cells.length % 7)) % 7;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  for (let day = 1; day <= remaining; day++) {
    const dateStr = formatDateString(nextYear, nextMonth, day);
    cells.push({
      dateString: dateStr,
      dayNumber: day,
      month: nextMonth,
      year: nextYear,
      isCurrentMonth: false,
      isToday: dateStr === today,
      isPast: dateStr < today,
    });
  }

  return cells;
}
