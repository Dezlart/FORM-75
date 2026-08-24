export const storyProgress = { current: 0 };

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
