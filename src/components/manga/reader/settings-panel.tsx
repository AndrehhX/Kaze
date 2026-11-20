"use client";

import { RotateCcw } from "lucide-react";
import type { ReactNode } from "react";
import { Dialog } from "@/components/ui/dialog";
import { useSettings } from "@/stores/settings";
import type { ReaderPrefs } from "@/lib/manga/reader/engine";
import { cn } from "@/lib/utils";

function Segmented<T extends string>({ label, value, options, onChange, hint }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; hint?: string }) {
  return (
    <fieldset>
      <legend className="k-label mb-2 text-muted">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button key={o.value} type="button" className="k-chip" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted">{hint}</p>}
    </fieldset>
  );
}

function Toggle({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (v: boolean) => void; description?: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-1.5">
      <span>
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-5 accent-[var(--k-primary)]" />
    </label>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4 border-b border-line pb-5">
      <h3 className="font-display text-base">{title}</h3>
      {children}
    </section>
  );
}

/** Reader preferences. Saved on this device and, when signed in, to the account (user_settings.reader). */
export function ReaderSettingsPanel({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const p = useSettings((s) => s.reader);
  const set = useSettings((s) => s.setReader);
  const reset = useSettings((s) => s.resetReader);
  const up = <K extends keyof ReaderPrefs>(k: K) => (v: ReaderPrefs[K]) => set({ [k]: v } as Partial<ReaderPrefs>);
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Ajustes de lectura" description="Se guardan en este dispositivo y en tu cuenta." side="right" className="!z-[95]">
      <div className="space-y-5 px-5 pb-8">
        <Group title="Lectura">
          <Segmented label="Modo" value={p.mode} onChange={up("mode")} options={[{ value: "auto", label: "Automático" }, { value: "paged", label: "Paginado" }, { value: "vertical", label: "Vertical" }, { value: "webtoon", label: "Webtoon continuo" }]} hint="Automático usa paginado para manga y webtoon para series verticales." />
          <Segmented label="Dirección" value={p.direction} onChange={up("direction")} options={[{ value: "auto", label: "Según la obra" }, { value: "rtl", label: "Derecha → izquierda" }, { value: "ltr", label: "Izquierda → derecha" }]} />
          <Segmented label="Páginas" value={p.layout} onChange={up("layout")} options={[{ value: "auto", label: "Automático" }, { value: "single", label: "Una página" }, { value: "double", label: "Doble página" }]} hint="Automático muestra doble página en pantallas anchas en horizontal." />
          <Toggle label="Primera página sola" description="Como en los tomos impresos, para que las dobles páginas encajen." checked={p.coverAlone} onChange={up("coverAlone")} />
        </Group>
        <Group title="Imagen">
          <Segmented label="Ajuste" value={p.fit} onChange={up("fit")} options={[{ value: "contain", label: "Página completa" }, { value: "width", label: "Al ancho" }, { value: "height", label: "Al alto" }, { value: "original", label: "Tamaño original" }]} />
          <Toggle label="Zoom con doble clic" checked={p.zoomOnDoubleClick} onChange={up("zoomOnDoubleClick")} />
          <Segmented label="Fondo" value={p.background} onChange={up("background")} options={[{ value: "theme", label: "Tema" }, { value: "paper", label: "Papel" }, { value: "black", label: "Negro" }, { value: "gray", label: "Gris" }]} />
          <label className="block">
            <span className="k-label mb-2 block text-muted">Atenuación ({Math.round(p.dim * 100)}%)</span>
            <input type="range" min={0} max={0.6} step={0.05} value={p.dim} onChange={(e) => set({ dim: Number(e.target.value) })} className="w-full accent-[var(--k-primary)]" />
            <span className="text-xs text-muted">Oscurece la pantalla como un control de brillo, sin alterar la ilustración.</span>
          </label>
          <label className="block">
            <span className="k-label mb-2 block text-muted">Separación en modo vertical ({p.pageGap}px)</span>
            <input type="range" min={0} max={64} step={4} value={p.pageGap} onChange={(e) => set({ pageGap: Number(e.target.value) })} className="w-full accent-[var(--k-primary)]" />
          </label>
        </Group>
        <Group title="Animación">
          <Segmented
            label="Experiencia"
            value={p.animation}
            onChange={up("animation")}
            options={[
              { value: "classic", label: "Clásica" },
              { value: "smooth", label: "Suave" },
              { value: "cinematic", label: "Cinemática" },
              { value: "focus", label: "Enfoque" },
            ]}
            hint={p.animation === "cinematic" ? "Transiciones con perspectiva y fondo atmosférico. La viñeta nunca se recorta ni se anima." : p.animation === "focus" ? "Interfaz mínima: los controles aparecen al tocar el centro." : p.animation === "smooth" ? "Desplazamientos suaves entre páginas." : "Cambios instantáneos, máxima fidelidad."}
          />
          <Segmented label="Velocidad de transición" value={p.transitionSpeed} onChange={up("transitionSpeed")} options={[{ value: "fast", label: "Rápida" }, { value: "normal", label: "Normal" }, { value: "slow", label: "Lenta" }]} />
          <p className="text-xs text-muted">Si tu sistema pide «reducir movimiento», todas las transiciones se desactivan.</p>
        </Group>
        <Group title="Rendimiento y datos">
          <label className="block">
            <span className="k-label mb-2 block text-muted">Precarga: {p.preload} páginas por delante</span>
            <input type="range" min={1} max={8} step={1} value={p.preload} onChange={(e) => set({ preload: Number(e.target.value) })} className="w-full accent-[var(--k-primary)]" />
          </label>
          <Segmented label="Calidad de imagen" value={p.quality} onChange={up("quality")} options={[{ value: "auto", label: "Automática" }, { value: "high", label: "Alta" }, { value: "data-saver", label: "Ahorro de datos" }]} />
          <Toggle label="Modo ahorro de datos" description="Usa versiones ligeras cuando el proveedor las ofrece y reduce la precarga." checked={p.dataSaver} onChange={up("dataSaver")} />
        </Group>
        <Group title="Pantalla y teclado">
          <Toggle label="Abrir en pantalla completa" checked={p.fullscreenOnOpen} onChange={up("fullscreenOnOpen")} />
          <Toggle label="Mostrar atajos de teclado" checked={p.showKeyboardHints} onChange={up("showKeyboardHints")} />
          <ul className={cn("grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted")}>
            <li><kbd className="font-mono">← →</kbd> pasar página (según dirección)</li>
            <li><kbd className="font-mono">Espacio</kbd> siguiente</li>
            <li><kbd className="font-mono">F</kbd> pantalla completa</li>
            <li><kbd className="font-mono">B</kbd> marcador</li>
            <li><kbd className="font-mono">+ / −</kbd> zoom</li>
            <li><kbd className="font-mono">S</kbd> ajustes</li>
            <li><kbd className="font-mono">Inicio / Fin</kbd> primera / última</li>
            <li><kbd className="font-mono">Esc</kbd> salir del zoom</li>
          </ul>
        </Group>
        <button type="button" className="k-btn k-btn-ghost w-full" onClick={reset}>
          <RotateCcw className="size-4" aria-hidden /> Restablecer ajustes del lector
        </button>
      </div>
    </Dialog>
  );
}
