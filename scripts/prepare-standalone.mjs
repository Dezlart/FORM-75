import { cpSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");
if (!existsSync(standalone)) process.exit(0);

// Next copies loaded .env / .env.production files into standalone output.
// Deployment credentials belong in the host's runtime environment; remove only
// generated copies, leaving the developer's files in the project root intact.
for (const entry of readdirSync(standalone, { withFileTypes: true })) {
  if ((entry.isFile() || entry.isSymbolicLink()) && (entry.name === ".env" || entry.name.startsWith(".env."))) {
    unlinkSync(join(standalone, entry.name));
  }
}

const staticSource = join(root, ".next", "static");
const staticTarget = join(standalone, ".next", "static");
mkdirSync(staticTarget, { recursive: true });
cpSync(staticSource, staticTarget, { recursive: true });

const publicSource = join(root, "public");
if (existsSync(publicSource)) cpSync(publicSource, join(standalone, "public"), { recursive: true });
