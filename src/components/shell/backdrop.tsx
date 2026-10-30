"use client";

import { useEffect, useRef } from "react";
import { useSettings } from "@/stores/settings";
import { useKazeMotion } from "@/lib/motion";
import { useMounted } from "@/lib/hooks";

/** Theme-specific atmosphere layer. Purely decorative, never intercepts input. */
export function ThemeBackdrop() {
  const theme = useSettings((s) => s.theme);
  const ambient = useSettings((s) => s.ambientEffects);
  const { reduced } = useKazeMotion();
  const mounted = useMounted();
  const animate = mounted && ambient && !reduced;

  return (
    <div className="k-backdrop" aria-hidden>
      {theme === "midnight" && (
        <>
          <div className="absolute -left-[10%] -top-[20%] size-[60vw] rounded-full bg-[radial-gradient(circle,rgb(168_85_247/0.18),transparent_65%)]" />
          <div className="absolute -right-[15%] top-[30%] size-[50vw] rounded-full bg-[radial-gradient(circle,rgb(255_79_216/0.10),transparent_65%)]" />
          <div className="absolute bottom-[-20%] left-[20%] size-[55vw] rounded-full bg-[radial-gradient(circle,rgb(109_94_248/0.12),transparent_65%)]" />
          {animate && (
            <>
              <span className="k-light-trail top-[22%]" style={{ animationDelay: "0s" }} />
              <span className="k-light-trail top-[58%]" style={{ animationDelay: "4.5s", rotate: "-12deg" }} />
              <span className="k-light-trail top-[80%]" style={{ animationDelay: "8s" }} />
            </>
          )}
        </>
      )}
      {theme === "sakura" && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_10%_0%,rgb(247_183_210/0.45),transparent_55%),radial-gradient(ellipse_at_95%_30%,rgb(184_154_247/0.25),transparent_50%),radial-gradient(ellipse_at_50%_110%,rgb(247_183_210/0.3),transparent_55%)]" />
          {animate && <SakuraPetals />}
        </>
      )}
      {theme === "cyber" && (
        <>
          <div className="k-cyber-grid" />
          <div className="k-scanlines" />
          {animate && <div className="k-sweep" />}
          <div className="absolute right-[4%] top-[18%] font-mono text-[0.625rem] leading-5 tracking-widest text-primary/25">
            SYS.KAZE//NET
            <br />
            LINK ▮▮▮▮▯ 0.98
            <br />
            NODE 風-07
          </div>
        </>
      )}
      {theme === "zen" && (
        <>
          <div className="k-grain" />
          <svg className="absolute -right-[8vw] top-[8vh] size-[46vw] max-w-[640px] opacity-[0.07]" viewBox="0 0 200 200">
            <path d="M100 18a82 82 0 1 1-71 41" fill="none" stroke="#1d1d1d" strokeWidth="9" strokeLinecap="round" />
          </svg>
          <div className="absolute bottom-0 left-[calc(var(--k-gutter)/2)] top-0 w-px bg-[#1d1d1d]/10" />
        </>
      )}
    </div>
  );
}

/** Lightweight canvas petals: capped count, paused when the tab is hidden. */
function SakuraPetals() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let w = 0;
    let h = 0;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);
    const count = Math.min(26, Math.round(w / 60));
    const petals = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 4 + Math.random() * 6,
      vy: 0.25 + Math.random() * 0.55,
      vx: 0.15 + Math.random() * 0.4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.02,
      phase: Math.random() * Math.PI * 2,
    }));
    const draw = (t: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const p of petals) {
        p.y += p.vy;
        p.x += p.vx + Math.sin(t / 1400 + p.phase) * 0.35;
        p.rot += p.vr;
        if (p.y > h + 20) {
          p.y = -20;
          p.x = Math.random() * w;
        }
        if (p.x > w + 20) p.x = -20;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = "rgba(232,106,154,0.32)";
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.62, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      raf = requestAnimationFrame(draw);
    };
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 size-full" />;
}
