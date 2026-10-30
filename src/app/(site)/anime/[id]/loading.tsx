export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading anime">
      <div className="k-skeleton -mt-[var(--k-nav-h)] h-[min(62svh,560px)] w-full !rounded-none opacity-50" />
      <div className="container-k -mt-48 grid gap-8 md:grid-cols-[minmax(200px,280px)_1fr]">
        <div className="k-skeleton mx-auto aspect-[2/3] w-[min(56vw,240px)] md:w-full" />
        <div className="space-y-4 md:pt-16">
          <div className="k-skeleton h-6 w-40" />
          <div className="k-skeleton h-14 w-[min(90%,520px)]" />
          <div className="k-skeleton h-4 w-64" />
          <div className="k-skeleton h-24 w-full max-w-2xl" />
        </div>
      </div>
    </div>
  );
}
