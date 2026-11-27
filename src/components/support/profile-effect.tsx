import { PROFILE_EFFECTS } from "@/lib/support/tiers";

/**
 * Efecto animado del perfil (Viento): pétalos, estrellas, nieve o luciérnagas.
 * Solo CSS, decorativo (aria-hidden, sin clics) y se apaga con "reducir movimiento".
 * Las posiciones son fijas (no aleatorias) para que el servidor y el navegador pinten lo mismo.
 */
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: -((i * 1.7) % 12),
  duration: 9 + ((i * 2.3) % 7),
  size: 0.6 + ((i * 7) % 5) / 10,
}));

export function ProfileEffect({ effect }: { effect: string | null | undefined }) {
  if (!effect || !PROFILE_EFFECTS.some((e) => e.id === effect)) return null;
  return (
    <div className={`k-fx k-fx-${effect}`} aria-hidden>
      {PARTICLES.map((p, i) => (
        <span key={i} style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`, ["--s" as string]: p.size }} />
      ))}
    </div>
  );
}
