"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

const subscribeOnline = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

export function useOnline() {
  return useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
}

export function useMounted() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const mq = matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => matchMedia(query).matches,
    () => false,
  );
}

let nowValue = 0;
const nowSubscribers = new Set<() => void>();
let nowTimer: ReturnType<typeof setInterval> | null = null;

/** Current time for relative labels; null during SSR/hydration so markup never mismatches. */
export function useNow() {
  return useSyncExternalStore(
    (cb) => {
      nowSubscribers.add(cb);
      if (!nowTimer) {
        nowValue = Date.now();
        nowTimer = setInterval(() => {
          nowValue = Date.now();
          nowSubscribers.forEach((f) => f());
        }, 30_000);
      }
      return () => {
        nowSubscribers.delete(cb);
        if (!nowSubscribers.size && nowTimer) {
          clearInterval(nowTimer);
          nowTimer = null;
        }
      };
    },
    () => nowValue || (nowValue = Date.now()),
    () => null,
  );
}
