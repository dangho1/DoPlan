/**
 * Shared parsing for Supabase auth deep links (password recovery, magic links).
 * Used by both the root layout (to catch links while the app is already
 * running) and the Auth component (to catch links on cold start).
 */

export interface ParsedAuthLink {
  accessToken: string | null;
  refreshToken: string | null;
  type: string | null;
}

export const parseAuthLink = (url: string): ParsedAuthLink => {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;
  let type: string | null = null;

  if (url.includes("#")) {
    const hashPart = url.split("#")[1];
    const hashParams = new URLSearchParams(hashPart);
    accessToken = hashParams.get("access_token");
    refreshToken = hashParams.get("refresh_token");
    type = hashParams.get("type");
  } else if (url.includes("?")) {
    const urlObj = new URL(url.replace("doplan://", "http://doplan/"));
    accessToken = urlObj.searchParams.get("access_token");
    refreshToken = urlObj.searchParams.get("refresh_token");
    type = urlObj.searchParams.get("type");
  }

  return {
    accessToken,
    refreshToken,
    type: type?.toLowerCase() ?? null,
  };
};

export const isRecoveryType = (type: string | null) =>
  type === "recovery" || type === "password_recovery";

export const isRecoveryUrl = (url: string) => {
  const normalized = url.toLowerCase();
  return (
    normalized.includes("type=recovery") ||
    normalized.includes("password_recovery")
  );
};
