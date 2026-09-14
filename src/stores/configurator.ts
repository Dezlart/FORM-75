import { create } from "zustand";
import type { BacklightPreset, CaseFinish, KeycapVariant, ProductConfiguration, SwitchVariant } from "@/types/product";

interface ConfiguratorState extends ProductConfiguration {
  switchPressed: boolean;
  switchPressSequence: number;
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
  switchPressSequence: 0,
  setCaseFinish: (caseFinish) => set((state) => state.caseFinish === caseFinish ? state : { caseFinish }),
  setKeycaps: (keycaps) => set((state) => state.keycaps === keycaps ? state : { keycaps }),
  setSwitchType: (switchType) => set((state) => state.switchType === switchType ? state : { switchType }),
  setBacklight: (backlight) => set((state) => state.backlight === backlight ? state : { backlight }),
  setBacklightPreset: (backlightPreset) => set((state) => state.backlightPreset === backlightPreset ? state : { backlightPreset }),
  setSwitchPressed: (switchPressed) => set((state) => state.switchPressed === switchPressed ? state : {
    switchPressed,
    switchPressSequence: state.switchPressSequence + (switchPressed ? 1 : 0),
  }),
}));
