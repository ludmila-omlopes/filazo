import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import nextEnv from "@next/env";

const inheritedEnv = { ...process.env };
nextEnv.loadEnvConfig(process.cwd(), true);
// Local workers need the same private credential as the Next process. Never
// write a generated secret to disk or expose it to browser code.
const cronSecret = process.env.CRON_SECRET?.trim() || randomBytes(32).toString("hex");
const server = spawn(process.execPath, [
  "node_modules/next/dist/bin/next", "dev", "--hostname", "localhost", "--port", "3001",
  ...process.argv.slice(2),
], {
  stdio: "inherit",
  // Let Next load and reload application credentials from .env files itself.
  // Passing loadEnvConfig's whole result pins those values in process.env,
  // which takes precedence even after Next detects an edited .env file.
  env: { ...inheritedEnv, CRON_SECRET: cronSecret },
  windowsHide: true,
});
const controller = new AbortController();
const timers = new Set();

async function pollWorker(path) {
  if (controller.signal.aborted) return;
  try {
    const response = await fetch(`http://localhost:3001/api/internal/${path}`, {
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
    });
    if (!response.ok) console.warn(`Local ${path} returned ${response.status}.`);
    await response.body?.cancel();
  } catch {
    // The dev server may still be compiling or restarting. Persisted work will
    // be picked up on the next tick, independently of open browser tabs.
  }
  if (!controller.signal.aborted) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      void pollWorker(path);
    }, 15_000);
    timers.add(timer);
  }
}

for (const path of ["steam-sync-worker", "gog-sync-worker", "game-metadata-worker"]) {
  const timer = setTimeout(() => {
    timers.delete(timer);
    void pollWorker(path);
  }, 10_000);
  timers.add(timer);
}
function stop() {
  controller.abort();
  for (const timer of timers) clearTimeout(timer);
  server.kill();
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
server.on("exit", code => { stop(); process.exitCode = code ?? 0; });
server.on("error", () => { stop(); process.exitCode = 1; });
