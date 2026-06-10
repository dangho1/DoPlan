import type {
    CalendarDayCell,
    CalendarEvent,
    CustodyTemplate,
    DayTimeRange,
    LaidOutDayEvent,
    WeekPattern,
} from "./types";

export const getDayOfWeekMondayIndex = (date: Date) => (date.getDay() + 6) % 7;

export const getDaysInMonth = (date: Date): CalendarDayCell[] => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();

  const days: CalendarDayCell[] = [];

  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const prevMonthDays = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
  for (let i = prevMonthDays; i > 0; i--) {
    days.push({
      date: new Date(year, month - 1, prevMonthLastDay - i + 1),
      isCurrentMonth: false,
    });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }

  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  return days;
};

export const formatLocalDateInput = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseLocalDateInput = (text: string) => {
  const trimmed = text.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);

  const parsed = new Date(year, month - 1, day);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed;
};

export const parseMinutes = (time: string) => {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
};

export const isMinuteInRange = (
  minuteOfDay: number,
  start: string,
  end: string,
) => {
  const startMinutes = parseMinutes(start);
  const endMinutes = parseMinutes(end);
  if (startMinutes === null || endMinutes === null) return true;

  if (startMinutes === endMinutes) {
    return true;
  }

  if (endMinutes > startMinutes) {
    return minuteOfDay >= startMinutes && minuteOfDay < endMinutes;
  }

  return minuteOfDay >= startMinutes || minuteOfDay < endMinutes;
};

export const getMinuteOfDayForCustody = (date: Date) =>
  date.getHours() === 0 && date.getMinutes() === 0
    ? 12 * 60
    : date.getHours() * 60 + date.getMinutes();

export const getWeekPatternForDate = (date: Date): WeekPattern => {
  const utcDate = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
  const dayNum = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((utcDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );

  return weekNo % 2 === 0 ? "even" : "odd";
};

export const getShiftedDate = (baseDate: Date, direction: "prev" | "next") => {
  const nextDate = new Date(baseDate);
  if (direction === "prev") {
    nextDate.setDate(nextDate.getDate() - 1);
  } else {
    nextDate.setDate(nextDate.getDate() + 1);
  }
  return nextDate;
};

export const buildCustodyTemplate = (
  template: CustodyTemplate,
): { days: number[]; range: DayTimeRange } => {
  const days =
    template === "weekdays"
      ? [0, 1, 2, 3, 4]
      : template === "weekends"
        ? [5, 6]
        : [0, 1, 2, 3, 4, 5, 6];

  const range =
    template === "schoolMorning"
      ? { start: "00:00", end: "08:00" }
      : template === "schoolAfter"
        ? { start: "08:00", end: "23:59" }
        : { start: "00:00", end: "23:59" };

  return { days, range };
};

export const layoutDayEvents = (
  dayEvents: CalendarEvent[],
): LaidOutDayEvent[] => {
  const parsedDayEvents = dayEvents
    .filter((event) => !isAllDayEvent(event))
    .map((event) => {
      const startTimeStr = event.start_time.includes("T")
        ? event.start_time.split("T")[1].split(".")[0]
        : event.start_time;
      const endTimeStr = event.end_time.includes("T")
        ? event.end_time.split("T")[1].split(".")[0]
        : event.end_time;

      const [startHour, startMin] = startTimeStr.split(":").map(Number);
      const [endHour, endMin] = endTimeStr.split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const rawEndMinutes = endHour * 60 + endMin;
      const endMinutes = Math.max(startMinutes + 15, rawEndMinutes);

      return {
        event,
        startTimeStr,
        endTimeStr,
        startMinutes,
        endMinutes,
        durationMinutes: Math.max(15, endMinutes - startMinutes),
      };
    })
    .sort(
      (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
    );

  const laidOutEvents: LaidOutDayEvent[] = [];

  const flushOverlapGroup = (
    overlapGroup: Array<{
      event: CalendarEvent;
      startTimeStr: string;
      endTimeStr: string;
      startMinutes: number;
      endMinutes: number;
      durationMinutes: number;
    }>,
  ) => {
    if (overlapGroup.length === 0) return;

    const columnEndMinutes: number[] = [];
    const placed = overlapGroup.map((item) => {
      let columnIndex = columnEndMinutes.findIndex(
        (columnEnd) => item.startMinutes >= columnEnd,
      );

      if (columnIndex === -1) {
        columnIndex = columnEndMinutes.length;
        columnEndMinutes.push(item.endMinutes);
      } else {
        columnEndMinutes[columnIndex] = item.endMinutes;
      }

      return {
        ...item,
        columnIndex,
      };
    });

    const columnCount = Math.max(1, columnEndMinutes.length);
    placed.forEach((item) => {
      laidOutEvents.push({
        event: item.event,
        startTimeStr: item.startTimeStr,
        endTimeStr: item.endTimeStr,
        startMinutes: item.startMinutes,
        durationMinutes: item.durationMinutes,
        columnIndex: item.columnIndex,
        columnCount,
      });
    });
  };

  let overlapGroup: Array<{
    event: CalendarEvent;
    startTimeStr: string;
    endTimeStr: string;
    startMinutes: number;
    endMinutes: number;
    durationMinutes: number;
  }> = [];
  let overlapGroupMaxEnd = -1;

  parsedDayEvents.forEach((item) => {
    if (overlapGroup.length > 0 && item.startMinutes >= overlapGroupMaxEnd) {
      flushOverlapGroup(overlapGroup);
      overlapGroup = [];
      overlapGroupMaxEnd = -1;
    }

    overlapGroup.push(item);
    overlapGroupMaxEnd = Math.max(overlapGroupMaxEnd, item.endMinutes);
  });
  flushOverlapGroup(overlapGroup);

  return laidOutEvents;
};

export const isAllDayEvent = (event: CalendarEvent) => {
  if (!event.start_time.includes("T") || !event.end_time.includes("T")) {
    return false;
  }

  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return false;
  }

  if (formatLocalDateKey(start) !== formatLocalDateKey(end)) {
    return false;
  }

  const durationMs = end.getTime() - start.getTime();
  const twentyThreeHoursMs = 23 * 60 * 60 * 1000;
  const twentyFiveHoursMs = 25 * 60 * 60 * 1000;
  return durationMs >= twentyThreeHoursMs && durationMs <= twentyFiveHoursMs;
};
