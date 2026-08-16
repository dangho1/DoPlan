import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { useColorScheme } from "../../hooks/useColorScheme";
import { supabase } from "../../lib/supabase";

interface ResetPasswordProps {
  onBack: () => void;
}

export default function ResetPassword({ onBack }: ResetPasswordProps) {
  const colorScheme = useColorScheme();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleResetPassword() {
    if (!email) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      Alert.alert("Error", "Please enter your email address");
      return;
    }

    setLoading(true);

    const { data: accountExists, error: checkError } = await supabase.rpc(
      "email_exists_for_reset",
      { input_email: normalizedEmail },
    );

    if (checkError) {
      setLoading(false);
      Alert.alert(
        "Error",
        "Could not verify this email right now. Please try again.",
      );
      return;
    }

    if (!accountExists) {
      setLoading(false);
      Alert.alert("No Account Found", "No account exists for this email.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      {
        redirectTo:
          "https://tanudin.github.io/brillin.github.io/doplan-redirect.html",
      },
    );

    if (error) {
      Alert.alert("Error", error.message);
    } else {
      setEmailSent(true);
      Alert.alert(
        "Reset Email Sent",
        "We sent a reset link to your email. If it doesn't appear within a few minutes, check your spam folder.",
      );
    }
    setLoading(false);
  }

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: Colors[colorScheme ?? "light"].background },
      ]}
    >
      <View
        style={[
          styles.formContainer,
          { backgroundColor: Colors[colorScheme ?? "light"].cardBackground },
        ]}
      >
        <Text
          style={[styles.title, { color: Colors[colorScheme ?? "light"].text }]}
        >
          Reset Password
        </Text>

        <Text
          style={[
            styles.subtitle,
            { color: Colors[colorScheme ?? "light"].textSecondary },
          ]}
        >
          Enter your email address and we'll send you a link to reset your
          password.
        </Text>

        <View style={styles.inputContainer}>
          <Text
            style={[
              styles.inputLabel,
              { color: Colors[colorScheme ?? "light"].text },
            ]}
          >
            Email
          </Text>
          <TextInput
            style={[
              styles.textInput,
              {
                backgroundColor: Colors[colorScheme ?? "light"].inputBackground,
                color: Colors[colorScheme ?? "light"].text,
              },
            ]}
            value={email}
            onChangeText={setEmail}
            placeholder="Enter your email address"
            placeholderTextColor={Colors[colorScheme ?? "light"].textLight}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            editable={!emailSent}
          />
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor: emailSent
                ? Colors[colorScheme ?? "light"].textLight
                : Colors[colorScheme ?? "light"].secondary,
            },
          ]}
          onPress={handleResetPassword}
          disabled={loading || emailSent}
        >
          <Text style={styles.submitButtonText}>
            {emailSent
              ? "Email Sent"
              : loading
                ? "Sending..."
                : "Send Reset Email"}
          </Text>
        </TouchableOpacity>

        {emailSent && (
          <View style={styles.successContainer}>
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={Colors[colorScheme ?? "light"].accent}
            />
            <Text
              style={[
                styles.successText,
                { color: Colors[colorScheme ?? "light"].text },
              ]}
            >
              Reset email sent successfully!
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.backToLoginContainer} onPress={onBack}>
          <Text
            style={[
              styles.backToLoginText,
              { color: Colors[colorScheme ?? "light"].accent },
            ]}
          >
            Back to Log In
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.backButton} onPress={onBack}>
        <Ionicons
          name="arrow-back"
          size={24}
          color={Colors[colorScheme ?? "light"].textSecondary}
        />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  formContainer: {
    margin: 20,
    marginTop: 80,
    borderRadius: 15,
    padding: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 22,
  },
  inputContainer: {
    marginBottom: 25,
  },
  inputLabel: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: "500",
  },
  textInput: {
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontSize: 16,
  },
  submitButton: {
    borderRadius: 8,
    paddingVertical: 15,
    marginBottom: 20,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    padding: 15,
    borderRadius: 8,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  successText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  backToLoginContainer: {
    alignItems: "center",
  },
  backToLoginText: {
    fontSize: 16,
    fontWeight: "500",
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 1,
  },
});
