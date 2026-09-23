"use client";

/* eslint-disable react-hooks/immutability -- R3F camera and light rigs are intentionally updated in useFrame. */

import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ACESFilmicToneMapping, MathUtils, Mesh, PerspectiveCamera, ShadowMaterial, SpotLight, SRGBColorSpace, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { KeyboardModel } from "./KeyboardModel";
import { SwitchModel } from "./SwitchModel";
import { advanceStoryMotion, getStorySwitchStage, isSceneDebugEnabled, registerSceneInvalidator, storyProgress, storyTargetProgress, smoothstep } from "@/lib/storyProgress";

type CanvasVariant = "story" | "configurator";
// Start at CSS resolution; AdaptiveQuality can raise it once real animation
// proves the device has headroom instead of overloading its first frame.
const mobileDpr = 1;
const desktopDpr: [number, number] = [1, 1.2];

function ResponsiveCamera({ mobile, variant }: { mobile: boolean; variant: CanvasVariant }) {
  const { camera, invalidate, size } = useThree();

  useLayoutEffect(() => {
    // Canvas initializes camera props once. Sync the retained camera when the
    // layout changes; R3F continues to manage its aspect ratio on every resize.
    if (!(camera instanceof PerspectiveCamera)) return;
    // Preserve the original composition on wide screens, and enough horizontal
    // viewing angle in portrait tablets / narrow configurator columns.
    const minimumAspect = variant === "story" ? 1.6 : 1.1;
    const aspect = size.width / Math.max(1, size.height);
    camera.fov = mobile ? 46 : MathUtils.radToDeg(2 * Math.atan(
      Math.tan(MathUtils.degToRad(35) / 2) * Math.max(1, minimumAspect / Math.max(0.1, aspect)),
    ));
    camera.updateProjectionMatrix();
    invalidate();
  }, [camera, invalidate, mobile, size.width, size.height, variant]);

  useLayoutEffect(() => {
    if (variant === "configurator") {
      if (mobile) camera.position.set(5.4, 6.2, 10.5);
      else camera.position.set(5.9, 5.3, 8.5);
    }
    invalidate();
  }, [camera, invalidate, mobile, variant]);

  return null;
}

function StoryCamera({ mobile }: { mobile: boolean }) {
  const { camera } = useThree();
  const target = useRef(new Vector3());
  const heroPosition = useRef(new Vector3());
  const wantedPosition = useRef(new Vector3());
  useFrame(() => {
    const progress = storyProgress.current;
    const design = smoothstep(0.08, 0.26, progress);
    const exploded = smoothstep(0.27, 0.58, progress);
    // Reframe only after the keyboard has begun its straight retreat. This
    // keeps the end of the Inside scene free of a sideways camera tug.
    const switchStage = getStorySwitchStage(progress);
    const returnHome = smoothstep(0.91, 0.99, progress);
    if (mobile) heroPosition.current.set(5, 7.8, 13.5);
    else heroPosition.current.set(8.2, 6.3, 11);
    wantedPosition.current.set(
      mobile ? 5 - design * 0.45 - exploded * 0.6 - switchStage * 3.2 : 8.2 - design * 0.8 - exploded - switchStage * 5,
      mobile ? 7.8 - design * 0.55 + exploded * 3.2 - switchStage * 2.2 : 6.3 - design * 0.7 + exploded * 3.8 - switchStage * 2.8,
      mobile ? 13.5 - design * 0.5 + exploded * 0.7 - switchStage * 2.3 : 11 - design * 0.5 + exploded - switchStage * 2.2,
    ).lerp(heroPosition.current, returnHome);
    camera.position.copy(wantedPosition.current);
    const stagedTargetX = (mobile ? 0.1 : 4.25) * (1 - switchStage);
    const stagedTargetY = mobile ? 1 + exploded * 0.62 - switchStage * 2.8 : -0.42 + exploded * 0.62 + switchStage * 0.55;
    target.current.set(MathUtils.lerp(stagedTargetX, mobile ? 0.1 : 4.25, returnHome), MathUtils.lerp(stagedTargetY, mobile ? 1 : -0.42, returnHome), 0);
    camera.lookAt(target.current);
    camera.updateMatrixWorld();
  }, -90);
  return null;
}

function StoryProgressController() {
  const { gl, invalidate } = useThree();
  const debug = useRef(isSceneDebugEnabled());
  const reducedMotion = useRef(false);
  const settling = useRef(false);
  const motion = useRef({ progress: storyProgress.current, velocity: 0 });

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reducedMotion.current = query.matches;
      settling.current = false;
      motion.current.velocity = 0;
      if (query.matches) storyProgress.current = storyTargetProgress.current;
      motion.current.progress = storyProgress.current;
      invalidate();
    };
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
  }, [invalidate]);

  useFrame((_, delta) => {
    const target = storyTargetProgress.current;
    const shell = debug.current ? gl.domElement.closest<HTMLElement>(".canvas-story") : null;
    if (shell) shell.dataset.storyFrame = String(gl.info.render.frame);
    if (reducedMotion.current) {
      storyProgress.current = target;
      motion.current.progress = target;
      motion.current.velocity = 0;
      if (shell) {
        shell.dataset.storyTarget = target.toFixed(5);
        shell.dataset.storyProgress = target.toFixed(5);
        shell.dataset.storyRendering = "settled";
      }
      return;
    }

    // The first demand frame includes time spent idle. Start the motion clock
    // here, then use only active frame time; never spend that idle time at once.
    const frameDelta = settling.current ? Math.min(delta, 1 / 20) : 0;
    settling.current = advanceStoryMotion(motion.current, target, frameDelta);
    storyProgress.current = motion.current.progress;
    if (shell) {
      shell.dataset.storyTarget = target.toFixed(5);
      shell.dataset.storyProgress = storyProgress.current.toFixed(5);
      shell.dataset.storyRendering = settling.current ? "active" : "settled";
    }
    if (settling.current) invalidate();
  }, -100);
  return null;
}

function ConfiguratorControls({ active }: { active: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { gl } = useThree();
  const previousAzimuth = useRef<number | null>(null);
  const accumulatedRotation = useRef(0);

  useEffect(() => {
    const canvas = gl.domElement;
    const controlSurface = controls.current?.domElement ?? canvas;
    const canvasTouchAction = canvas.style.touchAction;
    const controlTouchAction = controlSurface.style.touchAction;
    // The whole configurator canvas is the manipulation surface. Allowing
    // pan-y made diagonal finger drags scroll the document and cancel orbiting.
    canvas.style.touchAction = "none";
    controlSurface.style.touchAction = "none";
    return () => {
      canvas.style.touchAction = canvasTouchAction;
      controlSurface.style.touchAction = controlTouchAction;
    };
  }, [gl]);

  const recordRotation = () => {
    const instance = controls.current;
    if (!instance) return;
    const azimuth = instance.getAzimuthalAngle();
    const previous = previousAzimuth.current;
    if (previous !== null) {
      let delta = azimuth - previous;
      if (delta > Math.PI) delta -= Math.PI * 2;
      else if (delta < -Math.PI) delta += Math.PI * 2;
      accumulatedRotation.current += delta;
    }
    previousAzimuth.current = azimuth;
    const shell = gl.domElement.closest<HTMLElement>(".canvas-configurator");
    if (shell) {
      shell.dataset.configAzimuth = azimuth.toFixed(4);
      shell.dataset.configRotation = accumulatedRotation.current.toFixed(4);
    }
  };

  return (
    <OrbitControls
      ref={controls}
      enabled={active}
      // Keep the input surface stable if Drei updates events.connected later.
      domElement={gl.domElement}
      enablePan={false}
      enableZoom={false}
      minPolarAngle={0.75}
      maxPolarAngle={1.45}
      minAzimuthAngle={Number.NEGATIVE_INFINITY}
      maxAzimuthAngle={Number.POSITIVE_INFINITY}
      target={[0, -0.2, 0]}
      rotateSpeed={0.68}
      dampingFactor={0.08}
      enableDamping
      onChange={recordRotation}
      onStart={recordRotation}
      onEnd={recordRotation}
    />
  );
}

function ToneMapping() {
  const { gl, invalidate } = useThree();
  useEffect(() => {
    gl.toneMapping = ACESFilmicToneMapping;
    gl.outputColorSpace = SRGBColorSpace;
    gl.toneMappingExposure = 1.12;
    invalidate();
  }, [gl, invalidate]);
  return null;
}

function PerformanceProbe() {
  const { camera, gl, scene } = useThree();
  const elapsed = useRef(0);
  const frames = useRef(0);

  useEffect(() => {
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
    const shell = gl.domElement.closest<HTMLElement>(".canvas-shell");
    if (shell) {
      shell.dataset.renderCalls = String(gl.info.render.calls);
      shell.dataset.renderTriangles = String(gl.info.render.triangles);
      shell.dataset.renderFrame = String(gl.info.render.frame);
      if (camera instanceof PerspectiveCamera) {
        shell.dataset.cameraFov = String(camera.fov);
        shell.dataset.cameraAspect = camera.aspect.toFixed(5);
      }
    }
    elapsed.current += delta;
    frames.current += 1;
    if (frames.current < 6) return;
    if (shell) {
      shell.dataset.renderFps = (frames.current / elapsed.current).toFixed(1);
    }
    elapsed.current = 0;
    frames.current = 0;
  }, 2); // Read counters after PreparedRenderer's actual draw at priority 1.
  return null;
}

function AdaptiveQuality({ mobile, onDprChange }: { mobile: boolean; onDprChange: (dpr: number) => void }) {
  const { gl, setDpr } = useThree();
  const elapsed = useRef(0);
  const frames = useRef(0);
  const currentDpr = useRef(gl.getPixelRatio());
  const strongWindows = useRef(0);
  const continued = useRef(false);

  useEffect(() => {
    currentDpr.current = gl.getPixelRatio();
    elapsed.current = 0;
    frames.current = 0;
    continued.current = false;
  }, [gl, mobile]);

  useFrame((state, delta) => {
    // This subscriber follows all animation subscribers. A pending next frame
    // distinguishes continuous animation from time spent in the demand-loop idle.
    const sample = continued.current;
    continued.current = state.internal.frames > 1;
    if (!sample || delta <= 0 || delta > 0.25) {
      elapsed.current = 0;
      frames.current = 0;
      return;
    }
    elapsed.current += delta;
    frames.current += 1;
    if (frames.current < 8 || elapsed.current < 0.35) return;

    const fps = frames.current / elapsed.current;
    // Never undersample CSS pixels. MSAA plus a modest mobile resolution boost
    // smooths cap edges without changing any geometry, textures or materials.
    const minimum = 1;
    const maximum = Math.max(minimum, Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 1.2));
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
      onDprChange(nextDpr);
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
      if (reduced || duration <= 0) {
        invalidate();
        return;
      }
      renderUntil = Math.max(renderUntil, window.performance.now() + duration);
      if (!animationFrame) animationFrame = window.requestAnimationFrame(render);
    };
    const unregister = registerSceneInvalidator(variant, requestFrames);
    // Camera and switch animations invalidate themselves until settled.
    requestFrames(0);
    return () => {
      unregister();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
    };
  }, [active, invalidate, variant]);
  return null;
}

function PreparedRenderer({ onReady, onFailure }: { onReady: () => void; onFailure: () => void }) {
  const { gl, scene, camera, invalidate } = useThree();
  const compilation = useRef<"pending" | "compiling" | "ready" | "failed">("pending");
  const mounted = useRef(true);
  const reported = useRef(false);
  const animationFrame = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      window.cancelAnimationFrame(animationFrame.current);
    };
  }, []);
  useFrame(() => {
    // Run after lighting/environment setup and every pose subscriber. Owning
    // the final render prevents a synchronous first draw from waiting on GPU
    // shader compilation; keep the preview visible until an actual draw.
    if (compilation.current === "pending") {
      compilation.current = "compiling";
      void gl.compileAsync(scene, camera).then(() => {
        if (!mounted.current) return;
        compilation.current = "ready";
        invalidate();
      }).catch(() => {
        if (!mounted.current) return;
        compilation.current = "failed";
        onFailure();
      });
    }
    if (compilation.current !== "ready") return;
    gl.render(scene, camera);
    if (reported.current) return;
    reported.current = true;
    animationFrame.current = window.requestAnimationFrame(onReady);
  }, 1);
  return null;
}

function ShadowFloor({ story }: { story: boolean }) {
  const material = useRef<ShadowMaterial>(null);
  useFrame(() => {
    if (!material.current) return;
    const exploded = story ? smoothstep(0.25, 0.43, storyProgress.current) * (1 - smoothstep(0.88, 0.99, storyProgress.current)) : 0;
    material.current.opacity = 0.28 * (1 - exploded * 0.82);
  });
  return (
    <mesh position={[0, -1.28, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[28, 28]} />
      <shadowMaterial ref={material} color="#000000" transparent opacity={0.28} depthWrite={false} />
    </mesh>
  );
}

const StudioLighting = memo(function StudioLighting({ story, mobile }: { story: boolean; mobile: boolean }) {
  const key = useRef<SpotLight>(null);
  useFrame(() => {
    if (!key.current || !story) return;
    const progress = storyProgress.current;
    key.current.position.x = 6 - smoothstep(0.08, 0.45, progress) * 10;
  });
  return (
    <>
      <ambientLight intensity={0.16} />
      <hemisphereLight args={["#dbe8ef", "#111315", 0.72]} />
      <spotLight ref={key} position={[7.5, 10, 8]} angle={0.5} penumbra={0.9} intensity={72} color="#edf6fa" castShadow={!mobile} shadow-mapSize-width={512} shadow-mapSize-height={512} shadow-bias={-0.00015} />
      <spotLight position={[-7, 5.5, 6]} angle={0.62} penumbra={1} intensity={30} color="#7897aa" />
      <directionalLight position={[-5, 7, -7]} intensity={3.4} color="#8bb3ca" />
      <rectAreaLight position={[0, 8, -4]} rotation={[Math.PI / 2, 0, 0]} width={12} height={4} intensity={7} color="#dce8ef" />
      {/* Bake reflections once on every device so metal keeps the same finish. */}
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={3.4} color="#e5f1f6" position={[0, 6, 8]} rotation={[Math.PI / 2, 0, 0]} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={2.2} color="#9eb9c8" position={[-7, 2, 1]} rotation={[0, Math.PI / 2, 0]} scale={[5, 2, 1]} />
        <Lightformer form="rect" intensity={2.8} color="#d9dee1" position={[7, 1, -2]} rotation={[0, -Math.PI / 2, 0]} scale={[4, 2, 1]} />
      </Environment>
    </>
  );
});

function Scene({ variant, active, mobile, onReady, onFailure, onDprChange }: { variant: CanvasVariant; active: boolean; mobile: boolean; onReady: () => void; onFailure: () => void; onDprChange: (dpr: number) => void }) {
  return (
    <>
      <fog attach="fog" args={["#b8b8b5", 21, 34]} />
      <ToneMapping />
      <ResponsiveCamera mobile={mobile} variant={variant} />
      {variant === "story" && <StoryProgressController />}
      {isSceneDebugEnabled() && <PerformanceProbe />}
      <RenderScheduler active={active} variant={variant} />
      <PreparedRenderer onReady={onReady} onFailure={onFailure} />
      <StudioLighting story={variant === "story"} mobile={mobile} />
      <KeyboardModel variant={variant} mobile={mobile} />
      {variant === "story" && <><SwitchModel mobile={mobile} /><StoryCamera mobile={mobile} /></>}
      {variant === "configurator" && <ConfiguratorControls active={active} />}
      <ShadowFloor story={variant === "story"} />
      <AdaptiveQuality mobile={mobile} onDprChange={onDprChange} />
    </>
  );
}

export const KeyboardSceneRenderer = memo(function KeyboardSceneRenderer({ variant, active, mobile, onReady, onFailure }: {
  variant: CanvasVariant;
  active: boolean;
  mobile: boolean;
  onReady: () => void;
  onFailure: () => void;
}) {
  const [quality, setQuality] = useState<{ mobile: boolean; dpr: number | [number, number] }>(() => ({
    mobile,
    dpr: mobile ? mobileDpr : desktopDpr,
  }));
  // Canvas reapplies its DPR prop whenever it is reconfigured. Remember the
  // adapted value here so pausing, resizing and resuming cannot reset it.
  const rememberDpr = useCallback((dpr: number) => setQuality({ mobile, dpr }), [mobile]);
  const dpr = quality.mobile === mobile ? quality.dpr : (mobile ? mobileDpr : desktopDpr);

  return (
    <Canvas
      camera={{ position: variant === "story" ? (mobile ? [5, 7.8, 13.5] : [8.2, 6.3, 11]) : (mobile ? [5.4, 6.2, 10.5] : [5.9, 5.3, 8.5]), fov: mobile ? 46 : 35, near: 0.1, far: 60 }}
      dpr={dpr}
      gl={{ antialias: true, alpha: true, powerPreference: "default", failIfMajorPerformanceCaveat: true }}
      shadows={!mobile ? "soft" : false}
      frameloop={active ? "demand" : "never"}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          onFailure();
        }, { once: true });
      }}
    >
      <Scene variant={variant} active={active} mobile={mobile} onReady={onReady} onFailure={onFailure} onDprChange={rememberDpr} />
    </Canvas>
  );
});
