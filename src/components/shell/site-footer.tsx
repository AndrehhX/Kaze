import Link from "next/link";
import { Logo } from "./logo";
import { APK_DOWNLOAD_URL, DISCORD_INVITE_URL } from "./nav-config";
import { Coffee, Smartphone } from "lucide-react";
import { DiscordIcon } from "./discord-announcement-modal";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line pb-28 pt-12 lg:pb-12">
      <div className="container-k grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm text-muted">Anime isn&apos;t just something you watch. It&apos;s a universe you live in.</p>
        </div>
        <nav aria-label="Explorar" className="text-sm">
          <p className="k-label mb-3 text-muted">Explorar</p>
          <ul className="space-y-2">
            <li><Link className="hover:text-primary-ink" href="/discover">Descubrir</Link></li>
            <li><Link className="hover:text-primary-ink" href="/discover/moods">Mood Explorer</Link></li>
            <li><Link className="hover:text-primary-ink" href="/discover/roulette">Ruleta de anime</Link></li>
            <li><Link className="hover:text-primary-ink" href="/seasonal">Tabla de temporada</Link></li>
            <li>
              <a className="hover:text-primary-ink flex items-center gap-1.5" href={APK_DOWNLOAD_URL} rel="noopener noreferrer" download="kaze.apk">
                <Smartphone className="size-3.5 text-primary" aria-hidden />
                <span>App Android (APK)</span>
              </a>
            </li>
            <li>
              <a
                className="hover:text-primary-ink flex items-center gap-1.5"
                href="https://ko-fi.com/andrehwallet/goal?g=0"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Coffee className="size-3.5 text-[#FF5E5B]" aria-hidden />
                <span>Apoyar en Ko-fi</span>
              </a>
            </li>
            <li>
              <a
                className="hover:text-[#5865F2] flex items-center gap-1.5 transition-colors"
                href={DISCORD_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                <DiscordIcon className="size-3.5 fill-[#5865F2]" aria-hidden />
                <span className="font-medium text-fg">Discord Comunidad</span>
              </a>
            </li>
          </ul>
        </nav>
        <nav aria-label="Tú" className="text-sm">
          <p className="k-label mb-3 text-muted">Tú</p>
          <ul className="space-y-2">
            <li><Link className="hover:text-primary-ink" href="/library">Biblioteca</Link></li>
            <li><Link className="hover:text-primary-ink" href="/watch-parties">Salas de visionado</Link></li>
            <li><Link className="hover:text-primary-ink" href="/settings/appearance">Themes</Link></li>
            <li><Link className="hover:text-primary-ink" href="/settings/privacy">Privacidad</Link></li>
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
