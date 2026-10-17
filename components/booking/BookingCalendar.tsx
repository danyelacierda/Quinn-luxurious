"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESS_HOURS } from "@/lib/businessHours";
import { cn } from "@/lib/utils";

type BookingCalendarProps = {
  selectedDate: string; // ISO date "YYYY-MM-DD"
  onSelectDate: (dateISO: string) => void;
  minDateISO?: string;
  maxDaysAhead?: number;
  className?: string;
};

const WEEKDAY_NAMES = [
  { short: "Su", full: "Sunday" },
  { short: "Mo", full: "Monday" },
  { short: "Tu", full: "Tuesday" },
  { short: "We", full: "Wednesday" },
  { short: "Th", full: "Thursday" },
  { short: "Fr", full: "Friday" },
  { short: "Sa", full: "Saturday" },
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Accurately extracts the current date, time, and day in Asia/Manila (UTC+8).
 */
export function getManilaNow(): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  dateISO: string;
} {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  let year = 0;
  let month = 0;
  let day = 0;
  let hour = 0;
  let minute = 0;

  for (const p of parts) {
    if (p.type === "year") year = Number(p.value);
    if (p.type === "month") month = Number(p.value);
    if (p.type === "day") day = Number(p.value);
    if (p.type === "hour") hour = Number(p.value);
    if (p.type === "minute") minute = Number(p.value);
  }

  const dateISO = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return { year, month, day, hour, minute, dateISO };
}

export function BookingCalendar({
  selectedDate,
  onSelectDate,
  minDateISO,
  maxDaysAhead = 60,
  className,
}: BookingCalendarProps) {
  const manilaNow = useMemo(() => getManilaNow(), []);
  const effectiveMinISO = minDateISO || manilaNow.dateISO;

  // Compute maximum allowed date ISO
  const maxDateISO = useMemo(() => {
    const d = new Date(`${manilaNow.dateISO}T00:00:00`);
    d.setDate(d.getDate() + maxDaysAhead);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }, [manilaNow.dateISO, maxDaysAhead]);

  // Initial displayed month/year based on selectedDate or Manila current
  const [viewDate, setViewDate] = useState<{ year: number; month: number }>(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      const [y, m] = selectedDate.split("-").map(Number);
      return { year: y, month: m - 1 };
    }
    return { year: manilaNow.year, month: manilaNow.month - 1 };
  });

  const isCurrentMonthOrPast =
    viewDate.year < manilaNow.year ||
    (viewDate.year === manilaNow.year && viewDate.month <= manilaNow.month - 1);

  // Maximum view month is based on maxDateISO
  const isMaxMonth = useMemo(() => {
    const [maxY, maxM] = maxDateISO.split("-").map(Number);
    return viewDate.year > maxY || (viewDate.year === maxY && viewDate.month >= maxM - 1);
  }, [viewDate, maxDateISO]);

  function prevMonth() {
    if (isCurrentMonthOrPast) return;
    setViewDate((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  }

  function nextMonth() {
    if (isMaxMonth) return;
    setViewDate((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  }

  // Days matrix for viewDate
  const calendarDays = useMemo(() => {
    const { year, month } = viewDate;
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: Array<{
      dayNumber: number;
      dateISO: string;
      isToday: boolean;
      isDisabled: boolean;
      statusReason?: string;
    }> = [];

    // Padding cells
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({
        dayNumber: 0,
        dateISO: "",
        isToday: false,
        isDisabled: true,
      });
    }

    // Days in current view month
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dateObj = new Date(`${iso}T00:00:00`);
      const dayOfWeek = dateObj.getDay();
      const hours = BUSINESS_HOURS[dayOfWeek];

      let isDisabled = false;
      let statusReason = "Available";

      // 1. Check past date
      if (iso < effectiveMinISO) {
        isDisabled = true;
        statusReason = "Past date";
      }

      // 2. Check if beyond maximum horizon
      if (iso > maxDateISO) {
        isDisabled = true;
        statusReason = "Beyond booking window";
      }

      // 3. Check business hours existence
      if (!hours) {
        isDisabled = true;
        statusReason = "Salon closed";
      }

      // 4. Same-day Manila time check: if current time is past salon closing time today
      if (iso === manilaNow.dateISO && hours) {
        const [closeH, closeM] = hours.close.split(":").map(Number);
        const currentMinutes = manilaNow.hour * 60 + manilaNow.minute;
        const closeMinutes = closeH * 60 + closeM;

        if (currentMinutes >= closeMinutes) {
          isDisabled = true;
          statusReason = "Salon closed for today";
        }
      }

      days.push({
        dayNumber: d,
        dateISO: iso,
        isToday: iso === manilaNow.dateISO,
        isDisabled,
        statusReason,
      });
    }

    return days;
  }, [viewDate, effectiveMinISO, maxDateISO, manilaNow]);

  return (
    <div className={cn("rounded-3xl border border-gold/20 bg-white p-5 shadow-sm sm:p-6", className)}>
      {/* Calendar Header */}
      <div className="flex items-center justify-between pb-4 border-b border-gold/10">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-gold-dark" />
          <h4 className="font-display text-xl font-semibold text-ink">
            {MONTH_NAMES[viewDate.month]} {viewDate.year}
          </h4>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={prevMonth}
            disabled={isCurrentMonthOrPast}
            aria-label="Previous month"
            className="h-8 w-8 p-0 text-ink-soft hover:text-ink disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={nextMonth}
            disabled={isMaxMonth}
            aria-label="Next month"
            className="h-8 w-8 p-0 text-ink-soft hover:text-ink disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Weekday Labels */}
      <div className="mt-4 grid grid-cols-7 text-center text-xs font-semibold uppercase tracking-wider text-ink-soft/70">
        {WEEKDAY_NAMES.map((wd) => (
          <div key={wd.short} title={wd.full} className="py-1">
            {wd.short}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div className="mt-2 grid grid-cols-7 gap-1.5" role="grid" aria-label="Appointment dates">
        {calendarDays.map((dayItem, idx) => {
          if (dayItem.dayNumber === 0) {
            return <div key={`pad-${idx}`} className="h-10 sm:h-11" aria-hidden="true" />;
          }

          const isSelected = selectedDate === dayItem.dateISO;

          return (
            <button
              key={dayItem.dateISO}
              type="button"
              disabled={dayItem.isDisabled}
              onClick={() => onSelectDate(dayItem.dateISO)}
              aria-label={`${dayItem.dateISO}: ${dayItem.statusReason}`}
              aria-pressed={isSelected}
              className={cn(
                "relative flex h-10 sm:h-11 flex-col items-center justify-center rounded-2xl text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
                isSelected
                  ? "bg-gold text-white font-semibold shadow-gold scale-[1.03] z-10"
                  : dayItem.isDisabled
                  ? "cursor-not-allowed text-ink/25 bg-transparent"
                  : "bg-paper/40 text-ink hover:bg-gold/15 hover:text-gold-dark hover:border-gold/30 border border-transparent",
                dayItem.isToday && !isSelected && "border border-gold/50 text-gold-dark font-bold bg-gold/5"
              )}
            >
              <span>{dayItem.dayNumber}</span>
              {dayItem.isToday && !isSelected && (
                <span className="absolute bottom-1 h-1 w-1 rounded-full bg-gold-dark" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend & Timezone Footnote */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-gold/10 pt-3 text-[11px] text-ink-soft">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-gold" />
            <span>Selected</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full border border-gold/60 bg-gold/10" />
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-paper border border-ink/20" />
            <span>Available</span>
          </div>
        </div>
        <span className="italic text-ink-soft/70">Asia/Manila (UTC+8)</span>
      </div>
    </div>
  );
}
