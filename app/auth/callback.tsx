import { useRouter } from "expo-router";
import { useEffect } from "react";
import {
    ActivityIndicator,
    Platform,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { supabase } from "../../lib/supabase";

/**
 * This page handles the OAuth callback from Supabase password reset emails
 * It works on both web and mobile platforms
 */
export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        if (Platform.OS === "web") {
          // On web, extract the hash fragment
          const hashParams = new URLSearchParams(
            window.location.hash.substring(1),
          );
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");
          const type = hashParams.get("type");

          console.log(
            "Web callback - type:",
            type,
            "has tokens:",
            !!accessToken,
          );

          if (accessToken && refreshToken && type === "recovery") {
            // Set the session with the tokens from the URL
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              console.error("Error setting session:", error);
            } else {
              console.log("Session set successfully");
              // The auth state change will automatically redirect to the new password screen
              // via the main _layout.tsx
            }
          } else {
            console.error("Missing tokens or not a recovery link");
          }
        } else {
          // On mobile web browser, try to open the native app using deep link
          const appUrl = `doplan://auth/callback${window.location.hash}`;
          console.log("Attempting to open app:", appUrl);
          window.location.href = appUrl;

          // Fallback message if app doesn't open
          setTimeout(() => {
            alert(
              "Please open this link in your DivorceApp mobile application",
            );
          }, 2000);
        }
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
      {Platform.OS !== "web" && (
        <Text style={styles.subtext}>
          If the app doesn't open automatically, please open it manually
        </Text>
      )}
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
  subtext: {
    marginTop: 10,
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});
