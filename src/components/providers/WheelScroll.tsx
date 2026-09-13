"use client";

import { useEffect } from "react";

// Leave nested scroll areas (including contained areas at their edges) native.
function needsNativeScroll(event: WheelEvent) {
  for (const node of event.composedPath()) {
    if (!(node instanceof HTMLElement)) continue;
    if (node === document.body || node === document.documentElement) break;
    if (node.matches("input, textarea, select, [contenteditable]:not([contenteditable=false]), .assistant-panel")) return true;
    const style = getComputedStyle(node);
    if (/auto|scroll|overlay/.test(style.overflowY) && (
      node.scrollHeight > node.clientHeight || /contain|none/.test(style.overscrollBehaviorY)
    )) return true;
  }
  return [document.documentElement, document.body].some((node) => /hidden|clip/.test(getComputedStyle(node).overflowY));
}

export function WheelScroll() {
  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let position = window.scrollY;
    let target = position;
    let writtenPosition = position;
    let previousTime = 0;

    const cancel = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
      position = target = writtenPosition = window.scrollY;
    };

    const animate = (time: number) => {
      // A scrollbar, anchor, or external scroll always takes precedence, even
      // when its scroll event has not been delivered before this animation frame.
      if (Math.abs(window.scrollY - writtenPosition) > 1) {
        cancel();
        return;
      }
      // An input handler can run after this frame's RAF timestamp was sampled.
      const delta = Math.min(Math.max(0, time - previousTime) / 1000, 0.05);
      previousTime = Math.max(previousTime, time);
      position += (target - position) * (1 - Math.exp(-16 * delta));
      const settled = Math.abs(target - position) < 0.5;
      if (settled) position = target;
      // Write the real document offset so sticky sections, anchors, and the
      // existing ScrollTrigger / R3F pipeline share the same scroll position.
      window.scrollTo({ top: position, behavior: "instant" });
      writtenPosition = window.scrollY;
      frame = settled ? 0 : window.requestAnimationFrame(animate);
    };

    const onWheel = (event: WheelEvent) => {
      if (
        reducedMotion.matches || event.defaultPrevented || !event.cancelable ||
        event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
        event.deltaY === 0 || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || needsNativeScroll(event)
      ) {
        cancel();
        return;
      }

      // WheelEvent deltas can be pixels, text lines, or pages.
      const lineHeight = Number.parseFloat(getComputedStyle(document.documentElement).lineHeight) || 16;
      const unit = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? lineHeight
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? window.innerHeight : 1;
      const movement = event.deltaY * unit;
      const limit = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      if (!frame || Math.abs(window.scrollY - writtenPosition) > 1) cancel();
      // Reversing the wheel should respond immediately, without first paying
      // off the previous direction's accumulated distance.
      if (movement * (target - position) < 0) target = position;
      const nextTarget = Math.min(limit, Math.max(0, target + movement));
      if (!frame && nextTarget === position) return;

      event.preventDefault();
      target = nextTarget;
      if (!frame) {
        // Stop a browser-owned smooth scroll before starting this wheel gesture.
        window.scrollTo({ top: position, behavior: "instant" });
        writtenPosition = window.scrollY;
        previousTime = performance.now();
        frame = window.requestAnimationFrame(animate);
      }
    };

    const onScroll = () => {
      if (frame && Math.abs(window.scrollY - writtenPosition) > 1) cancel();
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pointerdown", cancel, { passive: true, capture: true });
    window.addEventListener("touchstart", cancel, { passive: true, capture: true });
    window.addEventListener("keydown", cancel, true);
    window.addEventListener("hashchange", cancel);
    window.addEventListener("blur", cancel);
    window.addEventListener("resize", cancel);
    document.addEventListener("visibilitychange", cancel);
    if (typeof reducedMotion.addEventListener === "function") reducedMotion.addEventListener("change", cancel);
    else reducedMotion.addListener(cancel);

    return () => {
      cancel();
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointerdown", cancel, true);
      window.removeEventListener("touchstart", cancel, true);
      window.removeEventListener("keydown", cancel, true);
      window.removeEventListener("hashchange", cancel);
      window.removeEventListener("blur", cancel);
      window.removeEventListener("resize", cancel);
      document.removeEventListener("visibilitychange", cancel);
      if (typeof reducedMotion.removeEventListener === "function") reducedMotion.removeEventListener("change", cancel);
      else reducedMotion.removeListener(cancel);
    };
  }, []);

  return null;
}
