import { useSyncExternalStore } from "react";

const key = "mti-table-density";
let fallback: "comfortable" | "compact" = "comfortable";
const eventName = "mti-table-density-change";
function readDensity(): "comfortable" | "compact" {
  try {
    const saved = localStorage.getItem(key);
    return saved === "compact" || saved === "comfortable" ? saved : fallback;
  } catch {
    return fallback;
  }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(eventName, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(eventName, callback);
  };
}
export function useTableDensity() {
  const density = useSyncExternalStore(subscribe, readDensity, () => "comfortable" as const);
  const toggleDensity = () => {
    fallback = density === "compact" ? "comfortable" : "compact";
    try {
      localStorage.setItem(key, fallback);
    } catch {
      // Keep this session usable when browser storage is unavailable.
    }
    window.dispatchEvent(new Event(eventName));
  };
  return { density, toggleDensity };
}
