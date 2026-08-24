import { cpSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const standalone = join(root, ".next", "standalone");
if (!existsSync(standalone)) process.exit(0);

const staticSource = join(root, ".next", "static");
const staticTarget = join(standalone, ".next", "static");
mkdirSync(staticTarget, { recursive: true });
cpSync(staticSource, staticTarget, { recursive: true });

const publicSource = join(root, "public");
if (existsSync(publicSource)) cpSync(publicSource, join(standalone, "public"), { recursive: true });
