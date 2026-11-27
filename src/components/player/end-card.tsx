"use client";

import Image from "next/image";
import Link from "next/link";
import { BellRing, Check, PartyPopper, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Airing = { status: string | null; next: { episode: number; airingAt: number } | null };
type Rec = { id: number; title: string; cover: string | null };

const SW_URL = "/sw.js?v=2";

function b64ToUint8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** ¿Este navegador ya recibe avisos? */
async function pushIsOn() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return null;
  if (Notification.permission !== "granted") return false;
  const reg = await navigator.serviceWorker.getRegistration();
  return Boolean(await reg?.pushManager.getSubscription());
}

async function enablePush(): Promise<boolean> {
  const info = (await fetch("/api/push").then((r) => r.json()).catch(() => null)) as { enabled?: boolean; publicKey?: string | null } | null;
  if (!info?.enabled || !info.publicKey) throw new Error("Los avisos no están disponibles ahora.");
  if ((await Notification.requestPermission()) !== "granted") return false;
  const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register(SW_URL));
  await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(info.publicKey) }));
  const res = await fetch("/api/push", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON(), welcome: true }) });
  if (!res.ok) throw new Error("No se pudieron activar los avisos.");
  return true;
}

const dayName = (sec: number) => {
  const d = new Date(sec * 1000);
  const days = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "mañana";
  if (days < 7) return `el ${d.toLocaleDateString("es", { weekday: "long" })}`;
  return `el ${d.toLocaleDateString("es", { day: "numeric", month: "long" })}`;
};

/**
 * Tarjeta pequeña al terminar el último episodio disponible (sin tapar el video ni insistir):
 *  - Si la serie sigue en emisión: cuándo sale el siguiente y un botón para que te avisemos.
 *  - Si ya terminó: hasta 3 recomendaciones.
 * Se cierra con la X y no vuelve a salir en ese anime.
 */
export function EndCard({ seriesId, seriesTitle }: { seriesId: string; seriesTitle: string }) {
  const [airing, setAiring] = useState<Airing | null>(null);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [push, setPush] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const storageKey = `kaze-endcard-${seriesId}`;
  // Solo se monta en el navegador (al terminar un episodio), así que se puede leer sessionStorage al iniciar.
  const [closed, setClosed] = useState(() => {
    try {
      return Boolean(sessionStorage.getItem(storageKey));
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (closed) return;
    let alive = true;
    void (async () => {
      const a = (await fetch(`/api/anilist/airing/${seriesId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as Airing | null;
      if (!alive) return;
      setAiring(a ?? { status: null, next: null });
      if (a?.next) setPush(await pushIsOn().catch(() => null));
      else {
        const r = (await fetch(`/api/anilist/recommendations/${seriesId}`).then((x) => (x.ok ? x.json() : null)).catch(() => null)) as {
          items?: { media: { id: number; title: { english: string | null; romaji: string | null; userPreferred: string | null }; coverImage: { large: string | null } } }[];
        } | null;
        if (!alive) return;
        setRecs((r?.items ?? []).slice(0, 3).map((i) => ({ id: i.media.id, title: i.media.title.userPreferred || i.media.title.english || i.media.title.romaji || "Anime", cover: i.media.coverImage.large })));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId]);

  const close = () => {
    setClosed(true);
    try {
      sessionStorage.setItem(storageKey, "1");
    } catch {}
  };

  if (closed || !airing) return null;
  const airingNext = airing.next;
  if (!airingNext && recs.length === 0) return null;

  return (
    <div className="absolute bottom-24 right-4 z-[13] w-[min(86%,330px)] rounded-[var(--k-radius-card)] border border-white/10 bg-black/90 p-4 text-white shadow-xl backdrop-blur sm:right-6" role="status">
      <button className="absolute right-2 top-2 grid size-8 place-items-center rounded-full text-white/60 hover:bg-white/10 hover:text-white" onClick={close} aria-label="Cerrar">
        <X className="size-4" aria-hidden />
      </button>
      {airingNext ? (
        <>
          <p className="pr-8 text-xs font-bold uppercase tracking-wider text-primary">Vas al día</p>
          <p className="mt-1 pr-6 text-sm font-semibold">
            El EP {airingNext.episode} sale {dayName(airingNext.airingAt)}.
          </p>
          {push === true ? (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-white/70">
              <Check className="size-3.5 text-success" aria-hidden /> Te avisaremos cuando salga.
            </p>
          ) : push === false ? (
            <button
              className="k-btn k-btn-primary k-btn-sm mt-3 w-full font-semibold"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const ok = await enablePush();
                  setPush(ok);
                  if (ok) toast.success(`Te avisaremos cuando salga el EP ${airingNext.episode}`);
                } catch (e) {
                  toast.error((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <BellRing className="size-4" aria-hidden /> Avisarme
            </button>
          ) : null}
        </>
      ) : (
        <>
          <p className="flex items-center gap-1.5 pr-8 text-xs font-bold uppercase tracking-wider text-primary">
            <PartyPopper className="size-3.5" aria-hidden /> Terminaste {seriesTitle}
          </p>
          <p className="mt-1 text-sm font-semibold">Si te gustó, prueba:</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {recs.map((r) => (
              <Link key={r.id} href={`/anime/${r.id}`} className="group block" title={r.title}>
                <div className="relative aspect-[2/3] overflow-hidden rounded-md bg-white/10">
                  {r.cover && <Image src={r.cover} alt="" fill sizes="96px" className="object-cover transition group-hover:scale-105" />}
                </div>
                <p className="mt-1 line-clamp-2 text-[0.7rem] leading-tight text-white/80">{r.title}</p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
