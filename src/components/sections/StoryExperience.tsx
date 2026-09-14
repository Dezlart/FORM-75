"use client";

import { useEffect, useRef, useState } from "react";
import { KeyboardCanvas } from "@/components/three/KeyboardCanvas";
import { useLocale } from "@/components/providers/LocaleProvider";
import { requestSceneFrames, storyTargetProgress } from "@/lib/storyProgress";
import { preloadSwitchClick } from "@/lib/switchSound";
import { useSwitchPress } from "@/lib/useSwitchPress";
import { useConfiguratorStore } from "@/stores/configurator";
import type { SwitchVariant } from "@/types/product";

export function StoryExperience() {
  const root = useRef<HTMLElement>(null);
  const [activeStage, setActiveStage] = useState(0);
  const { dictionary: t } = useLocale();
  useEffect(() => {
    const section = root.current;
    if (!section) return;
    let start = 0;
    let distance = 1;
    let currentStage = -1;
    let measureFrame = 0;
    let disposed = false;
    const updateProgress = () => {
      // Read cached geometry during scroll; measuring belongs to layout changes.
      const progress = Math.min(1, Math.max(0, (window.scrollY - start) / distance));
      if (storyTargetProgress.current !== progress) {
        storyTargetProgress.current = progress;
        requestSceneFrames("story", 0);
      }
      const nextStage = Math.min(5, Math.round(progress * 5));
      if (currentStage !== nextStage) {
        currentStage = nextStage;
        setActiveStage(nextStage);
      }
    };
    const measure = () => {
      measureFrame = 0;
      const bounds = section.getBoundingClientRect();
      start = bounds.top + window.scrollY;
      distance = Math.max(1, bounds.height - window.innerHeight);
      updateProgress();
    };
    const scheduleMeasure = () => {
      if (!disposed && !measureFrame) measureFrame = window.requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(section);
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", scheduleMeasure, { passive: true });
    void document.fonts.ready.then(scheduleMeasure);
    scheduleMeasure();
    return () => {
      disposed = true;
      observer.disconnect();
      window.cancelAnimationFrame(measureFrame);
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, []);

  return (
    <section ref={root} className="story-experience" aria-label="FORM 75 product story">
      <div className="story-sticky">
        <KeyboardCanvas variant="story" label={t.a11y.scene} fallbackStage={activeStage} />
        <div className="surface-reflections" aria-hidden="true" />
        <div className="story-progress" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((stage) => <i key={stage} className={activeStage === stage ? "active" : ""} />)}
        </div>
      </div>
      <div className="story-track">
        <article id="top" className="story-panel hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">{t.hero.eyebrow}</p>
            <h1>{t.hero.title}</h1>
            <div className="hero-details">
              <p className="hero-subtitle">{t.hero.subtitle}</p>
              <p className="hero-support">{t.hero.support}</p>
              <div className="hero-actions">
                <a className="primary-button" href="#design">{t.hero.cta}</a>
                <span>{t.hero.price}</span>
              </div>
            </div>
          </div>
          <div className="scroll-hint"><span />{t.hero.hint}</div>
        </article>

        <article id="design" className="story-panel align-left">
          <div className="story-copy">
            <p className="eyebrow">{t.story.designKicker}</p>
            <h2>{t.story.designTitle}</h2>
            <p>{t.story.designCopy}</p>
          </div>
        </article>

        <article className="story-panel align-right">
          <div className="story-copy exploded-copy">
            <p className="eyebrow">{t.story.explodedKicker}</p>
            <h2>{t.story.explodedTitle}</h2>
            <p>{t.story.explodedCopy}</p>
            <div className="layer-labels" aria-label="Keyboard layers">
              {t.story.layers.map((layer, index) => <span key={layer}><i>{String(index + 1).padStart(2, "0")}</i>{layer}</span>)}
            </div>
          </div>
        </article>

        <article id="inside" className="story-panel align-left inside-panel">
          <div className="story-copy">
            <p className="eyebrow">{t.story.insideKicker}</p>
            <h2>{t.story.insideTitle}</h2>
            <p>{t.story.insideCopy}</p>
            <div className="construction-facts"><span>GASKET</span><span>HOT-SWAP</span><span>4500 mAh</span></div>
          </div>
        </article>

        <article id="switches" className="story-panel align-right switch-panel">
          <SwitchControls />
        </article>

        <article className="story-panel align-left reassembly-panel">
          <div className="story-copy">
            <p className="eyebrow">{t.story.reassemblyKicker}</p>
            <h2>{t.story.reassemblyTitle}</h2>
            <p>{t.story.reassemblyCopy}</p>
          </div>
        </article>
      </div>
    </section>
  );
}

const switches: SwitchVariant[] = ["linear", "tactile", "silent"];

function SwitchControls() {
  const { dictionary: t } = useLocale();
  const audioTarget = useRef<HTMLDivElement>(null);
  const switchType = useConfiguratorStore((state) => state.switchType);
  const setSwitchType = useConfiguratorStore((state) => state.setSwitchType);
  const { pressButtonHandlers } = useSwitchPress();
  const switchCopy = t.story[switchType];

  useEffect(() => {
    const target = audioTarget.current;
    if (!target) return;
    // Decode shortly before the controls arrive, outside the initial page load.
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      preloadSwitchClick();
      observer.disconnect();
    }, { rootMargin: "100% 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="story-copy" ref={audioTarget}>
      <p className="eyebrow">{t.story.switchKicker}</p>
      <h2>{t.story.switchTitle}</h2>
      <p>{t.story.switchCopy}</p>
      <div className="switch-selector" role="group" aria-label={t.config.switches}>
        {switches.map((variant) => (
          <button key={variant} type="button" onClick={() => setSwitchType(variant)} className={switchType === variant ? "active" : ""} aria-pressed={switchType === variant} data-testid={`switch-${variant}`}>
            {t.story[variant].name}
          </button>
        ))}
      </div>
      <div className="switch-readout">
        <span>{switchCopy.force}</span><span>{switchCopy.feel}</span><span>{t.story.actuation}</span>
      </div>
      <button className="press-switch" type="button" onPointerEnter={preloadSwitchClick} onFocus={preloadSwitchClick} {...pressButtonHandlers}>
        <i />{t.story.press}
      </button>
    </div>
  );
}
