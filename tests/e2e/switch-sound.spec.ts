import { expect, test } from "@playwright/test";
import { playSwitchClick, preloadSwitchClick } from "../../src/lib/switchSound";

test("a delayed audio resume cannot replay stale clicks and active Web Audio voices are bounded", async ({}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Audio scheduling is tested once with a controlled browser audio clock.");
  let time = 100;
  let resumeCalls = 0;
  let bufferStarts = 0;
  let activeSources = 0;
  let peakSources = 0;
  let fallbackStarts = 0;
  let finishResume: () => void = () => undefined;
  const resumed = new Promise<void>((resolve) => { finishResume = resolve; });

  class AudioContextProbe {
    state = "suspended";
    destination = {};
    resume() { resumeCalls += 1; return resumed; }
    decodeAudioData() { return Promise.resolve({ duration: 0.14 }); }
    createGain() { return { gain: { value: 0 }, connect() {}, disconnect() {} }; }
    createBufferSource() {
      let end: () => void = () => undefined;
      return {
        buffer: null,
        connect() {},
        disconnect() {},
        addEventListener(_event: string, callback: () => void) { end = callback; },
        start() { bufferStarts += 1; activeSources += 1; peakSources = Math.max(peakSources, activeSources); },
        stop() { activeSources -= 1; end(); },
      };
    }
  }
  const context = new AudioContextProbe();
  class ContextConstructor { constructor() { return context; } }
  class AudioProbe {
    src = "";
    preload = "";
    volume = 1;
    currentTime = 0;
    paused = true;
    ended = false;
    play() { this.paused = false; fallbackStarts += 1; return Promise.resolve(); }
    pause() { this.paused = true; }
  }

  const names = ["window", "Audio", "fetch"] as const;
  const originals = names.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)] as const);
  Object.defineProperty(globalThis, "window", { configurable: true, value: { AudioContext: ContextConstructor, performance: { now: () => time } } });
  Object.defineProperty(globalThis, "Audio", { configurable: true, value: AudioProbe });
  Object.defineProperty(globalThis, "fetch", { configurable: true, value: () => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(1)) }) });
  try {
    preloadSwitchClick();
    // Allow the independent decode promises to populate all three buffers.
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let click = 0; click < 12; click += 1) {
      time += 45;
      playSwitchClick("linear");
      await Promise.resolve();
    }
    expect(resumeCalls).toBe(1);
    expect(fallbackStarts).toBe(12);
    expect(bufferStarts).toBe(0);
    context.state = "running";
    finishResume();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(bufferStarts, "resolving resume must never replay historical clicks").toBe(0);
    for (let click = 0; click < 30; click += 1) {
      time += 45;
      playSwitchClick("tactile");
    }
    expect(bufferStarts).toBe(30);
    expect(peakSources).toBeLessThanOrEqual(4);
  } finally {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
});
