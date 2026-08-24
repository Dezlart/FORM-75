"use client";

import { KeyboardCanvas } from "@/components/three/KeyboardCanvas";
import { useLocale } from "@/components/providers/LocaleProvider";
import { useConfiguratorStore } from "@/stores/configurator";
import { useShallow } from "zustand/react/shallow";
import type { BacklightPreset, CaseFinish, KeycapVariant, SwitchVariant } from "@/types/product";

export function ConfiguratorSection() {
  const { dictionary: t } = useLocale();
  const state = useConfiguratorStore(useShallow((store) => ({
    caseFinish: store.caseFinish,
    keycaps: store.keycaps,
    switchType: store.switchType,
    backlight: store.backlight,
    backlightPreset: store.backlightPreset,
    setCaseFinish: store.setCaseFinish,
    setKeycaps: store.setKeycaps,
    setSwitchType: store.setSwitchType,
    setBacklight: store.setBacklight,
    setBacklightPreset: store.setBacklightPreset,
  })));
  const finishes: CaseFinish[] = ["graphite", "silver", "sand"];
  const keycaps: KeycapVariant[] = ["obsidian", "porcelain", "ember"];
  const switches: SwitchVariant[] = ["linear", "tactile", "silent"];
  const presets: BacklightPreset[] = ["neutral", "warm", "ice"];

  return (
    <section id="configurator" className="configurator-section">
      <div className="configurator-visual">
        <KeyboardCanvas variant="configurator" label={t.a11y.scene} />
        <p className="rotate-hint">↔ {t.config.rotate}</p>
      </div>
      <div className="configurator-controls">
        <p className="eyebrow">{t.config.kicker}</p>
        <h2>{t.config.title}</h2>
        <p className="config-copy">{t.config.copy}</p>
        <OptionGroup label={t.config.finish}>
          {finishes.map((value) => <Option key={value} active={state.caseFinish === value} onClick={() => state.setCaseFinish(value)} testId={`finish-${value}`} swatch={`finish-${value}`}>{t.config[value]}</Option>)}
        </OptionGroup>
        <OptionGroup label={t.config.keycaps}>
          {keycaps.map((value) => <Option key={value} active={state.keycaps === value} onClick={() => state.setKeycaps(value)} testId={`keycaps-${value}`} swatch={`keycaps-${value}`}>{t.config[value]}</Option>)}
        </OptionGroup>
        <OptionGroup label={t.config.switches}>
          {switches.map((value) => <Option key={value} active={state.switchType === value} onClick={() => state.setSwitchType(value)} testId={`config-switch-${value}`}>{t.config[value]}</Option>)}
        </OptionGroup>
        <div className="backlight-row">
          <div><span className="option-label">{t.config.backlight}</span><strong>{state.backlight ? t.config.backlightOn : t.config.backlightOff}</strong></div>
          <button type="button" className={`toggle ${state.backlight ? "on" : ""}`} onClick={() => state.setBacklight(!state.backlight)} aria-pressed={state.backlight} data-testid="backlight-toggle"><i /></button>
        </div>
        {state.backlight && <OptionGroup label={t.config.lightColor}>{presets.map((value) => <Option key={value} active={state.backlightPreset === value} onClick={() => state.setBacklightPreset(value)} swatch={`light-${value}`}>{t.config[value]}</Option>)}</OptionGroup>}
        <a className="configure-cta" href="#final"><span>{t.config.cta}</span><small>{t.config.concept}</small></a>
      </div>
    </section>
  );
}

function OptionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return <fieldset className="option-group"><legend>{label}</legend><div>{children}</div></fieldset>;
}

function Option({ children, active, onClick, swatch, testId }: { children: React.ReactNode; active: boolean; onClick: () => void; swatch?: string; testId?: string }) {
  return <button type="button" className={`option ${active ? "active" : ""}`} onClick={onClick} aria-pressed={active} data-testid={testId}>{swatch && <i className={swatch} />}{children}</button>;
}
