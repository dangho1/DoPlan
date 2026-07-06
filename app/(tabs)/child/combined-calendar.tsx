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

type ChildInfo = {
  id: string;
  name: string;
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

interface CombinedCalendarProps {
  onBack: () => void;
}

const CHILD_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F3A683",
  "#786FA6",
  "#F8B500",
];

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

const getDayOfWeekMondayIndex = (date: Date) => {
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
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

  const childColorMap = useMemo(() => {
    const map: Record<string, { color: string; name: string }> = {};
    children.forEach((child, index) => {
      map[child.id] = {
        color: CHILD_COLORS[index % CHILD_COLORS.length],
        name: child.name,
      };
    });
    return map;
  }, [children]);

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
        return;
      }

      const { data: linkData, error: linkError } = await supabase
        .from("user_children")
        .select(
          `
            child_id,
            children (
              id,
              name
            )
          `,
        )
        .eq("user_id", user.id);

      if (linkError) {
        console.error("Error fetching linked children:", linkError);
        setChildren([]);
        setEvents([]);
        setRecurringActivities([]);
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
        return;
      }

      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0, 23, 59, 59);

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

  const days = getDaysInMonthGrid(currentMonth);
  const selectedEvents = getCombinedEventsForDate(selectedDate);
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
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: theme.tint }]}>
            Back
          </Text>
        </TouchableOpacity>
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

      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {selectedDate.toDateString()}
      </Text>

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
