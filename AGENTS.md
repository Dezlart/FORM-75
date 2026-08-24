# PROJECT PURPOSE

FORM 75 interactive product showcase.

# STACK

Next.js, React, TypeScript, Tailwind CSS, React Three Fiber, Three.js, GSAP, Zustand, Gemini, Playwright.

# RULES

- TypeScript strict.
- Use npm.
- No unnecessary database.
- `productKnowledge` is the source of truth.
- Never invent FORM 75 specifications.
- Never expose secrets.
- Keep 3D performant.
- Mobile is first-class.
- Respect reduced motion.
- Accessibility is required.
- Reuse the existing architecture.
- Do not replace working architecture without reason.
- Run checks before claiming success.
- Visual UI changes require browser QA.
- Use `$playwright-interactive` for frontend verification.
- Chrome Control may be used as additional browser verification.

# COMMANDS

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run test:e2e
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
