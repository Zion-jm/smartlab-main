import DropdownField from '../shared/DropdownField';
import ScheduleDetailModal from './ScheduleDetailModal';
import { useMemo, useState } from 'react';
import type { LabSchedule } from '../../types/labSchedule';
import { manilaTodayForPicker } from '../../utils/dateTime';
import { calendarColors, chartDayOrder, chartHourMarks, chartMinuteEnd, chartMinuteStart, chartRowHeight, chartSlotMinutes, chartSlotPercents, chartTotalMinutes, clampMinutes, dayNames, formatClockLabel, getMonthLabel, minutesFromIso, occursOnDate, sameDay, scheduleTypeLabel } from './scheduleViewUtils';

export type ChartViewProps = {
  schedules: LabSchedule[];
  computerLabNames?: string[];
  onSelectSchedule?: (scheduleId: string) => void;
  dayLabels?: readonly string[];
  showEmptyGrid?: boolean;
};

export function ChartView({ schedules, computerLabNames = [], onSelectSchedule, dayLabels = dayNames, showEmptyGrid = false }: ChartViewProps) {
  const [labOverride, setLabOverride] = useState<string | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<LabSchedule | null>(null);

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
    if (labOverride && labs.includes(labOverride)) {
      return labOverride;
    }
    return labs[0];
  }, [labOverride, labs]);

  const dataset = useMemo(() => {
    if (!selectedLab) return [];
    return schedules.filter((schedule) => schedule.isComputerLab === true && schedule.roomLabel === selectedLab);
  }, [schedules, selectedLab]);

  const summaryStats = useMemo(() => {
    const labsSet = new Set(schedules.map((schedule) => schedule.roomLabel).filter(Boolean));
    const facultySet = new Set(schedules.map((schedule) => schedule.facultyName).filter(Boolean));
    return {
      total: schedules.length,
      labs: labsSet.size,
      faculty: facultySet.size,
    };
  }, [schedules]);

  const chartHeightPx = ((chartMinuteEnd - chartMinuteStart) / chartSlotMinutes) * chartRowHeight;

  const columnData = chartDayOrder.map((dayIndex) => ({
    dayIndex,
    label: dayLabels[dayIndex],
    schedules: dataset.filter((schedule) => schedule.dayOfWeekIndex === dayIndex),
  }));

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
    <div className="px-4 lg:px-6 py-6 space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="row-span-2 flex min-w-0 flex-col justify-center rounded-2xl border border-[#f1f5f9] bg-[#f9fafb] p-4 md:row-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">Total Schedules</p>
          <p className="text-3xl md:text-2xl font-bold text-[#111827]">{summaryStats.total}</p>
        </div>
        <div className="rounded-2xl border border-[#f1f5f9] bg-[#f9fafb] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">Active Labs</p>
          <p className="text-2xl font-bold text-[#111827]">{summaryStats.labs}</p>
        </div>
        <div className="rounded-2xl border border-[#f1f5f9] bg-[#f9fafb] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#9ca3af]">Faculty Assigned</p>
          <p className="text-2xl font-bold text-[#111827]">{summaryStats.faculty}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-[#e5e7eb]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#f3f4f6] px-4 py-4">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">Weekly Lab Utilization</h3>
            <p className="text-xs text-[#6b7280]">Select a schedule to view full details. Short blocks show a brief summary.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-[#6b7280]">Lab</label>
            <DropdownField value={selectedLab} onChange={value => setLabOverride(value || null)} options={labs.map(lab => ({value:lab,label:lab}))} placeholder="No labs available" disabled={!labs.length} className="min-w-[140px]" />
          </div>
        </div>

        {labs.length === 0 ? (
          <div className="p-6 text-center text-xs lg:text-sm text-[#6b7280]">No lab rooms available yet.</div>
        ) : dataset.length === 0 && !showEmptyGrid ? (
          <div className="p-6 text-center text-xs lg:text-sm text-[#6b7280]">No schedules for {selectedLab} yet.</div>
        ) : (
          <div className="p-4 overflow-x-auto">
            <div className="min-w-[700px]">
              {showEmptyGrid && dataset.length === 0 && <p className="pb-3 text-center text-xs lg:text-sm text-[#6b7280]">No schedules for {selectedLab} yet.</p>}
              <div className="pl-20 grid grid-cols-6 gap-0 pb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-[#6b7280]">
                {chartDayOrder.map((dayIndex) => (
                  <div key={dayIndex}>{dayLabels[dayIndex]}</div>
                ))}
              </div>
              <div className="flex">
                <div className="w-20 pr-2 text-[10px] font-medium text-[#9ca3af]" style={{ height: chartHeightPx }}>
                  <div className="flex h-full flex-col justify-between">
                    {chartHourMarks.map((minute) => (
                      <span key={minute}>{formatClockLabel(minute)}</span>
                    ))}
                  </div>
                </div>
                <div className="grid flex-1 grid-cols-6 gap-2" style={{ height: chartHeightPx }}>
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
    <div className="px-4 lg:px-6 py-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-3">
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

      <div className="rounded-2xl border border-[#e5e7eb] bg-white">
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

