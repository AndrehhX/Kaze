import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WatchPartyRoom } from "@/components/watch-party/room";

export const metadata: Metadata = { title: "Watch Party" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function Page({ params }: PageProps<"/watch-parties/[roomId]">) {
  const { roomId } = await params;
  if (!UUID.test(roomId)) notFound();
  return <WatchPartyRoom roomId={roomId} />;
}
