import { expect, test, type Page } from "@playwright/test";
import { expectCleanRuntime, monitorRuntime, type RuntimeDiagnostics } from "./runtimeDiagnostics";

const runtimeByPage = new WeakMap<Page, RuntimeDiagnostics>();
const domClick = (page: Page, selector: string) => page.locator(selector).evaluate((element) => (element as HTMLElement).click());

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
  await navigation.locator('a[href="#connectivity"]').evaluate((element) => (element as HTMLAnchorElement).click());
  await expect(page.locator("#connectivity")).toBeInViewport();
});

test("locale, localized chat trigger and theme cycle through both states", async ({ page }) => {
  await expect(page.locator("html")).toHaveClass(/light/);
  await expect(page.getByTestId("assistant-open")).toHaveAttribute("aria-label", "Открыть FORM AI");
  const language = page.getByRole("button", { name: "Сменить язык" });
  await language.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(page.getByText("Precision in every press.")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByTestId("assistant-open")).toHaveAttribute("aria-label", "Open FORM AI");
  await page.getByRole("button", { name: "Change language" }).evaluate((element) => (element as HTMLButtonElement).click());
  await expect(page.getByText("Точность в каждом нажатии.")).toBeVisible();
  const theme = page.getByRole("button", { name: "Переключить тему" });
  await theme.evaluate((element) => (element as HTMLButtonElement).click());
  await expect(page.locator("html")).toHaveClass(/dark/);
  await theme.evaluate((element) => (element as HTMLButtonElement).click());
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
});

test("switch selector works in the cinematic story", async ({ page }) => {
  await page.locator("#switches").evaluate((element) => element.scrollIntoView());
  const silent = page.getByTestId("switch-silent");
  await domClick(page, '[data-testid="switch-silent"]');
  await expect(silent).toHaveClass(/active/);
  await expect(page.getByText("Смягчённый ход")).toBeVisible();
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
