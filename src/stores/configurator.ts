import { create } from "zustand";
import type { BacklightPreset, CaseFinish, KeycapVariant, ProductConfiguration, SwitchVariant } from "@/types/product";

interface ConfiguratorState extends ProductConfiguration {
  switchPressed: boolean;
  setCaseFinish: (finish: CaseFinish) => void;
  setKeycaps: (keycaps: KeycapVariant) => void;
  setSwitchType: (switchType: SwitchVariant) => void;
  setBacklight: (backlight: boolean) => void;
  setBacklightPreset: (preset: BacklightPreset) => void;
  setSwitchPressed: (pressed: boolean) => void;
}

export const useConfiguratorStore = create<ConfiguratorState>((set) => ({
  caseFinish: "silver",
  keycaps: "porcelain",
  switchType: "linear",
  backlight: true,
  backlightPreset: "neutral",
  switchPressed: false,
  setCaseFinish: (caseFinish) => set({ caseFinish }),
  setKeycaps: (keycaps) => set({ keycaps }),
  setSwitchType: (switchType) => set({ switchType }),
  setBacklight: (backlight) => set({ backlight }),
  setBacklightPreset: (backlightPreset) => set({ backlightPreset }),
  setSwitchPressed: (switchPressed) => set({ switchPressed }),
}));
