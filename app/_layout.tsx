import { Session } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Auth from "../components/Auth";
import { clearSupabaseStorage } from "../lib/storageAdapter";
import { supabase } from "../lib/supabase";
import { KeyboardProvider } from "react-native-keyboard-controller";

const queryClient = new QueryClient();

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

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
            </View>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    );
  }

  if (!session || isPasswordRecovery) {
    return (
      <KeyboardProvider>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={styles.gestureRoot}>
            <SafeAreaProvider>
              <View style={styles.keyboardContainer}>
                <Auth
                  forceShow={isPasswordRecovery}
                  onPasswordRecoveryComplete={() =>
                    setIsPasswordRecovery(false)
                  }
                />
              </View>
            </SafeAreaProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </KeyboardProvider>
    );
  }

  return (
    <KeyboardProvider>
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
            </View>
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </KeyboardProvider>
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
