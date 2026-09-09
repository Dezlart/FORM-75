"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { LocaleProvider } from "./LocaleProvider";

export function AppProviders({ children }: { children: ReactNode }) {
  // Keep the theme context and saved preference for the keyboard's existing lighting.
  return (
    <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light" enableSystem={false} storageKey="form75-theme-v2" disableTransitionOnChange={false}>
      <LocaleProvider>{children}</LocaleProvider>
    </ThemeProvider>
  );
}
