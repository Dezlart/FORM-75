const switchClickPath = "/audio/keyboard-click.mp3";
const minimumInterval = 72;

let clickAudio: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;
let clickBuffer: AudioBuffer | null = null;
let bufferPromise: Promise<AudioBuffer | null> | null = null;
let lastPlayback = 0;

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

function preloadAudioBuffer() {
  if (clickBuffer) return Promise.resolve(clickBuffer);
  if (bufferPromise) return bufferPromise;
  const context = getAudioContext();
  if (!context) return Promise.resolve(null);
  bufferPromise = fetch(switchClickPath)
    .then((response) => {
      if (!response.ok) throw new Error("Switch audio unavailable");
      return response.arrayBuffer();
    })
    .then((data) => context.decodeAudioData(data))
    .then((buffer) => {
      clickBuffer = buffer;
      return buffer;
    })
    .catch(() => null);
  return bufferPromise;
}

function getClickAudio() {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  if (!clickAudio) {
    clickAudio = new Audio();
    clickAudio.src = switchClickPath;
    clickAudio.preload = "auto";
    clickAudio.volume = 0.24;
    clickAudio.load();
  }
  return clickAudio;
}

export function preloadSwitchClick(): void {
  try {
    if (getAudioContext()) void preloadAudioBuffer();
  } catch {
    // Preloading is optional; playback still gets a user-gesture attempt.
  }
}

export function playSwitchClick(): void {
  if (typeof window === "undefined") return;
  const now = window.performance.now();
  if (now - lastPlayback < minimumInterval) return;
  lastPlayback = now;

  try {
    const context = getAudioContext();
    if (context && clickBuffer) {
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = clickBuffer;
      gain.gain.value = 0.24;
      source.connect(gain);
      gain.connect(context.destination);
      source.addEventListener("ended", () => {
        source.disconnect();
        gain.disconnect();
      }, { once: true });
      source.start(0);
      if (context.state === "suspended") void context.resume().catch(() => undefined);
      return;
    }

    void preloadAudioBuffer();
    const audio = getClickAudio();
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  } catch {
    // Audio is an enhancement; an unavailable decoder must not affect controls.
  }
}
