import { Suspense, type ReactNode } from "react";
import { MangaSubnav } from "@/components/manga/subnav";

export default function MangaLayout({ children }: { children: ReactNode }) {
  return (
    <div data-section="manga">
      <Suspense fallback={null}>
        <MangaSubnav />
      </Suspense>
      {children}
    </div>
  );
}
