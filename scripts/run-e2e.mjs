import { spawn } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const env = {
  ...process.env,
  HOSTNAME: "127.0.0.1",
  PORT: "3000",
  PLAYWRIGHT_EXTERNAL_SERVER: "1",
  PLAYWRIGHT_BROWSERS_PATH: join(root, ".playwright-browsers"),
};

const server = spawn(process.execPath, [join(root, ".next", "standalone", "server.js")], { cwd: root, env, stdio: "inherit" });

async function waitForServer() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`FORM 75 server exited with code ${server.exitCode}`);
    try {
      const response = await fetch("http://127.0.0.1:3000", { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for the FORM 75 server");
}

async function stopServer() {
  const terminate = async (signal, timeout) => {
    if (server.exitCode !== null) return;
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill(signal);
    await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, timeout))]);
  };
  await terminate("SIGTERM", 5_000);
  await terminate("SIGKILL", 5_000);
}

try {
  await waitForServer();
  const cli = join(root, "node_modules", "@playwright", "test", "cli.js");
  const tests = spawn(process.execPath, [cli, "test", ...process.argv.slice(2)], { cwd: root, env, stdio: "inherit" });
  const code = await new Promise((resolve) => tests.once("exit", (exitCode) => resolve(exitCode ?? 1)));
  process.exitCode = Number(code);
} finally {
  await stopServer();
}
