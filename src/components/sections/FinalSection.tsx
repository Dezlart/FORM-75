"use client";

import { ArrowUpRight } from "lucide-react";
import { useLocale } from "@/components/providers/LocaleProvider";

export function FinalSection() {
  const { dictionary: t } = useLocale();
  return (
    <section id="final" className="final-section">
      <p className="eyebrow">{t.final.eyebrow}</p>
      <h2>{t.final.title}</h2>
      <a className="final-cta" href="#configurator">{t.final.cta}<ArrowUpRight /></a>
      <div className="final-meta"><span>FORM 75 / 2026</span><span>{t.final.disclaimer}</span></div>
    </section>
  );
}
