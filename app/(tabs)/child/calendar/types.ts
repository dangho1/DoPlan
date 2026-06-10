export interface CalendarEvent {
  id: string;
  start_time: string;
  end_time: string;
  activity_name: string;
  child_id: string;
  notes?: string;
  location?: string;
  color?: string;
  isRecurring?: boolean;
}

export interface DayTimeRange {
  start: string;
  end: string;
}

export type WeekPattern = "all" | "odd" | "even";

export interface CustodySchedule {
  id: string;
  days_of_week: number[];
  parent_name: string;
  color: string;
  user_id: string;
  day_time_ranges?: Record<number, DayTimeRange>;
  week_pattern?: WeekPattern;
}

export interface CustodyDraft {
  days: number[];
  dayTimeRanges: Record<number, DayTimeRange>;
  weekPattern: WeekPattern;
}

export interface RecurringActivity {
  id: string;
  activity_name: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  color: string;
  child_id: string;
}

export interface CalendarDayCell {
  date: Date;
  isCurrentMonth: boolean;
}

export interface LaidOutDayEvent {
  event: CalendarEvent;
  startTimeStr: string;
  endTimeStr: string;
  startMinutes: number;
  durationMinutes: number;
  columnIndex: number;
  columnCount: number;
}

export type CustodyTemplate =
  | "weekdays"
  | "weekends"
  | "allDays"
  | "schoolMorning"
  | "schoolAfter";
