"use client";

import { useSyncExternalStore } from "react";
const mobileQuery = "(max-width: 767px)";
function subscribe(notify: () => void) {
  const media = window.matchMedia(mobileQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
const snapshot = () => window.matchMedia(mobileQuery).matches;
const serverSnapshot = () => false;
export function useIsMobile() {
  return useSyncExternalStore(subscribe, snapshot, serverSnapshot);
}
