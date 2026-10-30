"use client";

import { ProfileOverview, ProfileShell } from "./profile";
import { AnimeDna, ProfileLists } from "./dna";

export function ProfileOverviewPage({ username }: { username: string }) {
  return <ProfileShell username={username} tab="overview">{(d) => <ProfileOverview d={d} />}</ProfileShell>;
}
export function ProfileStatsPage({ username }: { username: string }) {
  return <ProfileShell username={username} tab="stats">{(d) => <AnimeDna d={d} />}</ProfileShell>;
}
export function ProfileListsPage({ username }: { username: string }) {
  return <ProfileShell username={username} tab="lists">{(d) => <ProfileLists d={d} />}</ProfileShell>;
}
