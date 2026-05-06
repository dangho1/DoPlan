import { useThemeColor } from "@/hooks/useThemeColor";
import { Stack, useLocalSearchParams } from "expo-router";

export default function ChatTabLayout() {
  const { title } = useLocalSearchParams<{ title?: string }>();
  const colors = useThemeColor();
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen
        name="[conversationId]"
        options={{
          headerTitle: title,
          headerShown: true,
          title,
          headerStyle: {
            backgroundColor: colors.tint,
          },
          headerTitleStyle: {
            color: "white",
          },
        }}
      />
    </Stack>
  );
}
