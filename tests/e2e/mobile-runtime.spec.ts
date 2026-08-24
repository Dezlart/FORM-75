import { expect, test } from "@playwright/test";
import { expectCleanRuntime, monitorRuntime } from "./runtimeDiagnostics";

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
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.getByRole("button", { name: "Сменить язык" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByTestId("assistant-open").click();
  await expect(page.getByTestId("assistant-panel")).toBeVisible();

  expectCleanRuntime(diagnostics);
});

test("mobile starts at the top with the intended defaults, switch layout and local click audio", async ({ page }, testInfo) => {
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

  const audioWasPreloaded = await page.evaluate(() => performance.getEntriesByType("resource").some((entry) => entry.name.endsWith("/audio/keyboard-click.mp3")));
  const audioResponse = audioWasPreloaded ? null : page.waitForResponse((response) => response.url().endsWith("/audio/keyboard-click.mp3"));
  await page.getByRole("button", { name: "Нажать переключатель" }).click();
  if (audioResponse) expect((await audioResponse).ok()).toBe(true);
  else expect(audioWasPreloaded).toBe(true);

  expectCleanRuntime(diagnostics);
});
