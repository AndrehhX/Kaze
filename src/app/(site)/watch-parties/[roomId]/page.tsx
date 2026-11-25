import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WatchPartyRoom } from "@/components/watch-party/room";

export const metadata: Metadata = { title: "Sala de visionado" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function generateStaticParams() {
  return [{ roomId: "00000000-0000-0000-0000-000000000000" }];
}

export default async function Page({ params }: PageProps<"/watch-parties/[roomId]">) {
  const { roomId } = await params;
  if (!UUID.test(roomId)) notFound();
  return <WatchPartyRoom roomId={roomId} />;
}
