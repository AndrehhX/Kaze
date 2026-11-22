"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, LayoutGrid, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/stores/auth";
import { useLibrary } from "@/stores/library";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { useAchievements } from "@/components/profile/achievements";
import {
  MAX_BADGES,
  MAX_SHOWCASES,
  SHOWCASE_INFO,
  TEXT_BODY_MAX,
  TEXT_TITLE_MAX,
  parseProfileCustom,
  safeImageUrl,
  type ProfileBackground,
  type ProfileCustom,
  type Showcase,
  type ShowcaseType,
} from "@/lib/profile-custom";

const MAX_UPLOAD = 5 * 1024 * 1024; // límite del bucket profile-media

function newShowcase(type: ShowcaseType): Showcase {
  if (type === "badges") return { type, ids: [] };
  if (type === "text") return { type, title: "", body: "" };
  if (type === "featured") return { type, mediaId: null };
  return { type } as Showcase;
}

export function ShowcaseEditor() {
  const profile = useAuth((s) => s.profile);
  const user = useAuth((s) => s.user);
  const entriesMap = useLibrary((s) => s.entries);
  const entries = useMemo(() => Object.values(entriesMap), [entriesMap]);
  const { achievements } = useAchievements(entries, user?.id ?? null, true);
  const initial = useMemo(() => parseProfileCustom(profile?.pinned_sections), [profile?.pinned_sections]);
  const [bg, setBg] = useState<ProfileBackground | null>(initial.background);
  const [bgInput, setBgInput] = useState(initial.background?.url ?? "");
  const [list, setList] = useState<Showcase[]>(initial.showcases);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!profile || !user) {
    return (
      <section className="k-card p-6 text-sm text-muted">
        <Link href="/login" className="font-semibold text-primary-ink">Inicia sesión</Link> para personalizar el fondo y los escaparates de tu perfil.
      </section>
    );
  }

  const used = new Set(list.filter((s) => s.type !== "text").map((s) => s.type));
  const addable = (Object.keys(SHOWCASE_INFO) as ShowcaseType[]).filter((t) => t === "text" || !used.has(t));
  const earned = achievements.filter((a) => a.earned);
  const candidates = entries.filter((e) => e.favorite || e.status === "COMPLETED").sort((a, b) => Number(b.favorite) - Number(a.favorite)).slice(0, 80);

  const move = (i: number, d: number) => setList((l) => {
    const j = i + d;
    if (j < 0 || j >= l.length) return l;
    const c = [...l];
    [c[i], c[j]] = [c[j], c[i]];
    return c;
  });
  const update = (i: number, s: Showcase) => setList((l) => l.map((x, k) => (k === i ? s : x)));

  const applyBgUrl = () => {
    const url = safeImageUrl(bgInput);
    if (!url) return toast.error("Usa un enlace de imagen que empiece por https://");
    setBg({ url, blur: bg?.blur ?? 0, dim: bg?.dim ?? 45 });
  };

  const upload = async (file: File) => {
    if (!/^image\/(png|jpe?g|webp|gif|avif)$/.test(file.type)) return toast.error("Formato no válido (PNG, JPG, WebP, AVIF o GIF)");
    if (file.size > MAX_UPLOAD) return toast.error("La imagen supera los 5 MB");
    setBusy("upload");
    try {
      const db = getSupabaseBrowser()!;
      const ext = file.type.split("/")[1].replace("jpeg", "jpg");
      const path = `${profile.id}/background-${Date.now()}.${ext}`;
      const { error } = await db.storage.from("profile-media").upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      const url = db.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
      setBg({ url, blur: bg?.blur ?? 0, dim: bg?.dim ?? 45 });
      setBgInput(url);
      toast.success("Fondo subido. Recuerda guardar.");
    } catch (e) {
      toast.error(`No se pudo subir: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    setBusy("save");
    const custom: ProfileCustom = parseProfileCustom({ v: 1, background: bg, showcases: list });
    const { error } = await getSupabaseBrowser()!.from("profiles").update({ pinned_sections: custom }).eq("id", profile.id);
    setBusy(null);
    if (error) return toast.error(`No se pudo guardar: ${error.message}`);
    useAuth.setState({ profile: { ...profile, pinned_sections: custom } });
    setList(custom.showcases);
    toast.success("Perfil personalizado guardado");
  };

  return (
    <section className="k-card mt-6 space-y-8 p-6" aria-labelledby="showcase-editor-h">
      <header className="flex flex-wrap items-center gap-3">
        <LayoutGrid className="size-6 text-primary-ink" aria-hidden />
        <div className="flex-1">
          <h2 id="showcase-editor-h" className="font-display text-2xl">Fondo y escaparates</h2>
          <p className="text-sm text-muted">Personaliza tu perfil como en Steam: un fondo propio y los bloques que quieres mostrar, en tu orden.</p>
        </div>
        <Link href={`/profile/${profile.username}`} className="k-btn k-btn-ghost k-btn-sm">Ver mi perfil</Link>
      </header>

      {/* Fondo */}
      <div className="space-y-3">
        <h3 className="font-display text-lg">Fondo del perfil</h3>
        <div className="flex flex-wrap gap-2">
          <input
            className="k-input min-w-0 flex-1"
            placeholder="https://… (imagen o GIF)"
            value={bgInput}
            onChange={(e) => setBgInput(e.target.value)}
            aria-label="Enlace de la imagen de fondo"
          />
          <button type="button" className="k-btn k-btn-outline" onClick={applyBgUrl}>Usar enlace</button>
          <button type="button" className="k-btn k-btn-outline" onClick={() => fileRef.current?.click()} disabled={busy === "upload"}>
            <ImagePlus className="size-4" /> {busy === "upload" ? "Subiendo…" : "Subir imagen"}
          </button>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </div>
        {bg && (
          <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
            <div className="relative aspect-video overflow-hidden rounded-xl border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={bg.url} alt="Vista previa del fondo" className="size-full object-cover" style={bg.blur ? { filter: `blur(${bg.blur / 2}px)` } : undefined} />
              <div className="absolute inset-0" style={{ background: `color-mix(in srgb, var(--k-bg) ${bg.dim}%, transparent)` }} />
            </div>
            <div className="space-y-3">
              <label className="block text-sm">
                Desenfoque: <strong>{bg.blur}px</strong>
                <input type="range" min={0} max={20} value={bg.blur} onChange={(e) => setBg({ ...bg, blur: Number(e.target.value) })} className="mt-1 w-full accent-[var(--k-primary)]" />
              </label>
              <label className="block text-sm">
                Oscurecido: <strong>{bg.dim}%</strong>
                <input type="range" min={0} max={90} value={bg.dim} onChange={(e) => setBg({ ...bg, dim: Number(e.target.value) })} className="mt-1 w-full accent-[var(--k-primary)]" />
              </label>
              <button type="button" className="k-btn k-btn-ghost k-btn-sm text-muted" onClick={() => { setBg(null); setBgInput(""); }}>
                <X className="size-4" /> Quitar fondo
              </button>
            </div>
          </div>
        )}
        <p className="text-xs text-muted">Máximo 5 MB al subir. Las imágenes inapropiadas pueden ser retiradas por moderación.</p>
      </div>

      {/* Escaparates */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display flex-1 text-lg">Escaparates ({list.length}/{MAX_SHOWCASES})</h3>
          {list.length < MAX_SHOWCASES && (
            <label className="flex items-center gap-2 text-sm">
              <Plus className="size-4" aria-hidden />
              <select
                className="k-input !w-auto !py-1.5"
                value=""
                onChange={(e) => e.target.value && setList((l) => [...l, newShowcase(e.target.value as ShowcaseType)])}
                aria-label="Añadir escaparate"
              >
                <option value="">Añadir escaparate…</option>
                {addable.map((t) => <option key={t} value={t}>{SHOWCASE_INFO[t].label}</option>)}
              </select>
            </label>
          )}
        </div>
        {list.length === 0 && <p className="text-sm text-muted">No hay escaparates: tu perfil solo mostrará la cabecera y el lateral.</p>}
        <ol className="space-y-3">
          {list.map((s, i) => (
            <li key={`${s.type}-${i}`} className="rounded-xl border border-line bg-bg/40 p-4">
              <div className="flex items-center gap-2">
                <span className="font-display w-6 text-primary-ink">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{SHOWCASE_INFO[s.type].label}</p>
                  <p className="text-xs text-muted">{SHOWCASE_INFO[s.type].description}</p>
                </div>
                <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir"><ArrowUp className="size-4" /></button>
                <button type="button" className="k-btn k-btn-ghost k-btn-sm" onClick={() => move(i, 1)} disabled={i === list.length - 1} aria-label="Bajar"><ArrowDown className="size-4" /></button>
                <button type="button" className="k-btn k-btn-ghost k-btn-sm text-muted" onClick={() => setList((l) => l.filter((_, k) => k !== i))} aria-label="Quitar"><Trash2 className="size-4" /></button>
              </div>

              {s.type === "featured" && (
                <select className="k-input mt-3" value={s.mediaId ?? ""} onChange={(e) => update(i, { type: "featured", mediaId: e.target.value ? Number(e.target.value) : null })} aria-label="Anime destacado">
                  <option value="">Automático (tu primer favorito)</option>
                  {candidates.map((e) => <option key={e.mediaId} value={e.mediaId}>{e.favorite ? "♥ " : ""}{e.media.title}</option>)}
                </select>
              )}

              {s.type === "badges" && (
                <div className="mt-3">
                  {earned.length === 0 ? (
                    <p className="text-xs text-muted">Aún no tienes logros ganados; se mostrarán automáticamente cuando los consigas.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {earned.map((a) => {
                        const on = s.ids.includes(a.id);
                        return (
                          <button
                            key={a.id}
                            type="button"
                            className="k-chip"
                            data-active={on}
                            aria-pressed={on}
                            disabled={!on && s.ids.length >= MAX_BADGES}
                            onClick={() => update(i, { type: "badges", ids: on ? s.ids.filter((x) => x !== a.id) : [...s.ids, a.id] })}
                          >
                            {a.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted">{s.ids.length}/{MAX_BADGES} elegidas · sin elegir se muestran las primeras ganadas.</p>
                </div>
              )}

              {s.type === "text" && (
                <div className="mt-3 space-y-2">
                  <input className="k-input" maxLength={TEXT_TITLE_MAX} placeholder="Título (opcional)" value={s.title} onChange={(e) => update(i, { ...s, title: e.target.value })} aria-label="Título del texto" />
                  <textarea className="k-input !min-h-24" maxLength={TEXT_BODY_MAX} placeholder="Escribe una frase, una cita, tus redes…" value={s.body} onChange={(e) => update(i, { ...s, body: e.target.value })} aria-label="Texto" />
                  <p className="text-right text-xs text-muted">{s.body.length}/{TEXT_BODY_MAX}</p>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>

      <div className="flex justify-end">
        <button type="button" className="k-btn k-btn-primary" onClick={save} disabled={busy === "save"}>
          <Save className="size-4" /> {busy === "save" ? "Guardando…" : "Guardar fondo y escaparates"}
        </button>
      </div>
    </section>
  );
}
