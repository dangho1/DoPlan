import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// supabase-js v2 persists the session under "sb-<project-ref>-auth-token"
const SUPABASE_KEY_PREFIX = "sb-";

/**
 * Storage is always available in the native runtime. On web it maps to
 * localStorage, which doesn't exist during SSR/static rendering (Node),
 * so only there we need the window guard.
 */
const isStorageAvailable = () =>
  Platform.OS !== "web" || typeof window !== "undefined";

/**
 * Clear all Supabase auth data from storage
 * Useful when dealing with corrupted or invalid tokens
 */
export const clearSupabaseStorage = async (): Promise<void> => {
  try {
    if (isStorageAvailable()) {
      const keys = await AsyncStorage.getAllKeys();
      const supabaseKeys = keys.filter((key) =>
        key.startsWith(SUPABASE_KEY_PREFIX),
      );
      if (supabaseKeys.length > 0) {
        await AsyncStorage.multiRemove(supabaseKeys);
        console.log("Cleared Supabase auth storage:", supabaseKeys);
      }
    }
  } catch (error) {
    console.error("Error clearing Supabase storage:", error);
  }
};

/**
 * Custom storage adapter for Supabase that safely handles different environments
 * This prevents the "window is not defined" error when running in a Node.js environment
 */
export const createStorageAdapter = () => {
  return {
    getItem: async (key: string): Promise<string | null> => {
      try {
        if (isStorageAvailable()) {
          const value = await AsyncStorage.getItem(key);
          // Validate that the stored data is valid JSON for auth tokens
          if (value && key.startsWith(SUPABASE_KEY_PREFIX)) {
            try {
              JSON.parse(value);
            } catch (e) {
              console.error("Invalid JSON in storage for key:", key);
              await AsyncStorage.removeItem(key);
              return null;
            }
          }
          return value;
        }
        return null;
      } catch (error) {
        console.error("Storage adapter getItem error:", error);
        return null;
      }
    },
    setItem: async (key: string, value: string): Promise<void> => {
      try {
        if (isStorageAvailable()) {
          await AsyncStorage.setItem(key, value);
        }
      } catch (error) {
        console.error("Storage adapter setItem error:", error);
      }
    },
    removeItem: async (key: string): Promise<void> => {
      try {
        if (isStorageAvailable()) {
          await AsyncStorage.removeItem(key);
        }
      } catch (error) {
        console.error("Storage adapter removeItem error:", error);
      }
    },
  };
};
