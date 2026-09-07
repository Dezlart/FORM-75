import { expect, test, type Locator, type Page } from "@playwright/test";
import { advanceStoryMotion, type StoryMotion } from "../../src/lib/storyProgress";
import { expectCleanRuntime, monitorRuntime, type RuntimeDiagnostics } from "./runtimeDiagnostics";

interface StoryFrame {
  time: number;
  frame: number;
  target: number;
  progress: number;
}

type ProbeWindow = Window & {
  __storyMotionProbe?: { frames: StoryFrame[]; request: number };
};

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Story motion invariants and desktop wheel input are covered once in Chromium.");
});

test("story motion is independent of refresh rate across target changes", () => {
  const run = (refreshRate: number) => {
    const motion: StoryMotion = { progress: 0.18, velocity: 0 };
    for (const target of [0.42, 0.25, 0.65]) {
      for (let frame = 0; frame < refreshRate / 6; frame += 1) {
        advanceStoryMotion(motion, target, 1 / refreshRate);
      }
    }
    return motion;
  };

  const reference = run(60);
  for (const refreshRate of [30, 144]) {
    const motion = run(refreshRate);
    expect(motion.progress).toBeCloseTo(reference.progress, 12);
    expect(motion.velocity).toBeCloseTo(reference.velocity, 12);
  }
});

test("story reversal preserves velocity and settles only after motion stops", () => {
  const motion: StoryMotion = { progress: 0.2, velocity: 0 };
  for (let frame = 0; frame < 4; frame += 1) advanceStoryMotion(motion, 0.7, 1 / 60);
  const beforeReversal = { ...motion };

  // Changing a target alone must not replace the current physical velocity.
  expect(advanceStoryMotion(motion, 0.05, 0)).toBe(true);
  expect(motion).toEqual(beforeReversal);
  advanceStoryMotion(motion, 0.05, 1 / 240);
  expect(motion.progress).toBeGreaterThan(beforeReversal.progress);
  expect(motion.velocity).toBeGreaterThan(0);

  let moving = true;
  let frames = 0;
  while (moving && frames < 240) {
    moving = advanceStoryMotion(motion, 0.05, 1 / 60);
    expect(motion.progress).toBeGreaterThanOrEqual(0);
    expect(motion.progress).toBeLessThanOrEqual(1);
    frames += 1;
  }
  expect(moving).toBe(false);
  expect(motion).toEqual({ progress: 0.05, velocity: 0 });

  // Crossing the target with appreciable speed is not a settled state.
  const crossing: StoryMotion = { progress: 0.4, velocity: 0.2 };
  expect(advanceStoryMotion(crossing, 0.4, 0)).toBe(true);
  expect(crossing.velocity).toBe(0.2);
});

async function startProbe(page: Page) {
  await page.evaluate(() => {
    const probeWindow = window as ProbeWindow;
    const shell = document.querySelector<HTMLElement>(".canvas-story")!;
    const probe = { frames: [] as StoryFrame[], request: 0 };
    probeWindow.__storyMotionProbe = probe;
    const sample = () => {
      const frame = Number(shell.dataset.storyFrame);
      // Count WebGL renders, not duplicate browser RAF observations while idle.
      if (probe.frames.at(-1)?.frame !== frame) {
        probe.frames.push({
          time: performance.now(),
          frame,
          target: Number(shell.dataset.storyTarget),
          progress: Number(shell.dataset.storyProgress),
        });
      }
      probe.request = requestAnimationFrame(sample);
    };
    sample();
  });
}

async function stopProbe(page: Page) {
  return page.evaluate(() => {
    const probe = (window as ProbeWindow).__storyMotionProbe!;
    cancelAnimationFrame(probe.request);
    return probe.frames;
  });
}

async function expectSettled(story: Locator) {
  await expect(story).toHaveAttribute("data-story-rendering", "settled", { timeout: 3_000 });
  const progress = await story.getAttribute("data-story-progress");
  await expect(story).toHaveAttribute("data-story-target", progress!);
}

async function expectRenderStopped(page: Page, story: Locator) {
  await expectSettled(story);
  await page.waitForTimeout(100);
  const frame = await story.getAttribute("data-story-frame");
  await page.waitForTimeout(320);
  await expect(story).toHaveAttribute("data-story-frame", frame!);
}

test.describe("hardware wheel regression", () => {
  const diagnosticsByPage = new WeakMap<Page, RuntimeDiagnostics>();

  test.beforeEach(async ({ page }) => {
    diagnosticsByPage.set(page, monitorRuntime(page));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto("/?debug3d=1");
    const story = page.locator(".canvas-story");
    await expect(story).not.toHaveAttribute("data-webgl", "checking");
    test.skip(await story.getAttribute("data-webgl") !== "available", "Hardware WebGL2 is unavailable in this browser.");
    await expect(story.locator("canvas")).toBeVisible();
    await expectSettled(story);
    // Let the initial finite lighting/render scheduler finish before testing idle.
    await page.waitForTimeout(1_100);
  });

  test.afterEach(async ({ page }) => {
    const diagnostics = diagnosticsByPage.get(page);
    if (diagnostics) expectCleanRuntime(diagnostics);
  });

  test("an isolated small wheel tick accelerates after idle and finishes exactly", async ({ page }, testInfo) => {
    const story = page.locator(".canvas-story");
    const baseline = Number(await story.getAttribute("data-story-progress"));
    await startProbe(page);
    await page.mouse.wheel(0, 36);
    await expect.poll(async () => Number(await story.getAttribute("data-story-target"))).toBeGreaterThan(baseline + 0.001);
    await expectSettled(story);
    const frames = await stopProbe(page);
    await testInfo.attach("small-wheel-rendered-frames", { body: JSON.stringify(frames), contentType: "application/json" });

    const targetFrame = frames.find((frame) => frame.target > baseline + 0.0001);
    expect(targetFrame).toBeDefined();
    // Idle wall time cannot advance the first demand frame or cause a jump.
    expect(targetFrame!.progress).toBe(baseline);
    const velocities = frames.slice(1).flatMap((frame, index) => {
      const previous = frames[index];
      const movement = frame.progress - previous.progress;
      return movement > 0.00001 && frame.time > previous.time
        ? [movement / (frame.time - previous.time)]
        : [];
    });
    expect(velocities.length).toBeGreaterThan(8);
    // First-order damping starts at maximum speed; a physical response accelerates.
    expect(Math.max(...velocities.slice(1))).toBeGreaterThan(velocities[0] * 1.3);
    for (let index = 1; index < frames.length; index += 1) {
      expect(frames[index].progress).toBeGreaterThanOrEqual(frames[index - 1].progress);
    }
    await expectRenderStopped(page, story);
  });

  test("discrete wheel ticks keep rendering between events and reverse cleanly", async ({ page }, testInfo) => {
    const story = page.locator(".canvas-story");
    await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
    await expect.poll(async () => Number(await story.getAttribute("data-story-target"))).toBeGreaterThan(0.05);
    await expectSettled(story);
    await page.waitForTimeout(400);
    await startProbe(page);

    for (let tick = 0; tick < 5; tick += 1) {
      await page.mouse.wheel(0, 120);
      await page.waitForTimeout(180);
    }
    await page.mouse.wheel(0, -240);
    await page.waitForTimeout(120);
    await page.mouse.wheel(0, -120);
    await expect.poll(async () => {
      const progress = Number(await story.getAttribute("data-story-progress"));
      const target = Number(await story.getAttribute("data-story-target"));
      return progress - target;
    }).toBeGreaterThan(0.001);
    await expectSettled(story);
    const frames = await stopProbe(page);
    await testInfo.attach("ticks-and-reversal-rendered-frames", { body: JSON.stringify(frames), contentType: "application/json" });

    const targetChanges = frames.slice(1).filter((frame, index) => Math.abs(frame.target - frames[index].target) > 0.001);
    expect(targetChanges.length).toBeGreaterThanOrEqual(7);
    const interpolatedFrames = frames.slice(1).filter((frame, index) => (
      frame.target === frames[index].target && Math.abs(frame.progress - frames[index].progress) > 0.00001
    ));
    expect(interpolatedFrames.length).toBeGreaterThan(20);
    const peak = Math.max(...frames.map((frame) => frame.progress));
    expect(peak - frames.at(-1)!.progress).toBeGreaterThan(0.01);
    const directions = frames.slice(1).flatMap((frame, index) => {
      const movement = frame.progress - frames[index].progress;
      return Math.abs(movement) > 0.00001 ? [Math.sign(movement)] : [];
    });
    const directionChanges = directions.slice(1).filter((direction, index) => direction !== directions[index]);
    expect(directionChanges).toEqual([-1]);
    await expectRenderStopped(page, story);
  });
});
