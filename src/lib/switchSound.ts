import type { SwitchVariant } from "@/types/product";

const switchSounds: Record<SwitchVariant, { path: string; volume: number }> = {
  linear: { path: "/audio/switch-linear.mp3", volume: 0.25 },
  tactile: { path: "/audio/switch-tactile.mp3", volume: 0.23 },
  silent: { path: "/audio/switch-silent.mp3", volume: 0.14 },
};
const variants = Object.keys(switchSounds) as SwitchVariant[];
const minimumInterval = 38;
const fallbackVoices = 4;

let audioContext: AudioContext | null = null;
let lastPlayback = 0;
const buffers = new Map<SwitchVariant, AudioBuffer>();
const bufferPromises = new Map<SwitchVariant, Promise<AudioBuffer | null>>();
const fallbackPools = new Map<SwitchVariant, HTMLAudioElement[]>();
const fallbackIndices = new Map<SwitchVariant, number>();

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (audioContext) return audioContext;
  const Context = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
  if (!Context) return null;
  try {
    audioContext = new Context();
  } catch {
    audioContext = null;
  }
  return audioContext;
}

function preloadAudioBuffer(variant: SwitchVariant) {
  const cached = buffers.get(variant);
  if (cached) return Promise.resolve(cached);
  const pending = bufferPromises.get(variant);
  if (pending) return pending;
  const context = getAudioContext();
  if (!context) return Promise.resolve(null);

  const promise = fetch(switchSounds[variant].path)
    .then((response) => {
      if (!response.ok) throw new Error("Switch audio unavailable");
      return response.arrayBuffer();
    })
    .then((data) => context.decodeAudioData(data))
    .then((buffer) => {
      buffers.set(variant, buffer);
      return buffer;
    })
    .catch(() => {
      bufferPromises.delete(variant);
      return null;
    });
  bufferPromises.set(variant, promise);
  return promise;
}

function getFallbackPool(variant: SwitchVariant) {
  if (typeof window === "undefined" || typeof Audio === "undefined") return [];
  const cached = fallbackPools.get(variant);
  if (cached) return cached;

  const { volume } = switchSounds[variant];
  const pool = Array.from({ length: fallbackVoices }, () => {
    const audio = new Audio();
    audio.preload = "none";
    audio.volume = volume;
    return audio;
  });
  fallbackPools.set(variant, pool);
  fallbackIndices.set(variant, 0);
  return pool;
}

function playFallback(variant: SwitchVariant) {
  const pool = getFallbackPool(variant);
  if (pool.length === 0) return;
  const available = pool.find((audio) => audio.paused || audio.ended);
  const index = fallbackIndices.get(variant) ?? 0;
  const audio = available ?? pool[index % pool.length];
  fallbackIndices.set(variant, (index + 1) % pool.length);
  if (!audio.src) audio.src = switchSounds[variant].path;
  audio.currentTime = 0;
  void audio.play().catch(() => undefined);
}

function playBuffer(context: AudioContext, buffer: AudioBuffer, volume: number) {
  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(context.destination);
  source.addEventListener("ended", () => {
    source.disconnect();
    gain.disconnect();
  }, { once: true });
  source.start();
}

export function preloadSwitchClick(): void {
  try {
    if (!getAudioContext()) return;
    variants.forEach((variant) => void preloadAudioBuffer(variant));
  } catch {
    // Preloading is optional; playback still gets a user-gesture attempt.
  }
}

export function playSwitchClick(variant: SwitchVariant): void {
  if (typeof window === "undefined") return;
  const now = window.performance.now();
  if (now - lastPlayback < minimumInterval) return;
  lastPlayback = now;

  try {
    const context = getAudioContext();
    const buffer = buffers.get(variant);
    if (context && buffer) {
      if (context.state === "suspended") {
        void context.resume()
          .then(() => playBuffer(context, buffer, switchSounds[variant].volume))
          .catch(() => playFallback(variant));
      } else {
        playBuffer(context, buffer, switchSounds[variant].volume);
      }
      return;
    }

    void preloadAudioBuffer(variant);
    playFallback(variant);
  } catch {
    // Audio is an enhancement; an unavailable decoder must not affect controls.
  }
}
