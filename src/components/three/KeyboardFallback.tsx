"use client";

import type { CSSProperties } from "react";
import { useConfiguratorStore } from "@/stores/configurator";

const fallbackKeys = Array.from({ length: 75 }, (_, index) => index);

const caseColors = {
  graphite: "#34373a",
  silver: "#b9b8b2",
  sand: "#9f8f7c",
} as const;

const keycapColors = {
  obsidian: "#252729",
  porcelain: "#eeece6",
  ember: "#7d3530",
} as const;

const lightColors = {
  neutral: "#f5ead6",
  warm: "#ffb66e",
  ice: "#a9dcff",
} as const;

export function KeyboardFallback({ variant, note, unavailable }: { variant: "story" | "configurator"; note: string; unavailable: boolean }) {
  const caseFinish = useConfiguratorStore((state) => state.caseFinish);
  const keycaps = useConfiguratorStore((state) => state.keycaps);
  const backlight = useConfiguratorStore((state) => state.backlight);
  const backlightPreset = useConfiguratorStore((state) => state.backlightPreset);
  const style = {
    "--fallback-case": caseColors[caseFinish],
    "--fallback-keycaps": keycapColors[keycaps],
    "--fallback-light": backlight ? lightColors[backlightPreset] : "transparent",
  } as CSSProperties;

  return (
    <div className={`webgl-fallback webgl-fallback-${variant}`} style={style} data-testid={unavailable ? "webgl-fallback" : undefined}>
      <div className="fallback-product" aria-hidden="true">
        <div className="fallback-deck">
          <div className="fallback-key-grid">
            {fallbackKeys.map((key) => <i className="fallback-key" key={key} />)}
          </div>
          <span className="fallback-knob" />
        </div>
      </div>
      {unavailable && <p className="webgl-fallback-note"><span>3D / FALLBACK</span>{note}</p>}
    </div>
  );
}
