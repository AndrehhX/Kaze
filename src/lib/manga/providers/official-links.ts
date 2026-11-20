import type { ReadingAvailability } from "../catalog";
import type { AvailabilityInput, AvailabilityProvider } from "./types";

/**
 * Official reading destinations come only from AniList's curated `externalLinks` (publisher apps and stores).
 * KAZE never embeds or proxies those chapters: it links out so the reader uses the licensed service directly.
 */

/** Known licensed reading platforms. Unknown "STREAMING" links are still shown, but not labelled as verified platforms. */
const KNOWN_PLATFORMS: Record<string, { label: string; free?: boolean }> = {
  "manga plus": { label: "MANGA Plus (Shueisha)", free: true },
  "manga plus by shueisha": { label: "MANGA Plus (Shueisha)", free: true },
  viz: { label: "VIZ Media" },
  "shonen jump": { label: "Shonen Jump (VIZ)" },
  "k manga": { label: "K MANGA (Kodansha)" },
  "kodansha comics": { label: "Kodansha" },
  "manga up!": { label: "Manga UP! (Square Enix)" },
  comikey: { label: "Comikey" },
  azuki: { label: "Azuki" },
  inkr: { label: "INKR Comics" },
  "bookwalker": { label: "BOOK☆WALKER" },
  webtoon: { label: "WEBTOON", free: true },
  "line webtoon": { label: "WEBTOON", free: true },
  tapas: { label: "Tapas" },
  tappytoon: { label: "Tappytoon" },
  lezhin: { label: "Lezhin Comics" },
  "pocket comics": { label: "Pocket Comics" },
  "manta": { label: "Manta" },
  "yen press": { label: "Yen Press" },
  "seven seas": { label: "Seven Seas" },
  "j-novel club": { label: "J-Novel Club" },
  "kakaopage": { label: "KakaoPage" },
  "naver series": { label: "Naver Series" },
  "bilibili comics": { label: "Bilibili Comics" },
  "mangamo": { label: "Mangamo" },
};

const LANG_ES: Record<string, string> = { English: "inglés", Japanese: "japonés", Spanish: "español", Korean: "coreano", Chinese: "chino", French: "francés", Portuguese: "portugués", German: "alemán", Italian: "italiano", Indonesian: "indonesio", Thai: "tailandés", Vietnamese: "vietnamita" };

export function languageLabel(lang: string | null | undefined) {
  if (!lang) return null;
  return LANG_ES[lang] ?? lang;
}

export const officialLinksProvider: AvailabilityProvider = {
  info: {
    id: "official-links",
    name: "Plataformas oficiales",
    kind: "official-link",
    rights: "Enlaces oficiales listados en AniList. La lectura ocurre en el servicio del editor, con sus propias condiciones.",
  },
  availabilityFor({ externalLinks }: AvailabilityInput): ReadingAvailability[] {
    const out: ReadingAvailability[] = [];
    const seen = new Set<string>();
    for (const l of externalLinks ?? []) {
      if (l.isDisabled || l.type !== "STREAMING" || !/^https:\/\//.test(l.url)) continue;
      const key = l.site.trim().toLowerCase();
      const known = KNOWN_PLATFORMS[key];
      const dedupe = `${key}|${l.language ?? ""}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      const lang = languageLabel(l.language);
      out.push({
        kind: "external",
        provider: "official-links",
        label: known?.label ?? l.site,
        url: l.url,
        language: l.language,
        official: true,
        note: `${known?.free ? "Capítulos gratuitos según el editor" : "Servicio oficial"}${lang ? ` · en ${lang}` : ""}. Se abre en el sitio del editor.`,
      });
    }
    // Spanish first, then English, then everything else.
    const rank = (a: ReadingAvailability) => (a.language === "Spanish" ? 0 : a.language === "English" ? 1 : a.language ? 2 : 3);
    return out.sort((a, b) => rank(a) - rank(b));
  },
};
