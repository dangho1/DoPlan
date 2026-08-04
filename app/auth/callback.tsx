import * as Linking from "expo-linking";
import { useEffect } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { parseAuthLink } from "../../lib/authLinking";
import { supabase } from "../../lib/supabase";

/**
 * Landing screen for the Supabase password-recovery deep link
 * (doplan://auth/callback#access_token=...). The root layout
 * (app/_layout.tsx) already listens for this same link globally and applies
 * the recovery session as soon as it arrives, on both cold start and while
 * the app is already running — once that happens it swaps this whole Stack
 * out for the password-recovery UI, unmounting this screen.
 *
 * This screen does the same token exchange as a defensive fallback (e.g. if
 * this route is reached without the root listener having fired yet) so it
 * never dead-ends in a spinner.
 */
export default function AuthCallback() {
  useEffect(() => {
    const handleCallback = async () => {
      try {
        if (Platform.OS === "web") {
          const hashParams = new URLSearchParams(
            window.location.hash.substring(1),
          );
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          const type = hashParams.get("type");

          if (accessToken && refreshToken && type === "recovery") {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) console.error("Error setting session:", error);
          }
          return;
        }

        const url = await Linking.getInitialURL();
        if (!url) return;

        const { accessToken, refreshToken } = parseAuthLink(url);
        if (!accessToken || !refreshToken) return;

        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (error) console.error("Error setting session:", error);
      } catch (error) {
        console.error("Callback error:", error);
      }
    };

    handleCallback();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#007AFF" />
      <Text style={styles.text}>Processing password reset...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 20,
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    color: "#333",
  },
});
