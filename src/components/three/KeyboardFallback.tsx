"use client";

import { useConfiguratorStore } from "@/stores/configurator";

function StaticRender({ desktopFile, mobileFile, priority = false }: { desktopFile: string; mobileFile: string; priority?: boolean }) {
  return (
    <picture className="fallback-render">
      <source media="(max-width: 760px)" srcSet={`/images/keyboard-fallbacks/${mobileFile}.webp`} />
      <img
        src={`/images/keyboard-fallbacks/${desktopFile}.webp`}
        alt=""
        aria-hidden="true"
        draggable={false}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
      />
    </picture>
  );
}

export function KeyboardFallback({
  variant,
  note,
  unavailable,
  stage = 0,
  ready = false,
}: {
  variant: "story" | "configurator";
  note: string;
  unavailable: boolean;
  stage?: number;
  ready?: boolean;
}) {
  const caseFinish = useConfiguratorStore((state) => state.caseFinish);
  const keycaps = useConfiguratorStore((state) => state.keycaps);
  const backlight = useConfiguratorStore((state) => state.backlight);
  const backlightPreset = useConfiguratorStore((state) => state.backlightPreset);
  const currentStage = Math.max(0, Math.min(5, Math.round(stage)));
  const configuratorState = `${caseFinish}-${keycaps}-${backlight ? backlightPreset : "off"}`;

  // A ready canvas covers the fallback. Do not download hidden renders for
  // every story stage and every configurator choice made during the session.
  if (ready && !unavailable) return null;

  return (
    <div
      className={`webgl-fallback webgl-fallback-${variant}`}
      data-testid={unavailable ? "webgl-fallback" : undefined}
      aria-hidden={!unavailable}
    >
      {variant === "story" ? (
        <div
          className="fallback-stage is-active"
          data-fallback-stage={currentStage}
        >
          <StaticRender desktopFile={`story-desktop-${currentStage}`} mobileFile={`story-mobile-${currentStage}`} priority={currentStage === 0} />
        </div>
      ) : (
        <div className="fallback-stage is-active">
          <StaticRender desktopFile={`configurator-desktop-${configuratorState}`} mobileFile={`configurator-mobile-${configuratorState}`} />
        </div>
      )}
      {unavailable && <p className="webgl-fallback-note"><span>3D / FALLBACK</span>{note}</p>}
    </div>
  );
}
