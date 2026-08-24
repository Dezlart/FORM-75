"use client";

import { useLocale } from "@/components/providers/LocaleProvider";

export function SpecsSection() {
  const { dictionary: t } = useLocale();
  return (
    <section id="specs" className="content-section specs-section">
      <div className="section-heading compact">
        <p className="eyebrow">{t.specs.kicker}</p>
        <h2>{t.specs.title}</h2>
      </div>
      <dl className="spec-list">
        {t.specs.items.map(([label, value], index) => (
          <div key={label}><dt><span>{String(index + 1).padStart(2, "0")}</span>{label}</dt><dd>{value}</dd></div>
        ))}
      </dl>
    </section>
  );
}
