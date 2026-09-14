import { expect, test } from "@playwright/test";
import { expectCleanRuntime, monitorRuntime } from "./runtimeDiagnostics";

async function dispatchTouchDrag(page: import("@playwright/test").Page, start: { x: number; y: number }, end: { x: number; y: number }) {
  const client = await page.context().newCDPSession(page);
  await client.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ ...start, id: 1, radiusX: 8, radiusY: 8, force: 1 }],
  });
  for (let step = 1; step <= 12; step += 1) {
    await client.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{
        x: start.x + (end.x - start.x) * step / 12,
        y: start.y + (end.y - start.y) * step / 12,
        id: 1,
        radiusX: 8,
        radiusY: 8,
        force: 1,
      }],
    });
  }
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

test("legacy Safari media-query APIs keep the WebGL fallback interactive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-safari", "Legacy Safari regression runs on the iPhone WebKit project.");
  const diagnostics = monitorRuntime(page);

  await page.addInitScript(() => {
    try { window.localStorage.clear(); } catch { /* unavailable storage is covered below */ }

    const mediaPrototype = Object.getPrototypeOf(window.matchMedia("(max-width: 700px)")) as object;
    Object.defineProperty(mediaPrototype, "addEventListener", { configurable: true, value: undefined });
    Object.defineProperty(mediaPrototype, "removeEventListener", { configurable: true, value: undefined });

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
      if (contextId === "webgl2") return null;
      return originalGetContext.call(this, contextId, ...args as []);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });

  await page.goto("/");
  await expect(page.getByTestId("webgl-fallback").first()).toBeVisible();
  await page.getByRole("button", { name: "Сменить язык" }).click();
  await expect(page.getByText("Precision in every press.")).toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  await expect(page.locator(".mobile-nav")).toBeVisible();
  await page.getByTestId("assistant-open").click();
  await expect(page.getByTestId("assistant-panel")).toBeVisible();

  expectCleanRuntime(diagnostics);
});

test("disabled Safari storage does not disable controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-safari", "Safari storage regression runs on the iPhone WebKit project.");
  const diagnostics = monitorRuntime(page);

  await page.addInitScript(() => {
    const unavailable = () => { throw new DOMException("Storage is disabled", "SecurityError"); };
    Object.defineProperties(Storage.prototype, {
      getItem: { configurable: true, value: unavailable },
      setItem: { configurable: true, value: unavailable },
      removeItem: { configurable: true, value: unavailable },
    });
  });

  await page.goto("/");
  await expect(page.locator("html")).not.toHaveClass(/dark|light/);
  await page.getByRole("button", { name: "Сменить язык" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: "Toggle theme" })).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveClass(/dark|light/);
  await page.getByTestId("assistant-open").click();
  await expect(page.getByTestId("assistant-panel")).toBeVisible();

  expectCleanRuntime(diagnostics);
});

test("mobile starts at the top with the intended defaults, switch layout and local switch audio", async ({ page, request }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-safari", "The complete mobile product-state check runs in iPhone WebKit.");
  const diagnostics = monitorRuntime(page);
  await page.goto("/");

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.getByTestId("finish-silver")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("keycaps-porcelain")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("config-switch-linear")).toHaveAttribute("aria-pressed", "true");

  await page.waitForLoadState("load");
  await page.waitForTimeout(750);
  await page.evaluate(() => window.scrollTo({ top: 1600, left: 0, behavior: "instant" }));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
  await page.reload();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  await page.locator("#switches").scrollIntoViewIfNeeded();
  const copyBox = await page.locator("#switches .story-copy").boundingBox();
  const viewport = page.viewportSize();
  expect(copyBox).not.toBeNull();
  expect(viewport).not.toBeNull();
  expect(copyBox!.y).toBeGreaterThanOrEqual(viewport!.height * 0.48);
  expect(copyBox!.y + copyBox!.height).toBeLessThanOrEqual(viewport!.height + 1);

  const audioAssets = ["/audio/switch-linear.mp3", "/audio/switch-tactile.mp3", "/audio/switch-silent.mp3"];
  for (const asset of audioAssets) {
    const response = await request.get(asset);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("audio/mpeg");
    expect((await response.body()).length).toBeGreaterThan(1_000);
  }

  await page.getByRole("button", { name: "Нажать переключатель" }).click();

  expectCleanRuntime(diagnostics);
});

test("the full mobile configurator surface rotates without scrolling the page", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Chromium CDP supplies a real touch gesture for this regression.");
  await page.goto("/?debug3d=1");
  await page.waitForLoadState("domcontentloaded");
  await page.locator("#configurator").evaluate((element) => window.scrollTo(0, (element as HTMLElement).offsetTop));

  const configurator = page.locator(".canvas-configurator");
  await expect(configurator).not.toHaveAttribute("data-webgl", "checking");
  test.skip(await configurator.getAttribute("data-webgl") !== "available", "Hardware WebGL2 is unavailable in this browser.");
  const canvas = configurator.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect(configurator).toHaveAttribute("data-canvas-ready", "true");
  // Lazy scene creation starts with the browser's 300x150 canvas. Gesture
  // coordinates must wait for R3F's ResizeObserver to apply the actual surface.
  await expect.poll(async () => (await canvas.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(540);
  await expect.poll(() => canvas.evaluate((element) => getComputedStyle(element).touchAction)).toBe("none");

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThanOrEqual(540);
  const before = await page.evaluate(() => ({
    scrollY: window.scrollY,
    rotation: Number(document.querySelector<HTMLElement>(".canvas-configurator")?.dataset.configRotation ?? 0),
  }));

  // Start well away from the rendered keyboard to cover the enlarged hit area.
  await dispatchTouchDrag(page, {
    x: box!.x + box!.width * 0.12,
    y: box!.y + box!.height * 0.3,
  }, {
    x: box!.x + box!.width * 0.34,
    y: box!.y + box!.height * 0.68,
  });
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => ({
    scrollY: window.scrollY,
    rotation: Number(document.querySelector<HTMLElement>(".canvas-configurator")?.dataset.configRotation ?? 0),
  }));

  expect(after.scrollY).toBeCloseTo(before.scrollY, 0);
  expect(Math.abs(after.rotation - before.rotation)).toBeGreaterThan(0.1);
});
