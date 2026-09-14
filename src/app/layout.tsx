import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@fontsource-variable/inter";
import "./globals.css";
import "./surface.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { ScrollRestoration } from "@/components/providers/ScrollRestoration";

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
    <html lang="ru">
      <body>
        <Script id="form75-scroll-restoration" strategy="beforeInteractive">
          {`if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; if (!location.hash) scrollTo(0, 0);`}
        </Script>
        <AppProviders><ScrollRestoration />{children}</AppProviders>
      </body>
    </html>
  );
}
