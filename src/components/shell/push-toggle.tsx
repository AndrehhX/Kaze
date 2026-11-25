"use client";

import { BellRing, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type State = "loading" | "unsupported" | "unavailable" | "denied" | "off" | "on" | "busy";

const SW_URL = "/sw.js?v=2";

function b64ToUint8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register(SW_URL));
}

async function postSubscription(sub: PushSubscription, welcome: boolean) {
  const res = await fetch("/api/push", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscription: sub.toJSON(), welcome }),
  });
  if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error || "No se pudo activar");
}

/** Interruptor de avisos push en este navegador (episodios nuevos de lo que sigues). */
export function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [key, setKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
      const info = (await fetch("/api/push").then((r) => r.json()).catch(() => null)) as { enabled?: boolean; publicKey?: string | null } | null;
      if (!alive) return;
      if (!info?.enabled || !info.publicKey) return setState("unavailable");
      setKey(info.publicKey);
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!alive) return;
      if (sub && Notification.permission === "granted") {
        setState("on");
        // Reenvía la suscripción una vez por sesión: si el servidor la perdió, se recupera sola.
        if (!sessionStorage.getItem("kaze-push-sync")) {
          sessionStorage.setItem("kaze-push-sync", "1");
          postSubscription(sub, false).catch(() => {});
        }
      } else setState("off");
    })().catch(() => alive && setState("unavailable"));
    return () => {
      alive = false;
    };
  }, []);

  const enable = async () => {
    if (!key) return;
    setState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await registration();
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(key) }));
      await postSubscription(sub, true);
      setState("on");
      toast.success("Avisos activados en este navegador");
    } catch (e) {
      setState("off");
      toast.error((e as Error).message || "No se pudieron activar los avisos");
    }
  };

  const disable = async () => {
    setState("busy");
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
        await sub.unsubscribe();
      }
      setState("off");
      toast("Avisos desactivados en este navegador");
    } catch {
      setState("on");
    }
  };

  if (state === "loading" || state === "unavailable" || state === "unsupported") return null;

  return (
    <div className="mx-1 mb-2 flex items-center gap-3 rounded-[min(var(--k-radius-btn),12px)] border border-line px-3 py-2.5 text-sm">
      {state === "on" ? <BellRing className="size-4 shrink-0 text-primary-ink" aria-hidden /> : <BellOff className="size-4 shrink-0 text-muted" aria-hidden />}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">Avisos en este navegador</span>
        <span className="block text-xs text-muted">
          {state === "denied"
            ? "Bloqueados. Actívalos desde el candado de la barra de direcciones."
            : state === "on"
              ? "Te avisamos de cada episodio nuevo de lo que sigues."
              : "Recibe un aviso cuando salga un episodio de lo que sigues."}
        </span>
      </span>
      {state !== "denied" && (
        <button
          type="button"
          className={state === "on" ? "k-btn k-btn-ghost k-btn-sm !min-h-8 text-xs" : "k-btn k-btn-primary k-btn-sm !min-h-8 text-xs"}
          onClick={state === "on" ? disable : enable}
          disabled={state === "busy"}
          aria-pressed={state === "on"}
        >
          {state === "busy" ? "…" : state === "on" ? "Desactivar" : "Activar"}
        </button>
      )}
    </div>
  );
}
