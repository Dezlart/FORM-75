import type { Metadata, Viewport } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import "./surface.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { ScrollRestoration } from "@/components/providers/ScrollRestoration";

const interLatin = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  variable: "--font-inter-latin",
  weight: "100 900",
  display: "optional",
});
const interCyrillic = localFont({
  src: "../../node_modules/@fontsource-variable/inter/files/inter-cyrillic-wght-normal.woff2",
  variable: "--font-inter-cyrillic",
  weight: "100 900",
  display: "optional",
  // Let Latin glyphs reach the Latin face before its metric-adjusted fallback.
  adjustFontFallback: false,
  declarations: [{ prop: "unicode-range", value: "U+0301,U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116" }],
});

export const metadata: Metadata = {
  title: "FORM 75 — премиальная механическая клавиатура | Concept",
  description: "Интерактивный концепт премиальной механической клавиатуры FORM 75 с 3D-конфигуратором и scroll-driven презентацией.",
  metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
  openGraph: {
    title: "FORM 75 — премиальная механическая клавиатура",
    description: "Интерактивный fictional concept с программной 3D-моделью FORM 75.",
    type: "website",
    locale: "ru_RU",
    siteName: "FORM 75 Concept",
  },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#b8b8b5" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${interCyrillic.variable} ${interLatin.variable}`}>
      <body>
        <Script id="form75-scroll-restoration" strategy="beforeInteractive">
          {`if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; if (!location.hash) scrollTo(0, 0);`}
        </Script>
        <AppProviders><ScrollRestoration />{children}</AppProviders>
      </body>
    </html>
  );
}
