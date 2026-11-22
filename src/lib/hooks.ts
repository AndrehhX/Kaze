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

/** Current time for relative labels; null during SSR/hydration so markup never mismatches. */
const NOW_STEP = 30_000;
const subscribeNow = (onChange: () => void) => {
  const timer = setInterval(onChange, NOW_STEP);
  return () => clearInterval(timer);
};
// Redondeado a 30 s: el valor solo cambia cuando el reloj avanza un paso (snapshot estable).
const getNow = () => Math.floor(Date.now() / NOW_STEP) * NOW_STEP;
const getServerNow = () => null;

export function useNow(): number | null {
  return useSyncExternalStore(subscribeNow, getNow, getServerNow);
}
