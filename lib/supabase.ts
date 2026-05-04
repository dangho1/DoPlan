import { createClient, processLock } from "@supabase/supabase-js";
import { AppState } from "react-native";
import "react-native-url-polyfill/auto";
import { createStorageAdapter } from "./storageAdapter";
import { Database } from "@/database.types";

const supabaseUrl = "https://ifhmpedzbaoehjrevvlr.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlmaG1wZWR6YmFvZWhqcmV2dmxyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk3Mjk3NTQsImV4cCI6MjA2NTMwNTc1NH0.3N9pJL8t3Mkr4cVxpozxCxK7mj8m7ZH47I12lIzbvWM";

// Create the Supabase client with our safe storage adapter
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createStorageAdapter(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    lock: processLock,
  },
});

// Tells Supabase Auth to continuously refresh the session automatically
// if the app is in the foreground. When this is added, you will continue
// to receive `onAuthStateChange` events with the `TOKEN_REFRESHED` or
// `SIGNED_OUT` event if the user's session is terminated. This should
// only be registered once.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

// Expose supabase to global scope for debugging (development only)
if (__DEV__) {
  (global as any).supabase = supabase;
  console.log("🔧 Supabase client available globally for debugging");
}
