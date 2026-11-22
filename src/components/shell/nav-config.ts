import { BookOpen, Compass, Home, Library, MessagesSquare, Popcorn, CalendarRange, CalendarClock, Users, UserRound, type LucideIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  jp: string;
  icon: LucideIcon;
  badge?: string;
  match?: (path: string) => boolean;
};

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Inicio", jp: "ホーム", icon: Home, match: (p) => p === "/" },
  { href: "/discover", label: "Descubrir", jp: "発見", icon: Compass },
  { href: "/manga", label: "Manga", jp: "漫画", icon: BookOpen, badge: "Mantenimiento" },
  { href: "/seasonal", label: "Temporada", jp: "今期", icon: CalendarRange },
  { href: "/calendario", label: "Calendario", jp: "放送予定", icon: CalendarClock },
  { href: "/library", label: "Mi Biblioteca", jp: "ライブラリ", icon: Library },
  { href: "/community", label: "Comunidad", jp: "コミュニティ", icon: MessagesSquare },
  { href: "/friends", label: "Amigos", jp: "フレンド", icon: Users },
  { href: "/watch-parties", label: "Salas de Cine", jp: "上映会", icon: Popcorn },
];

export const PROFILE_NAV: NavItem = { href: "/profile", label: "Perfil", jp: "プロフィール", icon: UserRound };

export const APK_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_APK_URL ||
  "https://raw.githubusercontent.com/AndrehhX/Kaze/479c81ed2d8880b949b7ff2219b97c409f75065b/public/kaze.apk";

export const DISCORD_INVITE_URL =
  process.env.NEXT_PUBLIC_DISCORD_URL || "https://discord.gg/eYpw7aVUdp";

export function isActive(item: NavItem, path: string) {
  return item.match ? item.match(path) : path === item.href || path.startsWith(item.href + "/");
}
