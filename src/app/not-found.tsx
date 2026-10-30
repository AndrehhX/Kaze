import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="k-jp text-8xl text-primary-ink" lang="ja" aria-hidden>
          無
        </p>
        <h1 className="font-display text-title mt-4">Page not found</h1>
        <p className="mt-3 text-muted">This corner of the universe doesn&apos;t exist (yet).</p>
        <Link href="/" className="k-btn k-btn-primary mt-6">
          Back to KAZE
        </Link>
      </div>
    </main>
  );
}
