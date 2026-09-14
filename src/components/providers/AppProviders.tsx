"use client";

import type { ReactNode } from "react";
import { LocaleProvider } from "./LocaleProvider";
import { WheelScroll } from "./WheelScroll";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <LocaleProvider><WheelScroll />{children}</LocaleProvider>
  );
}
