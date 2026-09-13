export const storyProgress = { current: 0 };
export const storyTargetProgress = { current: 0 };

export function isSceneDebugEnabled() {
  return process.env.NODE_ENV !== "production" || (
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug3d") === "1"
  );
}

export interface StoryMotion {
  progress: number;
  velocity: number;
}

// An analytic critically damped spring preserves velocity between discrete wheel
// targets. A first-order lerp/damp jumps velocity on every notch of the wheel.
export function advanceStoryMotion(motion: StoryMotion, target: number, delta: number) {
  const frequency = 18;
  const offset = motion.progress - target;
  const decay = Math.exp(-frequency * delta);
  const impulse = motion.velocity + frequency * offset;
  motion.progress = target + (offset + impulse * delta) * decay;
  motion.velocity = (motion.velocity - frequency * impulse * delta) * decay;
  if (motion.progress < 0 || motion.progress > 1) {
    motion.progress = Math.min(1, Math.max(0, motion.progress));
    motion.velocity = 0;
  }
  const moving = Math.abs(target - motion.progress) >= 0.00002 || Math.abs(motion.velocity) >= 0.0002;
  if (!moving) {
    motion.progress = target;
    motion.velocity = 0;
  }
  return moving;
}

export type SceneVariant = "story" | "configurator";
type SceneInvalidator = (duration?: number) => void;

const sceneInvalidators = new Map<SceneVariant, SceneInvalidator>();

export function registerSceneInvalidator(variant: SceneVariant, invalidator: SceneInvalidator) {
  sceneInvalidators.set(variant, invalidator);
  return () => {
    if (sceneInvalidators.get(variant) === invalidator) sceneInvalidators.delete(variant);
  };
}

export function requestSceneFrames(variant: SceneVariant, duration = 480) {
  sceneInvalidators.get(variant)?.(duration);
}

export const smoothstep = (min: number, max: number, value: number) => {
  const x = Math.min(1, Math.max(0, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
};

export const getStorySwitchStage = (progress: number) => (
  smoothstep(0.72, 0.8, progress) * (1 - smoothstep(0.91, 0.98, progress))
);

export const getStoryKeyboardRetreat = (progress: number) => (
  smoothstep(0.66, 0.74, progress) * (1 - smoothstep(0.91, 0.98, progress))
);

export function getStoryKeyboardPose(progress: number, mobile: boolean) {
  const explodeIn = smoothstep(0.27, 0.48, progress);
  const reassemble = smoothstep(0.9, 0.99, progress);
  const exploded = explodeIn * (1 - reassemble);
  const architecture = smoothstep(0.29, 0.38, progress) * (1 - smoothstep(0.48, 0.57, progress));
  const inside = smoothstep(0.48, 0.57, progress) * (1 - smoothstep(0.91, 0.98, progress));
  const design = smoothstep(0.1, 0.18, progress) * (1 - smoothstep(0.27, 0.32, progress));
  const hero = 1 - smoothstep(0.08, 0.16, progress);
  const reassembly = smoothstep(0.94, 0.995, progress);
  const retreat = getStoryKeyboardRetreat(progress);
  const baseX = mobile ? 0.1 : 5.2;
  const baseY = mobile ? -1.35 : -0.62;
  const baseScale = mobile ? 0.52 : 0.64;

  return {
    architecture,
    exploded,
    inside,
    retreat,
    x: baseX
      + architecture * (mobile ? 0.15 : -3.8)
      + inside * (mobile ? 0.08 : 1.65)
      + design * (mobile ? 0 : 0.35)
      + reassembly * (mobile ? 0 : 0.45),
    y: baseY - exploded * 0.72 + (
      mobile
        ? architecture * 1.2 + inside * 3.3 + design * 0.22 + reassembly * 0.3 - hero * 0.8
        : reassembly * -0.12
    ),
    z: -42 * retreat,
    scale: baseScale * (1 - architecture * 0.07),
    visible: retreat < 0.94,
  };
}

export const getStoryLightingIntensity = (progress: number) => {
  const hero = 1 - smoothstep(0.22, 0.31, progress);
  const exposedSwitches = 0.55 * smoothstep(0.26, 0.36, progress) * (1 - getStoryKeyboardRetreat(progress));
  const reassembled = smoothstep(0.955, 0.995, progress);
  return Math.max(hero, exposedSwitches, reassembled);
};
