import type { Metadata } from "next";
import { getWeeklySchedule } from "@/lib/anilist/service";
import { ScheduleView } from "@/components/schedule/schedule-view";

export const metadata: Metadata = {
  title: "Calendario de emisión de anime · Qué sale hoy",
  description: "Horario semanal de estrenos de anime: qué episodios salen hoy, mañana y esta semana, en tu zona horaria y con cuenta atrás.",
  alternates: { canonical: "/calendario" },
};

export default async function CalendarioPage() {
  const items = await getWeeklySchedule().catch(() => []);
  return <ScheduleView items={items} />;
}
