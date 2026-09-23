"use client";

import dynamic from "next/dynamic";
import { Component, memo, startTransition, useCallback, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { KeyboardFallback } from "./KeyboardFallback";
import { useLocale } from "@/components/providers/LocaleProvider";

const KeyboardSceneRenderer = dynamic(() => import("./KeyboardSceneRenderer").then((module) => module.KeyboardSceneRenderer), { ssr: false });

type CanvasVariant = "story" | "configurator";
type WebGLState = "checking" | "available" | "unavailable";

let cachedWebGL2Support: boolean | undefined;

class WebGLBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    this.props.onFailure();
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function supportsWebGL2() {
  if (cachedWebGL2Support !== undefined) return cachedWebGL2Support;
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      failIfMajorPerformanceCaveat: true,
      powerPreference: "default",
    });
    if (!context) {
      cachedWebGL2Support = false;
      return cachedWebGL2Support;
    }
    const rendererInfo = context.getExtension("WEBGL_debug_renderer_info");
    const renderer = String(context.getParameter(rendererInfo?.UNMASKED_RENDERER_WEBGL ?? context.RENDERER));
    cachedWebGL2Support = !/swiftshader|llvmpipe|software/i.test(renderer);
    context.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    cachedWebGL2Support = false;
  }
  return cachedWebGL2Support;
}

export const KeyboardCanvas = memo(function KeyboardCanvas({ variant, label, fallbackStage = 0 }: { variant: CanvasVariant; label: string; fallbackStage?: number }) {
  const { dictionary: t } = useLocale();
  const shell = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(false);
  const [active, setActive] = useState(variant === "story");
  const [activated, setActivated] = useState(variant === "story");
  const [foreground, setForeground] = useState(true);
  const [webGLState, setWebGLState] = useState<WebGLState>("checking");
  const [canvasReady, setCanvasReady] = useState(false);
  const [fallbackCovered, setFallbackCovered] = useState(false);
  const reportReady = useCallback(() => setCanvasReady(true), []);
  const reportFailure = useCallback(() => {
    setCanvasReady(false);
    setFallbackCovered(false);
    setWebGLState("unavailable");
  }, []);
  useEffect(() => {
    if (!canvasReady) return;
    // Keep the already loaded preview underneath the existing 220ms crossfade.
    // Removing it at the first frame makes the model briefly disappear.
    const timeout = window.setTimeout(() => setFallbackCovered(true), 250);
    return () => window.clearTimeout(timeout);
  }, [canvasReady]);
  useEffect(() => {
    if (!activated || !foreground || webGLState !== "checking") return;
    let frame = 0;
    let idle = 0;
    let timeout = 0;
    const check = () => {
      const supported = supportsWebGL2();
      startTransition(() => setWebGLState(supported ? "available" : "unavailable"));
    };
    const schedule = () => {
      // Let the HTML, fonts and preview paint before probing the GPU or loading
      // Three.js. Offscreen configurators never probe during initial loading.
      frame = window.requestAnimationFrame(() => {
        frame = window.requestAnimationFrame(() => {
          if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(check, { timeout: 1500 });
          else timeout = window.setTimeout(check, 0);
        });
      });
    };
    if (document.readyState === "complete") schedule();
    else window.addEventListener("load", schedule, { once: true });
    return () => {
      window.removeEventListener("load", schedule);
      window.cancelAnimationFrame(frame);
      if (idle) window.cancelIdleCallback(idle);
      window.clearTimeout(timeout);
    };
  }, [activated, foreground, webGLState]);
  useEffect(() => {
    const update = () => setForeground(!document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    // Match the CSS story layout so tablets never place the switch behind copy.
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setMobile(query.matches);
    update();
    const legacyQuery = query as MediaQueryList & {
      addListener?: (listener: (event: MediaQueryListEvent) => void) => void;
      removeListener?: (listener: (event: MediaQueryListEvent) => void) => void;
    };
    if (typeof query.addEventListener === "function") query.addEventListener("change", update);
    else legacyQuery.addListener?.(update);
    return () => {
      if (typeof query.removeEventListener === "function") query.removeEventListener("change", update);
      else legacyQuery.removeListener?.(update);
    };
  }, []);
  useEffect(() => {
    const element = shell.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setActivated(true);
      setActive(entry.isIntersecting);
    }, { rootMargin: variant === "configurator" ? "35% 0px" : "0px", threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [variant]);
  const unavailable = webGLState === "unavailable";
  // Keep GPU resources after first use. Returning to a scene should not rebuild
  // its renderer and compile every material again; its frame loop is suspended.
  const render3D = webGLState === "available" && activated;
  const rendering = active && foreground;

  return (
    <div
      ref={shell}
      className={`canvas-shell canvas-${variant}`}
      role="img"
      aria-label={unavailable ? `${label}. ${t.a11y.webglFallback}` : label}
      data-webgl={webGLState}
      data-canvas-ready={canvasReady}
      data-render-active={rendering}
    >
      <KeyboardFallback variant={variant} note={t.a11y.webglFallback} unavailable={unavailable} stage={fallbackStage} ready={fallbackCovered} />
      {render3D && (
        <WebGLBoundary
          fallback={null}
          onFailure={reportFailure}
        >
          <div className={`canvas-live${canvasReady ? " is-ready" : ""}`}>
            <KeyboardSceneRenderer variant={variant} active={rendering} mobile={mobile} onReady={reportReady} onFailure={reportFailure} />
          </div>
        </WebGLBoundary>
      )}
    </div>
  );
});
