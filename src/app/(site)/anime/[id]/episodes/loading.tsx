import { PageHeaderSkeleton } from "@/components/anime/skeletons";

export default function Loading() {
  return (
    <div aria-busy="true">
      <PageHeaderSkeleton />
      <div className="container-k mt-10 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="k-skeleton aspect-[4/3]" />
        ))}
      </div>
    </div>
  );
}
