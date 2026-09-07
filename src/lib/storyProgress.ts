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

export const getStoryLightingIntensity = (progress: number) => {
  const hero = 1 - smoothstep(0.22, 0.31, progress);
  const exposedSwitches = 0.55 * smoothstep(0.26, 0.36, progress) * (1 - smoothstep(0.68, 0.76, progress));
  const reassembled = smoothstep(0.955, 0.995, progress);
  return Math.max(hero, exposedSwitches, reassembled);
};
