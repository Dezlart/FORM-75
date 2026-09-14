import { expect, test } from "@playwright/test";
import { expectCleanRuntime, monitorRuntime } from "./runtimeDiagnostics";

test("initial loading leaves offscreen sound and hidden fallback stages deferred", async ({ page }) => {
  const diagnostics = monitorRuntime(page);
  const assets: string[] = [];
  page.on("request", (request) => assets.push(new URL(request.url()).pathname));
  await page.goto("/");
  await page.getByRole("button", { name: "Сменить язык" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(assets.filter((path) => path.endsWith(".mp3"))).toEqual([]);
  expect(assets.filter((path) => /story-(desktop|mobile)-[1-5]\.webp$/.test(path))).toEqual([]);
  await expect(page.getByTestId("assistant-panel")).toHaveCount(0);
  expectCleanRuntime(diagnostics);
});

test("visited GPU scenes keep their canvases, pause offscreen and stop when idle", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Hardware rendering is checked in Chromium.");
  const diagnostics = monitorRuntime(page);
  await page.goto("/?debug3d=1");
  const story = page.locator(".canvas-story");
  const configurator = page.locator(".canvas-configurator");
  await expect(story).not.toHaveAttribute("data-webgl", "checking");
  test.skip(await story.getAttribute("data-webgl") !== "available", "Hardware WebGL2 is unavailable.");
  await expect(story).toHaveAttribute("data-canvas-ready", "true", { timeout: 30_000 });
  const storyCanvas = await story.locator("canvas").elementHandle();

  await configurator.scrollIntoViewIfNeeded();
  await expect(configurator).toHaveAttribute("data-canvas-ready", "true", { timeout: 30_000 });
  await expect(story).toHaveAttribute("data-render-active", "false");
  const suspendedFrame = await story.getAttribute("data-render-frame");
  await page.getByTestId("finish-sand").click();
  await expect(page.getByTestId("finish-sand")).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(350);
  expect(await story.getAttribute("data-render-frame")).toBe(suspendedFrame);
  const configuratorCanvas = await configurator.locator("canvas").elementHandle();

  await page.getByRole("link", { name: "FORM 75", exact: true }).click();
  await expect(story).toHaveAttribute("data-render-active", "true");
  await expect(story).toHaveAttribute("data-story-rendering", "settled", { timeout: 10_000 });
  await expect(configurator).toHaveAttribute("data-render-active", "false");
  expect(await story.locator("canvas").evaluate((canvas, previous) => canvas === previous, storyCanvas)).toBe(true);
  await page.waitForTimeout(300);
  const idleFrame = await story.getAttribute("data-render-frame");
  await page.waitForTimeout(400);
  expect(await story.getAttribute("data-render-frame")).toBe(idleFrame);

  await configurator.scrollIntoViewIfNeeded();
  await expect(configurator).toHaveAttribute("data-render-active", "true");
  expect(await configurator.locator("canvas").evaluate((canvas, previous) => canvas === previous, configuratorCanvas)).toBe(true);
  await expect(page.getByTestId("finish-sand")).toHaveAttribute("aria-pressed", "true");
  expect(Number(await configurator.getAttribute("data-render-dpr"))).toBeGreaterThanOrEqual(1);
  expect(Number(await configurator.getAttribute("data-render-samples"))).toBeGreaterThan(0);
  expectCleanRuntime(diagnostics);
});

test("assistant traps keyboard focus and returns it to its trigger on close", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("assistant-open").click();
  const panel = page.getByRole("dialog");
  await expect(panel).toBeVisible();
  await expect(panel.locator("input")).toBeFocused();
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press("Tab");
    expect(await panel.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(page.getByTestId("assistant-open")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await expect(panel.locator("input")).toBeFocused();
});

test("keyboard appearance ignores system color scheme and legacy saved themes", async ({ page }, testInfo) => {
  test.skip(!["chromium", "mobile-chromium"].includes(testInfo.project.name), "Compare rendered pixels on desktop and mobile hardware WebGL.");
  const diagnostics = monitorRuntime(page);
  let reference: Buffer | undefined;
  for (const preference of [null, "light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: preference === "dark" ? "dark" : "light", reducedMotion: "reduce" });
    if (preference) await page.evaluate((theme) => {
      localStorage.setItem("form75-theme", theme);
      localStorage.setItem("form75-theme-v2", theme);
    }, preference);
    await page.goto("/?debug3d=1");
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const story = page.locator(".canvas-story");
    await expect(story).not.toHaveAttribute("data-webgl", "checking");
    test.skip(await story.getAttribute("data-webgl") !== "available", "Hardware WebGL2 is unavailable.");
    await expect(story).toHaveAttribute("data-canvas-ready", "true", { timeout: 30_000 });
    await expect(story).toHaveAttribute("data-story-rendering", "settled");
    await expect(page.locator("html")).not.toHaveClass(/dark|light/);
    // Capture after the existing preview-to-canvas fade has completed.
    await page.waitForTimeout(300);
    const rendered = await story.locator("canvas").screenshot({
      // Text entrance animations overlap this region but are not part of the model.
      style: "body * { visibility: hidden !important; } canvas { visibility: visible !important; }",
    });
    await testInfo.attach(`model-${preference ?? "fresh"}`, { body: rendered, contentType: "image/png" });
    if (reference) expect(rendered.equals(reference), `same model pixels with stored ${preference} theme`).toBe(true);
    else reference = rendered;
  }
  expectCleanRuntime(diagnostics);
});

test("retained cameras keep their framing when resizing desktop to mobile and back", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Breakpoint transitions are checked with desktop Chromium.");
  const diagnostics = monitorRuntime(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?debug3d=1");
  const story = page.locator(".canvas-story");
  const configurator = page.locator(".canvas-configurator");
  await expect(story).not.toHaveAttribute("data-webgl", "checking");
  test.skip(await story.getAttribute("data-webgl") !== "available", "Hardware WebGL2 is unavailable.");
  await expect(story).toHaveAttribute("data-canvas-ready", "true", { timeout: 30_000 });
  await expect(story).toHaveAttribute("data-camera-fov", "35");
  const storyCanvas = await story.locator("canvas").elementHandle();
  await configurator.scrollIntoViewIfNeeded();
  await expect(configurator).toHaveAttribute("data-canvas-ready", "true", { timeout: 30_000 });
  const configuratorCanvas = await configurator.locator("canvas").elementHandle();

  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1280, height: 720 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.getByRole("link", { name: "FORM 75", exact: true }).click();
    for (const { shell, previousCanvas } of [{ shell: story, previousCanvas: storyCanvas }, { shell: configurator, previousCanvas: configuratorCanvas }]) {
      await shell.scrollIntoViewIfNeeded();
      await expect(shell).toHaveAttribute("data-render-active", "true");
      if (viewport.width <= 760) await expect(shell).toHaveAttribute("data-camera-fov", "46");
      else await expect.poll(() => shell.evaluate((element) => {
        const aspect = Number(element.getAttribute("data-camera-aspect"));
        const fov = Number(element.getAttribute("data-camera-fov"));
        const minimumAspect = element.classList.contains("canvas-story") ? 1.6 : 1.1;
        // Retain the desktop vertical angle or its minimum horizontal field,
        // whichever needs more room. A stale mobile angle fails this check too.
        const visibleHalfWidth = Math.tan(fov * Math.PI / 360) * aspect;
        const requiredHalfWidth = Math.tan(35 * Math.PI / 360) * Math.max(aspect, minimumAspect);
        return Math.abs(visibleHalfWidth - requiredHalfWidth);
      })).toBeLessThan(0.001);
      await expect.poll(() => shell.evaluate((element) => {
        const bounds = element.querySelector("canvas")!.getBoundingClientRect();
        return Math.abs(Number(element.getAttribute("data-camera-aspect")) - bounds.width / bounds.height);
      })).toBeLessThan(0.001);
      expect(await shell.locator("canvas").evaluate((canvas, previous) => canvas === previous, previousCanvas)).toBe(true);
    }
  }
  expectCleanRuntime(diagnostics);
});
