"use client";
// SWR config tuned for slow / metered connections:
//  - cache persisted to localStorage  -> last-known data shows instantly on reload (even offline)
//  - keepPreviousData                  -> no blank flicker when switching transport / range
//  - revalidateOnFocus off + 60s dedupe -> minimal redundant requests
import { SWRConfig } from "swr";

const CACHE_KEY = "rtkm-swr-cache";

function localStorageProvider() {
  if (typeof window === "undefined") return new Map();
  let map;
  try { map = new Map(JSON.parse(localStorage.getItem(CACHE_KEY) || "[]")); } catch { map = new Map(); }
  const save = () => { try { localStorage.setItem(CACHE_KEY, JSON.stringify(Array.from(map.entries()))); } catch {} };
  window.addEventListener("beforeunload", save);
  return map;
}

export default function SwrProvider({ children }) {
  return (
    <SWRConfig
      value={{
        provider: localStorageProvider,
        revalidateOnFocus: false,
        keepPreviousData: true,
        dedupingInterval: 60000,
        errorRetryCount: 2,
        errorRetryInterval: 5000,
      }}
    >
      {children}
    </SWRConfig>
  );
}
