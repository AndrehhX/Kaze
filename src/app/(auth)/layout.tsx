import { Logo } from "@/components/shell/logo";
import { ThemeBackdrop } from "@/components/shell/backdrop";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <ThemeBackdrop />
      <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
        <aside className="relative hidden overflow-hidden border-r border-line lg:block" aria-hidden>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_30%,color-mix(in_oklab,var(--k-primary)_45%,transparent),transparent_60%),radial-gradient(ellipse_at_80%_80%,color-mix(in_oklab,var(--k-accent)_35%,transparent),transparent_55%)]" />
          <span className="k-jp vertical-jp absolute left-10 top-1/2 -translate-y-1/2 text-[9rem] font-bold leading-none text-fg/10" lang="ja">
            風の宇宙
          </span>
          <div className="absolute bottom-12 left-12 right-12">
            <p className="font-display text-title max-w-md">Anime isn&apos;t just something you watch.</p>
            <p className="mt-3 text-lg text-muted">It&apos;s a universe you live in.</p>
          </div>
        </aside>
        <main id="main" className="flex flex-col px-6 py-8 sm:px-12">
          <Logo />
          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
        </main>
      </div>
    </>
  );
}
