import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import type { Child } from "@/lib/types";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

interface MenuOption {
  id: string;
  title: string;
  icon: string;
  onPress: () => void;
}

interface ChildMenuProps {
  child: Child;
  onBack: () => void;
  onCalendar: () => void;
  onEconomics: () => void;
  onSettings: () => void;
  onActivities: () => void;
  // Add more function props as needed for future features
}

export default function ChildMenu({
  child,
  onBack,
  onCalendar,
  onEconomics,
  onSettings,
  onActivities,
}: ChildMenuProps) {
  const colorScheme = useColorScheme();

  // Template for menu options - easy to add more icons/functions
  const menuOptions: MenuOption[] = [
    {
      id: "calendar",
      title: "Calendar",
      icon: "📅",
      onPress: onCalendar,
    },
    {
      id: "economics",
      title: "Expenses",
      icon: "💰",
      onPress: onEconomics,
    },
  ];

  const calculateAge = (birthDate: string | null): string => {
    if (!birthDate) return "";

    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }

    return age > 0 ? `${age} years old` : "Less than 1 year old";
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: Colors[colorScheme ?? "light"].background },
      ]}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text
            style={[
              styles.backButtonText,
              { color: Colors[colorScheme ?? "light"].tint },
            ]}
          >
            ‹ Back
          </Text>
        </TouchableOpacity>
      </View>

      {/* Child profile section */}
      <View style={styles.profileSection}>
        {/* Child's picture with fixed size and cropping */}
        <View style={styles.profileImageContainer}>
          <Image
            source={
              child.avatar_url
                ? { uri: child.avatar_url }
                : require("../assets/images/child_placeholder.png")
            }
            style={styles.profileImage}
            resizeMode="cover"
          />
        </View>

        <Text
          style={[
            styles.childName,
            { color: Colors[colorScheme ?? "light"].text },
          ]}
        >
          {child.name}
        </Text>

        {child.date_of_birth && (
          <Text
            style={[
              styles.childAge,
              { color: Colors[colorScheme ?? "light"].text },
            ]}
          >
            {calculateAge(child.date_of_birth)}
          </Text>
        )}
      </View>

      {/* Menu options grid */}
      <View style={styles.menuGrid}>
        {menuOptions.map((option) => (
          <TouchableOpacity
            key={option.id}
            style={[
              styles.menuButton,
              { backgroundColor: Colors[colorScheme ?? "light"].background },
            ]}
            onPress={option.onPress}
          >
            <View
              style={[
                styles.menuButtonContent,
                { borderColor: Colors[colorScheme ?? "light"].tint },
              ]}
            >
              <Text style={styles.menuIcon}>{option.icon}</Text>
              <Text
                style={[
                  styles.menuTitle,
                  { color: Colors[colorScheme ?? "light"].text },
                ]}
              >
                {option.title}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {/* Active menu buttons for additional features */}
        <TouchableOpacity
          style={[
            styles.menuButton,
            { backgroundColor: Colors[colorScheme ?? "light"].background },
          ]}
          onPress={onActivities}
        >
          <View
            style={[
              styles.menuButtonContent,
              { borderColor: Colors[colorScheme ?? "light"].tint },
            ]}
          >
            <Text style={styles.menuIcon}>🎨</Text>
            <Text
              style={[
                styles.menuTitle,
                { color: Colors[colorScheme ?? "light"].text },
              ]}
            >
              Recurring Activities
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.menuButton,
            { backgroundColor: Colors[colorScheme ?? "light"].background },
          ]}
          onPress={onSettings}
        >
          <View
            style={[
              styles.menuButtonContent,
              { borderColor: Colors[colorScheme ?? "light"].tint },
            ]}
          >
            <Text style={styles.menuIcon}>⚙️</Text>
            <Text
              style={[
                styles.menuTitle,
                { color: Colors[colorScheme ?? "light"].text },
              ]}
            >
              Settings
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60, // Add top padding to account for removed header
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  backButton: {
    padding: 10,
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  profileSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    marginBottom: 15,
    backgroundColor: "#f0f0f0",
  },
  profileImage: {
    width: "100%",
    height: "100%",
  },
  childName: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 5,
  },
  childAge: {
    fontSize: 16,
    opacity: 0.7,
  },
  menuGrid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    alignItems: "flex-start",
    paddingHorizontal: 5,
  },
  menuButton: {
    width: "47%",
    marginBottom: 20,
    alignItems: "center",
  },
  menuButtonContent: {
    padding: 20,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 140,
    gap: 10,
  },
  menuIcon: {
    fontSize: 40,
    textAlign: "center",
    lineHeight: 44,
    marginBottom: 5,
  },
  menuTitle: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    lineHeight: 16,
    flexWrap: "wrap",
    maxWidth: "100%",
  },
});
