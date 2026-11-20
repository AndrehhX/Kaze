"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import type { ReadingAsset } from "@/lib/manga/catalog";
import { boxesExtent, layoutView, visualOrder, type FitMode, type PageBox, type ReadingDirection } from "@/lib/manga/reader/engine";
import { PageImage } from "./page-image";

export type Flip = { from: number[]; to: number[]; dir: 1 | -1; key: number };

type Common = {
  pages: ReadingAsset[];
  size: (i: number) => { w: number; h: number };
  stage: { width: number; height: number };
  fit: FitMode;
  dataSaver: boolean;
  onSize: (i: number, w: number, h: number) => void;
};

const PAPER = "#f3efe6";
const EASE = "cubic-bezier(0.45, 0.05, 0.2, 1)";

/** One printed page: the artwork fills its box (never cropped) with a gutter shadow on the spine side. */
function Page({ box, pages, dataSaver, onSize, style }: { box: PageBox; style?: CSSProperties } & Pick<Common, "pages" | "dataSaver" | "onSize">) {
  const asset = pages[box.index];
  if (!asset) return null;
  return (
    <div className="absolute overflow-hidden bg-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.6)]" style={{ left: box.left, top: box.top, width: box.width, height: box.height, ...style }}>
      <PageImage asset={asset} dataSaver={dataSaver} eager className="size-full [&_img]:size-full" style={{ width: "100%", height: "100%" }} onSize={(w, h) => onSize(box.index, w, h)} />
      {box.side !== "center" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-[14%]"
          style={{
            [box.side === "left" ? "right" : "left"]: 0,
            background: `linear-gradient(to ${box.side === "left" ? "left" : "right"}, rgba(0,0,0,0.32), rgba(0,0,0,0.1) 30%, rgba(0,0,0,0) 100%)`,
          }}
        />
      )}
    </div>
  );
}

/** A whole view (one page, or two pages as an open book). Used directly when page-turn animation is off. */
export function Spread({ view, direction, ...c }: Common & { view: number[]; direction: ReadingDirection }) {
  const boxes = layoutView(visualOrder(view, direction), c.size, c.stage, c.fit);
  return (
    <div className="absolute inset-0">
      {boxes.map((b) => (
        <Page key={c.pages[b.index]?.src ?? b.index} box={b} pages={c.pages} dataSaver={c.dataSaver} onSize={c.onSize} />
      ))}
    </div>
  );
}

/**
 * Paged stage that turns pages like a printed book. Two-page views flip a leaf over the spine (front: the
 * page being turned, back: the next page that lands on the other side). Single pages swing on their binding
 * edge — left for western books, right for manga read right-to-left.
 */
export function BookStage({ view, flip, direction, duration, onFlipDone, ...c }: Common & { view: number[]; flip: Flip | null; direction: ReadingDirection; duration: number; onFlipDone: (key: number) => void }) {
  const W = c.stage.width, H = c.stage.height;
  const lay = (v: number[]) => layoutView(visualOrder(v, direction), c.size, c.stage, c.fit);

  let base: PageBox[] = lay(view);
  let leaf: ReactNode = null;

  if (flip) {
    const from = lay(flip.from), to = lay(flip.to);
    const done = () => onFlipDone(flip.key);
    const ms = Math.max(1, Math.round(duration * 1000));
    const shadeFront = [0, 0.25, 0.55];
    const shadeBack = [0.55, 0.25, 0];

    if (from.length === 2 && to.length === 2) {
      // Open book: which half lifts depends on direction of travel and of reading.
      const turnRight = flip.dir > 0 !== (direction === "rtl");
      const half = W / 2;
      if (turnRight) {
        base = [from[0], to[1]];
        const front = from[1], back = to[0];
        leaf = (
          <Leaf key={flip.key} ms={ms} onDone={done} style={{ left: half, width: half, height: H, transformOrigin: "left center" }} frames={[{ transform: "rotateY(0deg)" }, { transform: "rotateY(-180deg)" }]}>
            <Face>
              <Page box={{ ...front, left: front.left - half }} pages={c.pages} dataSaver={c.dataSaver} onSize={c.onSize} />
              <Shade box={{ ...front, left: front.left - half }} ms={ms} opacity={shadeFront} dir="right" />
            </Face>
            <Face back>
              <Page box={back} pages={c.pages} dataSaver={c.dataSaver} onSize={c.onSize} />
              <Shade box={back} ms={ms} opacity={shadeBack} dir="left" />
            </Face>
          </Leaf>
        );
      } else {
        base = [to[0], from[1]];
        const front = from[0], back = to[1];
        leaf = (
          <Leaf key={flip.key} ms={ms} onDone={done} style={{ left: 0, width: half, height: H, transformOrigin: "right center" }} frames={[{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }]}>
            <Face>
              <Page box={front} pages={c.pages} dataSaver={c.dataSaver} onSize={c.onSize} />
              <Shade box={front} ms={ms} opacity={shadeFront} dir="left" />
            </Face>
            <Face back>
              <Page box={{ ...back, left: back.left - half }} pages={c.pages} dataSaver={c.dataSaver} onSize={c.onSize} />
              <Shade box={{ ...back, left: back.left - half }} ms={ms} opacity={shadeBack} dir="right" />
            </Face>
          </Leaf>
        );
      }
    } else {
      // Single pages (or a mix of single and double views): the leaf swings on its binding edge.
      const forward = flip.dir > 0;
      const moving = forward ? from : to;
      base = forward ? to : from;
      const ext = boxesExtent(moving);
      const sign = direction === "rtl" ? 1 : -1;
      const shifted = moving.map((b) => ({ ...b, left: b.left - ext.left }));
      leaf = (
        <Leaf
          key={flip.key}
          ms={ms}
          onDone={done}
          style={{ left: ext.left, width: ext.right - ext.left, height: H, transformOrigin: direction === "rtl" ? "right center" : "left center" }}
          frames={
            forward
              ? [{ transform: "rotateY(0deg)", opacity: 1 }, { transform: `rotateY(${sign * 120}deg)`, opacity: 1, offset: 0.65 }, { transform: `rotateY(${sign * 180}deg)`, opacity: 0 }]
              : [{ transform: `rotateY(${sign * 180}deg)`, opacity: 0 }, { transform: `rotateY(${sign * 120}deg)`, opacity: 1, offset: 0.35 }, { transform: "rotateY(0deg)", opacity: 1 }]
          }
        >
          <Face>
            {shifted.map((b) => (
              <Page key={b.index} box={b} pages={c.pages} dataSaver={c.dataSaver} onSize={c.onSize} />
            ))}
            {shifted.map((b) => (
              <Shade key={b.index} box={b} ms={ms} opacity={forward ? shadeFront : shadeBack} dir={direction === "rtl" ? "left" : "right"} />
            ))}
          </Face>
          <Face back>
            {/* the back of a printed page: paper with the artwork faintly showing through */}
            {shifted.map((b) => (
              <div key={b.index} className="absolute shadow-[0_18px_50px_-12px_rgba(0,0,0,0.6)]" style={{ left: ext.right - ext.left - b.left - b.width, top: b.top, width: b.width, height: b.height, background: `linear-gradient(to ${direction === "rtl" ? "left" : "right"}, #d9d3c6, ${PAPER} 18%)` }} />
            ))}
          </Face>
        </Leaf>
      );
    }
  }

  return (
    <div className="absolute inset-0" style={{ perspective: Math.max(W, H) * 2.2 }}>
      {base.map((b) => (
        <Page key={c.pages[b.index]?.src ?? b.index} box={b} pages={c.pages} dataSaver={c.dataSaver} onSize={c.onSize} />
      ))}
      {leaf}
    </div>
  );
}

function Face({ back, children }: { back?: boolean; children: ReactNode }) {
  return (
    <div className="absolute inset-0" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: back ? "rotateY(180deg)" : undefined }}>
      {children}
    </div>
  );
}

/**
 * The turning leaf. Driven by the Web Animations API (compositor-friendly, keeps running smoothly while
 * React re-renders); a timer guarantees the turn always completes even if the browser drops the animation.
 */
function Leaf({ frames, ms, onDone, style, children }: { frames: Keyframe[]; ms: number; onDone: () => void; style: CSSProperties; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const anim = el.animate(frames, { duration: ms, easing: EASE, fill: "forwards" });
    const finish = () => done.current();
    anim.finished.then(finish, () => {});
    const t = window.setTimeout(finish, ms + 120);
    return () => {
      window.clearTimeout(t);
      anim.cancel();
    };
    // Runs once per leaf: a new turn mounts a new leaf (keyed by the flip).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} className="absolute top-0 will-change-transform" style={{ ...style, transformStyle: "preserve-3d", transform: (frames[0].transform as string) ?? undefined, opacity: (frames[0].opacity as number) ?? undefined }}>
      {children}
    </div>
  );
}

/** Light falloff across a page while it bends: darker towards the edge that is lifting. */
function Shade({ box, ms, opacity, dir }: { box: PageBox; ms: number; opacity: number[]; dir: "left" | "right" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const anim = ref.current?.animate(
      opacity.map((o) => ({ opacity: o })),
      { duration: ms, easing: EASE, fill: "forwards" },
    );
    return () => anim?.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute"
      style={{ left: box.left, top: box.top, width: box.width, height: box.height, opacity: opacity[0], background: `linear-gradient(to ${dir}, rgba(0,0,0,0) 0%, rgba(0,0,0,0.25) 55%, rgba(0,0,0,0.6) 100%)` }}
    />
  );
}
