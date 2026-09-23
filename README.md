# FORM 75

FORM 75 is a cinematic, single-page product experience for a fictional premium 75% mechanical keyboard. The project combines a programmatic WebGL product model with scroll-driven storytelling, live configuration, localization, and a constrained AI product guide.

## Project preview

The opening sequence keeps the keyboard in a sticky studio scene while the scroll position changes its camera, lighting, assembly, and layer spacing. The experience then moves into connectivity, a hands-on configurator, technical specifications, and a quiet final statement.

## Features

- Programmatic 80-key keyboard model with independently animated construction layers
- Scroll-driven cinematic timeline with continuous scrub and cached section measurements
- Interactive FORM switch model and live keyboard configurator
- Graphite, Silver, and Sand case finishes; three PBT keycap sets; three switch types
- Tasteful backlight presets, the fixed silver presentation, and complete RU/EN copy
- FORM AI panel with local history, input validation, rate limiting, and graceful no-key behavior
- Responsive 3D camera/DPR settings, keyboard-accessible controls, and reduced-motion support
- Playwright E2E coverage and production-oriented Docker packaging

## Tech stack

Next.js App Router, React, strict TypeScript, Tailwind CSS, Three.js, React Three Fiber, Drei, Zustand, Zod, Google Gen AI SDK, and Playwright. Use Node.js 24 LTS and npm.

## Architecture

`src/components/three` owns geometry, scene lighting, camera behavior, and the shared keyboard model. `src/components/sections` owns product narrative sections. Configurator and assistant UI are isolated in their own feature folders. `src/stores` contains only shared product configuration; locale uses its dedicated provider.

## 3D system

The keyboard is built from separate bottom case, battery, PCB, dampening, plate, top case, switch, keycap, and rotary-knob groups. Eighty keycaps and switches use shared rounded geometries and instancing. Identical vertices and material batches are shared without removing triangles. Case, PBT, switch, and light materials read directly from the configurator store.

The lightweight canvas wrapper loads the Three.js renderer only after hardware WebGL2 is available. The configurator starts near the viewport. Once visited, scenes keep their GPU resources and suspend rendering outside the viewport or in a hidden tab. Stable scenes stop requesting frames. Unsupported devices retain interactive static product renders.

## Scroll storytelling

A single sticky canvas reads a lightweight mutable scroll progress value. ResizeObserver, viewport changes and font readiness refresh cached section bounds; scrolling itself does not measure layout. The existing spring interpolation drives the keyboard transform, camera, studio light, exploded distances, switch showcase, and reassembly without re-rendering the React page tree on every scroll tick. Desktop wheel smoothing and reduced-motion behavior are preserved.

## Configurator

Zustand stores case finish, keycap set, switch type, backlight state, and light preset. The controls update the real R3F model, while constrained OrbitControls provide mouse and touch rotation.

## FORM AI

`POST /api/chat` accepts JSON and reads at most 20,000 UTF-8 bytes. It uses Zod validation, a bounded in-memory IP limiter, and a server-only AI credential. `OPENROUTER_API_KEY` uses the zero-cost OpenRouter Free Models Router and takes priority; responses that exhaust their first token budget are retried once instead of returning incomplete text. `GEMINI_API_KEY` remains available as a direct Gemini fallback through the official `@google/genai` Interactions API with `store: false`. `src/data/productKnowledge.ts` is the trusted source for product claims. The site remains fully usable without an AI key. Assistant code and saved history load when its panel is opened.

## Localization and appearance

Russian is the initial language. Both complete dictionaries live in `src/i18n`, the selection persists locally, and the document `lang` follows it. The site has one fixed silver palette and one studio lighting setup: the keyboard uses the former dark-mode materials and reflections on every device. Browser color scheme and previously saved theme preferences have no effect.

## Responsive behavior

The 3D canvas starts at DPR 1 on mobile and can adapt up to 1.5 when sustained animation has headroom, capped by the device pixel ratio. It never renders below one pixel per CSS pixel. Responsive FOV, shared studio reflections, touch controls, mobile story composition, compact navigation, and the viewport-contained assistant bottom sheet are preserved. The complete configurator surface rotates the model; page scrolling remains available outside it.

Cold-load delivery uses Next.js `inlineCss` (experimental, production only) for this single-page site's small stylesheet. The local Latin and Cyrillic Inter subsets are preloaded; `font-display: optional` keeps a slow font from shifting already-visible text. GPU detection waits until page load and an idle opportunity after two paint frames. The configurator waits until it approaches the viewport. Scene shaders use Three.js `compileAsync` before the first draw, retaining the preview until that draw completes; browsers without parallel shader compilation use Three.js's compatibility path. First-load audits should cover both hardware WebGL and the static fallback: a high Lighthouse score for the fallback does not measure shader startup. Next.js/React runtime coverage and framework polyfill warnings can remain; do not patch framework internals to suppress them.

## Getting started

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## AI setup

Copy `.env.example` to `.env.local` and set an OpenRouter key:

```bash
OPENROUTER_API_KEY=your_key_here
```

Alternatively, set `GEMINI_API_KEY` to use Gemini directly. If both are present, the free OpenRouter route takes priority. Free routing has lower rate limits and model availability can vary. Keys are read only by the server route and must never use a `NEXT_PUBLIC_` prefix. Set optional `SITE_URL` to your public HTTPS origin before building to supply the metadata base; no demonstration domain is embedded in the site.

## Production hosting

```bash
npm ci
npm run build
npm start
```

The build prerenders the homepage and packages a Node.js standalone server. `postbuild` includes `public` and `.next/static`, so the complete `.next/standalone` directory can also be deployed directly and started with `node server.js`. Set `PORT` and `HOSTNAME` as required by the host. Keep Gemini credentials in runtime environment variables. Static-only hosting cannot run `/api/chat`.

Terminate HTTPS at the hosting platform or reverse proxy. That proxy must replace untrusted `X-Forwarded-For` / `X-Real-IP` headers with the actual client address; the API uses those headers for rate limiting. The built-in limiter is per process: if running multiple instances, enforce a shared limit at the hosting gateway. No database is required by the application.

Hashed Next.js bundles and the statically imported desktop/mobile hero previews use the framework's immutable cache policy. Regenerating either hero changes its content-hashed URL automatically. Other public product images and audio are cached for one day with background revalidation; purge the CDN if replacing these files and immediate propagation is required. Browser source maps, test reports, browser downloads, local environment files and historical QA artifacts are not part of the runtime deployment. Postbuild removes environment files copied by Next.js; the original local files stay in the project directory.

## Docker

```bash
docker compose up --build
```

The multi-stage image runs the standalone server as a non-root user. For Compose, set `OPENROUTER_API_KEY` (or `GEMINI_API_KEY`) and optional `SITE_URL` in your shell or a local `.env` file; Compose does not read `.env.local`. `SITE_URL` is a build argument, while the AI key is only passed to the running container. Rebuild after changing the public site URL. No database is included.

## Testing

```bash
npm run lint
npm run typecheck
npm run playwright:install
npm run test:e2e
```

`test:e2e` builds production first and starts an isolated standalone server on port 3101. Set `PLAYWRIGHT_PORT` if that port is occupied. Chromium, mobile Chromium, desktop WebKit and iPhone WebKit cover the interface, switch input/audio, scrolling, fallbacks, API limits and reduced motion. Hardware-only checks explicitly skip when a browser cannot create hardware WebGL2. To use locally installed Chrome for those checks, set `PLAYWRIGHT_CHROMIUM_CHANNEL=chrome` and run the Chromium projects. Emulation does not replace a final check on physical budget Android and iPhone devices.

`PLAYWRIGHT_OUTPUT_DIR` and `PLAYWRIGHT_HTML_OUTPUT_DIR` can place QA evidence outside the project. Keep maintained tests and fallback assets; generated reports and browser caches are ignored. `npm run capture:fallbacks` regenerates the static fallback renders using Chrome and the running site (`FORM75_URL` overrides its address).

## Project structure

```text
src/app               App Router pages and server API
src/components        Layout, sections, 3D, configurator, assistant
src/data              Trusted FORM 75 product knowledge
src/i18n              Typed Russian and English dictionaries
src/lib               Scroll bridge and server rate limiting
src/stores            Zustand product configuration
src/types             Product and chat contracts
tests/e2e             Browser-level regression tests
```

## Disclaimer

FORM 75 is a fictional concept product created for portfolio/demo purposes. The configuration CTA does not initiate checkout.
