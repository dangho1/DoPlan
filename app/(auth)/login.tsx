import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  FocusEvent,
  Keyboard,
  NativeMethods,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Colors } from "../../constants/Colors";
import { useColorScheme } from "../../hooks/useColorScheme";
import { supabase } from "../../lib/supabase";
import { calculateAge } from "../../lib/userProfileService";

interface AuthFormProps {
  initialTab?: "login" | "signup";
  onBack: () => void;
  onForgotPassword: () => void;
}

export default function AuthForm({
  initialTab = "signup",
  onBack,
  onForgotPassword,
}: AuthFormProps) {
  const colorScheme = useColorScheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"signup" | "login">(initialTab);

  // Additional signup fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollOffsetRef = useRef(0);
  const pendingFocusTargetRef = useRef<NativeMethods | null>(null);

  const scrollTargetIntoView = (target: NativeMethods) => {
    const windowHeight = Dimensions.get("window").height;
    const keyboardTop =
      keyboardHeight > 0 ? windowHeight - keyboardHeight : windowHeight;
    const targetY = Math.min(windowHeight * 0.34, keyboardTop * 0.52);

    target.measure((_x, _y, _width, _height, _px, py) => {
      const delta = py - targetY;
      if (delta > 4) {
        scrollViewRef.current?.scrollTo({
          y: Math.max(0, scrollOffsetRef.current + delta),
          animated: true,
        });
      }
    });
  };

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      const nextHeight = Math.max(0, event.endCoordinates.height);
      setKeyboardHeight(nextHeight);
      if (pendingFocusTargetRef.current) {
        const target = pendingFocusTargetRef.current;
        pendingFocusTargetRef.current = null;
        setTimeout(() => scrollTargetIntoView(target), 20);
      }
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
      pendingFocusTargetRef.current = null;
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleInputFocus = (event: FocusEvent) => {
    const target = event.target;

    if (keyboardHeight > 0) {
      setTimeout(() => scrollTargetIntoView(target), 20);
      return;
    }

    pendingFocusTargetRef.current = target;
  };

  const isEmailNotVerifiedError = (message: string) => {
    const normalized = message.toLowerCase();
    return (
      normalized.includes("email not confirmed") ||
      normalized.includes("email not verified") ||
      normalized.includes("confirm your email")
    );
  };

  const switchToLoginAfterSignup = () => {
    setActiveTab("login");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleTabSwitch = (tab: "signup" | "login") => {
    setActiveTab(tab);
    // Clear all fields when switching tabs
    setEmail("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setBirthDate("");
    setPhoneNumber("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const formatBirthDate = (text: string) => {
    // Remove any non-numeric characters
    const numbers = text.replace(/\D/g, "");

    // Format as YYYY-MM-DD
    if (numbers.length <= 4) {
      setBirthDate(numbers);
    } else if (numbers.length <= 6) {
      setBirthDate(`${numbers.slice(0, 4)}-${numbers.slice(4)}`);
    } else if (numbers.length <= 8) {
      setBirthDate(
        `${numbers.slice(0, 4)}-${numbers.slice(4, 6)}-${numbers.slice(6, 8)}`,
      );
    }
  };

  const formatPhoneNumber = (text: string) => {
    // Remove any non-numeric characters
    const numbers = text.replace(/\D/g, "");

    // Format as (XXX) XXX-XXXX
    if (numbers.length <= 3) {
      setPhoneNumber(numbers);
    } else if (numbers.length <= 6) {
      setPhoneNumber(`(${numbers.slice(0, 3)}) ${numbers.slice(3)}`);
    } else if (numbers.length <= 10) {
      setPhoneNumber(
        `(${numbers.slice(0, 3)}) ${numbers.slice(3, 6)}-${numbers.slice(6)}`,
      );
    }
  };

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    if (error) {
      if (isEmailNotVerifiedError(error.message)) {
        Alert.alert(
          "Confirm email first",
          "Please verify your email before logging in. Check your inbox and spam folder.",
        );
      } else {
        Alert.alert("Login Error", error.message);
      }
    }
    setLoading(false);
  }

  async function signUpWithEmail() {
    setLoading(true);

    // Validation for signup
    if (activeTab === "signup") {
      if (!firstName.trim() || !lastName.trim()) {
        Alert.alert("Please enter your first and last name");
        setLoading(false);
        return;
      }
      if (!email.trim() || !password.trim()) {
        Alert.alert("Please enter your email and password");
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert("Passwords do not match");
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        Alert.alert("Password must be at least 6 characters long");
        setLoading(false);
        return;
      }
      if (!birthDate.trim()) {
        Alert.alert("Please enter your birth date");
        setLoading(false);
        return;
      }
      // Validate birthdate format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(birthDate)) {
        Alert.alert("Please enter birth date in YYYY-MM-DD format");
        setLoading(false);
        return;
      }
      // Validate that it's a valid date
      const dateObj = new Date(birthDate);
      if (isNaN(dateObj.getTime()) || dateObj > new Date()) {
        Alert.alert("Please enter a valid birth date");
        setLoading(false);
        return;
      }

      // Calculate age from birth date
      const calculatedAge = calculateAge(birthDate);
      if (calculatedAge < 1 || calculatedAge > 120) {
        Alert.alert(
          "Please enter a valid birth date (age must be between 1 and 120)",
        );
        setLoading(false);
        return;
      }

      // Additional validation before sending to database
      if (!firstName.trim() || !lastName.trim()) {
        Alert.alert("Name fields cannot be empty");
        setLoading(false);
        return;
      }

      if (!email.trim()) {
        Alert.alert("Email cannot be empty");
        setLoading(false);
        return;
      }
    }

    console.log("Attempting signup with:", {
      email: email,
      emailLength: email.length,
      emailTrimmed: email.trim(),
      passwordLength: password.length,
      firstName: firstName,
      lastName: lastName,
    });

    const {
      data: { session, user },
      error,
    } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
      options: {
        emailRedirectTo: Linking.createURL("/"),
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          birth_date: birthDate,
          phone_number: phoneNumber.trim() || null,
          age: calculateAge(birthDate),
        },
      },
    });

    if (error) {
      console.error("Signup auth error details:", {
        message: error.message,
        status: error.status,
        name: error.name,
        cause: error.cause,
      });

      let errorMessage = error.message;

      // Provide helpful error messages
      if (error.message.includes("Database error")) {
        errorMessage =
          "Database setup incomplete. Please run the schema setup in Supabase SQL Editor.\n\nSee FIX_DATABASE_ERROR.md for instructions.";
      } else if (error.message.includes("User already registered")) {
        errorMessage =
          "This email is already registered. Try logging in instead.";
      }

      Alert.alert("Signup Error", errorMessage);
      setLoading(false);
      return;
    }

    // Check if we have a user (even without session, user should exist)
    const userToUse = session?.user || user;

    if (userToUse) {
      console.log("User created, profile should be auto-created by trigger");

      // Wait a moment for the trigger to execute
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify profile was created
      const { data: profileData, error: profileError } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", userToUse.id)
        .single();

      if (profileError) {
        console.error("Profile verification error:", profileError);
      } else {
        console.log("User profile created successfully:", profileData);
      }

      switchToLoginAfterSignup();
      Alert.alert(
        "Verify your email",
        "Account created. Please verify your email before logging in.",
      );
    } else {
      console.error("No user returned from signup");
      Alert.alert(
        "Signup Issue",
        "Account may have been created but profile setup failed. Please try logging in.",
      );
    }
    setLoading(false);
  }

  return (
    <SafeAreaView
      style={[
        styles.authContainer,
        { backgroundColor: Colors[colorScheme ?? "light"].background },
      ]}
    >
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        onScroll={(event) => {
          scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        <View
          style={[
            styles.formContainer,
            { backgroundColor: Colors[colorScheme ?? "light"].cardBackground },
          ]}
        >
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "signup" && {
                  borderBottomColor: Colors[colorScheme ?? "light"].secondary,
                },
              ]}
              onPress={() => handleTabSwitch("signup")}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: Colors[colorScheme ?? "light"].textLight },
                  activeTab === "signup" && {
                    color: Colors[colorScheme ?? "light"].text,
                  },
                ]}
              >
                SIGN UP
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === "login" && {
                  borderBottomColor: Colors[colorScheme ?? "light"].secondary,
                },
              ]}
              onPress={() => handleTabSwitch("login")}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: Colors[colorScheme ?? "light"].textLight },
                  activeTab === "login" && {
                    color: Colors[colorScheme ?? "light"].text,
                  },
                ]}
              >
                LOG IN
              </Text>
            </TouchableOpacity>
          </View>

          <Text
            style={[
              styles.formTitle,
              { color: Colors[colorScheme ?? "light"].text },
            ]}
          >
            {activeTab === "login" ? "Log in" : "Sign up"}
          </Text>

          {activeTab === "signup" && (
            <>
              <View style={styles.nameContainer}>
                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <Text
                    style={[
                      styles.inputLabel,
                      { color: Colors[colorScheme ?? "light"].text },
                    ]}
                  >
                    First Name
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor:
                          Colors[colorScheme ?? "light"].inputBackground,
                        color: Colors[colorScheme ?? "light"].text,
                      },
                    ]}
                    value={firstName}
                    onChangeText={setFirstName}
                    onFocus={handleInputFocus}
                    placeholder=""
                    autoCapitalize="words"
                  />
                </View>
                <View style={[styles.inputContainer, styles.halfWidth]}>
                  <Text
                    style={[
                      styles.inputLabel,
                      { color: Colors[colorScheme ?? "light"].text },
                    ]}
                  >
                    Last Name
                  </Text>
                  <TextInput
                    style={[
                      styles.textInput,
                      {
                        backgroundColor:
                          Colors[colorScheme ?? "light"].inputBackground,
                        color: Colors[colorScheme ?? "light"].text,
                      },
                    ]}
                    value={lastName}
                    onChangeText={setLastName}
                    onFocus={handleInputFocus}
                    placeholder=""
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.inputContainer}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: Colors[colorScheme ?? "light"].text },
                  ]}
                >
                  Birth Date
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor:
                        Colors[colorScheme ?? "light"].inputBackground,
                      color: Colors[colorScheme ?? "light"].text,
                    },
                  ]}
                  value={birthDate}
                  onChangeText={formatBirthDate}
                  onFocus={handleInputFocus}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>

              <View style={styles.inputContainer}>
                <Text
                  style={[
                    styles.inputLabel,
                    { color: Colors[colorScheme ?? "light"].text },
                  ]}
                >
                  Phone Number (Optional)
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor:
                        Colors[colorScheme ?? "light"].inputBackground,
                      color: Colors[colorScheme ?? "light"].text,
                    },
                  ]}
                  value={phoneNumber}
                  onChangeText={formatPhoneNumber}
                  onFocus={handleInputFocus}
                  placeholder="(555) 123-4567"
                  keyboardType="phone-pad"
                  maxLength={14}
                />
              </View>
            </>
          )}

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
                  backgroundColor:
                    Colors[colorScheme ?? "light"].inputBackground,
                  color: Colors[colorScheme ?? "light"].text,
                },
              ]}
              value={email}
              onChangeText={setEmail}
              onFocus={handleInputFocus}
              placeholder=""
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputContainer}>
            <Text
              style={[
                styles.inputLabel,
                { color: Colors[colorScheme ?? "light"].text },
              ]}
            >
              Password
            </Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.textInput,
                  styles.passwordInput,
                  {
                    backgroundColor:
                      Colors[colorScheme ?? "light"].inputBackground,
                    color: Colors[colorScheme ?? "light"].text,
                  },
                ]}
                value={password}
                onChangeText={setPassword}
                onFocus={handleInputFocus}
                placeholder=""
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeIcon}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye" : "eye-off"}
                  size={20}
                  color={Colors[colorScheme ?? "light"].textLight}
                />
              </TouchableOpacity>
            </View>
          </View>

          {activeTab === "signup" && (
            <View style={styles.inputContainer}>
              <Text
                style={[
                  styles.inputLabel,
                  { color: Colors[colorScheme ?? "light"].text },
                ]}
              >
                Confirm Password
              </Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[
                    styles.textInput,
                    styles.passwordInput,
                    {
                      backgroundColor:
                        Colors[colorScheme ?? "light"].inputBackground,
                      color: Colors[colorScheme ?? "light"].text,
                    },
                  ]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={handleInputFocus}
                  placeholder=""
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? "eye" : "eye-off"}
                    size={20}
                    color={Colors[colorScheme ?? "light"].textLight}
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: Colors[colorScheme ?? "light"].secondary },
            ]}
            onPress={activeTab === "login" ? signInWithEmail : signUpWithEmail}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {activeTab === "login" ? "Log in" : "Sign up"}
            </Text>
          </TouchableOpacity>

          {activeTab === "login" && (
            <TouchableOpacity onPress={onForgotPassword}>
              <Text
                style={[
                  styles.forgotPasswordText,
                  { color: Colors[colorScheme ?? "light"].accent },
                ]}
              >
                Forgot password?
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

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
  authContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 36,
  },
  tabContainer: {
    flexDirection: "row",
    marginBottom: 20,
    marginHorizontal: -10,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "500",
  },
  formContainer: {
    margin: 20,
    marginTop: 60,
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
  formTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 30,
  },
  nameContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 15,
  },
  halfWidth: {
    flex: 1,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    marginBottom: 8,
  },
  textInput: {
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 15,
    fontSize: 16,
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 50,
  },
  eyeIcon: {
    position: "absolute",
    right: 15,
    top: 15,
  },
  submitButton: {
    borderRadius: 8,
    paddingVertical: 15,
    marginTop: 10,
    marginBottom: 20,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  forgotPasswordText: {
    fontSize: 14,
    textAlign: "center",
  },
  backButton: {
    position: "absolute",
    top: 50,
    left: 20,
    zIndex: 1,
  },
});

