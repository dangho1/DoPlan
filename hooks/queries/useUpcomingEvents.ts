import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'

// How many days ahead to expand recurring activities into individual occurrences.
// Keeps the "rolling" upcoming list populated even for children whose only
// scheduled items are weekly recurring activities.
const RECURRING_LOOKAHEAD_DAYS = 21
const MAX_UPCOMING_EVENTS = 8

export interface UpcomingEventItem {
  id: string
  activityName: string
  startTime: Date
  endTime: Date
  isRecurring: boolean
  location: string | null
  notes: string | null
  color: string | null
}

interface RawCalendarEvent {
  id: string
  start_time: string
  end_time: string
  activity_name: string | null
  child_id: string | null
  notes: string | null
  location: string | null
}

interface RawRecurringActivity {
  id: string
  activity_name: string
  days_of_week: number[]
  start_time: string
  end_time: string
  color: string | null
  child_id: string
}

// Monday = 0 ... Sunday = 6. This matches getDayOfWeekMondayIndex used by the
// calendar screen (app/(tabs)/child/calendar/utils.ts) so the events surfaced
// here line up with what actually renders on the calendar grid for the same
// recurring activity.
const getDayOfWeekMondayIndex = (date: Date) => (date.getDay() + 6) % 7

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate())

const addDays = (date: Date, amount: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

const parseTimeOfDay = (time: string) => {
  const [rawHours = '0', rawMinutes = '0'] = time.split(':')
  return {
    hours: Number.parseInt(rawHours, 10) || 0,
    minutes: Number.parseInt(rawMinutes, 10) || 0,
  }
}

function expandRecurringOccurrences(
  activity: RawRecurringActivity,
  now: Date,
): UpcomingEventItem[] {
  const occurrences: UpcomingEventItem[] = []
  const start = parseTimeOfDay(activity.start_time)
  const end = parseTimeOfDay(activity.end_time)
  const today = startOfDay(now)

  for (let offset = 0; offset <= RECURRING_LOOKAHEAD_DAYS; offset++) {
    const candidateDay = addDays(today, offset)
    const dayOfWeek = getDayOfWeekMondayIndex(candidateDay)
    if (!activity.days_of_week.includes(dayOfWeek)) continue

    const occurrenceStart = new Date(
      candidateDay.getFullYear(),
      candidateDay.getMonth(),
      candidateDay.getDate(),
      start.hours,
      start.minutes,
    )
    const occurrenceEnd = new Date(
      candidateDay.getFullYear(),
      candidateDay.getMonth(),
      candidateDay.getDate(),
      end.hours,
      end.minutes,
    )

    // Skip occurrences that have already fully ended (only relevant for today).
    if (occurrenceEnd.getTime() < now.getTime()) continue

    occurrences.push({
      id: `recurring-${activity.id}-${candidateDay.getFullYear()}-${candidateDay.getMonth()}-${candidateDay.getDate()}`,
      activityName: activity.activity_name,
      startTime: occurrenceStart,
      endTime: occurrenceEnd,
      isRecurring: true,
      location: null,
      notes: null,
      color: activity.color,
    })
  }

  return occurrences
}

/**
 * Returns the next few upcoming events (today or future) for a child, merging
 * one-off `calendar_events` rows with expanded occurrences of active
 * `recurring_activities`. Sorted ascending by start time; the first item is
 * the single "next" event.
 */
export function useUpcomingEvents(childId: string | undefined) {
  return useQuery({
    queryKey: ['upcomingEvents', childId],
    queryFn: async (): Promise<UpcomingEventItem[]> => {
      const now = new Date()
      const nowISO = now.toISOString()

      const [eventsResult, recurringResult] = await Promise.all([
        supabase
          .from('calendar_events')
          .select('id, start_time, end_time, activity_name, child_id, notes, location')
          .eq('child_id', childId!)
          .gte('end_time', nowISO)
          .order('start_time', { ascending: true })
          .limit(20),
        supabase
          .from('recurring_activities')
          .select('id, activity_name, days_of_week, start_time, end_time, color, child_id')
          .eq('child_id', childId!)
          .eq('is_active', true),
      ])

      if (eventsResult.error) throw eventsResult.error
      if (recurringResult.error) throw recurringResult.error

      const dedicatedEvents: UpcomingEventItem[] = (
        (eventsResult.data ?? []) as RawCalendarEvent[]
      ).map((event) => ({
        id: event.id,
        activityName: event.activity_name || 'Untitled event',
        startTime: new Date(event.start_time),
        endTime: new Date(event.end_time),
        isRecurring: false,
        location: event.location,
        notes: event.notes,
        color: null,
      }))

      const recurringEvents = ((recurringResult.data ?? []) as RawRecurringActivity[]).flatMap(
        (activity) => expandRecurringOccurrences(activity, now),
      )

      return [...dedicatedEvents, ...recurringEvents]
        .sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
        .slice(0, MAX_UPCOMING_EVENTS)
    },
    enabled: !!childId,
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
  })
}
