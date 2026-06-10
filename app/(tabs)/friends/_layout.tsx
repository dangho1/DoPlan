import { useThemeColor } from "@/hooks/useThemeColor";
import { Stack, useLocalSearchParams } from "expo-router";
import { View } from "react-native";
import { ScreenStackHeaderLeftView } from "react-native-screens";

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
          headerBackTitle: "Chats",
          headerTintColor: "white",
          headerShadowVisible: false,
          headerTitleStyle: {
            color: "white",
          },
        }}
      />
    </Stack>
  );
}
