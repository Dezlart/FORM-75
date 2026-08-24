"use client";

/* eslint-disable react-hooks/immutability -- R3F camera and light rigs are intentionally updated in useFrame. */

import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTheme } from "next-themes";
import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { ACESFilmicToneMapping, MathUtils, Mesh, ShadowMaterial, SpotLight, SRGBColorSpace, Vector3 } from "three";
import { KeyboardModel } from "./KeyboardModel";
import { KeyboardFallback } from "./KeyboardFallback";
import { SwitchModel } from "./SwitchModel";
import { useLocale } from "@/components/providers/LocaleProvider";
import { registerSceneInvalidator, requestSceneFrames, storyProgress, smoothstep } from "@/lib/storyProgress";

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

function StoryCamera({ mobile }: { mobile: boolean }) {
  const { camera } = useThree();
  const target = useRef(new Vector3());
  const heroPosition = useRef(new Vector3());
  const wantedPosition = useRef(new Vector3());
  useFrame((_, delta) => {
    const progress = storyProgress.current;
    const design = smoothstep(0.08, 0.26, progress);
    const exploded = smoothstep(0.27, 0.58, progress);
    const switchStage = smoothstep(0.68, 0.76, progress) * (1 - smoothstep(0.91, 0.98, progress));
    const returnHome = smoothstep(0.91, 0.99, progress);
    if (mobile) heroPosition.current.set(5, 7.8, 13.5);
    else heroPosition.current.set(8.2, 6.3, 11);
    wantedPosition.current.set(
      mobile ? 5 - design * 0.45 - exploded * 0.6 - switchStage * 3.2 : 8.2 - design * 0.8 - exploded - switchStage * 5,
      mobile ? 7.8 - design * 0.55 + exploded * 3.2 - switchStage * 2.2 : 6.3 - design * 0.7 + exploded * 3.8 - switchStage * 2.8,
      mobile ? 13.5 - design * 0.5 + exploded * 0.7 - switchStage * 2.3 : 11 - design * 0.5 + exploded - switchStage * 2.2,
    ).lerp(heroPosition.current, returnHome);
    const wanted = wantedPosition.current;
    camera.position.x = MathUtils.damp(camera.position.x, wanted.x, 4, delta);
    camera.position.y = MathUtils.damp(camera.position.y, wanted.y, 4, delta);
    camera.position.z = MathUtils.damp(camera.position.z, wanted.z, 4, delta);
    const stagedTargetX = (mobile ? 0.1 : 4.25) * (1 - switchStage);
    const stagedTargetY = mobile ? 1 + exploded * 0.62 - switchStage * 2.8 : -0.42 + exploded * 0.62 + switchStage * 0.55;
    target.current.set(MathUtils.lerp(stagedTargetX, mobile ? 0.1 : 4.25, returnHome), MathUtils.lerp(stagedTargetY, mobile ? 1 : -0.42, returnHome), 0);
    camera.lookAt(target.current);
  });
  return null;
}

function ToneMapping({ dark }: { dark: boolean }) {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    gl.toneMapping = ACESFilmicToneMapping;
    gl.outputColorSpace = SRGBColorSpace;
    gl.toneMappingExposure = dark ? 1.12 : 1.02;
    invalidate();
  }, [dark, gl, invalidate]);
  return null;
}

function PerformanceProbe() {
  const { gl, scene } = useThree();
  const elapsed = useRef(0);
  const frames = useRef(0);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const shell = gl.domElement.closest<HTMLElement>(".canvas-shell");
    if (!shell) return;
    const geometries = new Set();
    const materials = new Set();
    let meshes = 0;
    let lights = 0;
    let objects = 0;
    scene.traverse((object) => {
      objects += 1;
      if (object instanceof Mesh) {
        meshes += 1;
        geometries.add(object.geometry);
        const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
        meshMaterials.forEach((material) => materials.add(material));
      }
      if (object.type.endsWith("Light")) lights += 1;
    });
    shell.dataset.renderObjects = String(objects);
    shell.dataset.renderMeshes = String(meshes);
    shell.dataset.renderGeometries = String(geometries.size);
    shell.dataset.renderMaterials = String(materials.size);
    shell.dataset.renderLights = String(lights);
    shell.dataset.renderDpr = gl.getPixelRatio().toFixed(2);
    const context = gl.getContext();
    shell.dataset.renderSamples = String(context.getParameter(context.SAMPLES));
  }, [gl, scene]);

  useFrame((_, delta) => {
    if (process.env.NODE_ENV === "production") return;
    const shell = gl.domElement.closest<HTMLElement>(".canvas-shell");
    if (shell) {
      shell.dataset.renderCalls = String(gl.info.render.calls);
      shell.dataset.renderTriangles = String(gl.info.render.triangles);
    }
    elapsed.current += delta;
    frames.current += 1;
    if (frames.current < 6) return;
    if (shell) {
      shell.dataset.renderFps = (frames.current / elapsed.current).toFixed(1);
    }
    elapsed.current = 0;
    frames.current = 0;
  });
  return null;
}

function AdaptiveQuality({ mobile }: { mobile: boolean }) {
  const { gl, setDpr } = useThree();
  const elapsed = useRef(0);
  const frames = useRef(0);
  const currentDpr = useRef(gl.getPixelRatio());
  const strongWindows = useRef(0);

  useFrame((_, delta) => {
    if (delta <= 0 || delta > 0.1) return;
    elapsed.current += delta;
    frames.current += 1;
    if (frames.current < 36) return;

    const fps = frames.current / elapsed.current;
    const minimum = mobile ? 0.82 : 0.9;
    const maximum = mobile ? 1 : 1.2;
    let nextDpr = currentDpr.current;
    if (fps < (mobile ? 46 : 48)) {
      nextDpr = Math.max(minimum, nextDpr - 0.08);
      strongWindows.current = 0;
    } else if (fps > 57) {
      strongWindows.current += 1;
      if (strongWindows.current >= 2) nextDpr = Math.min(maximum, nextDpr + 0.05);
    } else {
      strongWindows.current = 0;
    }

    if (Math.abs(nextDpr - currentDpr.current) >= 0.025) {
      currentDpr.current = nextDpr;
      setDpr(nextDpr);
      const shell = gl.domElement.closest<HTMLElement>(".canvas-shell");
      if (shell) shell.dataset.renderDpr = nextDpr.toFixed(2);
    }
    elapsed.current = 0;
    frames.current = 0;
  });
  return null;
}

function RenderScheduler({ active, variant }: { active: boolean; variant: CanvasVariant }) {
  const { invalidate } = useThree();
  useEffect(() => {
    if (!active) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let animationFrame = 0;
    let renderUntil = 0;
    const render = (time: number) => {
      invalidate();
      animationFrame = time < renderUntil ? window.requestAnimationFrame(render) : 0;
    };
    const requestFrames = (duration = 480) => {
      if (reduced) {
        invalidate();
        return;
      }
      renderUntil = Math.max(renderUntil, window.performance.now() + duration);
      if (!animationFrame) animationFrame = window.requestAnimationFrame(render);
    };
    const unregister = registerSceneInvalidator(variant, requestFrames);
    requestFrames(900);
    return () => {
      unregister();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [active, invalidate, variant]);
  return null;
}

function ShadowFloor({ dark, story }: { dark: boolean; story: boolean }) {
  const material = useRef<ShadowMaterial>(null);
  useFrame(() => {
    if (!material.current) return;
    const exploded = story ? smoothstep(0.25, 0.43, storyProgress.current) * (1 - smoothstep(0.88, 0.99, storyProgress.current)) : 0;
    material.current.opacity = (dark ? 0.28 : 0.16) * (1 - exploded * 0.82);
  });
  return (
    <mesh position={[0, -1.28, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[28, 28]} />
      <shadowMaterial ref={material} color={dark ? "#000000" : "#4d4942"} transparent opacity={dark ? 0.28 : 0.16} depthWrite={false} />
    </mesh>
  );
}

function StudioLighting({ dark, story, active, mobile }: { dark: boolean; story: boolean; active: boolean; mobile: boolean }) {
  const key = useRef<SpotLight>(null);
  useFrame(() => {
    if (!key.current || !story) return;
    const progress = storyProgress.current;
    key.current.position.x = 6 - smoothstep(0.08, 0.45, progress) * 10;
  });
  return (
    <>
      <ambientLight intensity={dark ? 0.16 : 0.24} />
      <hemisphereLight args={[dark ? "#dbe8ef" : "#fff8e9", dark ? "#111315" : "#b8b1a4", dark ? 0.72 : 0.82]} />
      <spotLight ref={key} position={[7.5, 10, 8]} angle={0.5} penumbra={0.9} intensity={dark ? 72 : 58} color={dark ? "#edf6fa" : "#fffdf7"} castShadow={!mobile} shadow-mapSize-width={512} shadow-mapSize-height={512} shadow-bias={-0.00015} />
      {!mobile && <spotLight position={[-7, 5.5, 6]} angle={0.62} penumbra={1} intensity={dark ? 30 : 22} color={dark ? "#7897aa" : "#d8c5aa"} />}
      <directionalLight position={[-5, 7, -7]} intensity={dark ? 3.4 : 2.2} color={dark ? "#8bb3ca" : "#e8edf0"} />
      {!mobile && <rectAreaLight position={[0, 8, -4]} rotation={[Math.PI / 2, 0, 0]} width={12} height={4} intensity={dark ? 7 : 5} color={dark ? "#dce8ef" : "#fff3dc"} />}
      {active && !mobile && <Environment resolution={64}>
        <Lightformer form="rect" intensity={dark ? 3.4 : 2.5} color={dark ? "#e5f1f6" : "#fff3dd"} position={[0, 6, 8]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={dark ? 2.2 : 1.7} color="#9eb9c8" position={[-7, 2, 1]} rotation={[0, Math.PI / 2, 0]} scale={[5, 2, 1]} />
        <Lightformer form="rect" intensity={dark ? 2.8 : 2} color="#d9dee1" position={[7, 1, -2]} rotation={[0, -Math.PI / 2, 0]} scale={[4, 2, 1]} />
      </Environment>}
    </>
  );
}

function Scene({ variant, dark, active, mobile }: { variant: CanvasVariant; dark: boolean; active: boolean; mobile: boolean }) {
  return (
    <>
      <color attach="background" args={[dark ? "#181a1c" : "#f3f4f2"]} />
      <fog attach="fog" args={[dark ? "#181a1c" : "#f3f4f2", 21, 34]} />
      <ToneMapping dark={dark} />
      {process.env.NODE_ENV !== "production" && <PerformanceProbe />}
      <AdaptiveQuality mobile={mobile} />
      <RenderScheduler active={active} variant={variant} />
      <StudioLighting dark={dark} story={variant === "story"} active={active} mobile={mobile} />
      <KeyboardModel variant={variant} dark={dark} mobile={mobile} />
      {variant === "story" && <><SwitchModel mobile={mobile} /><StoryCamera mobile={mobile} /></>}
      {variant === "configurator" && (
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          minPolarAngle={0.75}
          maxPolarAngle={1.45}
          minAzimuthAngle={-0.8}
          maxAzimuthAngle={0.9}
          target={[0, -0.2, 0]}
          dampingFactor={0.08}
          enableDamping
          onStart={() => requestSceneFrames("configurator", 1200)}
          onEnd={() => requestSceneFrames("configurator", 650)}
        />
      )}
      {active && <ShadowFloor dark={dark} story={variant === "story"} />}
    </>
  );
}

export function KeyboardCanvas({ variant, label }: { variant: CanvasVariant; label: string }) {
  const { resolvedTheme } = useTheme();
  const { dictionary: t } = useLocale();
  const shell = useRef<HTMLDivElement>(null);
  const [mobile, setMobile] = useState(false);
  const [active, setActive] = useState(variant === "story");
  const [webGLState, setWebGLState] = useState<WebGLState>("checking");
  const intentionallyInactive = useRef(variant !== "story");
  useEffect(() => {
    const timeout = window.setTimeout(() => setWebGLState(supportsWebGL2() ? "available" : "unavailable"), 0);
    return () => window.clearTimeout(timeout);
  }, []);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 700px)");
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
      intentionallyInactive.current = !entry.isIntersecting;
      setActive(entry.isIntersecting);
    }, { rootMargin: variant === "configurator" ? "100% 0px" : "35% 0px", threshold: 0 });
    observer.observe(element);
    return () => observer.disconnect();
  }, [variant]);
  const dark = resolvedTheme === "dark";
  const unavailable = webGLState === "unavailable";
  const render3D = webGLState === "available" && active;

  return (
    <div
      ref={shell}
      className={`canvas-shell canvas-${variant}`}
      role="img"
      aria-label={unavailable ? `${label}. ${t.a11y.webglFallback}` : label}
      data-webgl={webGLState}
      onPointerDown={() => variant === "configurator" && requestSceneFrames("configurator", 1200)}
      onPointerUp={() => variant === "configurator" && requestSceneFrames("configurator", 650)}
    >
      {!render3D ? (
        <KeyboardFallback variant={variant} note={t.a11y.webglFallback} unavailable={unavailable} />
      ) : (
        <WebGLBoundary
          fallback={<KeyboardFallback variant={variant} note={t.a11y.webglFallback} unavailable />}
          onFailure={() => setWebGLState("unavailable")}
        >
          <Canvas
            camera={{ position: variant === "story" ? (mobile ? [5, 7.8, 13.5] : [8.2, 6.3, 11]) : (mobile ? [5.4, 6.2, 10.5] : [5.9, 5.3, 8.5]), fov: mobile ? 46 : 35, near: 0.1, far: 60 }}
            dpr={mobile ? [0.82, 1] : [0.9, 1.2]}
            gl={{ antialias: true, alpha: false, powerPreference: "default", failIfMajorPerformanceCaveat: true }}
            shadows={!mobile ? "soft" : false}
            frameloop="demand"
            performance={{ min: 0.55 }}
            onCreated={({ gl }) => {
              gl.domElement.addEventListener("webglcontextlost", (event) => {
                if (intentionallyInactive.current) return;
                event.preventDefault();
                setWebGLState("unavailable");
              }, { once: true });
            }}
          >
            <Scene variant={variant} dark={dark} active={active} mobile={mobile} />
          </Canvas>
        </WebGLBoundary>
      )}
    </div>
  );
}
