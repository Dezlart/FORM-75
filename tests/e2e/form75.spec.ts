import { expect, test, type Page } from "@playwright/test";
import { expectCleanRuntime, monitorRuntime, type RuntimeDiagnostics } from "./runtimeDiagnostics";

const runtimeByPage = new WeakMap<Page, RuntimeDiagnostics>();
const domClick = (page: Page, selector: string) => page.locator(selector).click();

test.beforeEach(async ({ page }) => {
  runtimeByPage.set(page, monitorRuntime(page));
  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
      window.localStorage.setItem("form75-theme", "dark");
    } catch {
      // Storage availability is covered separately; it must not block navigation.
    }
  });
  await page.goto("/");
});

test.afterEach(async ({ page }) => {
  const diagnostics = runtimeByPage.get(page);
  if (diagnostics) expectCleanRuntime(diagnostics);
});

test("homepage hydrates and navigation anchors work", async ({ page }, testInfo) => {
  await expect(page).toHaveTitle(/FORM 75/);
  await expect(page.locator("h1")).toHaveText("FORM 75");
  await expect(page.getByText("Точность в каждом нажатии.")).toBeVisible();
  if (testInfo.project.name.startsWith("mobile")) {
    await page.getByRole("button", { name: "Открыть меню" }).click();
    await expect(page.locator(".mobile-nav")).toBeVisible();
  }
  const navigation = testInfo.project.name.startsWith("mobile") ? page.locator(".mobile-nav") : page.locator(".desktop-nav");
  await navigation.locator('a[href="#connectivity"]').click();
  await expect(page.locator("#connectivity")).toBeInViewport();
});

test("locale, localized chat trigger and theme cycle through both states", async ({ page }) => {
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(page.getByTestId("assistant-open")).toHaveAttribute("aria-label", "Открыть FORM AI");
  const language = page.getByRole("button", { name: "Сменить язык" });
  await language.click();
  await expect(page.getByText("Precision in every press.")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("assistant-open")).toHaveAttribute("aria-label", "Open FORM AI");
  await page.getByRole("button", { name: "Change language" }).click();
  await expect(page.getByText("Точность в каждом нажатии.")).toBeVisible();
  const theme = page.getByRole("button", { name: "Переключить тему" });
  await theme.click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await theme.click();
  await expect(page.locator("html")).toHaveClass(/light/);
});

test("falls back cleanly when WebGL2 cannot be created", async ({ page }) => {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
      if (contextId === "webgl2") return null;
      return originalGetContext.call(this, contextId, ...args as []);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.reload();
  await expect(page.getByTestId("webgl-fallback").first()).toBeVisible();
  await expect(page.getByText(/Статичная модель показана/).first()).toBeVisible();
  await expect(page.locator(".canvas-shell canvas")).toHaveCount(0);
  await page.getByRole("button", { name: "Сменить язык" }).evaluate((element) => (element as HTMLButtonElement).click());
  await expect(page.getByText("Precision in every press.")).toBeVisible();
});

test("configurator changes finish, keycaps, switch and backlight", async ({ page }) => {
  await page.locator("#configurator").evaluate((element) => element.scrollIntoView());
  const graphite = page.getByTestId("finish-graphite");
  const silver = page.getByTestId("finish-silver");
  await expect(silver).toHaveAttribute("aria-pressed", "true");
  await domClick(page, '[data-testid="finish-graphite"]');
  await expect(graphite).toHaveAttribute("aria-pressed", "true");
  await domClick(page, '[data-testid="finish-silver"]');
  await expect(silver).toHaveAttribute("aria-pressed", "true");
  const obsidian = page.getByTestId("keycaps-obsidian");
  const porcelain = page.getByTestId("keycaps-porcelain");
  await expect(porcelain).toHaveAttribute("aria-pressed", "true");
  await domClick(page, '[data-testid="keycaps-obsidian"]');
  await expect(obsidian).toHaveAttribute("aria-pressed", "true");
  await domClick(page, '[data-testid="keycaps-porcelain"]');
  await expect(porcelain).toHaveAttribute("aria-pressed", "true");
  const tactile = page.getByTestId("config-switch-tactile");
  await domClick(page, '[data-testid="config-switch-tactile"]');
  await expect(tactile).toHaveAttribute("aria-pressed", "true");
  const light = page.getByTestId("backlight-toggle");
  await domClick(page, '[data-testid="backlight-toggle"]');
  await expect(light).toHaveAttribute("aria-pressed", "false");
  await domClick(page, '[data-testid="backlight-toggle"]');
  await expect(light).toHaveAttribute("aria-pressed", "true");
  for (const preset of ["warm", "ice", "neutral"]) {
    await domClick(page, `[data-testid="light-${preset}"]`);
    await expect(page.getByTestId(`light-${preset}`)).toHaveAttribute("aria-pressed", "true");
  }
});

test("configurator orbit continues beyond a full horizontal turn", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop Chromium covers mouse orbit controls.");
  await page.locator("#configurator").scrollIntoViewIfNeeded();
  const configurator = page.locator(".canvas-configurator");
  await expect(configurator).not.toHaveAttribute("data-webgl", "checking");
  test.skip(await configurator.getAttribute("data-webgl") !== "available", "Hardware WebGL2 is unavailable in this browser.");

  const canvas = configurator.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const dragAround = async () => {
    await page.mouse.move(box!.x + box!.width * 0.78, box!.y + box!.height * 0.52);
    await page.mouse.down();
    await page.mouse.move(box!.x + box!.width * 0.18, box!.y + box!.height * 0.52, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(180);
  };

  await dragAround();
  await dragAround();
  await dragAround();
  const fullTurn = Math.abs(Number(await configurator.getAttribute("data-config-rotation")));
  expect(fullTurn).toBeGreaterThan(Math.PI * 2);

  await dragAround();
  const continued = Math.abs(Number(await configurator.getAttribute("data-config-rotation")));
  expect(continued).toBeGreaterThan(fullTurn + 1);
});

test("desktop wheel progress is damped and demand rendering settles", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop Chromium covers wheel-driven story progress.");
  const story = page.locator(".canvas-story");
  await expect(story).not.toHaveAttribute("data-webgl", "checking");
  test.skip(await story.getAttribute("data-webgl") !== "available", "Hardware WebGL2 is unavailable in this headless browser.");
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => story.getAttribute("data-story-rendering"), { timeout: 3_000 }).toBe("settled");
  await page.waitForTimeout(1_100);

  const baseline = await story.evaluate((element) => ({
    target: Number((element as HTMLElement).dataset.storyTarget),
    rendered: Number((element as HTMLElement).dataset.storyProgress),
  }));

  await page.evaluate(() => {
    type StorySample = { target: number; rendered: number };
    const probe = window as Window & { __storySamples?: StorySample[] };
    const shell = document.querySelector<HTMLElement>(".canvas-story");
    const started = window.performance.now();
    probe.__storySamples = [];
    const sample = () => {
      probe.__storySamples?.push({
        target: Number(shell?.dataset.storyTarget ?? 0),
        rendered: Number(shell?.dataset.storyProgress ?? 0),
      });
      if (window.performance.now() - started < 520) window.requestAnimationFrame(sample);
    };
    window.requestAnimationFrame(sample);
  });
  await page.mouse.wheel(0, 760);
  await page.waitForTimeout(560);

  const samples = await page.evaluate(() => (
    window as Window & { __storySamples?: Array<{ target: number; rendered: number }> }
  ).__storySamples ?? []);
  expect(samples.length).toBeGreaterThan(8);
  const targetIndex = samples.findIndex((sample) => sample.target > baseline.target + 0.001);
  expect(targetIndex).toBeGreaterThanOrEqual(0);
  const target = Math.max(...samples.map((sample) => sample.target));
  const beforeMove = targetIndex > 0 ? samples[targetIndex - 1].rendered : baseline.rendered;
  const firstMove = samples.slice(targetIndex).find((sample) => sample.rendered > beforeMove + 0.00001);
  expect(firstMove).toBeDefined();
  const firstStepFraction = (firstMove!.rendered - beforeMove) / (target - beforeMove);
  expect(firstStepFraction).toBeGreaterThan(0);
  expect(firstStepFraction).toBeLessThan(0.32);

  const renderedValues = samples.slice(targetIndex).map((sample) => sample.rendered);
  const uniqueIntermediateValues = new Set(renderedValues.map((value) => value.toFixed(5)));
  expect(uniqueIntermediateValues.size).toBeGreaterThan(5);
  renderedValues.forEach((value, index) => {
    if (index > 0) expect(value + 0.00001).toBeGreaterThanOrEqual(renderedValues[index - 1]);
  });

  await expect.poll(() => story.getAttribute("data-story-rendering"), { timeout: 3_000 }).toBe("settled");
  const settled = await story.evaluate((element) => ({
    target: Number((element as HTMLElement).dataset.storyTarget),
    rendered: Number((element as HTMLElement).dataset.storyProgress),
  }));
  expect(Math.abs(settled.target - settled.rendered)).toBeLessThan(0.00001);
  const settledFrame = await story.getAttribute("data-story-frame");
  await page.waitForTimeout(320);
  await expect(story).toHaveAttribute("data-story-frame", settledFrame ?? "");
});

test("reduced motion snaps story progress without an inertial render loop", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop Chromium covers reduced-motion story behavior.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  const story = page.locator(".canvas-story");
  await expect(story).not.toHaveAttribute("data-webgl", "checking");
  test.skip(await story.getAttribute("data-webgl") !== "available", "Hardware WebGL2 is unavailable in this browser.");
  await page.mouse.wheel(0, 760);
  await expect.poll(async () => Number(await story.getAttribute("data-story-target")), { timeout: 1_500 }).toBeGreaterThan(0.01);
  await expect(story).toHaveAttribute("data-story-rendering", "settled");
  const progress = await story.evaluate((element) => ({
    target: Number((element as HTMLElement).dataset.storyTarget),
    rendered: Number((element as HTMLElement).dataset.storyProgress),
  }));
  expect(progress.rendered).toBe(progress.target);
  const settledFrame = await story.getAttribute("data-story-frame");
  await page.waitForTimeout(320);
  await expect(story).toHaveAttribute("data-story-frame", settledFrame ?? "");
});

test("switch selector works in the cinematic story", async ({ page }) => {
  await page.locator("#switches").evaluate((element) => element.scrollIntoView());
  const silent = page.getByTestId("switch-silent");
  await domClick(page, '[data-testid="switch-silent"]');
  await expect(silent).toHaveClass(/active/);
  await expect(page.getByText("Смягчённый ход")).toBeVisible();
});

test("each FORM switch type selects its own local sound", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "AudioContext", { configurable: true, value: undefined });
    Object.defineProperty(window, "webkitAudioContext", { configurable: true, value: undefined });
    const played: string[] = [];
    (window as Window & { __playedSwitchSounds?: string[] }).__playedSwitchSounds = played;
    class AudioProbe {
      src = "";
      currentSrc = "";
      preload = "";
      volume = 1;
      currentTime = 0;
      paused = true;
      ended = false;

      play() {
        played.push(this.currentSrc || this.src);
        return Promise.resolve();
      }
    }
    Object.defineProperty(window, "Audio", { configurable: true, value: AudioProbe });
  });
  await page.reload();
  await page.locator("#switches").evaluate((element) => element.scrollIntoView());

  const pressSwitch = page.getByRole("button", { name: "Нажать переключатель" });
  for (const variant of ["linear", "tactile", "silent"]) {
    await domClick(page, `[data-testid="switch-${variant}"]`);
    await page.waitForTimeout(50);
    await pressSwitch.click();
  }
  await page.waitForTimeout(50);
  await pressSwitch.focus();
  await page.keyboard.press("Space");

  const played = await page.evaluate(() => (window as Window & { __playedSwitchSounds?: string[] }).__playedSwitchSounds ?? []);
  const resolved = played.map((url) => new URL(url, page.url()));
  expect(resolved.every((url) => url.origin === new URL(page.url()).origin)).toBe(true);
  expect(resolved.map((url) => url.pathname)).toEqual([
    "/audio/switch-linear.mp3",
    "/audio/switch-tactile.mp3",
    "/audio/switch-silent.mp3",
    "/audio/switch-silent.mp3",
  ]);
});

test("FORM AI opens, closes with Escape, and fails gracefully without a key", async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ error: "unavailable" }) });
  });
  await domClick(page, '[data-testid="assistant-open"]');
  await expect(page.getByTestId("assistant-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("assistant-panel")).toBeHidden();
  await domClick(page, '[data-testid="assistant-open"]');
  await page.getByRole("button", { name: "Есть ли Bluetooth?" }).evaluate((element) => (element as HTMLButtonElement).click());
  await expect(page.getByText("FORM AI пока недоступен в этой среде.")).toBeVisible();
  await domClick(page, '[data-testid="assistant-close"]');
  await expect(page.getByTestId("assistant-panel")).toBeHidden();
});

test("mobile layout, menu, hit targets and assistant fit", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("mobile"), "Mobile-only interaction and geometry checks.");

  const menu = page.getByRole("button", { name: "Открыть меню" });
  const language = page.getByRole("button", { name: "Сменить язык" });
  const assistant = page.getByTestId("assistant-open");
  for (const target of [menu, language, assistant]) {
    const topElement = await target.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === element || Boolean(hit && element.contains(hit));
    });
    expect(topElement, "interactive control is not covered by a canvas or fallback layer").toBe(true);
  }

  await menu.click();
  await expect(page.locator(".mobile-nav")).toBeVisible();
  await menu.click();
  await expect(page.locator(".mobile-nav")).toBeHidden();

  const metrics = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width);
  await assistant.click();
  const viewport = page.viewportSize();
  const box = await page.getByTestId("assistant-panel").boundingBox();
  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height);
});

test("mobile configurator rotates horizontally and preserves vertical touch scrolling", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile Chromium exposes the configurator touch-action contract.");
  await page.locator("#configurator").scrollIntoViewIfNeeded();
  const configurator = page.locator(".canvas-configurator");
  await expect(configurator).not.toHaveAttribute("data-webgl", "checking");
  test.skip(await configurator.getAttribute("data-webgl") !== "available", "Hardware WebGL2 is unavailable in this browser.");
  const canvas = configurator.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate((element) => getComputedStyle(element).touchAction)).toContain("pan-y");
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const session = await page.context().newCDPSession(page);
  const dispatchTouch = (type: "touchStart" | "touchMove" | "touchEnd", x?: number, y?: number, id = 1) => (
    session.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x: x!, y: y!, id, radiusX: 2, radiusY: 2, force: 1 }],
    })
  );

  const horizontalStart = box!.x + box!.width * 0.78;
  const horizontalEnd = box!.x + box!.width * 0.18;
  const horizontalY = box!.y + box!.height * 0.5;
  const scrollBeforeRotation = await page.evaluate(() => window.scrollY);
  await dispatchTouch("touchStart", horizontalStart, horizontalY);
  for (let step = 1; step <= 12; step += 1) {
    const x = horizontalStart + (horizontalEnd - horizontalStart) * (step / 12);
    await dispatchTouch("touchMove", x, horizontalY);
  }
  await dispatchTouch("touchEnd");
  await page.waitForTimeout(350);
  expect(Math.abs(Number(await configurator.getAttribute("data-config-rotation")))).toBeGreaterThan(0.5);
  expect(Math.abs(await page.evaluate(() => window.scrollY) - scrollBeforeRotation)).toBeLessThan(2);

  const verticalX = box!.x + box!.width * 0.5;
  const verticalStart = box!.y + box!.height * 0.72;
  const verticalEnd = box!.y + box!.height * 0.25;
  const scrollBeforeSwipe = await page.evaluate(() => window.scrollY);
  await dispatchTouch("touchStart", verticalX, verticalStart, 2);
  for (let step = 1; step <= 12; step += 1) {
    const y = verticalStart + (verticalEnd - verticalStart) * (step / 12);
    await dispatchTouch("touchMove", verticalX, y, 2);
  }
  await dispatchTouch("touchEnd", undefined, undefined, 2);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBeforeSwipe + 100);
});
