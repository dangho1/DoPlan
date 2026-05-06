import React from "react";
import { View, Text, PlatformColor } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { useThemeColor } from "@/hooks/useThemeColor";

// Usage: <Stack.Screen options={{ header: (props) => <StackHeader title="Home" {...props} /> }} />

export interface StackHeaderProps {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  transparent?: boolean;
  blurEffect?: "none" | "light" | "dark" | "regular" | "prominent";
  style?: any;
  navigation?: any;
  back?: { title?: string } | null;
}

export function StackHeader({
  title,
  subtitle,
  left,
  right,
  transparent = false,
  blurEffect = "none",
  style,
  navigation,
  back,
}: StackHeaderProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColor();

  const headerBg = transparent ? "transparent" : colors.tint;

  const renderBackButton = () => {
    if (!back || !navigation) return null;
    return (
      <View style={{ marginRight: 8, flex: 1 }}>
        <Text
          onPress={() => navigation.goBack()}
          style={{
            color: "white",
            fontSize: 28,
            fontWeight: "bold",
          }}
        >
          ←
        </Text>
      </View>
    );
  };

  const content = (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 8,
          minHeight: 44,
          backgroundColor: colors.tint,
          justifyContent: "space-between",
        },
      ]}
    >
      {renderBackButton()}
      {left && <View style={{ marginRight: 8 }}>{left}</View>}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          selectable
          style={{
            fontSize: 17,
            fontWeight: "600",
            color: PlatformColor("label"),
          }}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            selectable
            style={{
              fontSize: 13,
              color: PlatformColor("secondaryLabel"),
            }}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
      {right && <View style={{ marginLeft: 8 }}>{right}</View>}
    </View>
  );

  if (blurEffect !== "none" && !transparent) {
    return (
      <BlurView
        intensity={
          blurEffect === "prominent" ? 100 : blurEffect === "regular" ? 50 : 30
        }
        tint={
          blurEffect === "light"
            ? "light"
            : blurEffect === "dark"
              ? "dark"
              : "default"
        }
        style={[
          {
            width: "100%",
            paddingTop: insets.top,
            borderBottomWidth: 0.5,
            borderBottomColor: PlatformColor("separator"),
          },
          style,
        ]}
      >
        {content}
      </BlurView>
    );
  }

  return (
    <View
      style={[
        {
          width: "100%",
          backgroundColor: headerBg,
          paddingTop: insets.top,
          borderBottomWidth: transparent ? 0 : 0.5,
          borderBottomColor: PlatformColor("separator"),
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
        },
        style,
      ]}
    >
      {content}
    </View>
  );
}
