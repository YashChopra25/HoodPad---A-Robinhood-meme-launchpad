"use client";

import { useEffect, useRef } from "react";

/** Brand lime, market green and a violet counterpoint, as "r,g,b" for rgba(). */
const COLORS = ["200,240,49", "46,229,157", "124,92,255"];

interface Stream {
  offset: number;
  bend: number;
  color: string;
  width: number;
  alpha: number;
}

interface Particle {
  stream: number;
  t: number;
  speed: number;
  size: number;
}

/**
 * Light streams sweeping across the page behind everything, with square
 * "blocks" riding along them. A canvas rather than DOM nodes, so ninety moving
 * particles cost one layer. It caps the pixel ratio, pauses while the tab is
 * hidden, and draws a single still frame for anyone who prefers reduced motion.
 */
export default function StreamField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = ref.current;
    const context = element?.getContext("2d");
    if (!element || !context) return undefined;
    const canvas: HTMLCanvasElement = element;
    const ctx: CanvasRenderingContext2D = context;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let raf = 0;

    const streams: Stream[] = Array.from({ length: 24 }, (_, index) => ({
      offset: index / 24,
      bend: 0.2 + Math.random() * 0.6,
      color: COLORS[index % 5 === 0 ? 2 : index % 2],
      width: 0.6 + Math.random() * 1.1,
      alpha: 0.04 + Math.random() * 0.1,
    }));

    const particles: Particle[] = Array.from({ length: 90 }, () => ({
      stream: Math.floor(Math.random() * streams.length),
      t: Math.random(),
      speed: 0.0005 + Math.random() * 0.0016,
      size: 1.5 + Math.random() * 3.5,
    }));

    // Each stream is a quadratic curve from below the bottom-left edge to past
    // the top-right corner: `offset` fans them out, `bend` varies the arc.
    function point(stream: Stream, t: number): [number, number] {
      const x0 = width * (-0.2 + stream.offset * 0.7);
      const y0 = height * 1.1;
      const cx = width * (0.5 + stream.bend * 0.4);
      const cy = height * (1 - stream.bend * 0.5);
      const x1 = width * 1.1;
      const y1 = height * (-0.1 + stream.offset * 0.9);
      const u = 1 - t;
      return [u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1];
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      for (const stream of streams) {
        ctx.beginPath();
        for (let step = 0; step <= 40; step++) {
          const [x, y] = point(stream, step / 40);
          if (step === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(${stream.color},${stream.alpha})`;
        ctx.lineWidth = stream.width;
        ctx.stroke();
      }

      for (const particle of particles) {
        const stream = streams[particle.stream];
        const [x, y] = point(stream, particle.t);
        const [tailX, tailY] = point(stream, Math.max(0, particle.t - 0.035));
        // Brightest mid-flight, so blocks fade in and out at the edges.
        const glow = Math.sin(Math.PI * particle.t);

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = `rgba(${stream.color},${0.22 * glow})`;
        ctx.lineWidth = particle.size * 0.45;
        ctx.stroke();

        ctx.fillStyle = `rgba(${stream.color},${0.3 + 0.6 * glow})`;
        ctx.fillRect(x - particle.size / 2, y - particle.size / 2, particle.size, particle.size);
      }

      ctx.globalCompositeOperation = "source-over";
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (reduced) draw();
    }

    function tick() {
      for (const particle of particles) {
        particle.t += particle.speed;
        if (particle.t > 1) {
          particle.t = 0;
          particle.stream = Math.floor(Math.random() * streams.length);
        }
      }
      draw();
      raf = requestAnimationFrame(tick);
    }

    function onVisibility() {
      cancelAnimationFrame(raf);
      if (!document.hidden && !reduced) raf = requestAnimationFrame(tick);
    }

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVisibility);
    if (!reduced) raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 size-full opacity-80 mask-[linear-gradient(to_bottom,black,black_65%,transparent)]"
    />
  );
}
