import ChildMenu from "@/components/ChildMenu";
import type { Child } from "@/lib/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";

export default function ChildMenuScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    childId?: string;
    childName?: string;
    childDob?: string;
    childAvatarUrl?: string;
  }>();

  const childId = typeof params.childId === "string" ? params.childId : "";
  const childName = typeof params.childName === "string" ? params.childName : "";
  const childDob = typeof params.childDob === "string" ? params.childDob : null;
  const childAvatarUrl =
    typeof params.childAvatarUrl === "string" && params.childAvatarUrl.length > 0
      ? params.childAvatarUrl
      : null;

  const child: Child = {
    id: childId,
    name: childName || "Unknown Child",
    date_of_birth: childDob,
    avatar_url: childAvatarUrl,
    created_at: "",
  };

  const childRouteParams = {
    childId,
    childName: child.name,
  };

  return (
    <ChildMenu
      child={child}
      onBack={() => router.back()}
      onCalendar={() =>
        router.push({ pathname: "/child/calendar", params: childRouteParams })
      }
      onEconomics={() =>
        router.push({ pathname: "/child/economics", params: childRouteParams })
      }
      onSettings={() =>
        router.push({ pathname: "/child/child-settings", params: childRouteParams })
      }
      onActivities={() =>
        router.push({ pathname: "/child/activities", params: childRouteParams })
      }
    />
  );
}
