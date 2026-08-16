import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import {
  useUpcomingEvents,
  type UpcomingEventItem,
} from "@/hooks/queries/useUpcomingEvents";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface NextEventCardProps {
  childId: string | undefined;
  onPress: () => void;
}

interface RelativeDayInfo {
  label: string;
  isToday: boolean;
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Turns a Date into a short, unambiguous "when" label. Anything that isn't
// today gets its own distinct label so it reads clearly against the day
// badge's accent color (see DIFFERENT_DAY_ACCENT below).
function getRelativeDayInfo(date: Date, now: Date): RelativeDayInfo {
  const diffDays = Math.round(
    (startOfDay(date).getTime() - startOfDay(now).getTime()) / 86400000,
  );

  if (diffDays <= 0) return { label: "Today", isToday: true };
  if (diffDays === 1) return { label: "Tomorrow", isToday: false };
  if (diffDays <= 6) return { label: `In ${diffDays} days`, isToday: false };

  return {
    label: date.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    }),
    isToday: false,
  };
}

const formatTime = (date: Date) =>
  date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

// A dedicated accent (independent of the app's green tint) used only when the
// next event is NOT today, so "this is a different/upcoming date" reads at a
// glance rather than blending into the rest of the card.
const DIFFERENT_DAY_ACCENT = { light: "#2F80ED", dark: "#5B9BF7" };

export default function NextEventCard({ childId, onPress }: NextEventCardProps) {
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const differentDayAccent = DIFFERENT_DAY_ACCENT[colorScheme ?? "light"];

  const {
    data: upcomingEvents,
    isLoading,
    isError,
  } = useUpcomingEvents(childId);

  if (!childId) return null;

  if (isLoading) {
    return (
      <View
        style={[
          styles.card,
          styles.centeredCard,
          { backgroundColor: theme.cardBackground },
        ]}
      >
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  if (isError) {
    return (
      <View
        style={[
          styles.card,
          styles.centeredCard,
          { backgroundColor: theme.cardBackground },
        ]}
      >
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          Couldn&apos;t load upcoming events.
        </Text>
      </View>
    );
  }

  const events = upcomingEvents ?? [];
  const nextEvent: UpcomingEventItem | undefined = events[0];
  const restOfEvents = events.slice(1);

  if (!nextEvent) {
    return (
      <TouchableOpacity
        style={[
          styles.card,
          styles.centeredCard,
          { backgroundColor: theme.cardBackground },
        ]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="No upcoming events, open calendar"
      >
        <Ionicons name="calendar-outline" size={22} color={theme.textSecondary} />
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          No upcoming events
        </Text>
      </TouchableOpacity>
    );
  }

  const now = new Date();
  const dayInfo = getRelativeDayInfo(nextEvent.startTime, now);
  const badgeColor = dayInfo.isToday ? theme.tint : differentDayAccent;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: theme.cardBackground }]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Next event: ${nextEvent.activityName}, ${dayInfo.label}, ${formatTime(nextEvent.startTime)}`}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.eyebrow, { color: theme.textSecondary }]}>
            NEXT EVENT
          </Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textLight} />
        </View>

        <View style={styles.mainRow}>
          <View style={[styles.dayBadge, { backgroundColor: badgeColor }]}>
            <Text style={styles.dayBadgeText}>{dayInfo.label}</Text>
          </View>
          <View style={styles.eventInfo}>
            <Text
              style={[styles.eventTitle, { color: theme.text }]}
              numberOfLines={1}
            >
              {nextEvent.activityName}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons
                name={nextEvent.isRecurring ? "repeat-outline" : "time-outline"}
                size={14}
                color={theme.textSecondary}
              />
              <Text style={[styles.eventMeta, { color: theme.textSecondary }]}>
                {formatTime(nextEvent.startTime)} – {formatTime(nextEvent.endTime)}
              </Text>
            </View>
            {nextEvent.location ? (
              <View style={styles.metaRow}>
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={theme.textSecondary}
                />
                <Text
                  style={[styles.eventMeta, { color: theme.textSecondary }]}
                  numberOfLines={1}
                >
                  {nextEvent.location}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>

      {restOfEvents.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.upcomingStrip}
        >
          {restOfEvents.map((item) => {
            const itemDayInfo = getRelativeDayInfo(item.startTime, now);
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.upcomingChip,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.border,
                  },
                ]}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityLabel={`${item.activityName}, ${itemDayInfo.label}, ${formatTime(item.startTime)}`}
                activeOpacity={0.85}
              >
                <Text
                  style={[
                    styles.upcomingChipDay,
                    {
                      color: itemDayInfo.isToday
                        ? theme.tint
                        : differentDayAccent,
                    },
                  ]}
                >
                  {itemDayInfo.label.toUpperCase()}
                </Text>
                <Text
                  style={[styles.upcomingChipTitle, { color: theme.text }]}
                  numberOfLines={1}
                >
                  {item.activityName}
                </Text>
                <Text style={[styles.upcomingChipTime, { color: theme.textSecondary }]}>
                  {formatTime(item.startTime)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    marginBottom: 24,
  },
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  centeredCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  dayBadge: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 68,
    alignItems: "center",
    justifyContent: "center",
  },
  dayBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  eventInfo: {
    flex: 1,
    gap: 4,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eventMeta: {
    fontSize: 13,
    flexShrink: 1,
  },
  upcomingStrip: {
    flexDirection: "row",
    gap: 10,
    paddingTop: 12,
  },
  upcomingChip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 120,
    maxWidth: 160,
    gap: 4,
  },
  upcomingChipDay: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  upcomingChipTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  upcomingChipTime: {
    fontSize: 12,
  },
});
