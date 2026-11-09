"use client";

import { useEffect, useState } from "react";

export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const pointerQuery = window.matchMedia("(pointer: fine)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateEnabled = () => setEnabled(pointerQuery.matches && !motionQuery.matches);
    updateEnabled();

    pointerQuery.addEventListener("change", updateEnabled);
    motionQuery.addEventListener("change", updateEnabled);
    return () => {
      pointerQuery.removeEventListener("change", updateEnabled);
      motionQuery.removeEventListener("change", updateEnabled);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const root = document.documentElement;
    let frame = 0;
    let targetX = -100;
    let targetY = -100;
    let x = targetX;
    let y = targetY;

    const updateTarget = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      root.classList.add("cursor-active");
    };
    const updateHover = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("a, button, input, [role='button']")) {
        root.classList.add("cursor-hover");
      }
    };
    const clearHover = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("a, button, input, [role='button']")) {
        root.classList.remove("cursor-hover");
      }
    };
    const animate = () => {
      x += (targetX - x) * 0.18;
      y += (targetY - y) * 0.18;
      root.style.setProperty("--cursor-x", `${x}px`);
      root.style.setProperty("--cursor-y", `${y}px`);
      frame = window.requestAnimationFrame(animate);
    };

    window.addEventListener("pointermove", updateTarget, { passive: true });
    window.addEventListener("pointerover", updateHover, { passive: true });
    window.addEventListener("pointerout", clearHover, { passive: true });
    frame = window.requestAnimationFrame(animate);
    return () => {
      window.removeEventListener("pointermove", updateTarget);
      window.removeEventListener("pointerover", updateHover);
      window.removeEventListener("pointerout", clearHover);
      window.cancelAnimationFrame(frame);
      root.classList.remove("cursor-active");
      root.classList.remove("cursor-hover");
      root.style.removeProperty("--cursor-x");
      root.style.removeProperty("--cursor-y");
    };
  }, [enabled]);

  if (!enabled) return null;
  return <span className="custom-cursor" aria-hidden="true" />;
}
