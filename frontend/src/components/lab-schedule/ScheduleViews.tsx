import DropdownField from '../shared/DropdownField';
import ScheduleDetailModal from './ScheduleDetailModal';
import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Maximize2, Printer } from 'lucide-react';
import type { LabSchedule } from '../../types/labSchedule';
import { addCalendarDays, dateKeyToPickerDate, dateToDateKey, manilaTodayForPicker } from '../../utils/dateTime';
import { calendarColors, chartDayOrder, chartHourMarks, chartMinuteEnd, chartMinuteStart, chartRowHeight, chartSlotMinutes, chartSlotPercents, chartTotalMinutes, clampMinutes, dayNames, formatClockLabel, getMonthLabel, minutesFromIso, occursOnDate, sameDay, scheduleTypeLabel } from './scheduleViewUtils';

export type ChartViewProps = {
  flush?: boolean;
  schedules: LabSchedule[];
  computerLabNames?: string[];
  onSelectSchedule?: (scheduleId: string) => void;
  dayLabels?: readonly string[];
  showEmptyGrid?: boolean;
  selectedLab?: string;
  onSelectedLabChange?: (lab: string) => void;
  onExpand?: () => void;
  onPrint?: () => void;
  printTitle?: string;
  selectedWeekStart?: string;
  onSelectedWeekStartChange?: (weekStart: string) => void;
};

const mondayForDate = (value: Date | string) => {
  const key = typeof value === 'string' ? value : dateToDateKey(value);
  const weekday = new Date(`${key}T00:00:00Z`).getUTCDay();
  return addCalendarDays(key, weekday === 0 ? -6 : 1 - weekday);
};

const weekRangeLabel = (monday: string) => {
  const saturday = addCalendarDays(monday, 5);
  const start = new Date(`${monday}T00:00:00Z`);
  const end = new Date(`${saturday}T00:00:00Z`);
  const monthName = (date: Date) => date.toLocaleString('en-US', { timeZone: 'UTC', month: 'long' });
  const startMonth = monthName(start);
  const endMonth = monthName(end);
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();

  if (startYear === endYear && start.getUTCMonth() === end.getUTCMonth()) {
    return `${startMonth} ${startDay}–${endDay}, ${endYear}`;
  }
  if (startYear === endYear) {
    return `${startMonth} ${startDay}–${endMonth} ${endDay}, ${endYear}`;
  }
  return `${startMonth} ${startDay}, ${startYear}–${endMonth} ${endDay}, ${endYear}`;
};

export function ChartView({ flush = false, schedules, computerLabNames = [], onSelectSchedule, dayLabels = dayNames, showEmptyGrid = false, selectedLab: controlledLab, onSelectedLabChange, onExpand, onPrint, printTitle = 'Laboratory Schedule', selectedWeekStart: controlledWeekStart, onSelectedWeekStartChange }: ChartViewProps) {
  const [labOverride, setLabOverride] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<LabSchedule | null>(null);
  const [weekOverride, setWeekOverride] = useState(() => mondayForDate(manilaTodayForPicker()));
  const selectedWeekStart = controlledWeekStart || weekOverride;

  const labs = useMemo(() => {
    // Base the dropdown on the actual list of computer-lab rooms so labs with
    // no schedules yet still show up, not just rooms that happen to have one.
    const fromRooms = computerLabNames.filter(Boolean);
    if (fromRooms.length) return Array.from(new Set(fromRooms));
    // Fallback: derive from schedules in case the room list failed to load.
    return Array.from(
      new Set(
        schedules
          .filter((schedule) => schedule.isComputerLab)
          .map((schedule) => schedule.roomLabel)
          .filter(Boolean)
      )
    );
  }, [computerLabNames, schedules]);

  const selectedLab = useMemo(() => {
    if (!labs.length) return '';
    if (controlledLab && labs.includes(controlledLab)) return controlledLab;
    if (labOverride && labs.includes(labOverride)) {
      return labOverride;
    }
    return labs[0];
  }, [controlledLab, labOverride, labs]);

  const selectLab = (value: string) => {
    setLabOverride(value || null);
    onSelectedLabChange?.(value);
  };

  const selectWeek = (value: string) => {
    setWeekOverride(value);
    onSelectedWeekStartChange?.(value);
  };

  const dataset = useMemo(() => {
    if (!selectedLab) return [];
    return schedules.filter((schedule) => schedule.isComputerLab === true && schedule.roomLabel === selectedLab);
  }, [schedules, selectedLab]);

  const chartHeightPx = ((chartMinuteEnd - chartMinuteStart) / chartSlotMinutes) * chartRowHeight;

  const columnData = chartDayOrder.map((dayIndex) => {
    const dateKey = addCalendarDays(selectedWeekStart, dayIndex - 1);
    const date = dateKeyToPickerDate(dateKey)!;
    return {
      dayIndex,
      dateKey,
      label: `${dayLabels[dayIndex].slice(0, 3)} ${Number(dateKey.slice(8))}`,
      schedules: dataset.filter((schedule) => occursOnDate(schedule, date)),
    };
  });
  const visibleScheduleCount = columnData.reduce((count, column) => count + column.schedules.length, 0);

  const blockStyle = (schedule: LabSchedule) => {
    const startRaw = minutesFromIso(schedule.startTime);
    const endRaw = minutesFromIso(schedule.endTime);
    const start = clampMinutes(startRaw, chartMinuteStart, chartMinuteEnd);
    const end = clampMinutes(endRaw, chartMinuteStart, chartMinuteEnd);
    if (start === null || end === null || end <= start) {
      return null;
    }
    const top = ((start - chartMinuteStart) / chartTotalMinutes) * 100;
    const height = ((end - start) / chartTotalMinutes) * 100;
    return {
      top: `${top}%`,
      height: `${height}%`,
    };
  };

  return (
    <div className={`schedule-chart-print-area ${flush ? "" : "p-4 lg:p-5"}`}>
      <header className="schedule-chart-print-header hidden">
        <div className="schedule-chart-institution-header">
          <img src="/PUPLogo.png" alt="Polytechnic University of the Philippines" />
          <div>
            <p>Republic of the Philippines</p>
            <p>Polytechnic University of the Philippines</p>
            <p>Office of the Vice President for Academic Affairs</p>
            <p>College of Computer and Information Sciences</p>
          </div>
        </div>
        <h1 className="schedule-chart-print-title">{printTitle}</h1>
        <p className="mt-1 text-[10pt] text-[#514343]">{selectedLab || 'Laboratory'} · {weekRangeLabel(selectedWeekStart)}</p>
      </header>
      <div className="rounded-2xl border border-[#e5e7eb]">
        <div className="schedule-chart-controls flex flex-wrap items-center justify-between gap-4 border-b border-[#f3f4f6] px-4 py-4">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">Weekly Lab Utilization</h3>
            <p className="text-xs text-[#6b7280]">Select a schedule to view full details. Short blocks show a brief summary.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="flex min-h-10 items-center overflow-hidden rounded-lg border border-[#e5d5d1] bg-white">
              <button type="button" onClick={() => selectWeek(addCalendarDays(selectedWeekStart, -7))} aria-label="Previous week" className="inline-flex h-10 w-10 items-center justify-center text-[#786565] hover:bg-[#fff8f6] hover:text-[#800000]"><ChevronLeft size={16} /></button>
              <button type="button" onClick={() => selectWeek(mondayForDate(manilaTodayForPicker()))} className="inline-flex h-10 items-center gap-1.5 border-x border-[#e5d5d1] px-3 text-xs font-semibold text-[#800000]"><CalendarDays size={14} />This week</button>
              <button type="button" onClick={() => selectWeek(addCalendarDays(selectedWeekStart, 7))} aria-label="Next week" className="inline-flex h-10 w-10 items-center justify-center text-[#786565] hover:bg-[#fff8f6] hover:text-[#800000]"><ChevronRight size={16} /></button>
            </div>
            <label className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Lab</label>
            <DropdownField value={selectedLab} onChange={selectLab} options={labs.map(lab => ({value:lab,label:lab}))} placeholder="No labs available" disabled={!labs.length} className="min-w-[140px]" />
            {onPrint && <button type="button" onClick={onPrint} className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-[#e5d5d1] bg-white px-3 text-xs font-semibold text-[#800000] transition hover:border-[#800000] hover:bg-[#fff8f6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#800000]" aria-label="Print weekly lab utilization chart or save it as PDF"><Printer size={15} aria-hidden="true" />Print / PDF</button>}
            {onExpand && <button type="button" onClick={onExpand} className="inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg border border-[#e5d5d1] bg-white px-3 text-xs font-semibold text-[#800000] transition hover:border-[#800000] hover:bg-[#fff8f6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#800000]" aria-label="Expand weekly lab utilization chart"><Maximize2 size={15} aria-hidden="true" />Expand</button>}
          </div>
        </div>

        <div className="schedule-chart-week-heading border-b border-[#f3f4f6] bg-[#fffdfc] px-4 py-2 text-center text-xs font-semibold text-[#6b4f4a]" aria-live="polite">{weekRangeLabel(selectedWeekStart)}</div>

        {labs.length === 0 ? (
          <div className="p-6 text-center text-xs lg:text-sm text-[#6b7280]">No lab rooms available yet.</div>
        ) : visibleScheduleCount === 0 && !showEmptyGrid ? (
          <div className="p-6 text-center text-xs lg:text-sm text-[#6b7280]">No schedules for {selectedLab} during {weekRangeLabel(selectedWeekStart)}.</div>
        ) : (
          <div className="p-4 overflow-x-auto">
            <div className="min-w-[700px]">
              {showEmptyGrid && visibleScheduleCount === 0 && <p className="pb-3 text-center text-xs lg:text-sm text-[#6b7280]">No schedules for {selectedLab} during {weekRangeLabel(selectedWeekStart)}.</p>}
              <div className="schedule-chart-day-headings pl-20 grid grid-cols-6 gap-0 pb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                {columnData.map(({ dayIndex, label }) => (
                  <div key={dayIndex}>{label}</div>
                ))}
              </div>
              <div className="flex">
                <div className="schedule-chart-time-axis w-20 pr-2 text-[10px] font-medium text-[#9ca3af]" style={{ height: chartHeightPx }}>
                  <div className="flex h-full flex-col justify-between">
                    {chartHourMarks.map((minute) => (
                      <span key={minute}>{formatClockLabel(minute)}</span>
                    ))}
                  </div>
                </div>
                <div className="schedule-chart-grid grid flex-1 grid-cols-6 gap-2" style={{ height: chartHeightPx }}>
                  {columnData.map(({ dayIndex, schedules: daySchedules }) => (
                    <div key={dayIndex} className="relative rounded-xl border border-[#f1f5f9] bg-white">
                      {chartSlotPercents.map((pct, idx) => (
                        <span
                          key={`${dayIndex}-${pct}`}
                          className={`absolute inset-x-1 border-t ${idx % 2 === 0 ? 'border-dashed border-[#f1f5f9]' : 'border-[#f8fafc]'}`}
                          style={{ top: `${pct}%` }}
                        />
                      ))}

                      {daySchedules.map((schedule) => {
                        const style = blockStyle(schedule);
                        if (!style) return null;
                        const heightPx = parseFloat(style.height) / 100 * chartHeightPx;
                        const compact = heightPx < 44;
                        const detailed = heightPx >= 88;
                        const accessibleLabel = `${schedule.programLabel} — ${schedule.facultyName} — ${schedule.timeRange} — ${scheduleTypeLabel[schedule.scheduleType]}. View schedule details.`;
                        const blockClasses =
                          schedule.scheduleType === 'WEEKLY'
                            ? 'from-[#3b82f6] via-[#2563eb] to-[#1e40af]'
                            : 'from-[#f87171] via-[#dc2626] to-[#991b1b]';
                        return (
                          <button
                            key={schedule.id}
                            type="button"
                            data-schedule-type={schedule.scheduleType}
                            onClick={() => onSelectSchedule ? onSelectSchedule(schedule.id) : setSelectedSchedule(schedule)}
                            title={accessibleLabel}
                            aria-label={accessibleLabel}
                            className={`group absolute left-1.5 right-1.5 flex flex-col overflow-hidden rounded-2xl bg-linear-to-br ${blockClasses} min-h-0 box-border px-2 ${compact ? 'justify-center py-0' : 'py-1.5'} text-left text-white shadow-md ring-1 ring-black/5 transition-all duration-150 hover:z-10 hover:-translate-y-0.5 hover:shadow-lg hover:ring-2 hover:ring-white/60 focus:outline-none focus-visible:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-white cursor-pointer`}
                            style={style}
                          >
                            <span className="pointer-events-none absolute inset-0 bg-white/0 transition-colors duration-150 group-hover:bg-white/10" />
                            {compact ? (
                              <span className="relative block w-full shrink-0 truncate text-[10px] font-semibold leading-4">{schedule.programLabel} · {schedule.timeRange}</span>
                            ) : (
                              <>
                                {detailed && <span className="relative block w-full shrink-0 truncate text-[9px] font-bold uppercase leading-4 text-white/85">{scheduleTypeLabel[schedule.scheduleType]}</span>}
                                <span className="relative block w-full shrink-0 truncate text-xs font-bold leading-4">{schedule.programLabel}</span>
                                {detailed && <span className="relative block w-full shrink-0 truncate text-[10px] leading-4 text-white/95">{schedule.facultyName}</span>}
                                <span className="relative mt-auto block w-full shrink-0 truncate text-[9px] font-medium leading-4 text-white/85">{schedule.timeRange}</span>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {selectedSchedule && <ScheduleDetailModal schedule={selectedSchedule} onClose={() => setSelectedSchedule(null)} />}
    </div>
  );
}

export type CalendarViewProps = {
  schedules: LabSchedule[];
  dayLabels?: readonly string[];
};

export function CalendarView({ schedules, dayLabels = dayNames }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const today = manilaTodayForPicker();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDay, setSelectedDay] = useState<{ date: Date; schedules: LabSchedule[] } | null>(null);

  const colorMap = useMemo(() => {
    const uniqueRooms = Array.from(new Set(schedules.map((schedule) => schedule.roomLabel).filter(Boolean)));
    return uniqueRooms.reduce<Record<string, string>>((map, room, index) => {
      map[room] = calendarColors[index % calendarColors.length];
      return map;
    }, {});
  }, [schedules]);

  const startDayOfGrid = useMemo(() => {
    const clone = new Date(currentMonth);
    const dayOfWeek = clone.getDay();
    clone.setDate(clone.getDate() - dayOfWeek);
    clone.setHours(0, 0, 0, 0);
    return clone;
  }, [currentMonth]);

  const endDayOfGrid = useMemo(() => {
    const lastDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    const clone = new Date(lastDayOfMonth);
    clone.setHours(0, 0, 0, 0);
    while (clone.getDay() !== 6) {
      clone.setDate(clone.getDate() + 1);
    }
    return clone;
  }, [currentMonth]);

  const today = useMemo(() => {
    const now = manilaTodayForPicker();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  const calendarCells = useMemo(() => {
    const cells: { date: Date; inCurrentMonth: boolean; schedules: LabSchedule[] }[] = [];
    const totalDays = Math.round((endDayOfGrid.getTime() - startDayOfGrid.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    for (let i = 0; i < totalDays; i += 1) {
      const cellDate = new Date(startDayOfGrid);
      cellDate.setDate(startDayOfGrid.getDate() + i);
      const daySchedules = schedules.filter((schedule) => occursOnDate(schedule, cellDate));
      cells.push({
        date: cellDate,
        inCurrentMonth:
          cellDate.getFullYear() === currentMonth.getFullYear() && cellDate.getMonth() === currentMonth.getMonth(),
        schedules: daySchedules,
      });
    }
    return cells;
  }, [currentMonth, schedules, startDayOfGrid, endDayOfGrid]);

  const handlePrevMonth = () => {
    setCurrentMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth((previous) => new Date(previous.getFullYear(), previous.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const now = manilaTodayForPicker();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const closeModal = () => setSelectedDay(null);

  return (
    <div className="space-y-4 p-4 lg:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#eadfd9] bg-[#fffdfb] px-4 py-3">
        <div>
          <h3 className="text-base font-semibold text-[#111827]">{getMonthLabel(currentMonth)}</h3>
          <p className="text-xs text-[#6b7280]">Tap any day to review schedules.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToday}
            className="rounded-full border border-[#d1d5db] px-3 py-1.5 text-xs font-semibold text-[#374151] hover:border-[#9ca3af]"
          >
            Today
          </button>
          <div className="flex items-center rounded-full border border-[#d1d5db]">
            <button type="button" onClick={handlePrevMonth} className="px-3 py-1.5 text-[#374151] hover:text-[#111827]" aria-label="Previous month">
              ‹
            </button>
            <div className="h-4 w-px bg-[#e5e7eb]" />
            <button type="button" onClick={handleNextMonth} className="px-3 py-1.5 text-[#374151] hover:text-[#111827]" aria-label="Next month">
              ›
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#eadfd9] bg-white">
        <div className="grid grid-cols-7 border-b border-[#f3f4f6] text-center text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
          {dayLabels.map((label) => (
            <div key={label} className="py-2">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-[#f3f4f6]">
          {calendarCells.map(({ date, inCurrentMonth, schedules: daySchedules }) => {
            const isToday = sameDay(date, today);
            const showDate = date.getDate();
            return (
              <button
                key={date.toISOString()}
                type="button"
                onClick={() => setSelectedDay({ date, schedules: daySchedules })}
                className={`min-h-[110px] rounded-xl border border-white bg-white p-2 text-left transition hover:border-[#cbd5f5] ${
                  inCurrentMonth ? 'text-[#111827]' : 'text-[#9ca3af]'
                }`}
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-sm">{showDate}</span>
                  {isToday && <span className="text-[10px] text-[#b91c1c]">Today</span>}
                </div>
                <div className="mt-2 space-y-1">
                  {daySchedules.slice(0, 3).map((schedule) => (
                    <div
                      key={schedule.id}
                      className="truncate rounded-full px-2 py-1 text-[10px] font-semibold text-white"
                      style={{ backgroundColor: colorMap[schedule.roomLabel] || '#6b7280' }}
                    >
                      {schedule.subjectLabel || schedule.programLabel}
                    </div>
                  ))}
                  {daySchedules.length > 3 && (
                    <div className="text-[10px] font-semibold text-[#6b7280]">+{daySchedules.length - 3} more</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 px-4" onClick={closeModal}>
          <div className="max-h-[80vh] w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-[#f3f4f6] px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-[#111827]">
                  {selectedDay.date.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <p className="text-xs text-[#6b7280]">
                  {selectedDay.schedules.length} schedule{selectedDay.schedules.length === 1 ? '' : 's'}
                </p>
              </div>
              <button type="button" onClick={closeModal} className="text-[#6b7280] hover:text-[#111827]">
                ✕
              </button>
            </div>
            <div className="max-h-[60vh] space-y-3 overflow-y-auto px-4 py-4 text-sm text-[#111827]">
              {selectedDay.schedules.length === 0 ? (
                <p className="text-center text-xs text-[#9ca3af]">No schedules on this day.</p>
              ) : (
                selectedDay.schedules.map((schedule) => (
                  <div key={schedule.id} className="rounded-2xl border border-[#f1f5f9] p-3">
                    <div className="flex items-center justify-between text-xs text-[#6b7280]">
                      <span>{scheduleTypeLabel[schedule.scheduleType]}</span>
                      <span>{schedule.timeRange}</span>
                    </div>
                    <p className="text-sm font-semibold text-[#111827]">{schedule.subjectLabel}</p>
                    <p className="text-xs text-[#6b7280]">{schedule.roomLabel}</p>
                    <p className="text-xs text-[#6b7280]">{schedule.facultyName}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

