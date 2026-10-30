"use client";
import { useEffect } from "react";

/** Pointer/tilt effects: parallax on the hero scene, 3D tilt + shine on the cards. Off for touch-only and reduced motion. */
export default function GidsFx() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const head = document.querySelector<HTMLElement>(".g-head");
    let raf = 0;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !head) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        head.style.setProperty("--mx", String(e.clientX / innerWidth - 0.5));
        head.style.setProperty("--my", String(e.clientY / innerHeight - 0.5));
      });
    };
    addEventListener("pointermove", onMove, { passive: true });

    const cards = Array.from(document.querySelectorAll<HTMLElement>(".g-card, .g-why-card"));
    const offs = cards.map((c) => {
      const move = (e: PointerEvent) => {
        if (e.pointerType !== "mouse") return;
        const r = c.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.style.setProperty("--rx", `${(0.5 - y) * 8}deg`);
        c.style.setProperty("--ry", `${(x - 0.5) * 10}deg`);
        c.style.setProperty("--px", `${x * 100}%`);
        c.style.setProperty("--py", `${y * 100}%`);
      };
      const leave = () => { c.style.setProperty("--rx", "0deg"); c.style.setProperty("--ry", "0deg"); };
      c.addEventListener("pointermove", move);
      c.addEventListener("pointerleave", leave);
      return () => { c.removeEventListener("pointermove", move); c.removeEventListener("pointerleave", leave); };
    });
    return () => { removeEventListener("pointermove", onMove); offs.forEach((f) => f()); cancelAnimationFrame(raf); };
  }, []);
  return null;
}
