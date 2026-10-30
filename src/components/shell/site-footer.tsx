import Link from "next/link";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line pb-28 pt-12 lg:pb-12">
      <div className="container-k grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-muted">Anime isn&apos;t just something you watch. It&apos;s a universe you live in.</p>
        </div>
        <nav aria-label="Explore" className="text-sm">
          <p className="k-label mb-3 text-muted">Explore</p>
          <ul className="space-y-2">
            <li><Link className="hover:text-primary-ink" href="/discover">Discover</Link></li>
            <li><Link className="hover:text-primary-ink" href="/discover/moods">Mood Explorer</Link></li>
            <li><Link className="hover:text-primary-ink" href="/discover/roulette">Anime Roulette</Link></li>
            <li><Link className="hover:text-primary-ink" href="/seasonal">Seasonal chart</Link></li>
          </ul>
        </nav>
        <nav aria-label="You" className="text-sm">
          <p className="k-label mb-3 text-muted">You</p>
          <ul className="space-y-2">
            <li><Link className="hover:text-primary-ink" href="/library">Library</Link></li>
            <li><Link className="hover:text-primary-ink" href="/watch-parties">Watch parties</Link></li>
            <li><Link className="hover:text-primary-ink" href="/settings/appearance">Themes</Link></li>
            <li><Link className="hover:text-primary-ink" href="/settings/privacy">Privacy</Link></li>
          </ul>
        </nav>
        <div className="text-xs leading-relaxed text-muted">
          <p className="k-label mb-3">Sources</p>
          <p>
            Anime metadata from the{" "}
            <a className="underline hover:text-fg" href="https://anilist.co" target="_blank" rel="noreferrer">
              AniList
            </a>{" "}
            API. KAZE does not stream AniList titles; official streaming links are shown where AniList lists them.
          </p>
          <p className="mt-2">
            Playable demo media: Blender Foundation open films (CC BY 3.0) and public HLS test streams.
          </p>
        </div>
      </div>
    </footer>
  );
}
