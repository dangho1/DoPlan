import { CHILD_COLOR_SWATCHES } from "@/constants/ChildColors";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { supabase } from "@/lib/supabase";
import type { DayTimeRange, WeekPattern } from "./calendar/types";
import {
  getDayOfWeekMondayIndex,
  getWeekPatternForDate,
  parseMinutes,
} from "./calendar/utils";

type ChildInfo = {
  id: string;
  name: string;
  color: string | null;
};

type CalendarEventRow = {
  id: string;
  child_id: string;
  activity_name: string;
  start_time: string;
  end_time: string;
};

type RecurringActivityRow = {
  id: string;
  child_id: string;
  activity_name: string;
  days_of_week: number[];
  start_time: string;
  end_time: string;
  color?: string | null;
};

type CombinedEvent = {
  id: string;
  childId: string;
  childName: string;
  title: string;
  startLabel: string;
  endLabel: string;
  childColor: string;
  isRecurring?: boolean;
};

type CustodyScheduleRow = {
  id: string;
  child_id: string;
  days_of_week: number[];
  color: string;
  user_id: string;
  day_time_ranges: Record<number, DayTimeRange>;
  week_pattern: WeekPattern;
};

type GuardianInfo = {
  id: string;
  name: string;
};

type CustodyBarSegment = {
  id: string;
  userId: string;
  leftPercent: number;
  widthPercent: number;
  color: string;
  rowIndex: number;
};

interface CombinedCalendarProps {
  onBack?: () => void;
}

// Fallback colors for a guardian who doesn't have a custody_schedules row
// (and therefore no chosen color) yet. Kept distinct from CHILD_COLOR_SWATCHES
// so a parent's custody bar never reads as "just another child color".
const PARENT_FALLBACK_COLORS = ["#1D3557", "#E76F51", "#2A9D8F", "#6A4C93"];

const monthNames = [
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

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const isMissingWeekPatternColumnError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const maybeMessage = (error as { message?: string }).message || "";
  return (
    maybeMessage.includes("week_pattern") &&
    maybeMessage.includes("schema cache")
  );
};

const formatLocalDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getDaysInMonthGrid = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = getDayOfWeekMondayIndex(firstDay);

  const days: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) days.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day));
  }

  while (days.length % 7 !== 0) {
    days.push(null);
  }

  return days;
};

export default function CombinedCalendar({ onBack }: CombinedCalendarProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [children, setChildren] = useState<ChildInfo[]>([]);
  const [hiddenChildIds, setHiddenChildIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [events, setEvents] = useState<CalendarEventRow[]>([]);
  const [recurringActivities, setRecurringActivities] = useState<
    RecurringActivityRow[]
  >([]);
  const [custodySchedules, setCustodySchedules] = useState<
    CustodyScheduleRow[]
  >([]);
  const [guardians, setGuardians] = useState<GuardianInfo[]>([]);

  const childColorMap = useMemo(() => {
    const map: Record<string, { color: string; name: string }> = {};
    children.forEach((child, index) => {
      map[child.id] = {
        color:
          child.color ||
          CHILD_COLOR_SWATCHES[index % CHILD_COLOR_SWATCHES.length],
        name: child.name,
      };
    });
    return map;
  }, [children]);

  // Combined custody bar colors are keyed by guardian (user_id) rather than
  // by individual custody_schedules row, so a guardian's color stays
  // consistent across all of the current user's children even if their
  // per-child custody rows were set up with different colors. We seed the
  // color from whichever custody_schedules row we encounter first for that
  // guardian, and fall back to a small fixed palette for guardians who don't
  // have a custody schedule configured yet.
  const guardianColorMap = useMemo(() => {
    const map: Record<string, { color: string; name: string }> = {};
    custodySchedules.forEach((schedule) => {
      if (schedule.color && !map[schedule.user_id]) {
        map[schedule.user_id] = { color: schedule.color, name: "" };
      }
    });
    guardians.forEach((guardian, index) => {
      map[guardian.id] = {
        color:
          map[guardian.id]?.color ||
          PARENT_FALLBACK_COLORS[index % PARENT_FALLBACK_COLORS.length],
        name: guardian.name,
      };
    });
    return map;
  }, [custodySchedules, guardians]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user?.id) {
        setChildren([]);
        setEvents([]);
        setRecurringActivities([]);
        setCustodySchedules([]);
        setGuardians([]);
        return;
      }

      const { data: linkData, error: linkError } = await supabase
        .from("user_children")
        .select(
          `
            child_id,
            children (
              id,
              name,
              color
            )
          `,
        )
        .eq("user_id", user.id);

      if (linkError) {
        console.error("Error fetching linked children:", linkError);
        setChildren([]);
        setEvents([]);
        setRecurringActivities([]);
        setCustodySchedules([]);
        setGuardians([]);
        return;
      }

      const childRows =
        linkData
          ?.map((item) => item.children)
          .filter((c) => c !== null)
          .flat() || [];

      const dedupedChildren = Array.from(
        new Map(childRows.map((c: any) => [c.id, c])).values(),
      ) as ChildInfo[];

      setChildren(dedupedChildren);

      const childIds = dedupedChildren.map((child) => child.id);
      setHiddenChildIds((previous) => {
        const availableChildIds = new Set(childIds);
        return new Set(
          Array.from(previous).filter((childId) =>
            availableChildIds.has(childId),
          ),
        );
      });

      if (dedupedChildren.length === 0) {
        setEvents([]);
        setRecurringActivities([]);
        setCustodySchedules([]);
        setGuardians([]);
        return;
      }

      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0, 23, 59, 59);

      const fetchEventsAndRecurring = async () => {
        const [eventsRes, recurringRes] = await Promise.all([
          supabase
            .from("calendar_events")
            .select("id, child_id, activity_name, start_time, end_time")
            .in("child_id", childIds)
            .gte("start_time", firstDay.toISOString())
            .lte("start_time", lastDay.toISOString()),
          supabase
            .from("recurring_activities")
            .select(
              "id, child_id, activity_name, days_of_week, start_time, end_time, color",
            )
            .in("child_id", childIds)
            .eq("is_active", true),
        ]);

        if (eventsRes.error) {
          console.error("Error fetching combined events:", eventsRes.error);
        }
        if (recurringRes.error) {
          console.error(
            "Error fetching recurring activities:",
            recurringRes.error,
          );
        }

        setEvents(
          (eventsRes.data || []).filter(
            (event): event is CalendarEventRow =>
              event.child_id !== null && event.activity_name !== null,
          ),
        );
        setRecurringActivities(recurringRes.data || []);
      };

      // Fetch custody_schedules across ALL of the user's children (not a
      // single child like calendar.tsx does) so the combined view can show
      // one aggregated "who has responsibility today" bar, plus the list of
      // guardians (parents) who have access to any of these children so we
      // can label that bar with names.
      const fetchCustodyAndGuardians = async () => {
        let { data: custodyData, error: custodyError } = await supabase
          .from("custody_schedules")
          .select(
            "id, child_id, days_of_week, color, user_id, day_time_ranges, week_pattern",
          )
          .in("child_id", childIds);

        if (custodyError && isMissingWeekPatternColumnError(custodyError)) {
          const fallback = await supabase
            .from("custody_schedules")
            .select(
              "id, child_id, days_of_week, color, user_id, day_time_ranges",
            )
            .in("child_id", childIds);
          custodyData = fallback.data as typeof custodyData;
          custodyError = fallback.error;
        }

        if (custodyError) {
          console.error(
            "Error fetching custody schedules:",
            custodyError,
          );
          setCustodySchedules([]);
        } else {
          setCustodySchedules(
            (custodyData || []).map((schedule) => ({
              ...schedule,
              day_time_ranges:
                schedule.day_time_ranges &&
                typeof schedule.day_time_ranges === "object" &&
                !Array.isArray(schedule.day_time_ranges)
                  ? (schedule.day_time_ranges as unknown as Record<
                      number,
                      DayTimeRange
                    >)
                  : {},
              week_pattern: (schedule.week_pattern === "odd" ||
              schedule.week_pattern === "even"
                ? schedule.week_pattern
                : "all") as WeekPattern,
            })),
          );
        }

        const { data: userChildrenData, error: userChildrenError } =
          await supabase
            .from("user_children")
            .select("user_id")
            .in("child_id", childIds);

        if (userChildrenError) {
          console.error(
            "Error fetching guardians for combined calendar:",
            userChildrenError,
          );
          setGuardians([]);
          return;
        }

        const guardianIds = Array.from(
          new Set((userChildrenData || []).map((row) => row.user_id)),
        );

        if (guardianIds.length === 0) {
          setGuardians([]);
          return;
        }

        const { data: profilesData, error: profilesError } = await supabase
          .from("user_profiles")
          .select("user_id, email, display_name, first_name, last_name")
          .in("user_id", guardianIds);

        if (profilesError) {
          console.error("Error fetching guardian profiles:", profilesError);
          setGuardians([]);
          return;
        }

        setGuardians(
          (profilesData || []).map((profile) => {
            let name = "";
            if (profile.display_name) {
              name = profile.display_name;
            } else if (profile.first_name && profile.last_name) {
              name = `${profile.first_name} ${profile.last_name}`;
            } else if (profile.email) {
              name = profile.email;
            } else {
              name = "Guardian";
            }
            if (profile.user_id === user.id) {
              name = `${name} (You)`;
            }
            return { id: profile.user_id, name };
          }),
        );
      };

      await Promise.all([
        fetchEventsAndRecurring(),
        fetchCustodyAndGuardians(),
      ]);
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getCombinedEventsForDate = (date: Date): CombinedEvent[] => {
    const dateKey = formatLocalDateKey(date);
    const dayOfWeek = getDayOfWeekMondayIndex(date);

    const regular = events
      .filter(
        (event) =>
          !hiddenChildIds.has(event.child_id) &&
          formatLocalDateKey(new Date(event.start_time)) === dateKey,
      )
      .map((event) => {
        const childMeta = childColorMap[event.child_id];
        return {
          id: event.id,
          childId: event.child_id,
          childName: childMeta?.name || "Unknown child",
          childColor: childMeta?.color || theme.primary,
          title: event.activity_name,
          startLabel: new Date(event.start_time).toTimeString().slice(0, 5),
          endLabel: new Date(event.end_time).toTimeString().slice(0, 5),
        };
      });

    const recurring = recurringActivities
      .filter(
        (activity) =>
          !hiddenChildIds.has(activity.child_id) &&
          activity.days_of_week.includes(dayOfWeek),
      )
      .map((activity) => {
        const childMeta = childColorMap[activity.child_id];
        return {
          id: `rec-${activity.id}-${dateKey}`,
          childId: activity.child_id,
          childName: childMeta?.name || "Unknown child",
          childColor: childMeta?.color || activity.color || theme.primary,
          title: activity.activity_name,
          startLabel: activity.start_time.slice(0, 5),
          endLabel: activity.end_time.slice(0, 5),
          isRecurring: true,
        };
      });

    return [...regular, ...recurring].sort((a, b) =>
      a.startLabel.localeCompare(b.startLabel),
    );
  };

  const getChildrenWithEventsOnDate = (date: Date) => {
    const eventChildren = new Set(
      getCombinedEventsForDate(date).map((event) => event.childId),
    );
    return Array.from(eventChildren);
  };

  // Aggregates custody_schedules across ALL of the user's children into one
  // set of "who has responsibility" bar segments for a given day. Segments
  // are grouped/deduped by guardian (user_id) rather than kept per-child, so
  // if two children share the same guardian and time range on a given day
  // (the common case) the combined view shows a single bar for that
  // guardian instead of visually-redundant stacked duplicates. If different
  // children have different guardians or time ranges on the same day, each
  // distinct (guardian, time range) combination still renders as its own
  // segment.
  const getCustodyBarSegmentsForDate = (date: Date): CustodyBarSegment[] => {
    const dayOfWeek = getDayOfWeekMondayIndex(date);
    const weekPattern = getWeekPatternForDate(date);

    const rawSegments: {
      startMinutes: number;
      endMinutes: number;
      userId: string;
    }[] = [];

    custodySchedules.forEach((schedule) => {
      if (!schedule.days_of_week.includes(dayOfWeek)) return;

      const scheduleWeekPattern = schedule.week_pattern || "all";
      if (
        scheduleWeekPattern !== "all" &&
        scheduleWeekPattern !== weekPattern
      ) {
        return;
      }

      const ranges = schedule.day_time_ranges || {};
      const dayRange = ranges[dayOfWeek];

      if (!dayRange?.start || !dayRange?.end) {
        rawSegments.push({
          startMinutes: 0,
          endMinutes: 24 * 60,
          userId: schedule.user_id,
        });
        return;
      }

      const startMinutes = parseMinutes(dayRange.start);
      const endMinutes = parseMinutes(dayRange.end);

      if (
        startMinutes === null ||
        endMinutes === null ||
        startMinutes === endMinutes
      ) {
        rawSegments.push({
          startMinutes: 0,
          endMinutes: 24 * 60,
          userId: schedule.user_id,
        });
        return;
      }

      if (endMinutes > startMinutes) {
        rawSegments.push({ startMinutes, endMinutes, userId: schedule.user_id });
        return;
      }

      // Overnight custody windows are split into two visible day segments.
      rawSegments.push({
        startMinutes: 0,
        endMinutes,
        userId: schedule.user_id,
      });
      rawSegments.push({
        startMinutes,
        endMinutes: 24 * 60,
        userId: schedule.user_id,
      });
    });

    const dedupedSegments = Array.from(
      new Map(
        rawSegments.map((segment) => [
          `${segment.userId}-${segment.startMinutes}-${segment.endMinutes}`,
          segment,
        ]),
      ).values(),
    );

    return dedupedSegments.map((segment, index) => {
      const guardianMeta = guardianColorMap[segment.userId];
      return {
        id: `${segment.userId}-${segment.startMinutes}-${segment.endMinutes}-${index}`,
        userId: segment.userId,
        leftPercent: (segment.startMinutes / (24 * 60)) * 100,
        widthPercent: Math.max(
          1,
          ((segment.endMinutes - segment.startMinutes) / (24 * 60)) * 100,
        ),
        color: guardianMeta?.color || theme.primary,
        rowIndex: index,
      };
    });
  };

  const getGuardiansWithCustodyForDate = (date: Date) => {
    const segments = getCustodyBarSegmentsForDate(date);
    const seen = new Set<string>();
    const result: { userId: string; name: string; color: string }[] = [];

    segments.forEach((segment) => {
      if (seen.has(segment.userId)) return;
      seen.add(segment.userId);
      const guardianMeta = guardianColorMap[segment.userId];
      result.push({
        userId: segment.userId,
        name: guardianMeta?.name || "Guardian",
        color: segment.color,
      });
    });

    return result;
  };

  const days = getDaysInMonthGrid(currentMonth);
  const selectedEvents = getCombinedEventsForDate(selectedDate);
  const selectedCustodyGuardians = getGuardiansWithCustodyForDate(selectedDate);
  const visibleChildrenCount = children.length - hiddenChildIds.size;

  const toggleChildCalendar = (childId: string) => {
    setHiddenChildIds((previous) => {
      const next = new Set(previous);
      if (next.has(childId)) {
        next.delete(childId);
      } else {
        next.add(childId);
      }
      return next;
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.headerRow}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={[styles.backButtonText, { color: theme.tint }]}>
              Back
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.backButton} />
        )}
        <Text style={[styles.headerTitle, { color: theme.text }]}>
          Combined Calendar
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <View
        style={[styles.monthCard, { backgroundColor: theme.cardBackground }]}
      >
        <View style={styles.monthHeader}>
          <TouchableOpacity
            style={[styles.monthNavButton, { borderColor: theme.border }]}
            onPress={() =>
              setCurrentMonth(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
              )
            }
          >
            <Text style={[styles.monthNavText, { color: theme.text }]}>‹</Text>
          </TouchableOpacity>
          <Text style={[styles.monthTitle, { color: theme.text }]}>
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </Text>
          <TouchableOpacity
            style={[styles.monthNavButton, { borderColor: theme.border }]}
            onPress={() =>
              setCurrentMonth(
                (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
              )
            }
          >
            <Text style={[styles.monthNavText, { color: theme.text }]}>›</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.dayNamesRow}>
          {dayNames.map((day) => (
            <Text
              key={day}
              style={[styles.dayName, { color: theme.textSecondary }]}
            >
              {day}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {days.map((day, index) => {
            if (!day) {
              return <View key={`empty-${index}`} style={styles.dayCell} />;
            }

            const dateKey = formatLocalDateKey(day);
            const selectedKey = formatLocalDateKey(selectedDate);
            const isSelected = selectedKey === dateKey;
            const childIds = getChildrenWithEventsOnDate(day);
            const custodySegments = getCustodyBarSegmentsForDate(day);

            return (
              <View key={dateKey} style={styles.dayCell}>
                <TouchableOpacity
                  style={[
                    styles.dayTouchable,
                    {
                      backgroundColor: isSelected
                        ? theme.primary
                        : theme.inputBackground,
                      borderColor: isSelected ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setSelectedDate(day)}
                >
                  {custodySegments.length > 0 ? (
                    <View
                      style={[
                        styles.custodyBarContainer,
                        { height: Math.min(custodySegments.length * 3, 9) },
                      ]}
                      pointerEvents="none"
                    >
                      {custodySegments.map((segment) => (
                        <View
                          key={segment.id}
                          style={[
                            styles.custodyBar,
                            {
                              backgroundColor: segment.color,
                              left: `${segment.leftPercent}%`,
                              top: (segment.rowIndex % 3) * 3,
                              width: `${segment.widthPercent}%`,
                            },
                          ]}
                        />
                      ))}
                    </View>
                  ) : null}
                  <Text
                    style={[
                      styles.dayNumber,
                      { color: isSelected ? theme.buttonText : theme.text },
                    ]}
                  >
                    {day.getDate()}
                  </Text>
                  <View style={styles.dotRow}>
                    {childIds.slice(0, 4).map((childId) => (
                      <View
                        key={`${dateKey}-${childId}`}
                        style={[
                          styles.eventDot,
                          {
                            backgroundColor:
                              childColorMap[childId]?.color || theme.primary,
                          },
                        ]}
                      />
                    ))}
                  </View>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.calendarFilterHeader}>
        <Text style={[styles.calendarFilterTitle, { color: theme.text }]}>
          Calendars ({visibleChildrenCount}/{children.length})
        </Text>
        {hiddenChildIds.size > 0 ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Show all children's calendars"
            onPress={() => setHiddenChildIds(new Set<string>())}
            style={styles.showAllButton}
          >
            <Text style={[styles.showAllText, { color: theme.tint }]}>
              Show all
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.legendScroll}
        contentContainerStyle={styles.legendRow}
      >
        {children.map((child) => {
          const isVisible = !hiddenChildIds.has(child.id);
          const childColor = childColorMap[child.id]?.color || theme.primary;

          return (
            <TouchableOpacity
              key={child.id}
              accessibilityRole="checkbox"
              accessibilityLabel={`${child.name} calendar`}
              accessibilityState={{ checked: isVisible }}
              activeOpacity={0.7}
              onPress={() => toggleChildCalendar(child.id)}
              style={[
                styles.legendItem,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: isVisible ? childColor : theme.border,
                  opacity: isVisible ? 1 : 0.5,
                },
              ]}
            >
              <View style={[styles.legendColor, { backgroundColor: childColor }]} />
              <Text
                style={[
                  styles.legendText,
                  {
                    color: theme.text,
                    textDecorationLine: isVisible ? "none" : "line-through",
                  },
                ]}
              >
                {child.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {guardians.length > 0 ? (
        <>
          <Text style={[styles.calendarFilterTitle, { color: theme.text }]}>
            Parents
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.legendScroll}
            contentContainerStyle={styles.legendRow}
          >
            {guardians.map((guardian) => (
              <View
                key={guardian.id}
                style={[
                  styles.legendItem,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.legendColor,
                    {
                      backgroundColor:
                        guardianColorMap[guardian.id]?.color || theme.primary,
                    },
                  ]}
                />
                <Text style={[styles.legendText, { color: theme.text }]}>
                  {guardian.name}
                </Text>
              </View>
            ))}
          </ScrollView>
        </>
      ) : null}

      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {selectedDate.toDateString()}
      </Text>

      {selectedCustodyGuardians.length > 0 ? (
        <View style={styles.custodySummaryWrap}>
          {selectedCustodyGuardians.map((guardian) => (
            <View key={guardian.userId} style={styles.custodySummaryRow}>
              <View
                style={[
                  styles.custodySummaryDot,
                  { backgroundColor: guardian.color },
                ]}
              />
              <Text
                style={[
                  styles.custodySummaryText,
                  { color: theme.textSecondary },
                ]}
              >
                Custody: {guardian.name}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading combined calendar...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.eventsScroll}
          contentContainerStyle={styles.eventsContent}
          showsVerticalScrollIndicator={false}
        >
          {selectedEvents.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {visibleChildrenCount === 0
                ? "Select a calendar to see events"
                : "No events for this day"}
            </Text>
          ) : (
            selectedEvents.map((event) => (
              <View
                key={event.id}
                style={[
                  styles.eventCard,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.border,
                    borderLeftColor: event.childColor,
                  },
                ]}
              >
                <View style={styles.eventRowTop}>
                  <Text
                    style={[styles.eventTitle, { color: theme.text }]}
                    numberOfLines={1}
                  >
                    {event.title}
                  </Text>
                  {event.isRecurring ? (
                    <Text
                      style={[
                        styles.recurringBadge,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Recurring
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={[styles.eventMeta, { color: theme.textSecondary }]}
                >
                  {event.startLabel} - {event.endLabel}
                </Text>
                <Text style={[styles.eventChild, { color: event.childColor }]}>
                  {event.childName}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
    marginRight: 24,
  },
  headerSpacer: {
    width: 24,
  },
  monthCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  monthNavButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  monthNavText: {
    fontSize: 20,
    fontWeight: "700",
    lineHeight: 24,
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  dayNamesRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  dayName: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.2857%",
    aspectRatio: 1,
    padding: 4,
  },
  dayTouchable: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 6,
    overflow: "hidden",
  },
  custodyBarContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  custodyBar: {
    position: "absolute",
    top: 0,
    height: 3,
    borderRadius: 1.5,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: "700",
  },
  dotRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 4,
    gap: 3,
    minHeight: 8,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  calendarFilterHeader: {
    minHeight: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  calendarFilterTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  showAllButton: {
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  showAllText: {
    fontSize: 13,
    fontWeight: "700",
  },
  legendScroll: {
    flexGrow: 0,
    marginBottom: 8,
  },
  legendRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 16,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  legendColor: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  custodySummaryWrap: {
    marginBottom: 8,
    gap: 4,
  },
  custodySummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  custodySummaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  custodySummaryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  eventsScroll: {
    flex: 1,
  },
  eventsContent: {
    paddingBottom: 20,
    gap: 8,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 16,
    fontSize: 15,
  },
  eventCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  eventRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  eventTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  recurringBadge: {
    fontSize: 11,
    fontWeight: "600",
  },
  eventMeta: {
    marginTop: 4,
    fontSize: 13,
  },
  eventChild: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "700",
  },
});
