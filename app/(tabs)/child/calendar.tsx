import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  InputAccessoryView,
  Keyboard,
  LayoutAnimation,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
  type GestureResponderEvent,
} from "react-native";
import {
  PanGestureHandler,
  State,
  type PanGestureHandlerStateChangeEvent,
} from "react-native-gesture-handler";
import {
  cancelEventAlert,
  EVENT_ALERT_OPTIONS,
  rescheduleEventAlertFromPreference,
  scheduleEventAlert,
} from "@/lib/eventNotifications";
import { supabase } from "@/lib/supabase";
import { DayTimeline } from "./calendar/DayTimeline";
import type {
  CalendarEvent,
  CustodyDraft,
  CustodySchedule,
  CustodyScheduleChangeRequest,
  CustodyTemplate,
  RecurringActivity,
  WeekPattern,
} from "./calendar/types";
import {
  buildCustodyTemplate,
  formatLocalDateInput,
  formatLocalDateKey,
  getDayOfWeekMondayIndex,
  getDaysInMonth,
  getShiftedDate,
  getWeekPatternForDate,
  parseLocalDateInput,
  parseMinutes,
} from "./calendar/utils";


const TIME_WHEEL_ITEM_HEIGHT = 44;
const TIME_WHEEL_VISIBLE_ITEMS = 5;
const TIME_WHEEL_VERTICAL_PADDING =
  (TIME_WHEEL_ITEM_HEIGHT * (TIME_WHEEL_VISIBLE_ITEMS - 1)) / 2;

const formatTimeUnit = (value: number) => value.toString().padStart(2, "0");

const normalizeClockTime = (value: string) => {
  const [rawHour = "0", rawMinute = "0"] = value.split(":");
  const hour = Number.parseInt(rawHour, 10);
  const minute = Number.parseInt(rawMinute, 10);

  return `${formatTimeUnit(Number.isFinite(hour) ? Math.min(Math.max(hour, 0), 23) : 0)}:${formatTimeUnit(
    Number.isFinite(minute) ? Math.min(Math.max(minute, 0), 59) : 0,
  )}`;
};

type TimeWheelPickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function TimeWheelPicker({ label, value, onChange }: TimeWheelPickerProps) {
  const colorScheme = useColorScheme();
  const normalizedValue = normalizeClockTime(value);
  const [selectedHour, selectedMinute] = normalizedValue.split(":").map(Number);
  const hourScrollRef = useRef<ScrollView | null>(null);
  const minuteScrollRef = useRef<ScrollView | null>(null);
  const hours = Array.from({ length: 24 }, (_, index) => index);
  const minutes = Array.from({ length: 60 }, (_, index) => index);

  useEffect(() => {
    hourScrollRef.current?.scrollTo({
      y: selectedHour * TIME_WHEEL_ITEM_HEIGHT,
      animated: false,
    });
    minuteScrollRef.current?.scrollTo({
      y: selectedMinute * TIME_WHEEL_ITEM_HEIGHT,
      animated: false,
    });
  }, [selectedHour, selectedMinute]);

  const updateTime = (nextHour: number, nextMinute: number) => {
    onChange(`${formatTimeUnit(nextHour)}:${formatTimeUnit(nextMinute)}`);
  };

  const handleWheelEnd = (type: "hour" | "minute", offsetY: number) => {
    const maxValue = type === "hour" ? 23 : 59;
    const nextValue = Math.min(
      Math.max(Math.round(offsetY / TIME_WHEEL_ITEM_HEIGHT), 0),
      maxValue,
    );

    if (type === "hour") {
      updateTime(nextValue, selectedMinute);
      return;
    }

    updateTime(selectedHour, nextValue);
  };

  const renderWheel = (
    values: number[],
    selectedValue: number,
    type: "hour" | "minute",
    ref: React.RefObject<ScrollView | null>,
  ) => (
    <ScrollView
      ref={ref}
      showsVerticalScrollIndicator={false}
      snapToInterval={TIME_WHEEL_ITEM_HEIGHT}
      decelerationRate="fast"
      bounces={false}
      contentContainerStyle={styles.timeWheelContent}
      onMomentumScrollEnd={(event) =>
        handleWheelEnd(type, event.nativeEvent.contentOffset.y)
      }
      onScrollEndDrag={(event) =>
        handleWheelEnd(type, event.nativeEvent.contentOffset.y)
      }
    >
      {values.map((item) => {
        const isSelected = item === selectedValue;
        return (
          <View key={`${type}-${item}`} style={styles.timeWheelItem}>
            <Text
              style={[
                styles.timeWheelItemText,
                {
                  color: isSelected
                    ? Colors[colorScheme ?? "light"].text
                    : Colors[colorScheme ?? "light"].textLight,
                  opacity: isSelected ? 1 : 0.45,
                },
              ]}
            >
              {formatTimeUnit(item)}
            </Text>
          </View>
        );
      })}
    </ScrollView>
  );

  return (
    <View style={styles.timeWheelContainer}>
      <Text
        style={[styles.timeLabel, { color: Colors[colorScheme ?? "light"].text }]}
      >
        {label}
      </Text>
      <View
        style={[
          styles.timeWheelFrame,
          {
            backgroundColor: Colors[colorScheme ?? "light"].inputBackground,
            borderColor: Colors[colorScheme ?? "light"].border,
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.timeWheelSelection,
            { backgroundColor: colorScheme === "dark" ? "#3A3A3C" : "#E9E9EC" },
          ]}
        />
        {renderWheel(hours, selectedHour, "hour", hourScrollRef)}
        <Text
          pointerEvents="none"
          style={[styles.timeWheelSeparator, { color: Colors[colorScheme ?? "light"].text }]}
        >
          :
        </Text>
        {renderWheel(minutes, selectedMinute, "minute", minuteScrollRef)}
      </View>
    </View>
  );
}

interface CalendarProps {
  childName?: string;
  childId?: string;
  onCancel?: () => void;
}

export default function Calendar({
  childName,
  childId,
  onCancel,
}: CalendarProps) {
  const router = useRouter();
  const params = useLocalSearchParams<{
    childName?: string;
    childId?: string;
  }>();
  const resolvedChildName =
    childName ?? (typeof params.childName === "string" ? params.childName : "");
  const resolvedChildId =
    childId ?? (typeof params.childId === "string" ? params.childId : "");
  const handleCancel = onCancel ?? (() => router.back());
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme ?? "light"];
  const isDarkMode = (colorScheme ?? "light") === "dark";
  const addEventScrollRef = useRef<ScrollView | null>(null);
  const addEventDateInputRef = useRef<TextInput | null>(null);
  const addEventNameInputRef = useRef<TextInput | null>(null);
  const currentAddEventScrollYRef = useRef(0);
  const pendingAddEventFocusRef = useRef<TextInput | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [custodySchedules, setCustodySchedules] = useState<CustodySchedule[]>(
    [],
  );
  const [recurringActivities, setRecurringActivities] = useState<
    RecurringActivity[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [addEventModalVisible, setAddEventModalVisible] = useState(false);
  const [dayViewModalVisible, setDayViewModalVisible] = useState(false);
  const [editEventModalVisible, setEditEventModalVisible] = useState(false);
  const [custodyModalVisible, setCustodyModalVisible] = useState(false);
  const [fabMenuVisible, setFabMenuVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [newEventName, setNewEventName] = useState("");
  const [newEventAllDay, setNewEventAllDay] = useState(false);
  const [newEventRepeat, setNewEventRepeat] = useState<"none" | "weekly">(
    "none",
  );
  const [newEventAlertMinutes, setNewEventAlertMinutes] = useState<
    number | null
  >(null);
  const [newEventAlertDropdownOpen, setNewEventAlertDropdownOpen] =
    useState(false);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [dateInputText, setDateInputText] = useState("");
  const hourRowHeight = 60;
  const timelineHeight = 24 * hourRowHeight;
  const [editDateInputText, setEditDateInputText] = useState("");
  const [parents, setParents] = useState<
    { id: string; name: string; color: string }[]
  >([]);
  const [addEventKeyboardVisible, setAddEventKeyboardVisible] = useState(false);
  const [transitionDate, setTransitionDate] = useState<Date | null>(null);
  const [custodyDrafts, setCustodyDrafts] = useState<
    Record<string, CustodyDraft>
  >({});
  const [custodyChangeRequests, setCustodyChangeRequests] = useState<
    CustodyScheduleChangeRequest[]
  >([]);

  const dayContentTranslateX = useRef(new Animated.Value(0)).current;
  const transitionContentTranslateX = useRef(new Animated.Value(0)).current;
  const isDayTransitioningRef = useRef(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);

  const addEventDateAccessoryId = "calendarAddEventDateAccessory";
  const addEventNameAccessoryId = "calendarAddEventNameAccessory";

  const selectedAlertLabel =
    EVENT_ALERT_OPTIONS.find(
      (option) => option.minutesBefore === newEventAlertMinutes,
    )?.label ?? "None";

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [resolvedChildId, currentMonth]);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAddEventKeyboardVisible(true);
    });
    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setAddEventKeyboardVisible(false);
      pendingAddEventFocusRef.current = null;
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const loadData = async () => {
    await Promise.all([
      fetchEvents(),
      fetchCustodySchedules(),
      fetchRecurringActivities(),
      fetchParents(),
      fetchCustodyChangeRequests(),
    ]);
    setLoading(false);
  };

  const isMissingWeekPatternColumnError = (error: unknown) => {
    if (!error || typeof error !== "object") return false;
    const maybeMessage = (error as { message?: string }).message || "";
    return (
      maybeMessage.includes("week_pattern") &&
      maybeMessage.includes("schema cache")
    );
  };

  const dismissAddEventKeyboard = () => {
    Keyboard.dismiss();
  };

  const handleAddEventInputFocus = (inputRef: TextInput | null) => {
    pendingAddEventFocusRef.current = inputRef;
    setTimeout(() => {
      const ref = pendingAddEventFocusRef.current;
      if (!ref || !addEventScrollRef.current) return;

      // Keep focused input clear of keyboard when modal is scrolled.
      addEventScrollRef.current.scrollTo({
        y: currentAddEventScrollYRef.current + 120,
        animated: true,
      });
    }, 120);
  };

  const fetchParents = async () => {
    try {
      const { data: userChildrenData, error: userChildrenError } =
        await supabase
          .from("user_children")
          .select("user_id")
          .eq("child_id", resolvedChildId);

      if (userChildrenError) {
        console.error("Error fetching user_children:", userChildrenError);
        return;
      }

      if (!userChildrenData || userChildrenData.length === 0) {
        console.log("No parents found for child:", resolvedChildId);
        setParents([]);
        return;
      }

      // Get the user IDs
      const userIds = userChildrenData.map((uc) => uc.user_id);

      // Fetch user profiles for those user IDs
      const { data: profilesData, error: profilesError } = await supabase
        .from("user_profiles")
        .select("user_id, email, display_name, first_name, last_name")
        .in("user_id", userIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        return;
      }

      console.log("Found profiles:", profilesData);

      // Get current user to add "(You)" indicator
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Create parent list with colors
      const colors = [
        "#FF6B6B",
        "#4ECDC4",
        "#45B7D1",
        "#FFA07A",
        "#98D8C8",
        "#F3A683",
        "#786FA6",
        "#F8B500",
      ];
      const parentList = (profilesData || []).map(
        (profile: any, index: number) => {
          // Get name from profile - prefer display_name
          let name = "";
          if (profile.display_name) {
            name = profile.display_name;
          } else if (profile.first_name && profile.last_name) {
            name = `${profile.first_name} ${profile.last_name}`;
          } else if (profile.email) {
            name = profile.email;
          } else {
            name = `Guardian ${index + 1}`;
          }

          // If this is the current user, add "(You)" indicator
          if (user && profile.user_id === user.id) {
            name = `${name} (You)`;
          }

          return {
            id: profile.user_id,
            name: name,
            color: colors[index % colors.length],
          };
        },
      );

      console.log("Parent list created:", parentList);
      setParents(parentList);
    } catch (error) {
      console.error("Error fetching parents:", error);
    }
  };

  const fetchEvents = async () => {
    try {
      const year = currentMonth.getFullYear();
      const month = currentMonth.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);

      const { data, error } = await supabase
        .from("calendar_events")
        .select(
          "id, start_time, end_time, activity_name, child_id, notes, location",
        )
        .eq("child_id", resolvedChildId)
        .gte("start_time", firstDay.toISOString())
        .lte("start_time", lastDay.toISOString());

      if (error) {
        console.error("Error fetching events:", error);
        return;
      }

      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching events:", error);
    }
  };

  const fetchCustodySchedules = async () => {
    try {
      let { data, error } = await supabase
        .from("custody_schedules")
        .select(
          "id, days_of_week, color, user_id, day_time_ranges, week_pattern",
        )
        .eq("child_id", resolvedChildId);

      if (error && isMissingWeekPatternColumnError(error)) {
        const fallback = await supabase
          .from("custody_schedules")
          .select("id, days_of_week, color, user_id, day_time_ranges")
          .eq("child_id", resolvedChildId);
        data = fallback.data as typeof data;
        error = fallback.error;
      }

      if (error) {
        console.error("Error fetching custody schedules:", error);
        return;
      }

      // Map the data to include parent_name for backward compatibility
      const schedulesWithNames =
        data?.map((schedule, index) => ({
          ...schedule,
          parent_name: `Parent ${index + 1}`, // Simple name since we don't have profile table
          day_time_ranges:
            schedule.day_time_ranges &&
            typeof schedule.day_time_ranges === "object"
              ? schedule.day_time_ranges
              : {},
          week_pattern:
            schedule.week_pattern === "odd" || schedule.week_pattern === "even"
              ? schedule.week_pattern
              : "all",
        })) || [];

      setCustodySchedules(schedulesWithNames);
    } catch (error) {
      console.error("Error fetching custody schedules:", error);
    }
  };

  const fetchCustodyChangeRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("custody_schedule_change_requests")
        .select(
          "id, child_id, requested_by, proposed_schedules, status, created_at",
        )
        .eq("child_id", resolvedChildId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (error) {
        if (
          error.message?.includes("custody_schedule_change_requests") ||
          error.message?.includes("schema cache")
        ) {
          setCustodyChangeRequests([]);
          return;
        }
        console.error("Error fetching custody change requests:", error);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id;

      setCustodyChangeRequests(
        ((data || []) as any[])
          .filter((request) => request.requested_by !== currentUserId)
          .map((request) => ({
          ...request,
          proposed_schedules:
            request.proposed_schedules &&
            typeof request.proposed_schedules === "object"
              ? request.proposed_schedules
              : {},
          })),
      );
    } catch (error) {
      console.error("Error fetching custody change requests:", error);
    }
  };

  const fetchRecurringActivities = async () => {
    try {
      const { data, error } = await supabase
        .from("recurring_activities")
        .select(
          "id, activity_name, days_of_week, start_time, end_time, color, child_id",
        )
        .eq("child_id", resolvedChildId)
        .eq("is_active", true);

      if (error) {
        console.error("Error fetching recurring activities:", error);
        return;
      }

      setRecurringActivities(data || []);
    } catch (error) {
      console.error("Error fetching recurring activities:", error);
    }
  };

  const getEventsForDate = (date: Date) => {
    const dateStr = formatLocalDateKey(date);
    const dayOfWeek = getDayOfWeekMondayIndex(date);

    // Get regular events
    const regularEvents = events.filter((event) => {
      const eventDate = formatLocalDateKey(new Date(event.start_time));
      return eventDate === dateStr;
    });

    // Get recurring activities for this day of week
    const recurringEvents = recurringActivities
      .filter((activity) => activity.days_of_week.includes(dayOfWeek))
      .map((activity) => ({
        id: `recurring-${activity.id}-${dateStr}`,
        start_time: activity.start_time,
        end_time: activity.end_time,
        activity_name: activity.activity_name,
        child_id: resolvedChildId,
        isRecurring: true,
        color: activity.color,
      }));

    return [...regularEvents, ...recurringEvents];
  };

  const getCustodyBarSegmentsForDate = (date: Date) => {
    const dayOfWeek = getDayOfWeekMondayIndex(date);
    const weekPattern = getWeekPatternForDate(date);

    const segments: Array<{
      startMinutes: number;
      endMinutes: number;
      color: string;
    }> = [];

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
        segments.push({
          startMinutes: 0,
          endMinutes: 24 * 60,
          color: schedule.color,
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
        segments.push({
          startMinutes: 0,
          endMinutes: 24 * 60,
          color: schedule.color,
        });
        return;
      }

      if (endMinutes > startMinutes) {
        segments.push({ startMinutes, endMinutes, color: schedule.color });
        return;
      }

      // Overnight custody windows are split into two visible day segments.
      segments.push({ startMinutes: 0, endMinutes, color: schedule.color });
      segments.push({
        startMinutes,
        endMinutes: 24 * 60,
        color: schedule.color,
      });
    });

    return segments.map((segment, index) => ({
      id: `${segment.color}-${segment.startMinutes}-${segment.endMinutes}-${index}`,
      leftPercent: (segment.startMinutes / (24 * 60)) * 100,
      widthPercent: Math.max(
        1,
        ((segment.endMinutes - segment.startMinutes) / (24 * 60)) * 100,
      ),
      color: segment.color,
      rowIndex: index,
    }));
  };

  const buildInitialCustodyDrafts = () => {
    const drafts: Record<string, CustodyDraft> = {};

    parents.forEach((parent) => {
      const existing = custodySchedules.find((s) => s.user_id === parent.id);
      const days = [...(existing?.days_of_week || [])].sort((a, b) => a - b);
      const dayTimeRanges: Record<number, { start: string; end: string }> = {};

      days.forEach((day) => {
        const existingRange = existing?.day_time_ranges?.[day];
        dayTimeRanges[day] = {
          start: existingRange?.start || "00:00",
          end: existingRange?.end || "23:59",
        };
      });

      drafts[parent.id] = {
        days,
        dayTimeRanges,
        weekPattern: existing?.week_pattern || "all",
      };
    });

    return drafts;
  };

  const normalizeCustodyDraftsForComparison = (
    drafts: Record<string, CustodyDraft>,
  ) =>
    parents.reduce(
      (acc, parent) => {
        const draft = drafts[parent.id] || {
          days: [],
          dayTimeRanges: {},
          weekPattern: "all" as WeekPattern,
        };
        const days = [...new Set(draft.days)].sort((a, b) => a - b);

        acc[parent.id] = {
          days,
          dayTimeRanges: days.reduce(
            (ranges, day) => {
              ranges[day] = draft.dayTimeRanges[day] || {
                start: "00:00",
                end: "23:59",
              };
              return ranges;
            },
            {} as Record<number, { start: string; end: string }>,
          ),
          weekPattern:
            draft.weekPattern === "odd" || draft.weekPattern === "even"
              ? draft.weekPattern
              : "all",
        };

        return acc;
      },
      {} as Record<string, CustodyDraft>,
    );

  const hasUnsavedCustodyChanges = () =>
    JSON.stringify(normalizeCustodyDraftsForComparison(custodyDrafts)) !==
    JSON.stringify(
      normalizeCustodyDraftsForComparison(buildInitialCustodyDrafts()),
    );

  const closeCustodyModal = () => {
    if (!hasUnsavedCustodyChanges()) {
      setCustodyModalVisible(false);
      return;
    }

    Alert.alert(
      "Unsaved changes",
      "Do you want to continue editing or save your custody schedule changes?",
      [
        { text: "Continue editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => setCustodyModalVisible(false),
        },
        { text: "Save", onPress: saveCustodySchedules },
      ],
    );
  };

  const initializeCustodyDrafts = () => {
    setCustodyDrafts(buildInitialCustodyDrafts());
  };

  useEffect(() => {
    if (!custodyModalVisible) return;
    initializeCustodyDrafts();
  }, [custodyModalVisible, custodySchedules, parents]);

  const updateCustodyDraft = (
    parentId: string,
    updater: (draft: CustodyDraft) => CustodyDraft,
  ) => {
    setCustodyDrafts((prev) => {
      const baseDraft =
        prev[parentId] ||
        ({
          days: [],
          dayTimeRanges: {},
          weekPattern: "all",
        } as CustodyDraft);
      return {
        ...prev,
        [parentId]: updater(baseDraft),
      };
    });
  };

  const toggleCustodyDay = (parentId: string, dayIndex: number) => {
    updateCustodyDraft(parentId, (draft) => {
      const isSelected = draft.days.includes(dayIndex);
      if (isSelected) {
        const nextRanges = { ...draft.dayTimeRanges };
        delete nextRanges[dayIndex];
        return {
          ...draft,
          days: draft.days.filter((d) => d !== dayIndex),
          dayTimeRanges: nextRanges,
        };
      }

      return {
        ...draft,
        days: [...draft.days, dayIndex].sort((a, b) => a - b),
        dayTimeRanges: {
          ...draft.dayTimeRanges,
          [dayIndex]: draft.dayTimeRanges[dayIndex] || {
            start: "00:00",
            end: "23:59",
          },
        },
      };
    });
  };

  const updateDraftTime = (
    parentId: string,
    dayIndex: number,
    field: "start" | "end",
    value: string,
  ) => {
    updateCustodyDraft(parentId, (draft) => {
      const dayRange =
        draft.dayTimeRanges[dayIndex] ||
        ({ start: "00:00", end: "23:59" } as const);
      return {
        ...draft,
        dayTimeRanges: {
          ...draft.dayTimeRanges,
          [dayIndex]: {
            ...dayRange,
            [field]: value,
          },
        },
      };
    });
  };

  const dayLabelForIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const setDraftWeekPattern = (parentId: string, pattern: WeekPattern) => {
    updateCustodyDraft(parentId, (draft) => ({
      ...draft,
      weekPattern: pattern,
    }));
  };

  const getReadableTextColor = (hexColor: string) => {
    const normalized = hexColor.replace("#", "");
    const fullHex =
      normalized.length === 3
        ? normalized
            .split("")
            .map((c) => c + c)
            .join("")
        : normalized;

    const r = Number.parseInt(fullHex.slice(0, 2), 16);
    const g = Number.parseInt(fullHex.slice(2, 4), 16);
    const b = Number.parseInt(fullHex.slice(4, 6), 16);

    if ([r, g, b].some((value) => Number.isNaN(value))) {
      return "#FFFFFF";
    }

    // Relative luminance approximation to choose readable text on custom colors.
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#1A1A1A" : "#FFFFFF";
  };

  const applyCustodyTemplate = (
    parentId: string,
    template: CustodyTemplate,
  ) => {
    const { days: templateDays, range: templateRange } =
      buildCustodyTemplate(template);

    updateCustodyDraft(parentId, (draft) => {
      const dayTimeRanges: Record<number, { start: string; end: string }> = {};
      templateDays.forEach((day) => {
        dayTimeRanges[day] = {
          start: templateRange.start,
          end: templateRange.end,
        };
      });

      return {
        ...draft,
        days: templateDays,
        dayTimeRanges,
      };
    });
  };

  const isValidTimeInput = (value: string) =>
    /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);

  const validateCustodyDrafts = (drafts: Record<string, CustodyDraft>) => {
    for (const parent of parents) {
      const draft = drafts[parent.id] || {
        days: [],
        dayTimeRanges: {},
        weekPattern: "all" as WeekPattern,
      };
      const normalizedDays = [...new Set(draft.days)].sort((a, b) => a - b);

      for (const day of normalizedDays) {
        const range = draft.dayTimeRanges[day];
        if (
          !range ||
          !isValidTimeInput(range.start) ||
          !isValidTimeInput(range.end)
        ) {
          Alert.alert(
            "Invalid time",
            `Use HH:MM format for ${parent.name} on ${dayLabelForIndex[day]}.`,
          );
          return false;
        }
      }
    }

    return true;
  };

  const applyCustodyDrafts = async (drafts: Record<string, CustodyDraft>) => {
    for (const parent of parents) {
      const draft = drafts[parent.id] || {
        days: [],
        dayTimeRanges: {},
        weekPattern: "all" as WeekPattern,
      };
      const normalizedWeekPattern: WeekPattern =
        draft.weekPattern === "odd" || draft.weekPattern === "even"
          ? draft.weekPattern
          : "all";
      const normalizedDays = [...new Set(draft.days)].sort((a, b) => a - b);
      const existingSchedule = custodySchedules.find(
        (s) => s.user_id === parent.id,
      );
      const dayTimeRangesPayload = normalizedDays.reduce(
        (acc, day) => {
          acc[day] = draft.dayTimeRanges[day] || {
            start: "00:00",
            end: "23:59",
          };
          return acc;
        },
        {} as Record<number, { start: string; end: string }>,
      );

      if (normalizedDays.length === 0) {
        if (existingSchedule) {
          const { error } = await supabase
            .from("custody_schedules")
            .delete()
            .eq("id", existingSchedule.id);
          if (error) throw error;
        }
        continue;
      }

      if (existingSchedule) {
        const { error } = await supabase
          .from("custody_schedules")
          .update({
            days_of_week: normalizedDays,
            day_time_ranges: dayTimeRangesPayload,
            week_pattern: normalizedWeekPattern,
          })
          .eq("id", existingSchedule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("custody_schedules").insert({
          user_id: parent.id,
          child_id: resolvedChildId,
          color: parent.color,
          days_of_week: normalizedDays,
          day_time_ranges: dayTimeRangesPayload,
          week_pattern: normalizedWeekPattern,
        });
        if (error) throw error;
      }
    }
  };

  const saveCustodySchedules = async () => {
    try {
      if (!validateCustodyDrafts(custodyDrafts)) return;

      const { data: userData } = await supabase.auth.getUser();
      const currentUserId = userData?.user?.id;
      if (!currentUserId) {
        Alert.alert(
          "Error",
          "You must be signed in to change custody schedules.",
        );
        return;
      }

      const requiresApproval =
        parents.length > 1 &&
        parents.some((parent) => parent.id !== currentUserId);

      if (requiresApproval) {
        const { error } = await supabase
          .from("custody_schedule_change_requests")
          .insert({
            child_id: resolvedChildId,
            requested_by: currentUserId,
            proposed_schedules: custodyDrafts as any,
            status: "pending",
          });

        if (error) throw error;

        await fetchCustodyChangeRequests();
        setCustodyModalVisible(false);
        Alert.alert(
          "Proposal sent",
          "The custody schedule change has been sent to the other guardian for approval.",
        );
        return;
      }

      await applyCustodyDrafts(custodyDrafts);
      await fetchCustodySchedules();
      setCustodyModalVisible(false);
    } catch (error) {
      console.error("Error saving custody schedules:", error);
      if (isMissingWeekPatternColumnError(error)) {
        Alert.alert(
          "Database update needed",
          "Run the custody schedule migration SQL first to enable every-other-week settings.",
        );
        return;
      }
      Alert.alert("Error", "Failed to save custody schedule changes.");
    }
  };

  const approveCustodyChangeRequest = async (
    request: CustodyScheduleChangeRequest,
  ) => {
    try {
      if (!validateCustodyDrafts(request.proposed_schedules)) return;
      await applyCustodyDrafts(request.proposed_schedules);
      const { error } = await supabase
        .from("custody_schedule_change_requests")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", request.id);
      if (error) throw error;
      await Promise.all([fetchCustodySchedules(), fetchCustodyChangeRequests()]);
      Alert.alert("Approved", "The custody schedule has been updated.");
    } catch (error) {
      console.error("Error approving custody change request:", error);
      Alert.alert("Error", "Failed to approve custody schedule change.");
    }
  };

  const rejectCustodyChangeRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from("custody_schedule_change_requests")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
      await fetchCustodyChangeRequests();
    } catch (error) {
      console.error("Error rejecting custody change request:", error);
      Alert.alert("Error", "Failed to reject custody schedule change.");
    }
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newMonth = new Date(currentMonth);
    if (direction === "prev") {
      newMonth.setMonth(newMonth.getMonth() - 1);
    } else {
      newMonth.setMonth(newMonth.getMonth() + 1);
    }
    setCurrentMonth(newMonth);
  };

  const navigateSelectedDay = (direction: "prev" | "next") => {
    if (!selectedDate) return;

    const newDate = new Date(selectedDate);
    if (direction === "prev") {
      newDate.setDate(newDate.getDate() - 1);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }

    setSelectedDate(newDate);
    setCurrentMonth(newDate);
  };

  const animateDaySwipe = (swipeDirection: "left" | "right") => {
    if (!selectedDate || isDayTransitioningRef.current) return;

    const dayDirection = swipeDirection === "left" ? "next" : "prev";
    const incomingDate = getShiftedDate(selectedDate, dayDirection);
    const screenWidth = Dimensions.get("window").width;
    const exitToX = swipeDirection === "left" ? -screenWidth : screenWidth;
    const enterFromX = swipeDirection === "left" ? screenWidth : -screenWidth;

    isDayTransitioningRef.current = true;
    setTransitionDate(incomingDate);
    dayContentTranslateX.setValue(0);
    transitionContentTranslateX.setValue(enterFromX);

    Animated.parallel([
      Animated.timing(dayContentTranslateX, {
        toValue: exitToX,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(transitionContentTranslateX, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setSelectedDate(incomingDate);
      setCurrentMonth(incomingDate);
      setTransitionDate(null);
      dayContentTranslateX.setValue(0);
      transitionContentTranslateX.setValue(0);
      isDayTransitioningRef.current = false;
    });
  };

  const handleDayViewPanStateChange = (
    event: PanGestureHandlerStateChangeEvent,
  ) => {
    if (!dayViewModalVisible || !selectedDate) return;

    const { state, translationX, translationY, velocityX } = event.nativeEvent;
    if (state !== State.END) return;

    const isHorizontalSwipe =
      Math.abs(translationX) > 35 &&
      Math.abs(translationX) > Math.abs(translationY) * 1.15;
    const isFastHorizontalSwipe =
      Math.abs(velocityX) > 700 &&
      Math.abs(translationX) > Math.abs(translationY);

    if (!isHorizontalSwipe && !isFastHorizontalSwipe) return;

    if (isDayTransitioningRef.current) return;

    // User-requested direction mapping: left -> next day, right -> previous day.
    if (translationX < 0) {
      animateDaySwipe("left");
    } else {
      animateDaySwipe("right");
    }
  };

  const handleDayViewTouchStart = (event: GestureResponderEvent) => {
    const touch = event.nativeEvent.changedTouches[0];
    if (!touch) return;
    touchStartXRef.current = touch.pageX;
    touchStartYRef.current = touch.pageY;
  };

  const handleDayViewTouchEnd = (event: GestureResponderEvent) => {
    if (!dayViewModalVisible || !selectedDate) return;
    if (isDayTransitioningRef.current) return;

    const touch = event.nativeEvent.changedTouches[0];
    if (!touch) return;

    const dx = touch.pageX - touchStartXRef.current;
    const dy = touch.pageY - touchStartYRef.current;
    if (Math.abs(dx) < 35 || Math.abs(dx) <= Math.abs(dy) * 1.15) return;

    if (dx < 0) {
      animateDaySwipe("left");
    } else {
      animateDaySwipe("right");
    }
  };

  const handleDayEventPress = (event: CalendarEvent) => {
    if (event.isRecurring || event.id?.toString().startsWith("recurring-")) {
      Alert.alert(
        "Recurring Activity",
        'This is a recurring activity. To edit it, please go to the "Recurring Activities" menu.',
        [{ text: "OK" }],
      );
      return;
    }

    setSelectedEvent(event);
    setEditEventModalVisible(true);
  };

  const handleAddEvent = async () => {
    if (!selectedDate || !newEventName.trim()) {
      Alert.alert("Error", "Please enter an event name");
      return;
    }

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user?.id) return;

      // Parse time strings (HH:MM format); all-day events use full-day bounds.
      const [parsedStartHour, parsedStartMinute] = startTime
        .split(":")
        .map(Number);
      const [parsedEndHour, parsedEndMinute] = endTime.split(":").map(Number);

      const startHour = newEventAllDay ? 0 : parsedStartHour;
      const startMinute = newEventAllDay ? 0 : parsedStartMinute;
      const endHour = newEventAllDay ? 23 : parsedEndHour;
      const endMinute = newEventAllDay ? 59 : parsedEndMinute;

      let error: { message?: string } | null = null;

      if (newEventRepeat === "weekly") {
        const recurringStartTime = `${String(startHour).padStart(2, "0")}:${String(startMinute).padStart(2, "0")}:00`;
        const recurringEndTime = `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}:00`;
        const repeatingDayIndex = getDayOfWeekMondayIndex(selectedDate);

        const insertResult = await supabase
          .from("recurring_activities")
          .insert({
            child_id: resolvedChildId,
            user_id: userData.user.id,
            activity_name: newEventName,
            days_of_week: [repeatingDayIndex],
            start_time: recurringStartTime,
            end_time: recurringEndTime,
            color: theme.tint,
            is_active: true,
          });
        error = insertResult.error as { message?: string } | null;
      } else {
        const startTimeISO = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          startHour,
          startMinute,
        ).toISOString();
        const endTimeISO = new Date(
          selectedDate.getFullYear(),
          selectedDate.getMonth(),
          selectedDate.getDate(),
          endHour,
          endMinute,
        ).toISOString();

        const insertResult = await supabase
          .from("calendar_events")
          .insert({
            child_id: resolvedChildId,
            user_id: userData.user.id,
            start_time: startTimeISO,
            end_time: endTimeISO,
            event_type: "scheduled",
            activity_name: newEventName,
            location: "",
            notes: "",
          })
          .select("id, start_time, activity_name")
          .single();
        error = insertResult.error as { message?: string } | null;

        if (!error && insertResult.data?.id) {
          await scheduleEventAlert({
            eventId: insertResult.data.id,
            title: insertResult.data.activity_name || newEventName,
            startTimeISO: insertResult.data.start_time || startTimeISO,
            childName: resolvedChildName,
            minutesBefore: newEventAlertMinutes,
          });
        }
      }

      if (error) {
        console.error("Error adding event:", error);
        Alert.alert("Error", "Failed to add event");
        return;
      }

      setAddEventModalVisible(false);
      setNewEventName("");
      setNewEventAllDay(false);
      setNewEventRepeat("none");
      setNewEventAlertMinutes(null);
      setNewEventAlertDropdownOpen(false);
      setStartTime("09:00");
      setEndTime("17:00");
      setSelectedDate(null);
      await Promise.all([fetchEvents(), fetchRecurringActivities()]);
    } catch (error) {
      console.error("Error adding event:", error);
      Alert.alert("Error", "Failed to add event");
    }
  };

  const renderEditEventOverlay = () => (
    <View style={styles.modalOverlay}>
      <View
        style={[
          styles.modalContent,
          {
            backgroundColor: Colors[colorScheme ?? "light"].cardBackground,
          },
        ]}
      >
        <Text
          style={[
            styles.modalTitle,
            { color: Colors[colorScheme ?? "light"].text },
          ]}
        >
          Edit Event
        </Text>

        {/* Date Input - Full Width */}
        <View style={styles.dateFieldContainer}>
          <Text
            style={[
              styles.timeLabel,
              { color: Colors[colorScheme ?? "light"].text },
            ]}
          >
            Date
          </Text>
          <TextInput
            style={[
              styles.modalInput,
              {
                backgroundColor: Colors[colorScheme ?? "light"].inputBackground,
                color: Colors[colorScheme ?? "light"].text,
                borderColor: Colors[colorScheme ?? "light"].border,
              },
            ]}
            value={
              editDateInputText ||
              (selectedEvent?.start_time
                ? formatLocalDateInput(new Date(selectedEvent.start_time))
                : "")
            }
            onChangeText={(text) => {
              setEditDateInputText(text);
              if (text.length === 10 && selectedEvent) {
                const newDate = parseLocalDateInput(text);
                if (newDate && !Number.isNaN(newDate.getTime())) {
                  const startParts = selectedEvent.start_time?.split("T");
                  const endParts = selectedEvent.end_time?.split("T");
                  const timeStr =
                    startParts && startParts.length > 1
                      ? startParts[1].split(".")[0]
                      : "00:00:00";
                  const endTimeStr =
                    endParts && endParts.length > 1
                      ? endParts[1].split(".")[0]
                      : "23:59:59";

                  setSelectedEvent({
                    ...selectedEvent,
                    start_time: `${text}T${timeStr}`,
                    end_time: `${text}T${endTimeStr}`,
                  });
                }
              }
            }}
            onFocus={() => {
              if (selectedEvent?.start_time) {
                const date = new Date(selectedEvent.start_time);
                if (!Number.isNaN(date.getTime())) {
                  setEditDateInputText(formatLocalDateInput(date));
                }
              }
            }}
            onBlur={() => {
              setEditDateInputText("");
            }}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors[colorScheme ?? "light"].textLight}
          />
        </View>

        <TextInput
          style={[
            styles.modalInput,
            {
              backgroundColor: Colors[colorScheme ?? "light"].inputBackground,
              color: Colors[colorScheme ?? "light"].text,
              borderColor: Colors[colorScheme ?? "light"].border,
            },
          ]}
          value={selectedEvent?.activity_name}
          onChangeText={(text) =>
            setSelectedEvent((prev: CalendarEvent | null) =>
              prev ? { ...prev, activity_name: text } : null,
            )
          }
          placeholder="Event name"
          placeholderTextColor={Colors[colorScheme ?? "light"].textLight}
        />
        <View style={styles.timeInputsRow}>
          <View style={styles.timeInputContainer}>
            <Text
              style={[
                styles.timeLabel,
                { color: Colors[colorScheme ?? "light"].text },
              ]}
            >
              Start Time
            </Text>
            <TextInput
              style={[
                styles.timeInput,
                {
                  backgroundColor:
                    Colors[colorScheme ?? "light"].inputBackground,
                  color: Colors[colorScheme ?? "light"].text,
                  borderColor: Colors[colorScheme ?? "light"].border,
                },
              ]}
              value={
                selectedEvent?.start_time
                  ? (() => {
                      const parts = selectedEvent.start_time.split("T");
                      if (parts.length < 2) return "";
                      return parts[1].substring(0, 5);
                    })()
                  : ""
              }
              onChangeText={(text) => {
                if (!selectedEvent) return;
                const parts = selectedEvent.start_time.split("T");
                const dateStr =
                  parts.length > 0
                    ? parts[0]
                    : new Date().toISOString().split("T")[0];
                if (/^\d{0,2}:\d{0,2}$/.test(text)) {
                  setSelectedEvent({
                    ...selectedEvent,
                    start_time: `${dateStr}T${text}`,
                  });
                }
              }}
              placeholder="09:00"
              placeholderTextColor={Colors[colorScheme ?? "light"].textLight}
            />
          </View>
          <View style={styles.timeInputContainer}>
            <Text
              style={[
                styles.timeLabel,
                { color: Colors[colorScheme ?? "light"].text },
              ]}
            >
              End Time
            </Text>
            <TextInput
              style={[
                styles.timeInput,
                {
                  backgroundColor:
                    Colors[colorScheme ?? "light"].inputBackground,
                  color: Colors[colorScheme ?? "light"].text,
                  borderColor: Colors[colorScheme ?? "light"].border,
                },
              ]}
              value={
                selectedEvent?.end_time
                  ? (() => {
                      const parts = selectedEvent.end_time.split("T");
                      if (parts.length < 2) return "";
                      return parts[1].substring(0, 5);
                    })()
                  : ""
              }
              onChangeText={(text) => {
                if (!selectedEvent) return;
                const parts = selectedEvent.end_time.split("T");
                const dateStr =
                  parts.length > 0
                    ? parts[0]
                    : new Date().toISOString().split("T")[0];
                if (/^\d{0,2}:\d{0,2}$/.test(text)) {
                  setSelectedEvent({
                    ...selectedEvent,
                    end_time: `${dateStr}T${text}`,
                  });
                }
              }}
              placeholder="17:00"
              placeholderTextColor={Colors[colorScheme ?? "light"].textLight}
            />
          </View>
        </View>
        <View style={styles.modalButtons}>
          <TouchableOpacity
            style={[
              styles.modalButton,
              styles.deleteButton,
              { backgroundColor: "#FF3B30" },
            ]}
            onPress={async () => {
              if (!selectedEvent) return;
              try {
                const { error } = await supabase
                  .from("calendar_events")
                  .delete()
                  .eq("id", selectedEvent.id);
                if (error) throw error;
                await cancelEventAlert(selectedEvent.id);
                setEditEventModalVisible(false);
                setSelectedEvent(null);
                fetchEvents();
              } catch (error) {
                console.error("Error deleting event:", error);
              }
            }}
          >
            <Text style={[styles.modalButtonText, { color: "white" }]}>
              Delete
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modalButton,
              styles.cancelButton,
              { borderColor: Colors[colorScheme ?? "light"].border },
            ]}
            onPress={() => {
              setEditEventModalVisible(false);
              setSelectedEvent(null);
            }}
          >
            <Text
              style={[
                styles.modalButtonText,
                { color: Colors[colorScheme ?? "light"].text },
              ]}
            >
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modalButton,
              styles.addButton,
              { backgroundColor: Colors[colorScheme ?? "light"].tint },
            ]}
            onPress={async () => {
              if (!selectedEvent) return;
              try {
                const normalizeTime = (timeStr: string) => {
                  const parts = timeStr.split("T");
                  if (parts.length < 2) return timeStr;
                  const datePart = parts[0];
                  const timePart = parts[1];
                  const timeComponents = timePart.split(":");
                  const hours = timeComponents[0]?.padStart(2, "0") || "00";
                  const minutes = timeComponents[1]?.padStart(2, "0") || "00";
                  const seconds = timeComponents[2]?.padStart(2, "0") || "00";
                  return `${datePart}T${hours}:${minutes}:${seconds}`;
                };

                const { error } = await supabase
                  .from("calendar_events")
                  .update({
                    activity_name: selectedEvent.activity_name,
                    start_time: normalizeTime(selectedEvent.start_time),
                    end_time: normalizeTime(selectedEvent.end_time),
                  })
                  .eq("id", selectedEvent.id);
                if (error) throw error;

                await rescheduleEventAlertFromPreference({
                  eventId: selectedEvent.id,
                  title: selectedEvent.activity_name,
                  startTimeISO: normalizeTime(selectedEvent.start_time),
                  childName: resolvedChildName,
                });

                setEditEventModalVisible(false);
                setSelectedEvent(null);
                fetchEvents();
              } catch (error) {
                console.error("Error updating event:", error);
              }
            }}
          >
            <Text style={[styles.modalButtonText, styles.addButtonText]}>
              Save
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

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
  const days = getDaysInMonth(currentMonth);

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: Colors[colorScheme ?? "light"].background },
        ]}
      >
        <View style={styles.loadingContainer}>
          <Text
            style={[
              styles.loadingText,
              { color: Colors[colorScheme ?? "light"].text },
            ]}
          >
            Loading calendar...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: Colors[colorScheme ?? "light"].background },
      ]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: Colors[colorScheme ?? "light"].border },
        ]}
      >
        <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
          <Text
            style={[
              styles.backButtonText,
              { color: Colors[colorScheme ?? "light"].tint },
            ]}
          >
            ‹ Back
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setCurrentMonth(new Date())}
          style={[
            styles.todayButton,
            {
              backgroundColor: Colors[colorScheme ?? "light"].tint,
              opacity:
                currentMonth.getMonth() === new Date().getMonth() &&
                currentMonth.getFullYear() === new Date().getFullYear()
                  ? 0.5
                  : 1,
            },
          ]}
        >
          <Text style={styles.todayButtonText}>Today</Text>
        </TouchableOpacity>
        <View style={styles.monthControls}>
          <TouchableOpacity
            onPress={() => navigateMonth("prev")}
            style={[
              styles.navButton,
              {
                backgroundColor: `${Colors[colorScheme ?? "light"].tint}15`,
                borderColor: `${Colors[colorScheme ?? "light"].tint}40`,
              },
            ]}
          >
            <Text
              style={[
                styles.navButtonText,
                { color: Colors[colorScheme ?? "light"].tint },
              ]}
            >
              ‹
            </Text>
          </TouchableOpacity>
          <Text
            style={[
              styles.monthText,
              { color: Colors[colorScheme ?? "light"].text },
            ]}
          >
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </Text>
          <TouchableOpacity
            onPress={() => navigateMonth("next")}
            style={[
              styles.navButton,
              {
                backgroundColor: `${Colors[colorScheme ?? "light"].tint}15`,
                borderColor: `${Colors[colorScheme ?? "light"].tint}40`,
              },
            ]}
          >
            <Text
              style={[
                styles.navButtonText,
                { color: Colors[colorScheme ?? "light"].tint },
              ]}
            >
              ›
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Calendar Grid */}
      <View style={styles.calendarWrapper}>
        {/* Day Names */}
        <View
          style={[
            styles.dayNamesRow,
            { borderBottomColor: Colors[colorScheme ?? "light"].border },
          ]}
        >
          {dayNames.map((day) => (
            <View key={day} style={styles.dayNameCell}>
              <Text
                style={[
                  styles.dayNameText,
                  { color: Colors[colorScheme ?? "light"].text },
                ]}
              >
                {day}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar Days */}
        <ScrollView
          style={styles.calendarScroll}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.calendarGrid}>
            {Array.from({ length: 6 }).map((_, weekIndex) => (
              <View key={weekIndex} style={styles.weekRow}>
                {days
                  .slice(weekIndex * 7, (weekIndex + 1) * 7)
                  .map((dayObj, dayIndex) => {
                    const dayEvents = getEventsForDate(dayObj.date);
                    const custodySegments = getCustodyBarSegmentsForDate(
                      dayObj.date,
                    );
                    const isToday =
                      dayObj.date.toDateString() === new Date().toDateString();

                    return (
                      <TouchableOpacity
                        key={`${weekIndex}-${dayIndex}`}
                        style={[
                          styles.dayCell,
                          {
                            borderColor: Colors[colorScheme ?? "light"].border,
                          },
                          !dayObj.isCurrentMonth && styles.otherMonthDay,
                        ]}
                        onPress={() => {
                          setSelectedDate(dayObj.date);
                          setDayViewModalVisible(true);
                        }}
                      >
                        {/* Custody Bar */}
                        {custodySegments.length > 0 && (
                          <View
                            style={[
                              styles.custodyBarContainer,
                              {
                                height: Math.min(
                                  custodySegments.length * 4,
                                  16,
                                ),
                              },
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
                                    top: (segment.rowIndex % 4) * 4,
                                    width: `${segment.widthPercent}%`,
                                  },
                                ]}
                              />
                            ))}
                          </View>
                        )}

                        {/* Date Number */}
                        <View
                          style={[
                            styles.dateNumberContainer,
                            isToday && {
                              backgroundColor:
                                Colors[colorScheme ?? "light"].tint,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.dateNumber,
                              {
                                color: dayObj.isCurrentMonth
                                  ? Colors[colorScheme ?? "light"].text
                                  : Colors[colorScheme ?? "light"].textLight,
                              },
                              isToday && styles.todayText,
                            ]}
                          >
                            {dayObj.date.getDate()}
                          </Text>
                        </View>

                        {/* Events */}
                        <View style={styles.eventsContainer}>
                          {dayEvents.slice(0, 3).map((event) => {
                            const isRecurring =
                              "isRecurring" in event && event.isRecurring;
                            const eventColor =
                              isRecurring && "color" in event && event.color
                                ? event.color
                                : Colors[colorScheme ?? "light"].tint;

                            return (
                              <View
                                key={event.id}
                                style={[
                                  styles.eventDot,
                                  { backgroundColor: eventColor },
                                ]}
                              >
                                <Text
                                  style={styles.eventText}
                                  numberOfLines={1}
                                >
                                  {event.activity_name}
                                </Text>
                              </View>
                            );
                          })}
                          {dayEvents.length > 3 && (
                            <Text
                              style={[
                                styles.moreEvents,
                                {
                                  color:
                                    Colors[colorScheme ?? "light"].textLight,
                                },
                              ]}
                            >
                              +{dayEvents.length - 3} more
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            ))}
          </View>
        </ScrollView>

        {/* Floating Action Button */}
        <View style={styles.fabContainer}>
          {fabMenuVisible && (
            <View style={styles.fabMenu}>
              <TouchableOpacity
                style={[
                  styles.fabMenuItem,
                  {
                    backgroundColor:
                      Colors[colorScheme ?? "light"].cardBackground,
                  },
                ]}
                onPress={() => {
                  setFabMenuVisible(false);
                  setSelectedDate(new Date());
                  setAddEventModalVisible(true);
                }}
              >
                <Text
                  style={[
                    styles.fabMenuText,
                    { color: Colors[colorScheme ?? "light"].text },
                  ]}
                >
                  Add Event
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.fabMenuItem,
                  {
                    backgroundColor:
                      Colors[colorScheme ?? "light"].cardBackground,
                  },
                ]}
                onPress={() => {
                  setFabMenuVisible(false);
                  setCustodyModalVisible(true);
                }}
              >
                <Text
                  style={[
                    styles.fabMenuText,
                    { color: Colors[colorScheme ?? "light"].text },
                  ]}
                >
                  Custody Schedule
                </Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            style={[
              styles.fab,
              { backgroundColor: Colors[colorScheme ?? "light"].tint },
            ]}
            onPress={() => setFabMenuVisible(!fabMenuVisible)}
          >
            <Text style={styles.fabText}>{fabMenuVisible ? "×" : "+"}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Day View Modal */}
      <Modal
        visible={dayViewModalVisible}
        animationType="slide"
        transparent={false}
      >
        <PanGestureHandler
          activeOffsetX={[-20, 20]}
          onHandlerStateChange={handleDayViewPanStateChange}
        >
          <View
            onTouchStart={handleDayViewTouchStart}
            onTouchEnd={handleDayViewTouchEnd}
            style={[
              styles.container,
              { backgroundColor: Colors[colorScheme ?? "light"].background },
            ]}
          >
            <View
              style={[
                styles.dayViewHeader,
                {
                  backgroundColor:
                    Colors[colorScheme ?? "light"].cardBackground,
                },
              ]}
            >
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setDayViewModalVisible(false)}
              >
                <Text
                  style={[
                    styles.backButtonText,
                    { color: Colors[colorScheme ?? "light"].tint },
                  ]}
                >
                  ← Back
                </Text>
              </TouchableOpacity>
              <Text
                style={[
                  styles.dayViewTitle,
                  { color: Colors[colorScheme ?? "light"].text },
                ]}
              >
                {(transitionDate ?? selectedDate)
                  ? (transitionDate ?? selectedDate)?.toLocaleDateString(
                      "en-US",
                      {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      },
                    )
                  : ""}
              </Text>
              <TouchableOpacity
                style={[
                  styles.addEventButton,
                  { backgroundColor: Colors[colorScheme ?? "light"].tint },
                ]}
                onPress={() => {
                  if (isDayTransitioningRef.current) return;
                  setDayViewModalVisible(false);
                  setAddEventModalVisible(true);
                }}
              >
                <Text style={styles.addEventButtonText}>+ Add</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.dayViewContentViewport}>
              <Animated.View
                style={[
                  styles.dayViewPage,
                  { transform: [{ translateX: dayContentTranslateX }] },
                ]}
              >
                <DayTimeline
                  colorScheme={colorScheme}
                  date={selectedDate}
                  getEventsForDate={getEventsForDate}
                  onEventPress={handleDayEventPress}
                />
              </Animated.View>
              {transitionDate ? (
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.dayViewPage,
                    {
                      transform: [{ translateX: transitionContentTranslateX }],
                    },
                  ]}
                >
                  <DayTimeline
                    colorScheme={colorScheme}
                    date={transitionDate}
                    getEventsForDate={getEventsForDate}
                    onEventPress={handleDayEventPress}
                  />
                </Animated.View>
              ) : null}
            </View>

            {editEventModalVisible ? (
              <View style={styles.dayModalOverlayAbsolute}>
                {renderEditEventOverlay()}
              </View>
            ) : null}
          </View>
        </PanGestureHandler>
      </Modal>

      {/* Add Event Modal */}
      <Modal
        visible={addEventModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          pendingAddEventFocusRef.current = null;
          setAddEventModalVisible(false);
          setNewEventRepeat("none");
          setNewEventAlertMinutes(null);
          setNewEventAlertDropdownOpen(false);
        }}
      >
        <View
          style={[
            styles.modalOverlay,
            addEventKeyboardVisible && styles.modalOverlayKeyboardVisible,
          ]}
        >
          <View style={styles.addEventModalShell}>
            <ScrollView
              ref={addEventScrollRef}
              style={[styles.modalContentScroll]}
              contentContainerStyle={[
                styles.addEventModalContent,
                addEventKeyboardVisible && styles.addEventModalContentKeyboard,
                {
                  backgroundColor:
                    Colors[colorScheme ?? "light"].cardBackground,
                },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="interactive"
              automaticallyAdjustKeyboardInsets
              onScroll={(event) => {
                currentAddEventScrollYRef.current =
                  event.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              <Text
                style={[
                  styles.modalTitle,
                  { color: Colors[colorScheme ?? "light"].text },
                ]}
              >
                Add Event
              </Text>

              {/* Date Input - Full Width */}
              <View style={styles.dateFieldContainer}>
                <Text
                  style={[
                    styles.timeLabel,
                    { color: Colors[colorScheme ?? "light"].text },
                  ]}
                >
                  Date
                </Text>
                <TextInput
                  ref={(ref) => {
                    if (ref) {
                      addEventDateInputRef.current = ref;
                    }
                  }}
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor:
                        Colors[colorScheme ?? "light"].inputBackground,
                      color: Colors[colorScheme ?? "light"].text,
                      borderColor: Colors[colorScheme ?? "light"].border,
                    },
                  ]}
                  value={
                    dateInputText ||
                    (selectedDate ? formatLocalDateInput(selectedDate) : "")
                  }
                  onChangeText={(text) => {
                    setDateInputText(text);
                    // Only update the date if it's a valid complete date (10 characters: YYYY-MM-DD)
                    if (text.length === 10) {
                      const newDate = parseLocalDateInput(text);
                      if (newDate) {
                        setSelectedDate(newDate);
                      }
                    }
                  }}
                  onFocus={() => {
                    handleAddEventInputFocus(addEventDateInputRef.current);
                    // Set the text field to current date when focused
                    if (selectedDate) {
                      setDateInputText(formatLocalDateInput(selectedDate));
                    }
                  }}
                  onBlur={() => {
                    // Clear the text input on blur, it will show the formatted date
                    setDateInputText("");
                  }}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={
                    Colors[colorScheme ?? "light"].textLight
                  }
                  inputAccessoryViewID={
                    Platform.OS === "ios" ? addEventDateAccessoryId : undefined
                  }
                  keyboardType={
                    Platform.OS === "ios"
                      ? "numbers-and-punctuation"
                      : "default"
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="off"
                  textContentType="none"
                  smartInsertDelete={false}
                  smartDashesType="no"
                  smartQuotesType="no"
                  returnKeyType="done"
                  onSubmitEditing={dismissAddEventKeyboard}
                />
              </View>

              {/* Event Name */}
              <TextInput
                ref={(ref) => {
                  if (ref) {
                    addEventNameInputRef.current = ref;
                  }
                }}
                style={[
                  styles.modalInput,
                  {
                    backgroundColor:
                      Colors[colorScheme ?? "light"].inputBackground,
                    color: Colors[colorScheme ?? "light"].text,
                    borderColor: Colors[colorScheme ?? "light"].border,
                  },
                ]}
                value={newEventName}
                onChangeText={setNewEventName}
                onFocus={() =>
                  handleAddEventInputFocus(addEventNameInputRef.current)
                }
                placeholder="Event name"
                placeholderTextColor={Colors[colorScheme ?? "light"].textLight}
                inputAccessoryViewID={
                  Platform.OS === "ios" ? addEventNameAccessoryId : undefined
                }
                keyboardType="default"
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                autoComplete="off"
                textContentType="none"
                smartInsertDelete={false}
                smartDashesType="no"
                smartQuotesType="no"
                returnKeyType="done"
                onSubmitEditing={dismissAddEventKeyboard}
                blurOnSubmit
              />

              <View style={styles.allDayToggleRow}>
                <Text
                  style={[
                    styles.timeLabel,
                    { color: Colors[colorScheme ?? "light"].text },
                  ]}
                >
                  All day
                </Text>
                <TouchableOpacity
                  style={[
                    styles.allDayToggleButton,
                    {
                      borderColor: Colors[colorScheme ?? "light"].border,
                      backgroundColor: newEventAllDay
                        ? Colors[colorScheme ?? "light"].tint
                        : Colors[colorScheme ?? "light"].inputBackground,
                    },
                  ]}
                  onPress={() => setNewEventAllDay((prev) => !prev)}
                >
                  <Text
                    style={[
                      styles.allDayToggleButtonText,
                      {
                        color: newEventAllDay
                          ? "white"
                          : Colors[colorScheme ?? "light"].text,
                      },
                    ]}
                  >
                    {newEventAllDay ? "Enabled" : "Disabled"}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={styles.repeatSection}>
                <Text
                  style={[
                    styles.timeLabel,
                    { color: Colors[colorScheme ?? "light"].text },
                  ]}
                >
                  Repeat
                </Text>
                <View style={styles.repeatOptionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.repeatOptionButton,
                      {
                        borderColor: Colors[colorScheme ?? "light"].border,
                        backgroundColor:
                          newEventRepeat === "none"
                            ? Colors[colorScheme ?? "light"].tint
                            : Colors[colorScheme ?? "light"].inputBackground,
                      },
                    ]}
                    onPress={() => setNewEventRepeat("none")}
                  >
                    <Text
                      style={[
                        styles.repeatOptionText,
                        {
                          color:
                            newEventRepeat === "none"
                              ? "#fff"
                              : Colors[colorScheme ?? "light"].text,
                        },
                      ]}
                    >
                      Does not repeat
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.repeatOptionButton,
                      {
                        borderColor: Colors[colorScheme ?? "light"].border,
                        backgroundColor:
                          newEventRepeat === "weekly"
                            ? Colors[colorScheme ?? "light"].tint
                            : Colors[colorScheme ?? "light"].inputBackground,
                      },
                    ]}
                    onPress={() => setNewEventRepeat("weekly")}
                  >
                    <Text
                      style={[
                        styles.repeatOptionText,
                        {
                          color:
                            newEventRepeat === "weekly"
                              ? "#fff"
                              : Colors[colorScheme ?? "light"].text,
                        },
                      ]}
                    >
                      Weekly
                    </Text>
                  </TouchableOpacity>
                </View>
                {newEventRepeat === "weekly" && selectedDate ? (
                  <Text
                    style={[
                      styles.repeatHintText,
                      { color: Colors[colorScheme ?? "light"].textLight },
                    ]}
                  >
                    Repeats every{" "}
                    {dayLabelForIndex[getDayOfWeekMondayIndex(selectedDate)]}
                  </Text>
                ) : null}
              </View>

              <View style={styles.repeatSection}>
                <Text
                  style={[
                    styles.timeLabel,
                    { color: Colors[colorScheme ?? "light"].text },
                  ]}
                >
                  Alert
                </Text>
                {newEventRepeat === "weekly" ? (
                  <Text
                    style={[
                      styles.repeatHintText,
                      { color: Colors[colorScheme ?? "light"].textLight },
                    ]}
                  >
                    Alerts currently apply to one-time events.
                  </Text>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[
                        styles.alertDropdownTrigger,
                        {
                          borderColor: Colors[colorScheme ?? "light"].border,
                          backgroundColor:
                            Colors[colorScheme ?? "light"].inputBackground,
                        },
                      ]}
                      onPress={() =>
                        setNewEventAlertDropdownOpen(
                          (previousValue) => !previousValue,
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.alertDropdownTriggerText,
                          { color: Colors[colorScheme ?? "light"].text },
                        ]}
                      >
                        {selectedAlertLabel}
                      </Text>
                      <Text
                        style={[
                          styles.alertDropdownChevron,
                          { color: Colors[colorScheme ?? "light"].textLight },
                        ]}
                      >
                        {newEventAlertDropdownOpen ? "▲" : "▼"}
                      </Text>
                    </TouchableOpacity>
                    {newEventAlertDropdownOpen ? (
                      <View
                        style={[
                          styles.alertDropdownList,
                          {
                            borderColor: Colors[colorScheme ?? "light"].border,
                            backgroundColor:
                              Colors[colorScheme ?? "light"].cardBackground,
                          },
                        ]}
                      >
                        {EVENT_ALERT_OPTIONS.map((option) => {
                          const isSelected =
                            option.minutesBefore === newEventAlertMinutes;
                          return (
                            <TouchableOpacity
                              key={option.label}
                              style={[
                                styles.alertDropdownItem,
                                {
                                  backgroundColor: isSelected
                                    ? Colors[colorScheme ?? "light"].tint
                                    : "transparent",
                                },
                              ]}
                              onPress={() => {
                                setNewEventAlertMinutes(option.minutesBefore);
                                setNewEventAlertDropdownOpen(false);
                              }}
                            >
                              <Text
                                style={[
                                  styles.alertDropdownItemText,
                                  {
                                    color: isSelected
                                      ? "#fff"
                                      : Colors[colorScheme ?? "light"].text,
                                  },
                                ]}
                              >
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    ) : null}
                    <Text
                      style={[
                        styles.repeatHintText,
                        { color: Colors[colorScheme ?? "light"].textLight },
                      ]}
                    >
                      Selected: {selectedAlertLabel}
                    </Text>
                  </>
                )}
              </View>

              {!newEventAllDay ? (
                <View style={styles.timeInputsRow}>
                  <TimeWheelPicker
                    label="Start Time"
                    value={startTime}
                    onChange={setStartTime}
                  />
                  <TimeWheelPicker
                    label="End Time"
                    value={endTime}
                    onChange={setEndTime}
                  />
                </View>
              ) : (
                <Text
                  style={[
                    styles.allDayHintText,
                    { color: Colors[colorScheme ?? "light"].textLight },
                  ]}
                >
                  This event will appear at the top of day view as an all-day
                  item.
                </Text>
              )}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.cancelButton,
                    { borderColor: Colors[colorScheme ?? "light"].border },
                  ]}
                  onPress={() => {
                    pendingAddEventFocusRef.current = null;
                    setAddEventModalVisible(false);
                    setNewEventName("");
                    setNewEventAllDay(false);
                    setNewEventRepeat("none");
                    setNewEventAlertMinutes(null);
                    setNewEventAlertDropdownOpen(false);
                    setStartTime("09:00");
                    setEndTime("17:00");
                  }}
                >
                  <Text
                    style={[
                      styles.modalButtonText,
                      { color: Colors[colorScheme ?? "light"].text },
                    ]}
                  >
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    styles.addButton,
                    { backgroundColor: Colors[colorScheme ?? "light"].tint },
                  ]}
                  onPress={handleAddEvent}
                >
                  <Text style={[styles.modalButtonText, styles.addButtonText]}>
                    Add
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            {Platform.OS === "ios" ? (
              <>
                <InputAccessoryView nativeID={addEventDateAccessoryId}>
                  <View
                    style={[
                      styles.keyboardAccessory,
                      {
                        backgroundColor:
                          Colors[colorScheme ?? "light"].cardBackground,
                        borderTopColor: Colors[colorScheme ?? "light"].border,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.keyboardAccessoryDoneButton}
                      onPress={dismissAddEventKeyboard}
                    >
                      <Text
                        style={[
                          styles.keyboardAccessoryDoneText,
                          { color: Colors[colorScheme ?? "light"].tint },
                        ]}
                      >
                        Done
                      </Text>
                    </TouchableOpacity>
                  </View>
                </InputAccessoryView>
                <InputAccessoryView nativeID={addEventNameAccessoryId}>
                  <View
                    style={[
                      styles.keyboardAccessory,
                      {
                        backgroundColor:
                          Colors[colorScheme ?? "light"].cardBackground,
                        borderTopColor: Colors[colorScheme ?? "light"].border,
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.keyboardAccessoryDoneButton}
                      onPress={dismissAddEventKeyboard}
                    >
                      <Text
                        style={[
                          styles.keyboardAccessoryDoneText,
                          { color: Colors[colorScheme ?? "light"].tint },
                        ]}
                      >
                        Done
                      </Text>
                    </TouchableOpacity>
                  </View>
                </InputAccessoryView>
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Edit Event Modal */}
      <Modal
        visible={editEventModalVisible && !dayViewModalVisible}
        animationType="slide"
        transparent={true}
      >
        {renderEditEventOverlay()}
      </Modal>

      {/* Custody Schedule Modal */}
      <Modal
        visible={custodyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeCustodyModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.custodyModalContent,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.custodyModalHeader}>
              <TouchableOpacity
                style={styles.custodyBackButton}
                onPress={closeCustodyModal}
                accessibilityRole="button"
                accessibilityLabel="Go back from custody schedule"
              >
                <Text
                  style={[styles.custodyBackButtonText, { color: theme.tint }]}
                >
                  ‹ Back
                </Text>
              </TouchableOpacity>
              <Text
                style={[
                  styles.modalTitle,
                  styles.custodyModalTitle,
                  { color: theme.text },
                ]}
              >
                Custody Schedule
              </Text>
              <View style={styles.custodyHeaderSpacer} />
            </View>
            <Text
              style={[
                styles.custodySubtitle,
                { color: isDarkMode ? theme.textSecondary : theme.textLight },
              ]}
            >
              {parents.length === 0
                ? "No guardians found for this child"
                : parents.length > 1
                  ? "Changes are sent as proposals that another guardian must approve"
                  : `Assign days for ${parents.length} guardian${parents.length > 1 ? "s" : ""}`}
            </Text>

            {custodyChangeRequests.length > 0 && (
              <View
                style={[
                  styles.changeRequestPanel,
                  {
                    backgroundColor: isDarkMode ? "#2A2418" : "#FFF7E6",
                    borderColor: isDarkMode ? "#8A6D2F" : "#F5C35B",
                  },
                ]}
              >
                <Text style={[styles.changeRequestTitle, { color: theme.text }]}>
                  Pending custody change proposals
                </Text>
                <Text
                  style={[
                    styles.changeRequestText,
                    { color: isDarkMode ? theme.textSecondary : theme.textLight },
                  ]}
                >
                  Review proposed week distribution changes before they are applied.
                </Text>
                {custodyChangeRequests.map((request) => (
                  <View key={request.id} style={styles.changeRequestActions}>
                    <Text style={[styles.changeRequestDate, { color: theme.text }]}>
                      {request.created_at
                        ? new Date(request.created_at).toLocaleDateString()
                        : "New proposal"}
                    </Text>
                    <TouchableOpacity
                      style={[styles.requestActionButton, { backgroundColor: theme.tint }]}
                      onPress={() => approveCustodyChangeRequest(request)}
                    >
                      <Text style={styles.requestActionButtonText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.requestActionButton,
                        { backgroundColor: "#E74C3C" },
                      ]}
                      onPress={() => rejectCustodyChangeRequest(request.id)}
                    >
                      <Text style={styles.requestActionButtonText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {parents.length === 0 ? (
              <View style={styles.emptyState}>
                <Text
                  style={[
                    styles.emptyStateText,
                    {
                      color: isDarkMode ? theme.textSecondary : theme.textLight,
                    },
                  ]}
                >
                  Add guardians to this child in the profile settings to manage
                  custody schedules.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.parentsContainer}>
                {parents.map((parent) => {
                  const draft = custodyDrafts[parent.id] || {
                    days: [],
                    dayTimeRanges: {},
                    weekPattern: "all" as WeekPattern,
                  };
                  const selectedDays = draft.days;

                  return (
                    <View
                      key={parent.id}
                      style={[
                        styles.parentSection,
                        {
                          backgroundColor: isDarkMode ? "#1F1F1F" : "#F5F5F5",
                          borderColor: theme.border,
                        },
                      ]}
                    >
                      <View style={styles.parentHeader}>
                        <View
                          style={[
                            styles.parentColorDot,
                            { backgroundColor: parent.color },
                          ]}
                        />
                        <Text
                          style={[
                            styles.parentName,
                            { color: Colors[colorScheme ?? "light"].text },
                          ]}
                        >
                          {parent.name}
                        </Text>
                      </View>

                      <View style={styles.weekPatternRow}>
                        {[
                          { value: "all", label: "Every week" },
                          { value: "odd", label: "Odd weeks" },
                          { value: "even", label: "Even weeks" },
                        ].map((option) => {
                          const isActive = draft.weekPattern === option.value;
                          return (
                            <TouchableOpacity
                              key={`${parent.id}-${option.value}`}
                              style={[
                                styles.weekPatternChip,
                                {
                                  borderColor: parent.color,
                                  backgroundColor: isActive
                                    ? parent.color
                                    : isDarkMode
                                      ? `${parent.color}22`
                                      : `${parent.color}14`,
                                },
                              ]}
                              onPress={() =>
                                setDraftWeekPattern(
                                  parent.id,
                                  option.value as WeekPattern,
                                )
                              }
                            >
                              <Text
                                style={[
                                  styles.weekPatternChipText,
                                  {
                                    color: isActive
                                      ? getReadableTextColor(parent.color)
                                      : theme.text,
                                  },
                                ]}
                              >
                                {option.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      <View style={styles.templateRow}>
                        <TouchableOpacity
                          style={[
                            styles.templateChip,
                            {
                              borderColor: parent.color,
                              backgroundColor: isDarkMode
                                ? `${parent.color}33`
                                : `${parent.color}20`,
                            },
                          ]}
                          onPress={() =>
                            applyCustodyTemplate(parent.id, "weekdays")
                          }
                        >
                          <Text
                            style={[
                              styles.templateChipText,
                              { color: isDarkMode ? theme.text : theme.text },
                            ]}
                          >
                            Weekdays
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.templateChip,
                            {
                              borderColor: parent.color,
                              backgroundColor: isDarkMode
                                ? `${parent.color}33`
                                : `${parent.color}20`,
                            },
                          ]}
                          onPress={() =>
                            applyCustodyTemplate(parent.id, "weekends")
                          }
                        >
                          <Text
                            style={[
                              styles.templateChipText,
                              { color: isDarkMode ? theme.text : theme.text },
                            ]}
                          >
                            Weekends
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.templateChip,
                            {
                              borderColor: parent.color,
                              backgroundColor: isDarkMode
                                ? `${parent.color}33`
                                : `${parent.color}20`,
                            },
                          ]}
                          onPress={() =>
                            applyCustodyTemplate(parent.id, "allDays")
                          }
                        >
                          <Text
                            style={[
                              styles.templateChipText,
                              { color: isDarkMode ? theme.text : theme.text },
                            ]}
                          >
                            All days
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.templateRow}>
                        <TouchableOpacity
                          style={[
                            styles.templateChip,
                            {
                              borderColor: parent.color,
                              backgroundColor: isDarkMode
                                ? `${parent.color}33`
                                : `${parent.color}20`,
                            },
                          ]}
                          onPress={() =>
                            applyCustodyTemplate(parent.id, "schoolMorning")
                          }
                        >
                          <Text
                            style={[
                              styles.templateChipText,
                              { color: isDarkMode ? theme.text : theme.text },
                            ]}
                          >
                            School morning (00-08)
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.templateChip,
                            {
                              borderColor: parent.color,
                              backgroundColor: isDarkMode
                                ? `${parent.color}33`
                                : `${parent.color}20`,
                            },
                          ]}
                          onPress={() =>
                            applyCustodyTemplate(parent.id, "schoolAfter")
                          }
                        >
                          <Text
                            style={[
                              styles.templateChipText,
                              { color: isDarkMode ? theme.text : theme.text },
                            ]}
                          >
                            After school (08-24)
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.daysGrid}>
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                          (day, index) => {
                            const isSelected = selectedDays.includes(index);
                            return (
                              <TouchableOpacity
                                key={day}
                                style={[
                                  styles.dayButton,
                                  {
                                    backgroundColor: isSelected
                                      ? parent.color
                                      : theme.inputBackground,
                                    borderColor: parent.color,
                                  },
                                ]}
                                onPress={() =>
                                  toggleCustodyDay(parent.id, index)
                                }
                              >
                                <Text
                                  style={[
                                    styles.dayButtonText,
                                    {
                                      color: isSelected
                                        ? getReadableTextColor(parent.color)
                                        : theme.text,
                                    },
                                  ]}
                                >
                                  {day}
                                </Text>
                              </TouchableOpacity>
                            );
                          },
                        )}
                      </View>

                      {selectedDays.length > 0 && (
                        <View style={styles.dayTimeRangesSection}>
                          <Text
                            style={[
                              styles.dayTimeRangesTitle,
                              { color: theme.text },
                            ]}
                          >
                            Responsibility windows per day (HH:MM)
                          </Text>
                          {selectedDays.map((dayIndex) => {
                            const range = draft.dayTimeRanges[dayIndex] || {
                              start: "00:00",
                              end: "23:59",
                            };

                            return (
                              <View
                                key={`${parent.id}-${dayIndex}`}
                                style={styles.timeRangeRow}
                              >
                                <Text
                                  style={[
                                    styles.timeRangeDayLabel,
                                    {
                                      color: theme.text,
                                    },
                                  ]}
                                >
                                  {dayLabelForIndex[dayIndex]}
                                </Text>
                                <TextInput
                                  style={[
                                    styles.timeRangeInput,
                                    {
                                      color: theme.text,
                                      borderColor: theme.border,
                                      backgroundColor: theme.inputBackground,
                                    },
                                  ]}
                                  value={range.start}
                                  onChangeText={(value) =>
                                    updateDraftTime(
                                      parent.id,
                                      dayIndex,
                                      "start",
                                      value,
                                    )
                                  }
                                  placeholder="00:00"
                                  placeholderTextColor={theme.textLight}
                                  keyboardType="numbers-and-punctuation"
                                  autoCapitalize="none"
                                  autoCorrect={false}
                                />
                                <Text
                                  style={[
                                    styles.timeRangeSeparator,
                                    {
                                      color: isDarkMode
                                        ? theme.textSecondary
                                        : theme.textLight,
                                    },
                                  ]}
                                >
                                  to
                                </Text>
                                <TextInput
                                  style={[
                                    styles.timeRangeInput,
                                    {
                                      color: theme.text,
                                      borderColor: theme.border,
                                      backgroundColor: theme.inputBackground,
                                    },
                                  ]}
                                  value={range.end}
                                  onChangeText={(value) =>
                                    updateDraftTime(
                                      parent.id,
                                      dayIndex,
                                      "end",
                                      value,
                                    )
                                  }
                                  placeholder="23:59"
                                  placeholderTextColor={theme.textLight}
                                  keyboardType="numbers-and-punctuation"
                                  autoCapitalize="none"
                                  autoCorrect={false}
                                />
                              </View>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <TouchableOpacity
              style={[styles.doneButton, { backgroundColor: theme.tint }]}
              onPress={saveCustodySchedules}
            >
              <Text style={styles.doneButtonText}>{parents.length > 1 ? "Send Proposal" : "Save Schedule"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    paddingTop: 50,
    borderBottomWidth: 1,
    gap: 4,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    padding: 6,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  todayButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  monthControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  navButton: {
    paddingHorizontal: 8,
    paddingVertical: 10,
    width: 38,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  navButtonText: {
    fontSize: 24,
    fontWeight: "bold",
    lineHeight: 24,
  },
  monthText: {
    fontSize: 15,
    fontWeight: "600",
    minWidth: 130,
    textAlign: "center",
  },
  calendarWrapper: {
    flex: 1,
    paddingHorizontal: 8,
  },
  dayNamesRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  dayNameCell: {
    flex: 1,
    alignItems: "center",
  },
  dayNameText: {
    fontSize: 12,
    fontWeight: "600",
  },
  calendarScroll: {
    flex: 1,
  },
  calendarGrid: {
    flex: 1,
  },
  weekRow: {
    flexDirection: "row",
    height: 100,
  },
  dayCell: {
    flex: 1,
    borderWidth: 0.5,
    padding: 4,
    position: "relative",
  },
  otherMonthDay: {
    opacity: 0.3,
  },
  custodyBarContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
  },
  custodyBar: {
    position: "absolute",
    top: 0,
    height: 3,
  },
  dateNumberContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  dateNumber: {
    fontSize: 14,
    fontWeight: "600",
  },
  todayText: {
    color: "#fff",
  },
  eventsContainer: {
    flex: 1,
    gap: 2,
  },
  eventDot: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 3,
  },
  eventText: {
    fontSize: 10,
    color: "#fff",
    fontWeight: "500",
  },
  moreEvents: {
    fontSize: 9,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    borderRadius: 12,
    padding: 24,
  },
  addEventModalContent: {
    width: "100%",
    borderRadius: 12,
    padding: 24,
  },
  addEventModalContentKeyboard: {
    paddingBottom: 24,
  },
  addEventModalShell: {
    width: "85%",
    maxHeight: "92%",
    borderRadius: 12,
    position: "relative",
  },
  modalContentScroll: {
    maxHeight: "100%",
    width: "100%",
  },
  modalContentScrollKeyboardVisible: {
    maxHeight: "100%",
  },
  modalOverlayKeyboardVisible: {
    justifyContent: "center",
    paddingTop: Platform.OS === "ios" ? 44 : 20,
    paddingBottom: Platform.OS === "ios" ? 20 : 20,
  },
  keyboardAccessory: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "flex-end",
  },
  keyboardAccessoryDoneButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  keyboardAccessoryDoneText: {
    fontSize: 17,
    fontWeight: "600",
  },
  allDayToggleRow: {
    marginBottom: 10,
  },
  allDayToggleButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  allDayToggleButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  allDayHintText: {
    fontSize: 12,
    marginBottom: 12,
  },
  repeatSection: {
    marginBottom: 12,
  },
  repeatOptionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  repeatOptionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  repeatOptionText: {
    fontSize: 13,
    fontWeight: "700",
  },
  repeatHintText: {
    marginTop: 6,
    fontSize: 12,
  },
  alertDropdownTrigger: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  alertDropdownTriggerText: {
    fontSize: 13,
    fontWeight: "600",
  },
  alertDropdownChevron: {
    fontSize: 12,
    marginLeft: 8,
  },
  alertDropdownList: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 8,
    overflow: "hidden",
  },
  alertDropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  alertDropdownItemText: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 8,
  },
  modalDate: {
    fontSize: 14,
    marginBottom: 16,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  timeInputsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  dateFieldContainer: {
    marginBottom: 16,
  },
  timeInputContainer: {
    flex: 1,
  },
  timeWheelContainer: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
  },
  timeInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: "center",
  },
  timeWheelFrame: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    height: TIME_WHEEL_ITEM_HEIGHT * TIME_WHEEL_VISIBLE_ITEMS,
    justifyContent: "center",
    overflow: "hidden",
    paddingHorizontal: 10,
    position: "relative",
  },
  timeWheelSelection: {
    borderRadius: 14,
    height: TIME_WHEEL_ITEM_HEIGHT,
    left: 10,
    position: "absolute",
    right: 10,
    top: TIME_WHEEL_VERTICAL_PADDING,
  },
  timeWheelContent: {
    paddingVertical: TIME_WHEEL_VERTICAL_PADDING,
  },
  timeWheelItem: {
    alignItems: "center",
    height: TIME_WHEEL_ITEM_HEIGHT,
    justifyContent: "center",
    minWidth: 48,
  },
  timeWheelItemText: {
    fontSize: 30,
    fontWeight: "500",
  },
  timeWheelSeparator: {
    fontSize: 30,
    fontWeight: "500",
    marginHorizontal: 2,
    zIndex: 1,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButton: {
    borderWidth: 1,
  },
  addButton: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  addButtonText: {
    color: "#fff",
  },
  deleteButton: {
    backgroundColor: "#FF3B30",
  },
  // Day View Styles
  dayViewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 50,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  dayViewTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  addEventButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addEventButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  dayViewContentViewport: {
    flex: 1,
    overflow: "hidden",
    position: "relative",
  },
  dayModalOverlayAbsolute: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  dayViewPage: {
    ...StyleSheet.absoluteFillObject,
  },
  // FAB Styles
  fabContainer: {
    position: "absolute",
    bottom: 20,
    right: 20,
    alignItems: "flex-end",
  },
  fabMenu: {
    marginBottom: 10,
    gap: 8,
  },
  fabMenuItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    minWidth: 150,
  },
  fabMenuText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fabText: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "300",
    lineHeight: 32,
  },
  // Custody Modal Styles
  custodyModalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    width: "94%",
    maxHeight: "88%",
  },
  custodyModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  custodyBackButton: {
    minWidth: 72,
    paddingVertical: 8,
    paddingRight: 8,
  },
  custodyBackButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  custodyModalTitle: {
    flex: 1,
    marginBottom: 0,
    textAlign: "center",
  },
  custodyHeaderSpacer: {
    width: 72,
  },
  custodySubtitle: {
    fontSize: 13,
    marginBottom: 12,
    textAlign: "center",
  },
  parentsContainer: {
    maxHeight: 560,
  },
  changeRequestPanel: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  changeRequestTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  changeRequestText: {
    fontSize: 12,
    marginBottom: 10,
  },
  changeRequestActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  changeRequestDate: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  requestActionButton: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  requestActionButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },

  parentSection: {
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  parentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  templateRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  weekPatternRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  weekPatternChip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  weekPatternChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  templateChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  templateChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  parentColorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
  },
  parentName: {
    fontSize: 18,
    fontWeight: "600",
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 6,
    justifyContent: "space-between",
  },
  dayButton: {
    paddingHorizontal: 4,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    flex: 1,
    maxWidth: 54,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLetters: {
    alignItems: "center",
    justifyContent: "center",
  },
  dayTimeRangesSection: {
    marginTop: 12,
    gap: 8,
  },
  dayTimeRangesTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  timeRangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  timeRangeDayLabel: {
    width: 34,
    fontSize: 12,
    fontWeight: "600",
  },
  timeRangeInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    minWidth: 70,
    textAlign: "center",
    fontSize: 12,
  },
  timeRangeSeparator: {
    fontSize: 12,
    fontWeight: "500",
  },
  dayButtonText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  emptyState: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  doneButton: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
  },
  doneButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
