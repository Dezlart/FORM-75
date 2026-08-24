# FORM 75

FORM 75 is a cinematic, single-page product experience for a fictional premium 75% mechanical keyboard. The project combines a programmatic WebGL product model with scroll-driven storytelling, live configuration, localization, themes, and a constrained AI product guide.

## Project preview

The opening sequence keeps the keyboard in a sticky studio scene while the scroll position changes its camera, lighting, assembly, and layer spacing. The experience then moves into connectivity, a hands-on configurator, technical specifications, and a quiet final statement.

## Features

- Programmatic 80-key keyboard model with independently animated construction layers
- GSAP/ScrollTrigger cinematic timeline with continuous scrub
- Interactive FORM switch model and live keyboard configurator
- Graphite, Silver, and Sand case finishes; three PBT keycap sets; three switch types
- Tasteful backlight presets, light/dark themes, and complete RU/EN copy
- FORM AI panel with local history, input validation, rate limiting, and graceful no-key behavior
- Responsive 3D camera/DPR settings, keyboard-accessible controls, and reduced-motion support
- Playwright E2E coverage and production-oriented Docker packaging

## Tech stack

Next.js App Router, React, strict TypeScript, Tailwind CSS, Three.js, React Three Fiber, Drei, GSAP, ScrollTrigger, Zustand, next-themes, Zod, Google Gen AI SDK, and Playwright.

## Architecture

`src/components/three` owns geometry, scene lighting, camera behavior, and the shared keyboard model. `src/components/sections` owns product narrative sections. Configurator and assistant UI are isolated in their own feature folders. `src/stores` contains only shared product configuration; theme and locale use their dedicated providers.

## 3D system

The keyboard is built from separate bottom case, battery, PCB, dampening, plate, top case, switch, keycap, and rotary-knob groups. Eighty keycaps and switches use shared rounded geometries and instancing. Case, PBT, switch, and light materials read directly from the configurator store.

## Scroll storytelling

A single sticky canvas reads a lightweight mutable GSAP progress value. The R3F scene uses that value every frame to interpolate the keyboard transform, camera, studio light, exploded distances, switch showcase, and reassembly without re-rendering the React page tree on every scroll tick.

## Configurator

Zustand stores case finish, keycap set, switch type, backlight state, and light preset. The controls update the real R3F model, while constrained OrbitControls provide mouse and touch rotation.

## FORM AI

`POST /api/chat` uses Zod limits, a replaceable in-memory IP limiter, server-only `GEMINI_API_KEY`, and the official `@google/genai` Interactions API with `store: false`. `src/data/productKnowledge.ts` is the trusted source for product claims. The site remains fully usable without a Gemini key.

## Localization and themes

Russian is the initial language. Both complete dictionaries live in `src/i18n`, the selection persists locally, and the document `lang` follows it. `next-themes` applies a persisted light or dark token set to the interface and 3D studio.

## Responsive behavior

The 3D canvas uses a lower mobile DPR, responsive FOV, reduced shadows, touch controls, mobile-specific story composition, compact navigation, and a viewport-contained assistant bottom sheet.

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Gemini setup

Copy `.env.example` to `.env.local` and set:

```bash
GEMINI_API_KEY=your_key_here
```

The key is read only by the server route and must never use a `NEXT_PUBLIC_` prefix.

## Docker

```bash
docker compose up --build
```

The multi-stage image runs the Next.js standalone server. No database is included.

## Testing

```bash
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

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
