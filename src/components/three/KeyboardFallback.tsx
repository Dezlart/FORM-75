"use client";

import { useConfiguratorStore } from "@/stores/configurator";

const storyStages = [0, 1, 2, 3, 4, 5] as const;

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
      />
    </picture>
  );
}

export function KeyboardFallback({
  variant,
  note,
  unavailable,
  stage = 0,
}: {
  variant: "story" | "configurator";
  note: string;
  unavailable: boolean;
  stage?: number;
}) {
  const caseFinish = useConfiguratorStore((state) => state.caseFinish);
  const keycaps = useConfiguratorStore((state) => state.keycaps);
  const backlight = useConfiguratorStore((state) => state.backlight);
  const backlightPreset = useConfiguratorStore((state) => state.backlightPreset);
  const currentStage = Math.max(0, Math.min(5, Math.round(stage)));
  const configuratorState = `${caseFinish}-${keycaps}-${backlight ? backlightPreset : "off"}`;

  return (
    <div
      className={`webgl-fallback webgl-fallback-${variant}`}
      data-testid={unavailable ? "webgl-fallback" : undefined}
      aria-hidden={!unavailable}
    >
      {variant === "story" ? storyStages.map((storyStage) => (
        <div
          className={`fallback-stage${currentStage === storyStage ? " is-active" : ""}`}
          key={storyStage}
          data-fallback-stage={storyStage}
        >
          <StaticRender desktopFile={`story-desktop-${storyStage}`} mobileFile={`story-mobile-${storyStage}`} priority />
        </div>
      )) : (
        <div className="fallback-stage is-active">
          <StaticRender desktopFile={`configurator-desktop-${configuratorState}`} mobileFile={`configurator-mobile-${configuratorState}`} priority />
        </div>
      )}
      {unavailable && <p className="webgl-fallback-note"><span>3D / FALLBACK</span>{note}</p>}
    </div>
  );
}
