"use client";

import { Dialog } from "@/components/ui/dialog";

/** YouTube trailer via the privacy-enhanced domain. Loads (and plays) only after the user asks. */
export function TrailerDialog({ open, onOpenChange, youtubeId, title }: { open: boolean; onOpenChange: (o: boolean) => void; youtubeId: string; title: string }) {
  const safeId = /^[\w-]{6,20}$/.test(youtubeId) ? youtubeId : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`${title} — trailer`} className="w-[min(96vw,1100px)]">
      <div className="p-3 pt-2">
        {safeId ? (
          <div className="relative aspect-video w-full overflow-hidden rounded-[min(var(--k-radius-card),14px)] bg-black">
            <iframe
              className="absolute inset-0 size-full"
              src={`https://www.youtube-nocookie.com/embed/${safeId}?autoplay=1&rel=0&modestbranding=1`}
              title={`${title} trailer`}
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          <p className="p-6 text-sm text-muted">This trailer can&apos;t be played here.</p>
        )}
      </div>
    </Dialog>
  );
}
