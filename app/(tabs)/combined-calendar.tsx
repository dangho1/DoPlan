import CombinedCalendar from "@/app/(tabs)/child/combined-calendar";
import { useRouter } from "expo-router";
import React from "react";

export default function CombinedCalendarTabScreen() {
  const router = useRouter();

  return <CombinedCalendar onBack={() => router.replace("/(tabs)")} />;
}
