export const storyProgress = { current: 0 };
export const storyTargetProgress = { current: 0 };

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
  const reassembled = smoothstep(0.955, 0.995, progress);
  return Math.max(hero, reassembled);
};
