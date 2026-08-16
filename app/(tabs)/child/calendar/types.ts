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

/**
 * A one-off exception to the recurring custody pattern for a single date.
 *
 * - `assigned_user_id` set                          -> an existing guardian has the child
 * - `assigned_user_id` null + `assigned_label` set  -> a non-app person (e.g. "Aunt Lisa")
 * - both null                                       -> nobody has responsibility that day
 *
 * `start_time`/`end_time` are `HH:MM`; both null means the whole day.
 */
export interface CustodyOverride {
  id: string;
  child_id: string;
  date: string;
  assigned_user_id: string | null;
  assigned_label: string | null;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
}

export type CustodyOverrideAssignment = "parent" | "none" | "other";

export interface CustodyOverrideDraft {
  assignment: CustodyOverrideAssignment;
  parentId: string | null;
  label: string;
  allDay: boolean;
  startTime: string;
  endTime: string;
  note: string;
}

export interface CustodyDraft {
  days: number[];
  dayTimeRanges: Record<number, DayTimeRange>;
  weekPattern: WeekPattern;
}

export interface CustodyScheduleChangeRequest {
  id: string;
  child_id: string;
  requested_by: string;
  proposed_schedules: Record<string, CustodyDraft>;
  status: "pending" | "approved" | "rejected";
  created_at: string | null;
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
