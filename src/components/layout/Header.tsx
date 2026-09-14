"use client";

import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocale } from "@/components/providers/LocaleProvider";

export function Header() {
  const { dictionary: t, locale, toggleLocale } = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let current = false;
    const onScroll = () => {
      const next = window.scrollY > 24;
      if (next === current) return;
      current = next;
      setScrolled(next);
    };
    const frame = window.requestAnimationFrame(onScroll);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const navigation = [
    ["#design", t.nav.design],
    ["#inside", t.nav.inside],
    ["#switches", t.nav.switches],
    ["#connectivity", t.nav.connectivity],
    ["#configurator", t.nav.configurator],
    ["#specs", t.nav.specs],
  ] as const;

  return (
    <header className={`site-header ${scrolled || menuOpen ? "is-scrolled" : ""}`}>
      <div className="header-inner">
        <a className="wordmark" href="#top" aria-label="FORM 75">FORM<span>.</span></a>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {navigation.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
        </nav>
        <div className="header-actions">
          <button className="language-toggle" type="button" onClick={toggleLocale} aria-label={t.a11y.language}>
            <span className={locale === "ru" ? "active" : ""}>RU</span><i />
            <span className={locale === "en" ? "active" : ""}>EN</span>
          </button>
          <button className="icon-button mobile-menu-button" type="button" onClick={() => setMenuOpen((open) => !open)} aria-label={t.nav.menu} aria-expanded={menuOpen}>
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navigation.map(([href, label], index) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)}>
              <span>0{index + 1}</span>{label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
