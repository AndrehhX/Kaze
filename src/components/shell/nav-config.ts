import { Compass, Home, Library, MessagesSquare, Popcorn, CalendarRange, Users, UserRound, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; jp: string; icon: LucideIcon; match?: (path: string) => boolean };

export const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Home", jp: "ホーム", icon: Home, match: (p) => p === "/" },
  { href: "/discover", label: "Discover", jp: "発見", icon: Compass },
  { href: "/seasonal", label: "Seasonal", jp: "今期", icon: CalendarRange },
  { href: "/library", label: "My Library", jp: "ライブラリ", icon: Library },
  { href: "/community", label: "Community", jp: "コミュニティ", icon: MessagesSquare },
  { href: "/friends", label: "Friends", jp: "フレンド", icon: Users },
  { href: "/watch-parties", label: "Watch Parties", jp: "上映会", icon: Popcorn },
];

export const PROFILE_NAV: NavItem = { href: "/profile", label: "Profile", jp: "プロフィール", icon: UserRound };

export function isActive(item: NavItem, path: string) {
  return item.match ? item.match(path) : path === item.href || path.startsWith(item.href + "/");
}
