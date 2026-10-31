"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, Check, ExternalLink, Flame, Image as ImageIcon, Sparkles, Star, UserRound, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth, type Profile } from "@/stores/auth";
import { useGuestProfile, writeGuestProfile } from "@/lib/profile/guest";
import { useLibrary } from "@/stores/library";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { refreshProfile } from "@/components/providers/auth-provider";
import { friendlyDbError } from "@/lib/social";
import { THEME_IDS, THEMES, type ThemeId } from "@/lib/themes";
import { FALLBACK_GENRES } from "@/lib/anilist/browse-params";
import { Avatar } from "@/components/shell/user-menu";
import { Panel } from "./panels";
import { SafeImage } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

const AVATAR_FRAMES = [
  { id: "none", name: "Clásico (Sin marco)", icon: "⭕", desc: "Borde circular estándar" },
  { id: "cosmic-fire", name: "Fuego Cósmico", icon: "🔥", desc: "Llamas ardientes en gradiente vivo" },
  { id: "cyber-neon", name: "Cyberpunk Neon", icon: "⚡", desc: "Resplandor cian y fucsia eléctrico" },
  { id: "sakura", name: "Flor de Cerezo", icon: "🌸", desc: "Aura suave rosada con destellos" },
  { id: "golden-aura", name: "Aura Dorada", icon: "⭐", desc: "Brillo dorado resplandeciente VIP" },
  { id: "abyssal-vortex", name: "Vórtice Abisal", icon: "🌌", desc: "Nebulosa púrpura y cian cósmico" },
] as const;

export function ProfileSettingsPanel() {
  const status = useAuth((s) => s.status);
  const authProfile = useAuth((s) => s.profile);
  const authUser = useAuth((s) => s.user);
  const [guestProfile] = useGuestProfile();
  const libraryEntries = useLibrary((s) => s.entries);
  const router = useRouter();

  const isAuth = status === "signed-in";
  const activeProfile = isAuth && authProfile ? authProfile : guestProfile;

  const [form, setForm] = useState(() => ({
    display_name: activeProfile.display_name || (isAuth ? authUser?.email?.split("@")[0] || "Usuario" : "Invitado"),
    username: activeProfile.username || (isAuth ? authUser?.email?.split("@")[0] || "user" : "guest"),
    bio: activeProfile.bio || "",
    avatar_url: activeProfile.avatar_url || "",
    banner_url: activeProfile.banner_url || "",
    avatar_frame: activeProfile.avatar_frame || "none",
    profile_theme: activeProfile.profile_theme || "midnight",
    favorite_genres: activeProfile.favorite_genres ?? [],
    favorite_anime: activeProfile.favorite_anime ?? [],
    visibility: activeProfile.visibility || "public",
  }));
  const [dirty, setDirty] = useState(false);
  const [avatarUrlInput, setAvatarUrlInput] = useState("");
  const [bannerUrlInput, setBannerUrlInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Sincronizar automáticamente el formulario cuando se carga el perfil autenticado real
  useEffect(() => {
    if (isAuth && authProfile && !dirty) {
      setForm({
        display_name: authProfile.display_name || authUser?.email?.split("@")[0] || "Usuario",
        username: authProfile.username || authUser?.email?.split("@")[0] || "user",
        bio: authProfile.bio || "",
        avatar_url: authProfile.avatar_url || "",
        banner_url: authProfile.banner_url || "",
        avatar_frame: authProfile.avatar_frame || "none",
        profile_theme: authProfile.profile_theme || "midnight",
        favorite_genres: authProfile.favorite_genres ?? [],
        favorite_anime: authProfile.favorite_anime ?? [],
        visibility: authProfile.visibility || "public",
      });
    }
  }, [isAuth, authProfile, authUser, dirty]);

  // Lista de favoritos del usuario para la vitrina
  const libraryList = useMemo(() => Object.values(libraryEntries), [libraryEntries]);
  const favoriteTitles = useMemo(() => libraryList.filter((e) => e.favorite || e.status === "COMPLETED" || e.status === "CURRENT"), [libraryList]);

  // Manejador de subida de imágenes (archivo local)
  const handleFileUpload = (kind: "avatar" | "banner", file: File) => {
    if (!["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"].includes(file.type)) {
      return toast.error("Formato no soportado. Usa PNG, JPEG, GIF o WebP.");
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast.error("La imagen debe pesar 5 MB o menos.");
    }

    setBusy(kind);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setForm((prev) => ({ ...prev, [kind === "avatar" ? "avatar_url" : "banner_url"]: dataUrl }));
      setBusy(null);
      toast.success(kind === "avatar" ? "Foto de perfil cargada" : "Portada cargada");
    };
    reader.onerror = () => {
      setBusy(null);
      toast.error("Error al leer el archivo de imagen.");
    };
    reader.readAsDataURL(file);
  };

  // Guardar cambios totales
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("save");

    const patch: Partial<Profile> = {
      display_name: form.display_name.trim().slice(0, 48) || "Usuario",
      bio: form.bio.slice(0, 600),
      avatar_url: form.avatar_url || null,
      banner_url: form.banner_url || null,
      avatar_frame: form.avatar_frame === "none" ? null : form.avatar_frame,
      profile_theme: form.profile_theme,
      favorite_genres: form.favorite_genres.slice(0, 10),
      visibility: form.visibility as "public" | "friends" | "private",
    };

    if (isAuth && authProfile) {
      // 1. Actualización optimista inmediata en useAuth
      useAuth.getState().set({
        profile: {
          ...authProfile,
          ...patch,
        },
      });

      // 2. Persistir en Supabase
      try {
        const db = getSupabaseBrowser();
        if (db && authProfile.id) {
          let { error: updateErr } = await db.from("profiles").update(patch).eq("id", authProfile.id);
          if (updateErr && /avatar_frame|custom_accent/i.test(updateErr.message)) {
            // Reintentar sin columnas opcionales si no están aún en la BD
            const safePatch: Record<string, unknown> = { ...patch };
            delete safePatch.avatar_frame;
            delete safePatch.custom_accent;
            const res = await db.from("profiles").update(safePatch).eq("id", authProfile.id);
            updateErr = res.error;
          }
          if (updateErr) {
            console.error("[kaze] profile update remote error", updateErr);
            toast.error(friendlyDbError(updateErr));
            setBusy(null);
            return;
          }
        }
        await refreshProfile();
      } catch (err) {
        console.warn("[kaze] profile update remote error", err);
      }

      setBusy(null);
      setDirty(false);
      toast.success("Perfil guardado con éxito");
      router.refresh();
      return;
    }

    // Modo invitado: persistir localmente en el dispositivo
    writeGuestProfile(patch);
    setBusy(null);
    setDirty(false);
    toast.success("Perfil de Orunei guardado en este dispositivo");
    router.refresh();
  };

  const pTheme: ThemeId = (form.profile_theme as ThemeId) in THEMES ? (form.profile_theme as ThemeId) : "midnight";

  return (
    <form onSubmit={save} className="space-y-8">
      {/* ── 1. VISTA PREVIA EN VIVO (LIVE PREVIEW) ── */}
      <section className="k-card relative overflow-hidden p-0 shadow-2xl border border-line">
        <div className="relative h-44 w-full overflow-hidden bg-elevated">
          {form.banner_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.banner_url} alt="Portada" className="size-full object-cover" />
          ) : (
            <div className="size-full bg-[radial-gradient(ellipse_at_20%_20%,var(--k-primary),transparent_55%),radial-gradient(ellipse_at_90%_60%,var(--k-accent),transparent_50%)] opacity-70" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
          <span className="absolute right-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            Vista previa en vivo
          </span>
        </div>

        <div className="relative px-6 pb-6 pt-0">
          <div className="-mt-14 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar
                src={form.avatar_url}
                name={form.display_name || "U"}
                size={92}
                frame={form.avatar_frame}
              />
              <div className="mb-1 min-w-0">
                <h3 className="font-display text-2xl font-bold truncate">{form.display_name || "Tu Nombre"}</h3>
                <p className="text-xs text-muted">
                  @{form.username} · {THEMES[pTheme].name}
                </p>
              </div>
            </div>

            <Link href={form.username && form.username !== "guest" ? `/profile/${encodeURIComponent(form.username)}` : "/profile"} className="k-btn k-btn-outline k-btn-sm text-xs gap-1.5">
              <ExternalLink className="size-3.5" /> Ver perfil público
            </Link>
          </div>

          {form.bio && <p className="mt-4 max-w-xl text-sm text-fg/80 whitespace-pre-line">{form.bio}</p>}

          {(form.favorite_genres?.length ?? 0) > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {form.favorite_genres?.map((g) => (
                <span key={g} className="k-chip text-xs !py-0.5 !px-2">
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── 2. AVATAR & MARCOS ANIMADOS ESTILO STEAM ── */}
      <Panel
        title="Avatar & Marcos Animados (Estilo Steam)"
        description="Elige una foto de perfil o GIF animado y personalízalo con un marco exclusivo."
      >
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-4">
            <Avatar
              src={form.avatar_url}
              name={form.display_name || "U"}
              size={72}
              frame={form.avatar_frame}
            />
            <div className="space-y-2 flex-1 min-w-[240px]">
              <div className="flex flex-wrap gap-2">
                <label className="k-btn k-btn-outline k-btn-sm cursor-pointer">
                  <Camera className="size-4 mr-1.5" />
                  {busy === "avatar" ? "Cargando…" : "Subir Foto / GIF de Avatar"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                    className="sr-only"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload("avatar", e.target.files[0])}
                  />
                </label>
                {form.avatar_url && (
                  <button
                    type="button"
                    className="k-btn k-btn-ghost k-btn-sm text-xs text-muted hover:text-danger"
                    onClick={() => setForm((p) => ({ ...p, avatar_url: "" }))}
                  >
                    Quitar foto
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="O pega URL de imagen o GIF animado..."
                  className="k-input text-xs flex-1"
                  value={avatarUrlInput}
                  onChange={(e) => setAvatarUrlInput(e.target.value)}
                />
                <button
                  type="button"
                  className="k-btn k-btn-ghost k-btn-sm text-xs"
                  onClick={() => {
                    if (avatarUrlInput.trim()) {
                      setForm((p) => ({ ...p, avatar_url: avatarUrlInput.trim() }));
                      toast.success("URL de avatar aplicada");
                    }
                  }}
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted block mb-3">
              Marcos Animados para el Avatar
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {AVATAR_FRAMES.map((f) => {
                const active = (form.avatar_frame || "none") === f.id;
                return (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() => setForm((p) => ({ ...p, avatar_frame: f.id }))}
                    className={cn(
                      "k-card p-3 text-left transition-all relative overflow-hidden",
                      active
                        ? "ring-2 ring-primary border-primary bg-primary/10 shadow-md"
                        : "hover:border-line hover:bg-[var(--k-btn-ghost)]",
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{f.icon}</span>
                      <span className="font-semibold text-xs text-fg">{f.name}</span>
                    </div>
                    <p className="text-[0.68rem] text-muted line-clamp-1">{f.desc}</p>
                    {active && <span className="absolute top-2 right-2 text-primary font-bold text-xs">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Panel>

      {/* ── 3. PORTADA / BANNER DEL PERFIL ── */}
      <Panel
        title="Portada y Banner de tu Universo"
        description="Sube una ilustración o GIF animado para la cabecera panorámica de tu perfil."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2.5">
            <label className="k-btn k-btn-outline k-btn-sm cursor-pointer">
              <ImageIcon className="size-4 mr-1.5" />
              {busy === "banner" ? "Cargando…" : "Subir Portada / Banner GIF"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && handleFileUpload("banner", e.target.files[0])}
              />
            </label>
            {form.banner_url && (
              <button
                type="button"
                className="k-btn k-btn-ghost k-btn-sm text-xs text-muted hover:text-danger"
                onClick={() => setForm((p) => ({ ...p, banner_url: "" }))}
              >
                Restablecer a gradiente
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              placeholder="O pega URL de portada panorámica o GIF..."
              className="k-input text-xs flex-1"
              value={bannerUrlInput}
              onChange={(e) => setBannerUrlInput(e.target.value)}
            />
            <button
              type="button"
              className="k-btn k-btn-ghost k-btn-sm text-xs"
              onClick={() => {
                if (bannerUrlInput.trim()) {
                  setForm((p) => ({ ...p, banner_url: bannerUrlInput.trim() }));
                  toast.success("URL de portada aplicada");
                }
              }}
            >
              Aplicar
            </button>
          </div>
        </div>
      </Panel>

      {/* ── 4. IDENTIDAD Y BIOGRAFÍA ── */}
      <Panel
        title="Identidad y Mensaje"
        description="Tu nombre visible en la comunidad y tu descripción personal."
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="pf-display-name" className="text-sm font-semibold block mb-1.5">
              Nombre para mostrar
            </label>
            <input
              id="pf-display-name"
              className="k-input w-full"
              maxLength={48}
              value={form.display_name}
              onChange={(e) => setForm({ ...form, display_name: e.target.value })}
              placeholder="Ej: Andreh, Senpai, etc."
            />
          </div>

          <div>
            <label htmlFor="pf-bio" className="text-sm font-semibold block mb-1.5">
              Biografía pública
            </label>
            <textarea
              id="pf-bio"
              rows={3}
              className="k-input w-full leading-relaxed"
              maxLength={600}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="Escribe sobre tus gustos de anime, historias favoritas o tu cita preferida..."
            />
            <span className="text-xs text-muted block text-right mt-1">{form.bio.length}/600 caracteres</span>
          </div>
        </div>
      </Panel>

      {/* ── 5. TEMAS VISUALES DE ORUNEI ── */}
      <Panel
        title="Tema del Universo"
        description="Define la paleta de colores y atmósfera visual que los demás verán al visitar tu perfil."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {THEME_IDS.map((id) => {
            const active = form.profile_theme === id;
            return (
              <button
                type="button"
                key={id}
                onClick={() => setForm({ ...form, profile_theme: id })}
                className={cn(
                  "k-card p-4 text-left transition-all border",
                  active
                    ? "ring-2 ring-primary border-primary bg-primary/10 shadow-lg"
                    : "hover:border-line hover:bg-[var(--k-btn-ghost)]",
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm text-fg">{THEMES[id].name}</span>
                  <span className="k-jp text-xs opacity-60 font-medium">{THEMES[id].jp}</span>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                  {id === "midnight" && "Púrpura y cian sobre negro profundo. La firma clásica de Orunei."}
                  {id === "sakura" && "Flores de cerezo, tonos cálidos y pasteles primaverales."}
                  {id === "cyber" && "Cian de alta tecnología, magenta eléctrico y líneas de escaneo."}
                  {id === "zen" && "Estilo editorial minimalista japonés con contraste cálido y elegante."}
                </p>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* ── 6. VITRINA DE OBRA MAESTRA (SHOWCASE) ── */}
      {favoriteTitles.length > 0 && (
        <Panel
          title="Vitrina de Obra Maestra (Showcase)"
          description="Destaca tu anime favorito en la portada principal de tu perfil."
        >
          <div className="space-y-3">
            <label htmlFor="pf-showcase" className="text-sm font-semibold block">
              Anime para la Vitrina
            </label>
            <select
              id="pf-showcase"
              className="k-input w-full text-sm font-medium"
              value={form.favorite_anime[0] || ""}
              onChange={(e) => {
                const id = Number(e.target.value);
                setForm((prev) => ({
                  ...prev,
                  favorite_anime: id ? [id, ...prev.favorite_anime.filter((x) => x !== id)] : [],
                }));
              }}
            >
              <option value="">(Ninguno seleccionado)</option>
              {favoriteTitles.map((fav) => (
                <option key={fav.mediaId} value={fav.mediaId}>
                  ★ {fav.media.title}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted">
              El anime seleccionado aparecerá en una tarjeta panorámica destacada en la parte superior de tu universo.
            </p>
          </div>
        </Panel>
      )}

      {/* ── 7. GÉNEROS FAVORITOS ── */}
      <Panel
        title="Tus Géneros Favoritos"
        description="Selecciona hasta 10 géneros para calcular tu ADN de Anime."
      >
        <div className="flex flex-wrap gap-2">
          {FALLBACK_GENRES.map((g) => {
            const list = form.favorite_genres ?? [];
            const selected = list.includes(g);
            return (
              <button
                type="button"
                key={g}
                onClick={() =>
                  setForm({
                    ...form,
                    favorite_genres: selected
                      ? list.filter((x) => x !== g)
                      : [...list, g].slice(0, 10),
                  })
                }
                className={cn(
                  "k-chip text-xs transition-all",
                  selected ? "!bg-primary !text-white border-primary shadow-sm" : "hover:border-primary/50",
                )}
              >
                {selected && "✓ "}
                {g}
              </button>
            );
          })}
        </div>
      </Panel>

      {/* ── 8. VISIBILIDAD Y PRIVACIDAD ── */}
      <Panel
        title="Visibilidad del Perfil"
        description="Decide quién puede ver tu universo, listas y actividad compartida."
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(
            [
              ["public", "Público", "Cualquier persona puede ver tu perfil y listas."],
              ["friends", "Solo amigos", "Solo amigos aceptados pueden ver tu universo."],
              ["private", "Privado", "Solo tú puedes ver tus listas y actividad."],
            ] as const
          ).map(([val, label, desc]) => (
            <button
              type="button"
              key={val}
              onClick={() => setForm({ ...form, visibility: val })}
              className={cn(
                "k-card p-3.5 text-left transition-all border",
                form.visibility === val
                  ? "ring-2 ring-primary border-primary bg-primary/10"
                  : "hover:border-line hover:bg-[var(--k-btn-ghost)]",
              )}
            >
              <div className="font-bold text-sm text-fg mb-1">{label}</div>
              <p className="text-xs text-muted leading-relaxed">{desc}</p>
            </button>
          ))}
        </div>
      </Panel>

      {/* ── BOTÓN FINAL DE GUARDAR ── */}
      <div className="sticky bottom-6 z-20 flex justify-end gap-3 rounded-2xl bg-surface/90 p-4 shadow-2xl backdrop-blur border border-line">
        <Link href="/profile" className="k-btn k-btn-ghost k-btn-sm">
          Cancelar
        </Link>
        <button
          type="submit"
          disabled={busy === "save"}
          className="k-btn k-btn-primary k-btn-sm px-6 font-bold shadow-lg"
        >
          {busy === "save" ? "Guardando cambios…" : "Guardar cambios en tu perfil"}
        </button>
      </div>
    </form>
  );
}
