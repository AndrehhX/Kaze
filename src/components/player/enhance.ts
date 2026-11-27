"use client";

/* eslint-disable react-hooks/immutability -- WebGPU y el <canvas> se manejan de forma imperativa dentro del efecto, igual que el reproductor. */

/**
 * "Mejorar imagen": reescalado con Anime4K (WebGPU) en la tarjeta gráfica de quien mira.
 * El servidor manda el mismo video de siempre; cada fotograma se reescala en el navegador y se pinta
 * en un <canvas> encima del <video>. Anime4K (~3,5 MB) solo se descarga si alguien activa la opción.
 *
 *  - "max":   Anime4K Mode A (la mejor calidad que aguanta tiempo real en una gráfica normal).
 *  - "light": una red pequeña (CNNx2M) para gráficas modestas.
 * Si el equipo no llega (fotogramas que tardan demasiado), baja solo de "max" a "light" y, si tampoco, se apaga.
 */
import { useEffect, useRef } from "react";

import type { EnhanceMode } from "@/lib/player/picture";

export type { EnhanceMode };

export function webgpuAvailable() {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

const BLIT = /* wgsl */ `
@group(0) @binding(0) var tex: texture_2d<f32>;
@group(0) @binding(1) var smp: sampler;
struct VO { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vs(@builtin(vertex_index) i: u32) -> VO {
  var p = array<vec2f, 3>(vec2f(-1, -3), vec2f(-1, 1), vec2f(3, 1));
  var o: VO; o.pos = vec4f(p[i], 0, 1); o.uv = vec2f((p[i].x + 1) / 2, (1 - p[i].y) / 2); return o;
}
@fragment fn fs(v: VO) -> @location(0) vec4f { return vec4f(textureSample(tex, smp, v.uv).rgb, 1); }`;

type Status = { active: boolean; mode: EnhanceMode; reason?: string };

/**
 * Engancha Anime4K al video mientras `mode` no sea "off".
 * `onStatus` avisa si se activó, si bajó a ligero o si se apagó (y por qué).
 */
export function useEnhance(video: HTMLVideoElement | null, canvas: HTMLCanvasElement | null, mode: EnhanceMode, onStatus: (s: Status) => void) {
  const statusRef = useRef(onStatus);
  useEffect(() => {
    statusRef.current = onStatus;
  });

  useEffect(() => {
    if (mode === "off" || !video || !canvas) return;
    if (!webgpuAvailable()) {
      statusRef.current({ active: false, mode: "off", reason: "Tu navegador no tiene WebGPU (prueba con Chrome o Edge actualizados)." });
      return;
    }
    let cancelled = false;
    let frameHandle = 0;
    let device: GPUDevice | null = null;
    const current: EnhanceMode = mode;
    const cleanups: (() => void)[] = [];

    (async () => {
      const A4K = await import("anime4k-webgpu");
      const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
      if (!adapter || cancelled) {
        if (!cancelled) statusRef.current({ active: false, mode: "off", reason: "No se encontró una tarjeta gráfica compatible." });
        return;
      }
      device = await adapter.requestDevice();
      if (cancelled) return device.destroy();
      const ctx = canvas.getContext("webgpu");
      if (!ctx) return statusRef.current({ active: false, mode: "off", reason: "No se pudo usar la tarjeta gráfica." });
      const format = navigator.gpu.getPreferredCanvasFormat();
      ctx.configure({ device, format, alphaMode: "opaque" });
      const shader = device.createShaderModule({ code: BLIT });
      const blit = device.createRenderPipeline({
        layout: "auto",
        vertex: { module: shader, entryPoint: "vs" },
        fragment: { module: shader, entryPoint: "fs", targets: [{ format }] },
      });
      const sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });
      device.lost.then(() => !cancelled && statusRef.current({ active: false, mode: "off", reason: "Se reinició la tarjeta gráfica." }));

      // Escalera de redes, de mejor a más ligera. Si el video ya ocupa (casi) lo mismo que la pantalla,
      // reescalar no aporta y cuesta 4 veces más: se usa la restauración (define las líneas sin reescalar).
      type Pipe = { pass: (e: GPUCommandEncoder) => void; getOutputTexture: () => GPUTexture };
      type Step = (input: GPUTexture, vw: number, vh: number, tw: number, th: number) => Pipe[];
      const d = device;
      const ladder = (upscale: boolean): Step[] =>
        upscale
          ? [
              (i, vw, vh, tw, th) => [new A4K.ModeA({ device: d, inputTexture: i, nativeDimensions: { width: vw, height: vh }, targetDimensions: { width: tw, height: th } })],
              (i) => [new A4K.CNNx2VL({ device: d, inputTexture: i })],
              (i) => [new A4K.CNNx2M({ device: d, inputTexture: i })],
            ]
          : [(i) => [new A4K.CNNM({ device: d, inputTexture: i })], (i) => [new A4K.DoG({ device: d, inputTexture: i })]];
      // Presupuesto por fotograma: el anime va a 24 fps (41 ms), pero la gráfica también decodifica y dibuja la página.
      const BUDGET_MS = 18;

      let built: { key: string; input: GPUTexture; pipes: Pipe[]; bind: GPUBindGroup; level: number; levels: number } | null = null;
      let building: Promise<void> | null = null;
      let floor = current === "light" ? 99 : 0; // nivel mínimo permitido (sube si el video se traba)

      /** Mide una red en esta gráfica (varios fotogramas seguidos) y devuelve ms por fotograma. */
      const bench = async (pipes: Pipe[]) => {
        const run = () => {
          const enc = d.createCommandEncoder();
          for (const p of pipes) p.pass(enc);
          d.queue.submit([enc.finish()]);
        };
        run();
        await d.queue.onSubmittedWorkDone();
        const t0 = performance.now();
        for (let k = 0; k < 6; k++) run();
        await d.queue.onSubmittedWorkDone();
        return (performance.now() - t0) / 6;
      };

      /** Elige la mejor red que cabe en el presupuesto (empezando por `floor`). */
      const build = async (vw: number, vh: number, tw: number, th: number) => {
        const steps = ladder(tw / vw >= 1.25);
        const start = Math.min(floor, steps.length - 1);
        const key = `${vw}x${vh}>${tw}x${th}:${start}`;
        if (built?.key === key) return;
        built?.input.destroy();
        built = null;
        for (let level = start; level < steps.length; level++) {
          const input = d.createTexture({
            size: [vw, vh],
            format: "rgba16float",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
          });
          const pipes = steps[level](input, vw, vh, tw, th);
          const ms = await bench(pipes);
          if (cancelled) return input.destroy();
          const last = level === steps.length - 1;
          if (ms <= BUDGET_MS || last) {
            if (last && ms > BUDGET_MS * 1.6) {
              input.destroy();
              cancelled = true;
              statusRef.current({ active: false, mode: "off", reason: "Tu tarjeta gráfica no da para mejorar este video en tiempo real. La dejé apagada para que no se trabe." });
              return;
            }
            const bind = d.createBindGroup({
              layout: blit.getBindGroupLayout(0),
              entries: [
                { binding: 0, resource: pipes[pipes.length - 1].getOutputTexture().createView() },
                { binding: 1, resource: sampler },
              ],
            });
            built = { key, input, pipes, bind, level, levels: steps.length };
            floor = Math.min(floor, level);
            return;
          }
          input.destroy();
        }
      };

      // Tamaño de salida: lo que ocupa en pantalla (en píxeles reales), entre 1x y 2x el video.
      const targetSize = (vw: number, vh: number) => {
        const r = canvas.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const fit = Math.min((r.width * dpr) / vw, (r.height * dpr) / vh);
        const scale = Math.max(1, Math.min(2, fit || 1));
        return [Math.round(vw * scale), Math.round(vh * scale)] as const;
      };

      const draw = async () => {
        if (cancelled || building || video.readyState < 2 || !video.videoWidth) return;
        const vw = video.videoWidth, vh = video.videoHeight;
        const [tw, th] = targetSize(vw, vh);
        if (canvas.width !== tw || canvas.height !== th) {
          canvas.width = tw;
          canvas.height = th;
        }
        // Al empezar o al cambiar de tamaño (pantalla completa) se mide la gráfica y se elige la red.
        building = build(vw, vh, tw, th).finally(() => (building = null));
        await building;
        const b = built;
        if (cancelled || !b) return;
        d.queue.copyExternalImageToTexture({ source: video }, { texture: b.input }, [vw, vh]);
        const enc = d.createCommandEncoder();
        for (const p of b.pipes) p.pass(enc);
        const pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), loadOp: "clear", storeOp: "store", clearValue: [0, 0, 0, 1] }] });
        pass.setPipeline(blit);
        pass.setBindGroup(0, b.bind);
        pass.draw(3);
        pass.end();
        d.queue.submit([enc.finish()]);
      };

      // Vigilancia con la señal real: fotogramas que el video se salta. Si pasa del 8 % dos veces seguidas,
      // se baja un nivel; si ya está en el más ligero, se apaga para que el video no se trabe.
      let prevQ = video.getVideoPlaybackQuality?.();
      let strikes = 0;
      const watchdog = setInterval(() => {
        const q = video.getVideoPlaybackQuality?.();
        if (!q || !prevQ || video.paused || cancelled || !built) return void (prevQ = q);
        const total = q.totalVideoFrames - prevQ.totalVideoFrames;
        const dropped = q.droppedVideoFrames - prevQ.droppedVideoFrames;
        prevQ = q;
        if (total < 20) return;
        strikes = dropped / total > 0.08 ? strikes + 1 : 0;
        if (strikes < 2) return;
        strikes = 0;
        if (built.level < built.levels - 1) {
          floor = built.level + 1;
          built = { ...built, key: "" }; // se rehace con la red siguiente en el próximo fotograma
          statusRef.current({ active: true, mode: "light", reason: "El video iba justo: bajé la mejora a una más ligera." });
        } else {
          cancelled = true;
          statusRef.current({ active: false, mode: "off", reason: "Tu equipo no da para mejorar la imagen en tiempo real. La apagué para que el video no se trabe." });
        }
      }, 4000);
      cleanups.push(() => clearInterval(watchdog));

      // Un fotograma nuevo del video → un fotograma mejorado.
      const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number; cancelVideoFrameCallback?: (h: number) => void };
      if (v.requestVideoFrameCallback) {
        const loop = () => {
          if (cancelled) return;
          void draw();
          frameHandle = v.requestVideoFrameCallback!(loop);
        };
        frameHandle = v.requestVideoFrameCallback(loop);
        cleanups.push(() => v.cancelVideoFrameCallback?.(frameHandle));
      } else {
        const loop = () => {
          if (cancelled) return;
          void draw();
          frameHandle = requestAnimationFrame(loop);
        };
        frameHandle = requestAnimationFrame(loop);
        cleanups.push(() => cancelAnimationFrame(frameHandle));
      }
      // En pausa no llegan fotogramas: se repinta al buscar, al cambiar de tamaño (pantalla completa) y al cargar.
      const redraw = () => void draw();
      for (const ev of ["seeked", "loadeddata", "pause"]) video.addEventListener(ev, redraw);
      cleanups.push(() => ["seeked", "loadeddata", "pause"].forEach((ev) => video.removeEventListener(ev, redraw)));
      const ro = new ResizeObserver(redraw);
      ro.observe(canvas);
      cleanups.push(() => ro.disconnect());
      cleanups.push(() => built?.input.destroy());
      await draw();
      if (!cancelled) statusRef.current({ active: true, mode: current });
    })().catch((e: unknown) => {
      if (!cancelled) statusRef.current({ active: false, mode: "off", reason: `No se pudo mejorar la imagen (${e instanceof Error ? e.message.slice(0, 80) : "error"}).` });
    });

    return () => {
      cancelled = true;
      cleanups.forEach((f) => f());
      device?.destroy();
    };
  }, [video, canvas, mode]);
}
