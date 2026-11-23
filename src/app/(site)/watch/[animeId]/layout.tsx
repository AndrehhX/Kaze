/**
 * Contenedor estable de la pantalla completa del reproductor.
 *
 * Next vuelve a montar la página al cambiar `[episodeId]`, pero este layout (nivel `[animeId]`)
 * se mantiene. El reproductor pide la pantalla completa sobre este div; al pasar al siguiente
 * episodio el elemento en pantalla completa sigue existiendo, así que el navegador no se queda
 * "atascado" y el reproductor nuevo aparece ya en pantalla completa (ver `.player-fs-host` en
 * globals.css y `fullscreenTarget` en components/player/player.tsx).
 */
export default function WatchAnimeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-player-host className="player-fs-host">
      {children}
    </div>
  );
}
