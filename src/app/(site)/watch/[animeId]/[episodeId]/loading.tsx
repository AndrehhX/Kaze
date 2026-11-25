export default function Loading() {
  return (
    <div className="container-k grid gap-6 pt-4 lg:grid-cols-[1fr_340px]" aria-busy="true" aria-label="Cargando reproductor">
      <div data-fs-player className="k-skeleton aspect-video w-full" />
      <div className="k-skeleton h-80 max-lg:hidden" />
    </div>
  );
}
