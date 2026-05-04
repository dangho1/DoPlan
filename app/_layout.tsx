import { Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Dimensions,
    Keyboard,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Auth from "../components/Auth";
import { Colors } from "../constants/Colors";
import { useColorScheme } from "../hooks/useColorScheme";
import { isBrowser } from "../lib/platformUtils";
import { clearSupabaseStorage } from "../lib/storageAdapter";
import { supabase } from "../lib/supabase";

const queryClient = new QueryClient()

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [keyboardBottomOffset, setKeyboardBottomOffset] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [focusedInputHasAccessory, setFocusedInputHasAccessory] =
    useState(false);

  const theme = Colors[colorScheme ?? "light"];

  const getKeyboardBottomOffset = (
    keyboardHeight?: number,
    keyboardScreenY?: number,
  ) => {
    const windowHeight = Dimensions.get("window").height;
    const fromHeight = Math.max(0, keyboardHeight ?? 0);
    const fromScreenY =
      keyboardScreenY != null ? Math.max(0, windowHeight - keyboardScreenY) : 0;

    // Use the larger signal so the bar remains attached across keyboard frame changes.
    return Math.max(fromHeight, fromScreenY);
  };

  const updateFocusedInputAccessoryState = () => {
    const textInputState = (
      TextInput as unknown as {
        State?: {
          currentlyFocusedInput?: () => {
            props?: {
              inputAccessoryViewID?: string;
            };
          } | null;
        };
      }
    ).State;

    const focusedInput = textInputState?.currentlyFocusedInput?.();

    setFocusedInputHasAccessory(
      Boolean(focusedInput?.props?.inputAccessoryViewID),
    );
  };

  const isRecoveryUrl = (url: string) => {
    const normalized = url.toLowerCase();
    return (
      normalized.includes("type=recovery") ||
      normalized.includes("password_recovery")
    );
  };

  useEffect(() => {
    // Check for password recovery URL first
    const checkPasswordRecovery = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl && isRecoveryUrl(initialUrl)) {
        console.log("Password recovery URL detected in main layout");
        setIsPasswordRecovery(true);
      }
    };

    checkPasswordRecovery();

    if (!isBrowser()) {
      setLoading(false);
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data: { session } }: { data: { session: Session | null } }) => {
        setSession(session);
        setLoading(false);
      })
      .catch(async (error: unknown) => {
        console.error("Error getting session:", error);
        // Clear invalid session data if refresh token is invalid
        if (error instanceof Error && error.message.includes("Refresh Token")) {
          console.log("Clearing invalid session data");
          await clearSupabaseStorage();
          await supabase.auth.signOut();
        }
        setSession(null);
        setLoading(false);
      });

    try {
      const { data: subscription } = supabase.auth.onAuthStateChange(
        async (event: string, session: Session | null) => {
          console.log("Main layout - Auth state change:", event, session);

          // Handle token refresh errors
          if (event === "TOKEN_REFRESHED" && !session) {
            console.log("Token refresh failed, clearing session");
            await clearSupabaseStorage();
            await supabase.auth.signOut();
            setSession(null);
            setIsPasswordRecovery(false);
            return;
          }

          setSession(session);

          // Clear password recovery flag on successful password update
          if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
            // Don't clear immediately, let Auth component handle it
          } else if (event === "SIGNED_OUT") {
            setIsPasswordRecovery(false);
          }
        },
      );

      return () => {
        subscription?.subscription?.unsubscribe();
      };
    } catch (error) {
      console.error("Error setting up auth state change listener:", error);
      return () => {};
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      return;
    }

    const showSub = Keyboard.addListener("keyboardWillShow", (event) => {
      setKeyboardBottomOffset(
        getKeyboardBottomOffset(
          event.endCoordinates.height,
          event.endCoordinates.screenY,
        ),
      );
      setKeyboardVisible(true);
      requestAnimationFrame(updateFocusedInputAccessoryState);
    });

    const frameSub = Keyboard.addListener(
      "keyboardWillChangeFrame",
      (event) => {
        setKeyboardBottomOffset(
          getKeyboardBottomOffset(
            event.endCoordinates.height,
            event.endCoordinates.screenY,
          ),
        );
        requestAnimationFrame(updateFocusedInputAccessoryState);
      },
    );

    const didFrameSub = Keyboard.addListener(
      "keyboardDidChangeFrame",
      (event) => {
        setKeyboardBottomOffset(
          getKeyboardBottomOffset(
            event.endCoordinates.height,
            event.endCoordinates.screenY,
          ),
        );
        requestAnimationFrame(updateFocusedInputAccessoryState);
      },
    );

    const hideSub = Keyboard.addListener("keyboardWillHide", () => {
      setKeyboardVisible(false);
      setKeyboardBottomOffset(0);
      setFocusedInputHasAccessory(false);
    });

    return () => {
      showSub.remove();
      frameSub.remove();
      didFrameSub.remove();
      hideSub.remove();
    };
  }, []);

  const renderKeyboardDismissBar = () => {
    if (Platform.OS !== "ios" || !keyboardVisible || focusedInputHasAccessory) {
      return null;
    }

    return (
      <View
        pointerEvents="box-none"
        style={[
          styles.keyboardAccessoryBar,
          {
            bottom: keyboardBottomOffset,
            backgroundColor: theme.cardBackground,
            borderTopColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={Keyboard.dismiss}
          style={styles.keyboardAccessoryButton}
          activeOpacity={0.7}
        >
          <Text
            style={[styles.keyboardAccessoryButtonText, { color: theme.tint }]}
          >
            Done
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={styles.gestureRoot}>
          <SafeAreaProvider>
            <View style={styles.keyboardContainer}>
              <View
                style={{
                  flex: 1,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <ActivityIndicator size="large" />
              </View>
              {renderKeyboardDismissBar()}
            </View>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    );
  }

  if (!session || isPasswordRecovery) {
    return (
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView style={styles.gestureRoot}>
          <SafeAreaProvider>
            <View style={styles.keyboardContainer}>
              <Auth
                forceShow={isPasswordRecovery}
                onPasswordRecoveryComplete={() => setIsPasswordRecovery(false)}
              />
              {renderKeyboardDismissBar()}
            </View>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <SafeAreaProvider>
          <View style={styles.keyboardContainer}>
            <Stack
              screenOptions={{
                headerShown: false,
              }}
            >
              <Stack.Screen
                name="(tabs)"
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="settings"
                options={{
                  headerShown: false,
                }}
              />
            </Stack>
            {renderKeyboardDismissBar()}
          </View>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  keyboardAccessoryBar: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    justifyContent: "center",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  keyboardAccessoryButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  keyboardAccessoryButtonText: {
    fontSize: 17,
    fontWeight: "600",
  },
});
