import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    findNodeHandle,
    Keyboard,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    UIManager,
    View,
} from "react-native";
import { deleteCurrentUserAccount } from "@/lib/accountService";
import { supabase } from "@/lib/supabase";

const DELETE_CONFIRMATION_TEXT = "I AGREE";

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [loading, setLoading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const deleteConfirmationInputRef = React.useRef<TextInput>(null);
  const scrollOffsetRef = React.useRef(0);
  const pendingDeleteFocusRef = React.useRef(false);

  const scrollDeleteFieldToTarget = () => {
    const nodeHandle = findNodeHandle(deleteConfirmationInputRef.current);
    if (!nodeHandle) {
      return;
    }

    const windowHeight = Dimensions.get("window").height;
    const keyboardTop =
      keyboardHeight > 0 ? windowHeight - keyboardHeight : windowHeight;
    const targetY = Math.min(windowHeight * 0.34, keyboardTop * 0.52);

    UIManager.measure(nodeHandle, (_x, _y, _width, _height, _px, py) => {
      const delta = py - targetY;
      if (delta > 4) {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, scrollOffsetRef.current + delta),
          animated: true,
        });
      }
    });
  };

  React.useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      const nextHeight = Math.max(0, event.endCoordinates.height);
      setKeyboardHeight(nextHeight);
      if (pendingDeleteFocusRef.current) {
        pendingDeleteFocusRef.current = false;
        setTimeout(() => scrollDeleteFieldToTarget(), 20);
      }
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      pendingDeleteFocusRef.current = false;
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleDeleteConfirmationFocus = () => {
    if (keyboardHeight > 0) {
      setTimeout(() => scrollDeleteFieldToTarget(), 20);
      return;
    }

    pendingDeleteFocusRef.current = true;
  };

  const handleBack = () => {
    router.back();
  };

  const handleLogout = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    setLoading(false);

    if (error) {
      Alert.alert("Error", "Failed to logout. Please try again.");
    }
  };

  const handleResetPassword = async () => {
    setLoading(true);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      setLoading(false);
      Alert.alert("Error", "Unable to find your account email.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(user.email);
    setLoading(false);

    if (error) {
      Alert.alert("Error", "Failed to send reset email. Please try again.");
      return;
    }

    Alert.alert("Success", "Password reset email sent. Check your inbox.");
  };

  const handleDeleteAccount = () => {
    if (deleteConfirmation.trim().toUpperCase() !== DELETE_CONFIRMATION_TEXT) {
      Alert.alert(
        "Confirmation Required",
        `Please type "${DELETE_CONFIRMATION_TEXT}" to continue.`,
      );
      return;
    }

    Alert.alert(
      "Delete Account",
      "This action is permanent and cannot be undone. Your account and related data will be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Permanently",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const { error } = await deleteCurrentUserAccount();
            setLoading(false);

            if (error) {
              Alert.alert(
                "Delete Failed",
                "Could not delete your account. Please try again.",
              );
              return;
            }

            Alert.alert(
              "Account Deleted",
              "Your account has been permanently deleted.",
            );
          },
        },
      ],
    );
  };

  const canDelete =
    deleteConfirmation.trim().toUpperCase() === DELETE_CONFIRMATION_TEXT;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
          <Text style={[styles.backText, { color: colors.text }]}>Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          Settings
        </Text>
      </View>

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        onScroll={(event) => {
          scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        <TouchableOpacity
          style={[styles.actionButton, { borderColor: colors.primary }]}
          onPress={handleResetPassword}
          disabled={loading}
        >
          <Ionicons name="mail" size={18} color={colors.primary} />
          <Text style={[styles.actionButtonText, { color: colors.primary }]}>
            Request Password Reset Email
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: "#d9534f" }]}
          onPress={handleLogout}
          disabled={loading}
        >
          <Ionicons name="log-out" size={18} color="#fff" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>

        <View
          style={[
            styles.dangerZone,
            { borderColor: "#cc4b37", backgroundColor: "#fff4f2" },
          ]}
        >
          <Text style={styles.dangerTitle}>Danger Zone</Text>
          <Text style={styles.dangerText}>
            Delete your account permanently. This removes your login and
            associated profile data.
          </Text>
          <Text style={styles.confirmationHint}>
            Type I AGREE to enable deletion:
          </Text>
          <TextInput
            ref={deleteConfirmationInputRef}
            style={styles.confirmationInput}
            value={deleteConfirmation}
            onChangeText={setDeleteConfirmation}
            onFocus={handleDeleteConfirmationFocus}
            autoCapitalize="characters"
            placeholder="I AGREE"
            editable={!loading}
          />
          <TouchableOpacity
            style={[
              styles.deleteButton,
              { backgroundColor: canDelete ? "#cc4b37" : "#d9d9d9" },
            ]}
            onPress={handleDeleteAccount}
            disabled={!canDelete || loading}
          >
            <Ionicons name="trash" size={18} color="#fff" />
            <Text style={styles.deleteButtonText}>
              Delete Account Permanently
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
    zIndex: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 10,
    gap: 12,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  backText: {
    fontSize: 16,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "700",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 14,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 14,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  logoutButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  dangerZone: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 10,
  },
  dangerTitle: {
    color: "#a53622",
    fontSize: 18,
    fontWeight: "700",
  },
  dangerText: {
    color: "#7d2f1f",
    fontSize: 14,
    lineHeight: 20,
  },
  confirmationHint: {
    color: "#7d2f1f",
    fontWeight: "600",
    marginTop: 4,
  },
  confirmationInput: {
    borderWidth: 1,
    borderColor: "#d48d81",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    fontSize: 15,
  },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingVertical: 14,
    gap: 8,
    marginTop: 6,
  },
  deleteButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
});
