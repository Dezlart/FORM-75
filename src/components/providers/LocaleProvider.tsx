"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dictionaries } from "@/i18n";
import { readStorage, writeStorage } from "@/lib/safeStorage";
import type { Dictionary } from "@/i18n/ru";
import type { Locale } from "@/types/product";

interface LocaleContextValue {
  locale: Locale;
  dictionary: Dictionary;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ru");

  useEffect(() => {
    const saved = readStorage("form75-locale");
    if (saved !== "ru" && saved !== "en") return;
    const frame = window.requestAnimationFrame(() => setLocaleState(saved));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    writeStorage("form75-locale", nextLocale);
  }, []);

  const toggleLocale = useCallback(() => setLocale(locale === "ru" ? "en" : "ru"), [locale, setLocale]);
  const value = useMemo(() => ({ locale, dictionary: dictionaries[locale], setLocale, toggleLocale }), [locale, setLocale, toggleLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}
