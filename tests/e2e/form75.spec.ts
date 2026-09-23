import { expect, test, type Locator, type Page } from "@playwright/test";
import { expectCleanRuntime, monitorRuntime, type RuntimeDiagnostics } from "./runtimeDiagnostics";

const runtimeByPage = new WeakMap<Page, RuntimeDiagnostics>();
const domClick = (page: Page, selector: string) => page.locator(selector).click();

async function waitForCanvasSize(container: Locator) {
  // A visible canvas can still have its browser default 300x150 dimensions
  // before R3F's resize observer runs. Gestures need the final surface size.
  await expect.poll(() => container.evaluate((element) => {
    const surface = element.querySelector("canvas");
    if (!surface) return false;
    const outer = element.getBoundingClientRect();
    const inner = surface.getBoundingClientRect();
    return Math.abs(inner.width - outer.width) < 1 && Math.abs(inner.height - outer.height) < 1;
  })).toBe(true);
}

test.beforeEach(async ({ page }) => {
  runtimeByPage.set(page, monitorRuntime(page));
  await page.addInitScript(() => {
    try {
      window.localStorage.clear();
      window.localStorage.setItem("form75-theme", "dark");
      window.localStorage.setItem("form75-theme-v2", "dark");
    } catch {
      // Storage availability is covered separately; it must not block navigation.
    }
  });
  await page.goto("/?debug3d=1");
  // Tests that reload the document must not cancel its in-flight font requests.
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
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

test("locale and localized chat trigger work with the fixed site theme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect(page.locator("html")).not.toHaveClass(/dark|light/);
  await expect(page.getByRole("button", { name: "Переключить тему" })).toHaveCount(0);
  await expect(page.getByTestId("assistant-open")).toHaveAttribute("aria-label", "Открыть FORM AI");
  const language = page.getByRole("button", { name: "Сменить язык" });
  await language.click();
  await expect(page.getByText("Precision in every press.")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("assistant-open")).toHaveAttribute("aria-label", "Open FORM AI");
  await expect(page.getByRole("button", { name: "Toggle theme" })).toHaveCount(0);
  await page.getByRole("button", { name: "Change language" }).click();
  await expect(page.getByText("Точность в каждом нажатии.")).toBeVisible();
  await expect(page.locator("html")).not.toHaveClass(/dark|light/);
});

test("falls back cleanly when WebGL2 cannot be created", async ({ page }, testInfo) => {
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
  const activeStoryRender = page.locator(".canvas-story .fallback-stage.is-active");
  await expect(activeStoryRender).toHaveAttribute("data-fallback-stage", "0");
  await expect(activeStoryRender.locator("img")).toHaveJSProperty("complete", true);
  expect(await activeStoryRender.locator("img").evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(300);

  // Finish the initial scroll-restoration / layout frame before issuing a
  // programmatic scroll; otherwise WebKit can reset that scroll back to zero.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

  await page.locator("#inside").evaluate((element) => element.scrollIntoView({ block: "start", behavior: "instant" }));
  await expect(activeStoryRender).toHaveAttribute("data-fallback-stage", "3");
  await expect(activeStoryRender.locator("img")).toHaveJSProperty("complete", true);
  await page.locator("#switches").evaluate((element) => element.scrollIntoView({ block: "start", behavior: "instant" }));
  await expect(activeStoryRender).toHaveAttribute("data-fallback-stage", "4");
  await expect(activeStoryRender.locator("img")).toHaveJSProperty("complete", true);

  await page.locator("#configurator").evaluate((element) => element.scrollIntoView({ block: "start", behavior: "instant" }));
  const configuratorRender = page.locator(".canvas-configurator .fallback-stage.is-active img");
  await expect(configuratorRender).toBeVisible();
  expect(await configuratorRender.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(300);
  const target = testInfo.project.name.startsWith("mobile") ? "mobile" : "desktop";
  await expect.poll(() => configuratorRender.evaluate((image) => (image as HTMLImageElement).currentSrc)).toContain(`configurator-${target}-silver-porcelain-neutral.webp`);
  await domClick(page, '[data-testid="finish-graphite"]');
  await domClick(page, '[data-testid="keycaps-obsidian"]');
  await domClick(page, '[data-testid="light-warm"]');
  await expect.poll(() => configuratorRender.evaluate((image) => (image as HTMLImageElement).currentSrc)).toContain(`configurator-${target}-graphite-obsidian-warm.webp`);
  await domClick(page, '[data-testid="backlight-toggle"]');
  await expect.poll(() => configuratorRender.evaluate((image) => (image as HTMLImageElement).currentSrc)).toContain(`configurator-${target}-graphite-obsidian-off.webp`);
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
  await waitForCanvasSize(configurator);
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

test("rapid switch clicks settle without queued strokes and Space ignores auto-repeat", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop Chromium covers rendered switch press/release behavior.");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const story = page.locator(".canvas-story");
  await expect(story).not.toHaveAttribute("data-webgl", "checking");
  test.skip(await story.getAttribute("data-webgl") !== "available", "Hardware WebGL2 is unavailable in this browser.");
  await page.locator("#switches").evaluate((element) => element.scrollIntoView({ block: "start", behavior: "instant" }));
  await expect.poll(async () => Number(await story.getAttribute("data-story-progress"))).toBeGreaterThan(0.76);
  await expect(story).toHaveAttribute("data-story-rendering", "settled");
  await waitForCanvasSize(story);

  const button = page.getByRole("button", { name: "Нажать переключатель" });
  await expect(button).toBeInViewport();
  const box = await button.boundingBox();
  expect(box).not.toBeNull();
  const baseline = Number(await story.getAttribute("data-switch-press-sequence"));
  const scrollY = await page.evaluate(() => window.scrollY);
  type StrokeSample = { travel: number; sequence: number };
  type StrokeProbeWindow = Window & { __switchStrokeProbe?: { samples: StrokeSample[]; request: number } };
  await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".canvas-story")!;
    const probe = { samples: [] as StrokeSample[], request: 0 };
    (window as StrokeProbeWindow).__switchStrokeProbe = probe;
    const sample = () => {
      probe.samples.push({
        travel: Number(shell.dataset.switchTravel),
        sequence: Number(shell.dataset.switchPressSequence),
      });
      probe.request = requestAnimationFrame(sample);
    };
    sample();
  });

  // Native down/up can both arrive before a rendered frame; each short click
  // must still produce a visible stroke instead of only toggling React state.
  for (let click = 0; click < 12; click += 1) {
    await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.waitForTimeout(50);
  }
  await expect(story).toHaveAttribute("data-switch-press-sequence", String(baseline + 12));
  await expect(story).toHaveAttribute("data-switch-pressed", "false");
  await expect(story).toHaveAttribute("data-switch-motion", "settled", { timeout: 700 });
  await expect(story).toHaveAttribute("data-switch-travel", "0.0000");
  const samples = await page.evaluate(() => {
    const probe = (window as StrokeProbeWindow).__switchStrokeProbe!;
    cancelAnimationFrame(probe.request);
    return probe.samples;
  });
  expect(Math.max(...samples.map((sample) => sample.travel))).toBeGreaterThan(0.5);
  const visibleStrokes = new Set(samples.filter((sample) => sample.travel > 0.1).map((sample) => sample.sequence));
  expect(visibleStrokes.size).toBeGreaterThan(3);
  await testInfo.attach("rapid-switch-rendered-strokes", { body: JSON.stringify(samples), contentType: "application/json" });

  await button.focus();
  await page.keyboard.down("Space");
  await expect(story).toHaveAttribute("data-switch-press-sequence", String(baseline + 13));
  await expect(story).toHaveAttribute("data-switch-pressed", "true");
  await expect(story).toHaveAttribute("data-switch-travel", "1.0000");
  for (let repeat = 0; repeat < 3; repeat += 1) {
    await page.keyboard.down("Space");
    await page.waitForTimeout(50);
  }
  await expect(story).toHaveAttribute("data-switch-press-sequence", String(baseline + 13));
  await expect(story).toHaveAttribute("data-switch-pressed", "true");
  await page.keyboard.up("Space");
  await expect(story).toHaveAttribute("data-switch-pressed", "false");
  await expect(story).toHaveAttribute("data-switch-motion", "settled", { timeout: 700 });
  await expect(story).toHaveAttribute("data-switch-travel", "0.0000");
  await expect(story).toHaveAttribute("data-switch-press-sequence", String(baseline + 13));
  expect(Math.abs(await page.evaluate(() => window.scrollY) - scrollY)).toBeLessThan(2);
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

test("mobile configurator rotates horizontally and page scrolling remains available outside it", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chromium", "Mobile Chromium exposes the configurator touch-action contract.");
  const configurator = page.locator(".canvas-configurator");
  // On mobile the whole section is taller than the viewport; centering it can
  // leave the interactive surface above the screen and send touch to the header.
  await configurator.scrollIntoViewIfNeeded();
  await expect(configurator).not.toHaveAttribute("data-webgl", "checking");
  test.skip(await configurator.getAttribute("data-webgl") !== "available", "Hardware WebGL2 is unavailable in this browser.");
  const canvas = configurator.locator("canvas");
  await expect(canvas).toBeVisible();
  await expect.poll(() => canvas.evaluate((element) => getComputedStyle(element).touchAction)).toBe("none");
  await waitForCanvasSize(configurator);
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

  // The canvas spans the full phone width; the controls below it are the
  // document scrolling surface, not an assumed gutter inside the canvas.
  await page.locator(".configurator-controls").scrollIntoViewIfNeeded();
  const viewport = page.viewportSize()!;
  const verticalX = viewport.width * 0.5;
  const verticalStart = viewport.height * 0.72;
  const verticalEnd = viewport.height * 0.3;
  expect(await page.evaluate(({ x, y }) => Boolean(document.elementFromPoint(x, y)?.closest(".canvas-shell")), { x: verticalX, y: verticalStart })).toBe(false);
  const scrollBeforeSwipe = await page.evaluate(() => window.scrollY);
  await dispatchTouch("touchStart", verticalX, verticalStart, 2);
  for (let step = 1; step <= 12; step += 1) {
    const y = verticalStart + (verticalEnd - verticalStart) * (step / 12);
    await dispatchTouch("touchMove", verticalX, y, 2);
  }
  await dispatchTouch("touchEnd", undefined, undefined, 2);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBeforeSwipe + 100);
});
