export type Locale = "ru" | "en";
export type CaseFinish = "graphite" | "silver" | "sand";
export type KeycapVariant = "obsidian" | "porcelain" | "ember";
export type SwitchVariant = "linear" | "tactile" | "silent";
export type BacklightPreset = "neutral" | "warm" | "ice";

export interface ProductConfiguration {
  caseFinish: CaseFinish;
  keycaps: KeycapVariant;
  switchType: SwitchVariant;
  backlight: boolean;
  backlightPreset: BacklightPreset;
}

export interface KeyDefinition {
  label: string;
  width: number;
  accent?: boolean;
}
