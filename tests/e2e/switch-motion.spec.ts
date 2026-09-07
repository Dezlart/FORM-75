import { expect, test } from "@playwright/test";
import { advanceSwitchMotion, createSwitchMotion } from "../../src/lib/switchMotion";
import { useConfiguratorStore } from "../../src/stores/configurator";

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "The stroke state machine is independent of the rendering backend.");
  useConfiguratorStore.getState().setSwitchPressed(false);
});

test("a complete click between render frames still produces a visible stroke", () => {
  const before = useConfiguratorStore.getState();
  const motion = createSwitchMotion(before.switchPressSequence);
  before.setSwitchPressed(true);
  before.setSwitchPressed(false);
  const state = useConfiguratorStore.getState();

  expect(state.switchPressed).toBe(false);
  expect(state.switchPressSequence).toBe(before.switchPressSequence + 1);
  advanceSwitchMotion(motion, state.switchPressSequence, state.switchPressed, 1 / 60);
  expect(motion.travel).toBeGreaterThan(0.5);
  expect(motion.active).toBe(true);
  for (let frame = 0; frame < 14; frame += 1) advanceSwitchMotion(motion, state.switchPressSequence, false, 1 / 60);
  expect(motion.travel).toBe(0);
  expect(motion.active).toBe(false);
});

test("rapid retriggering retargets one stroke and leaves no release queue", () => {
  const motion = createSwitchMotion();
  for (let sequence = 1; sequence <= 40; sequence += 1) {
    advanceSwitchMotion(motion, sequence, false, 1 / 60);
    expect(motion.travel).toBeGreaterThan(0.5);
    expect(motion.travel).toBeLessThanOrEqual(1);
    advanceSwitchMotion(motion, sequence, false, 1 / 60);
  }
  for (let frame = 0; frame < 15; frame += 1) advanceSwitchMotion(motion, 40, false, 1 / 60);
  expect(motion.travel).toBe(0);
  expect(motion.active).toBe(false);
});

test("a long demand idle cannot swallow a stroke and a held press stops rendering", () => {
  const motion = createSwitchMotion();
  advanceSwitchMotion(motion, 1, true, 8);
  expect(motion.travel).toBeGreaterThan(0.8);
  expect(motion.travel).toBeLessThan(1);
  expect(motion.active).toBe(true);
  for (let frame = 0; frame < 15; frame += 1) advanceSwitchMotion(motion, 1, true, 1 / 60);
  expect(motion.travel).toBe(1);
  expect(motion.active).toBe(false);
  for (let frame = 0; frame < 15; frame += 1) advanceSwitchMotion(motion, 1, false, 1 / 60);
  expect(motion.travel).toBe(0);
  expect(motion.active).toBe(false);
});

test("clicks fifty milliseconds apart still include a return movement", () => {
  const motion = createSwitchMotion();
  for (let sequence = 1; sequence <= 12; sequence += 1) {
    advanceSwitchMotion(motion, sequence, false, 1 / 60);
    advanceSwitchMotion(motion, sequence, false, 1 / 60);
    const compressed = motion.travel;
    advanceSwitchMotion(motion, sequence, false, 1 / 60);
    expect(motion.travel).toBeLessThan(compressed * 0.6);
  }
});

test("reduced motion retains brief input feedback without interpolation or a persistent loop", () => {
  const motion = createSwitchMotion();
  advanceSwitchMotion(motion, 1, false, 1 / 60, true);
  expect(motion.travel).toBe(1);
  for (let frame = 0; frame < 4; frame += 1) advanceSwitchMotion(motion, 1, false, 1 / 60, true);
  expect(motion.travel).toBe(0);
  expect(motion.active).toBe(false);
});
