import { expect, test, type Page } from "@playwright/test";
import { expectCleanRuntime, monitorRuntime, type RuntimeDiagnostics } from "./runtimeDiagnostics";

interface ScrollFrame {
  time: number;
  y: number;
}

type ProbeWindow = Window & {
  __wheelScrollProbe?: { frames: ScrollFrame[]; request: number };
  __wheelReversalStart?: number;
};

// The page must smooth physical wheel steps even when Chrome does not.
test.use({ launchOptions: { args: ["--disable-smooth-scrolling"] } });

const diagnosticsByPage = new WeakMap<Page, RuntimeDiagnostics>();

test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "These regressions exercise desktop mouse-wheel scrolling.");
});

test.beforeEach(async ({ page }) => {
  diagnosticsByPage.set(page, monitorRuntime(page));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  // A successful React interaction also establishes that client effects ran.
  await page.getByTestId("assistant-open").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByTestId("assistant-close").click();
  await page.mouse.move(700, 450);
  await expectAt(page, 0);
});

test.afterEach(async ({ page }) => {
  const diagnostics = diagnosticsByPage.get(page);
  if (diagnostics) expectCleanRuntime(diagnostics);
});

async function expectAt(page: Page, y: number) {
  await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - y)).toBeLessThanOrEqual(1);
}

async function expectStopped(page: Page, y: number) {
  await expectAt(page, y);
  await page.waitForTimeout(500);
  expect(Math.abs(await page.evaluate(() => window.scrollY) - y)).toBeLessThanOrEqual(1);
}

async function startProbe(page: Page) {
  await page.evaluate(() => {
    const probe = { frames: [] as ScrollFrame[], request: 0 };
    (window as ProbeWindow).__wheelScrollProbe = probe;
    const sample = () => {
      probe.frames.push({ time: performance.now(), y: window.scrollY });
      probe.request = requestAnimationFrame(sample);
    };
    sample();
  });
}

async function stopProbe(page: Page) {
  return page.evaluate(() => {
    const probe = (window as ProbeWindow).__wheelScrollProbe!;
    cancelAnimationFrame(probe.request);
    delete (window as ProbeWindow).__wheelScrollProbe;
    return probe.frames;
  });
}

test("one wheel notch moves the document through intermediate frames with native smoothing disabled", async ({ page }, testInfo) => {
  await startProbe(page);
  await page.mouse.wheel(0, 120);
  await expectStopped(page, 120);
  const frames = await stopProbe(page);
  await testInfo.attach("document-wheel-frames", { body: JSON.stringify(frames), contentType: "application/json" });

  const intermediatePositions = new Set(frames.filter(({ y }) => y > 0 && y < 120).map(({ y }) => y));
  expect(intermediatePositions.size).toBeGreaterThan(8);
  for (let index = 1; index < frames.length; index += 1) {
    expect(frames[index].y).toBeGreaterThanOrEqual(frames[index - 1].y);
    expect(frames[index].y).toBeLessThanOrEqual(120);
  }
});

test("small ticks accumulate, reverse once, and yield to an external scroll position", async ({ page }, testInfo) => {
  await page.evaluate(() => window.scrollTo({ top: 600, behavior: "instant" }));
  await expectAt(page, 600);
  await startProbe(page);
  for (let tick = 0; tick < 3; tick += 1) {
    await page.mouse.wheel(0, 36);
    await page.waitForTimeout(60);
  }
  await expectAt(page, 708);
  await page.mouse.wheel(0, 120);
  await page.waitForTimeout(40);
  await page.evaluate(() => {
    window.addEventListener("wheel", () => {
      (window as ProbeWindow).__wheelReversalStart = window.scrollY;
    }, { once: true, passive: true, capture: true });
  });
  await page.mouse.wheel(0, -120);
  // Reversing discards the previous direction's remaining travel so the page
  // responds immediately, rather than continuing toward the old destination.
  const reversalStart = await page.evaluate(() => (window as ProbeWindow).__wheelReversalStart!);
  await expectStopped(page, reversalStart - 120);
  const frames = await stopProbe(page);
  await testInfo.attach("document-ticks-and-reversal", { body: JSON.stringify(frames), contentType: "application/json" });

  expect(Math.max(...frames.map(({ y }) => y))).toBeGreaterThan(708);
  const directions = frames.slice(1).flatMap((frame, index) => {
    const difference = frame.y - frames[index].y;
    return difference === 0 ? [] : [Math.sign(difference)];
  });
  expect(directions.slice(1).filter((direction, index) => direction !== directions[index])).toEqual([-1]);

  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(40);
  await page.evaluate(() => window.scrollTo({ top: 1200, behavior: "instant" }));
  await expectStopped(page, 1200);
});

test("keyboard and anchor navigation interrupt pending wheel motion", async ({ page }) => {
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(40);
  await page.keyboard.press("Home");
  await expectStopped(page, 0);

  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(40);
  await page.getByRole("navigation", { name: "Primary navigation", exact: true }).locator('a[href="#inside"]').click();
  await expect(page).toHaveURL(/#inside$/);
  await expect(page.locator("#inside")).toBeInViewport();
  const anchorY = await page.locator("#inside").evaluate((element) => element.getBoundingClientRect().top + window.scrollY);
  await expectStopped(page, anchorY);
});

test("live reduced motion stops inertia and restores native wheel behavior", async ({ page }) => {
  await page.mouse.wheel(0, 240);
  await page.waitForTimeout(40);
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Allow the media-query change to reach client listeners before measuring.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const reducedY = await page.evaluate(() => window.scrollY);
  await expectStopped(page, reducedY);

  await startProbe(page);
  await page.mouse.wheel(0, 120);
  await expectStopped(page, reducedY + 120);
  const nativeFrames = await stopProbe(page);
  expect(new Set(nativeFrames.map(({ y }) => y)).size).toBeLessThanOrEqual(3);

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  const before = await page.evaluate(() => window.scrollY);
  await startProbe(page);
  await page.mouse.wheel(0, 120);
  await expectStopped(page, before + 120);
  const smoothedFrames = await stopProbe(page);
  expect(new Set(smoothedFrames.filter(({ y }) => y > before && y < before + 120).map(({ y }) => y)).size).toBeGreaterThan(8);
});

test("chat scroll stays native and never moves the page at either boundary", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("form75-chat-v1", JSON.stringify(Array.from({ length: 20 }, (_, index) => ({
      id: `wheel-history-${index}`,
      role: index % 2 === 0 ? "user" : "assistant",
      content: `Scroll history ${index}. ${"A saved conversation provides enough content to scroll. ".repeat(8)}`,
    }))));
  });
  await page.reload();
  await page.getByTestId("assistant-open").click();
  const conversation = page.getByRole("dialog").locator('[aria-live="polite"]');
  await expect(conversation).toBeVisible();
  await expect.poll(() => conversation.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(500);
  await page.evaluate(() => window.scrollTo({ top: 800, behavior: "instant" }));
  await expectAt(page, 800);
  await conversation.evaluate((element) => element.scrollTo({ top: 0, behavior: "instant" }));
  await conversation.hover();
  await page.mouse.wheel(0, 240);
  await expect.poll(() => conversation.evaluate((element) => element.scrollTop)).toBeGreaterThan(150);
  await expectStopped(page, 800);

  await conversation.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "instant" }));
  await page.mouse.wheel(0, 240);
  await expectStopped(page, 800);
  await conversation.evaluate((element) => element.scrollTo({ top: 0, behavior: "instant" }));
  await page.mouse.wheel(0, -240);
  await expectStopped(page, 800);
  expect(await conversation.evaluate((element) => element.scrollTop)).toBe(0);
});
