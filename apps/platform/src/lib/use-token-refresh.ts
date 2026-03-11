"use client";

import { useEffect, useRef, useCallback } from "react";

const REFRESH_INTERVAL_MS = 60_000; // Check every 60 seconds
const REFRESH_THRESHOLD_SECS = 120; // Refresh when < 2 minutes remaining

export function useTokenRefresh() {
  const refreshingRef = useRef(false);

  const checkAndRefresh = useCallback(async () => {
    if (refreshingRef.current) return;

    try {
      const res = await fetch("/api/auth/token-status");
      if (!res.ok) return;

      const data = await res.json();

      if (!data.authenticated && data.expired) {
        // Token expired — attempt refresh
        refreshingRef.current = true;
        const refreshRes = await fetch("/api/auth/refresh", { method: "POST" });
        refreshingRef.current = false;

        if (!refreshRes.ok) {
          window.location.href = "/login";
        }
        return;
      }

      if (!data.authenticated) {
        // No token at all
        window.location.href = "/login";
        return;
      }

      if (data.expiresIn <= REFRESH_THRESHOLD_SECS) {
        refreshingRef.current = true;
        const refreshRes = await fetch("/api/auth/refresh", { method: "POST" });
        refreshingRef.current = false;

        if (!refreshRes.ok) {
          window.location.href = "/login";
        }
      }
    } catch {
      // Network error — ignore, will retry next interval
    }
  }, []);

  useEffect(() => {
    // Initial check after short delay (don't block page load)
    const initialTimeout = setTimeout(checkAndRefresh, 5000);

    // Set up interval
    const interval = setInterval(checkAndRefresh, REFRESH_INTERVAL_MS);

    // Also check when tab becomes visible (user returns from other tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkAndRefresh();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [checkAndRefresh]);
}
