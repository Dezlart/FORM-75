"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, useState } from "react";
import { KeyboardCanvas } from "@/components/three/KeyboardCanvas";
import { useLocale } from "@/components/providers/LocaleProvider";
import { requestSceneFrames, storyTargetProgress } from "@/lib/storyProgress";
import { playSwitchClick, preloadSwitchClick } from "@/lib/switchSound";
import { useConfiguratorStore } from "@/stores/configurator";
import type { SwitchVariant } from "@/types/product";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export function StoryExperience() {
  const root = useRef<HTMLElement>(null);
  const [activeStage, setActiveStage] = useState(0);
  const { dictionary: t } = useLocale();
  const switchType = useConfiguratorStore((state) => state.switchType);
  const setSwitchType = useConfiguratorStore((state) => state.setSwitchType);
  const setPressed = useConfiguratorStore((state) => state.setSwitchPressed);

  useEffect(() => {
    preloadSwitchClick();
  }, []);

  useGSAP(() => {
    const trigger = ScrollTrigger.create({
      trigger: root.current,
      start: "top top",
      end: "bottom bottom",
      invalidateOnRefresh: true,
      onUpdate: (self) => {
        storyTargetProgress.current = self.progress;
        requestSceneFrames("story", 0);
        const nextStage = Math.min(5, Math.round(self.progress * 5));
        setActiveStage((current) => current === nextStage ? current : nextStage);
      },
    });
    return () => trigger.kill();
  }, { scope: root });

  const switches: SwitchVariant[] = ["linear", "tactile", "silent"];
  const switchCopy = t.story[switchType];

  return (
    <section ref={root} className="story-experience" aria-label="FORM 75 product story">
      <div className="story-sticky">
        <KeyboardCanvas variant="story" label={t.a11y.scene} />
        <div className="story-progress" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map((stage) => <i key={stage} className={activeStage === stage ? "active" : ""} />)}
        </div>
      </div>
      <div className="story-track">
        <article id="top" className="story-panel hero-panel">
          <div className="hero-copy">
            <p className="eyebrow">{t.hero.eyebrow}</p>
            <h1>{t.hero.title}</h1>
            <p className="hero-subtitle">{t.hero.subtitle}</p>
            <p className="hero-support">{t.hero.support}</p>
            <div className="hero-actions">
              <a className="primary-button" href="#design">{t.hero.cta}</a>
              <span>{t.hero.price}</span>
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
          <div className="story-copy">
            <p className="eyebrow">{t.story.switchKicker}</p>
            <h2>{t.story.switchTitle}</h2>
            <p>{t.story.switchCopy}</p>
            <div className="switch-selector" role="group" aria-label={t.config.switches}>
              {switches.map((variant) => (
                <button key={variant} type="button" onClick={() => { setSwitchType(variant); requestSceneFrames("story", 260); }} className={switchType === variant ? "active" : ""} data-testid={`switch-${variant}`}>
                  {t.story[variant].name}
                </button>
              ))}
            </div>
            <div className="switch-readout">
              <span>{switchCopy.force}</span><span>{switchCopy.feel}</span><span>{t.story.actuation}</span>
            </div>
            <button
              className="press-switch"
              type="button"
              onPointerEnter={preloadSwitchClick}
              onFocus={preloadSwitchClick}
              onPointerDown={() => { playSwitchClick(switchType); setPressed(true); requestSceneFrames("story", 420); }}
              onPointerUp={() => { setPressed(false); requestSceneFrames("story", 320); }}
              onPointerLeave={() => { setPressed(false); requestSceneFrames("story", 320); }}
              onPointerCancel={() => { setPressed(false); requestSceneFrames("story", 320); }}
              onKeyDown={(event) => {
                if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
                  playSwitchClick(switchType);
                  setPressed(true);
                  requestSceneFrames("story", 420);
                }
              }}
              onKeyUp={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  setPressed(false);
                  requestSceneFrames("story", 320);
                }
              }}
              onBlur={() => { setPressed(false); requestSceneFrames("story", 320); }}
            >
              <i />{t.story.press}
            </button>
          </div>
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
