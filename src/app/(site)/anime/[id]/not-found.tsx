import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-k grid min-h-[60dvh] place-items-center py-20 text-center">
      <div>
        <p className="k-jp text-7xl text-primary-ink" lang="ja" aria-hidden>
          迷
        </p>
        <h1 className="font-display text-title mt-4">This anime isn&apos;t in the catalog</h1>
        <p className="mt-3 text-muted">The id may be wrong, or AniList may not list it publicly.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/discover" className="k-btn k-btn-primary">
            Search the catalog
          </Link>
          <Link href="/" className="k-btn k-btn-ghost">
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
