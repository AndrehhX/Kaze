export function RailSkeleton({ count = 7 }: { count?: number }) {
  return (
    <div className="container-k mt-14" aria-busy="true" aria-label="Loading">
      <div className="k-skeleton mb-5 h-7 w-56" />
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="w-[38vw] shrink-0 sm:w-[22vw] md:w-[17vw] lg:w-[13.5vw] xl:w-[11.5vw]">
            <div className="k-skeleton aspect-[2/3] w-full" />
            <div className="k-skeleton mt-3 h-3.5 w-4/5" />
            <div className="k-skeleton mt-2 h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function GridSkeleton({ count = 18 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 xs:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <div className="k-skeleton aspect-[2/3] w-full" />
          <div className="k-skeleton mt-3 h-3.5 w-4/5" />
          <div className="k-skeleton mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  );
}

export function PageHeaderSkeleton() {
  return (
    <div className="container-k pt-10" aria-hidden>
      <div className="k-skeleton h-3 w-24" />
      <div className="k-skeleton mt-4 h-12 w-[min(80%,480px)]" />
      <div className="k-skeleton mt-4 h-4 w-72" />
    </div>
  );
}
