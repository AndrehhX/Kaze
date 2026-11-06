"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      process.env.NODE_ENV === "production"
    ) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("[KAZE PWA] Service Worker registrado con alcance:", reg.scope);
          })
          .catch((err) => {
            console.warn("[KAZE PWA] Error al registrar Service Worker:", err);
          });
      });
    }
  }, []);

  return null;
}
