"use client";

import { useEffect } from "react";

export function ScrollRestoration() {
  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const resetUnanchoredPage = () => {
      if (!window.location.hash) window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    };
    const frame = window.requestAnimationFrame(resetUnanchoredPage);
    window.addEventListener("pageshow", resetUnanchoredPage);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("pageshow", resetUnanchoredPage);
      window.history.scrollRestoration = previous;
    };
  }, []);
  return null;
}
