import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import sharp from "sharp";

const baseUrl = process.env.FORM75_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.resolve("public/images/keyboard-fallbacks");
const targets = [
  // A wide desktop source preserves the camera's vertical framing while
  // leaving enough horizontal room for the complete configurator model.
  { name: "desktop", width: 1920, height: 786 },
  { name: "mobile", width: 390, height: 844 },
];
const finishes = ["graphite", "silver", "sand"];
const keycapSets = ["obsidian", "porcelain", "ember"];
const lightingStates = ["off", "neutral", "warm", "ice"];

async function saveCanvas(page, selector, fileName) {
  const png = await page.locator(selector).screenshot({ omitBackground: true, type: "png" });
  const outputPath = path.join(outputDirectory, fileName);
  await sharp(png).webp({ quality: 88, alphaQuality: 92, smartSubsample: true }).toFile(outputPath);
  const metadata = await sharp(outputPath).metadata();
  process.stdout.write(`${fileName}: ${metadata.width}x${metadata.height}\n`);
}

async function waitForStoryFrame(page, progress) {
  await page.evaluate((nextProgress) => {
    const story = document.querySelector(".story-experience");
    if (!(story instanceof HTMLElement)) throw new Error("Story section not found");
    const start = story.offsetTop;
    const end = start + story.offsetHeight - window.innerHeight;
    window.scrollTo(0, start + (end - start) * nextProgress);
  }, progress);
  await page.waitForFunction((expected) => {
    const shell = document.querySelector(".canvas-story");
    const rendered = Number(shell?.getAttribute("data-story-progress"));
    return Number.isFinite(rendered) && Math.abs(rendered - expected) < 0.002;
  }, progress);
  await page.waitForTimeout(180);
}

async function activateOption(page, testId) {
  await page.getByTestId(testId).evaluate((button) => button.click());
}

async function setBacklight(page, lighting) {
  const toggle = page.getByTestId("backlight-toggle");
  const enabled = await toggle.getAttribute("aria-pressed") === "true";
  if ((lighting === "off") === enabled) await toggle.evaluate((button) => button.click());
  if (lighting !== "off") await activateOption(page, `light-${lighting}`);
}

await mkdir(outputDirectory, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: false });

try {
  for (const target of targets) {
    const context = await browser.newContext({
      viewport: { width: target.width, height: target.height },
      deviceScaleFactor: 1,
      isMobile: target.name === "mobile",
      hasTouch: target.name === "mobile",
      reducedMotion: "reduce",
      colorScheme: "light",
    });
    const page = await context.newPage();
    await page.goto(`${baseUrl}?captureLighting=dark`, { waitUntil: "networkidle" });
    await page.locator(".canvas-story canvas").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector(".canvas-story")?.getAttribute("data-canvas-ready") === "true");
    await page.addStyleTag({ content: `
      html, body, main, .story-experience, .story-sticky, .configurator-section,
      .configurator-visual, .canvas-shell { background: transparent !important; }
      body * { visibility: hidden !important; }
      .story-experience, .story-sticky, .configurator-section, .configurator-visual,
      .canvas-shell, .canvas-shell canvas { visibility: visible !important; }
      .webgl-fallback { display: none !important; }
    ` });

    for (let stage = 0; stage < 6; stage += 1) {
      await waitForStoryFrame(page, stage / 5);
      await saveCanvas(page, ".canvas-story canvas", `story-${target.name}-${stage}.webp`);
    }

    await page.locator(".configurator-section").evaluate((section) => {
      window.scrollTo(0, section.getBoundingClientRect().top + window.scrollY);
    });
    await page.locator(".canvas-configurator canvas").waitFor({ state: "visible" });
    await page.waitForFunction(() => document.querySelector(".canvas-configurator")?.getAttribute("data-canvas-ready") === "true");
    for (const finish of finishes) {
      await activateOption(page, `finish-${finish}`);
      for (const keycaps of keycapSets) {
        await activateOption(page, `keycaps-${keycaps}`);
        for (const lighting of lightingStates) {
          await setBacklight(page, lighting);
          await page.waitForTimeout(80);
          await saveCanvas(
            page,
            ".canvas-configurator canvas",
            `configurator-${target.name}-${finish}-${keycaps}-${lighting}.webp`,
          );
        }
      }
    }
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(
  path.join(outputDirectory, "README.md"),
  "# Keyboard fallback renders\n\nGenerated from the live Three.js scene with `npm run capture:fallbacks`. Story renders use the canonical silver/porcelain/neutral configuration. Configurator renders cover every visible finish, keycap, and lighting combination. Keep these files in sync with material, camera, and composition changes.\n",
);
