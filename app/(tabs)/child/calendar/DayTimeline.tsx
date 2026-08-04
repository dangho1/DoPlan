import { Colors } from "@/constants/Colors";
import React, { useMemo, useState } from "react";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import type { CalendarEvent } from "./types";
import { isAllDayEvent, layoutDayEvents } from "./utils";

/**
 * Event blocks are laid out at 1px per minute, which makes a 15 minute event a
 * 15px tall touch target — far below the ~44px platform guideline and easy to
 * miss. Short events are floored to this height and given extra hit slop so
 * they can be tapped anywhere near their slot.
 */
const MIN_EVENT_BLOCK_HEIGHT = 30;
/** Below this height there is no room for the second (time) line. */
const COMPACT_EVENT_BLOCK_HEIGHT = 44;
const EVENT_BLOCK_HIT_SLOP = { top: 6, bottom: 6, left: 6, right: 6 };

interface DayTimelineProps {
  colorScheme: "light" | "dark" | null | undefined;
  date: Date | null;
  getEventsForDate: (date: Date) => CalendarEvent[];
  onEventPress: (event: CalendarEvent) => void;
}

export function DayTimeline({
  colorScheme,
  date,
  getEventsForDate,
  onEventPress,
}: DayTimelineProps) {
  const [overlayWidth, setOverlayWidth] = useState(0);
  const pixelsPerMinute = 1;
  const timelineHeight = 24 * 60 * pixelsPerMinute;

  const laidOutEvents = useMemo(() => {
    const dayEvents = date ? getEventsForDate(date) : [];
    return layoutDayEvents(dayEvents);
  }, [date, getEventsForDate]);

  const allDayEvents = useMemo(() => {
    const dayEvents = date ? getEventsForDate(date) : [];
    return dayEvents.filter((event) => isAllDayEvent(event));
  }, [date, getEventsForDate]);

  return (
    <View style={styles.dayViewContent}>
      {allDayEvents.length > 0 ? (
        <View
          style={[
            styles.allDayContainer,
            { borderColor: Colors[colorScheme ?? "light"].border },
          ]}
        >
          <Text
            style={[
              styles.allDayTitle,
              { color: Colors[colorScheme ?? "light"].textLight },
            ]}
          >
            All day
          </Text>
          <View style={styles.allDayChipWrap}>
            {allDayEvents.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={[
                  styles.allDayChip,
                  {
                    backgroundColor:
                      event.color ?? Colors[colorScheme ?? "light"].tint,
                  },
                ]}
                onPress={() => onEventPress(event)}
              >
                <Text style={styles.allDayChipText} numberOfLines={1}>
                  {event.activity_name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      <ScrollView style={styles.dayTimelineScroll}>
        <View style={[styles.dayTimelineContainer, { height: timelineHeight }]}>
          {Array.from({ length: 24 }, (_, i) => {
            const hourString = i.toString().padStart(2, "0") + ":00";

            return (
              <View key={i} style={styles.hourRow}>
                <View style={styles.hourLabelContainer}>
                  <Text
                    style={[
                      styles.hourLabel,
                      { color: Colors[colorScheme ?? "light"].textLight },
                    ]}
                  >
                    {hourString}
                  </Text>
                </View>
                <View
                  style={[
                    styles.hourContent,
                    { borderColor: Colors[colorScheme ?? "light"].border },
                  ]}
                />
              </View>
            );
          })}

          <View
            pointerEvents="box-none"
            style={styles.dayEventsOverlay}
            onLayout={(event) => {
              setOverlayWidth(event.nativeEvent.layout.width);
            }}
          >
            {laidOutEvents.map((item) => {
              const columnWidthPct = 100 / item.columnCount;
              const leftPct = item.columnIndex * columnWidthPct;
              const eventColumnGap = 6;
              const hasMeasuredOverlayWidth = overlayWidth > 0;
              const columnWidthPx = hasMeasuredOverlayWidth
                ? Math.max(
                    0,
                    (overlayWidth - eventColumnGap * (item.columnCount - 1)) /
                      item.columnCount,
                  )
                : null;
              const leftPx = hasMeasuredOverlayWidth
                ? item.columnIndex * ((columnWidthPx ?? 0) + eventColumnGap)
                : null;

              const blockHeight = Math.max(
                item.durationMinutes * pixelsPerMinute,
                MIN_EVENT_BLOCK_HEIGHT,
              );
              const isCompact = blockHeight < COMPACT_EVENT_BLOCK_HEIGHT;

              return (
                <TouchableOpacity
                  key={item.event.id}
                  style={[
                    styles.dayEventBlock,
                    isCompact && styles.dayEventBlockCompact,
                    {
                      backgroundColor:
                        item.event.color ?? Colors[colorScheme ?? "light"].tint,
                      height: blockHeight,
                      top: item.startMinutes * pixelsPerMinute,
                      left: leftPx !== null ? leftPx : `${leftPct}%`,
                      width:
                        columnWidthPx !== null
                          ? columnWidthPx
                          : `${columnWidthPct}%`,
                    },
                  ]}
                  hitSlop={EVENT_BLOCK_HIT_SLOP}
                  onPress={() => onEventPress(item.event)}
                >
                  <Text
                    style={[
                      styles.dayEventName,
                      isCompact && styles.dayEventNameCompact,
                    ]}
                    numberOfLines={1}
                  >
                    {item.event.activity_name}
                  </Text>
                  {isCompact ? null : (
                    <Text style={styles.dayEventTime} numberOfLines={1}>
                      {item.startTimeStr.substring(0, 5)} -{" "}
                      {item.endTimeStr.substring(0, 5)}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  dayViewContent: {
    flex: 1,
    width: "100%",
  },
  dayTimelineScroll: {
    flex: 1,
    width: "100%",
  },
  allDayContainer: {
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
  },
  allDayTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  allDayChipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  allDayChip: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: "100%",
  },
  allDayChipText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  dayTimelineContainer: {
    position: "relative",
    width: "100%",
    paddingLeft: 0,
    paddingRight: 0,
  },
  hourRow: {
    flexDirection: "row",
    height: 60,
  },
  hourLabelContainer: {
    width: 44,
    position: "absolute",
    left: 4,
    top: 0,
    bottom: 0,
    justifyContent: "flex-start",
    alignItems: "flex-start",
    paddingTop: 2,
    paddingLeft: 8,
  },
  hourLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  hourContent: {
    marginLeft: 0,
    flex: 1,
    borderTopWidth: 1,
  },
  dayEventsOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  dayEventBlock: {
    position: "absolute",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
    overflow: "hidden",
    zIndex: 3,
    elevation: 3,
  },
  dayEventBlockCompact: {
    justifyContent: "center",
    paddingVertical: 2,
  },
  dayEventName: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  dayEventNameCompact: {
    fontSize: 11,
  },
  dayEventTime: {
    color: "rgba(255, 255, 255, 0.95)",
    fontSize: 10,
    marginTop: 2,
  },
});
