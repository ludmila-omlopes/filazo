import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

process.loadEnvFile(".env");
const key = process.env.STRIPE_SECRET_KEY?.trim();
if (!key || !/^(sk|rk)_test_/.test(key)) {
  throw new Error("Local webhook forwarding requires a test STRIPE_SECRET_KEY in .env.");
}

// Pin the official CLI. Credentials travel through the child environment,
// never command-line arguments or terminal output.
const args = ["exec", "--yes", "--package=@stripe/cli@1.50.11", "--", "stripe",
  "listen", "--forward-to", "http://localhost:3001/api/billing/webhook"];
const cli = process.platform === "win32"
  ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `npm ${args.join(" ")}`], {
    env: { ...process.env, STRIPE_API_KEY: key }, windowsHide: true,
  })
  : spawn("npm", args, { env: { ...process.env, STRIPE_API_KEY: key } });

function handleLine(line) {
  const secret = line.match(/whsec_[A-Za-z0-9]+/)?.[0];
  if (secret) {
    const current = readFileSync(".env", "utf8");
    const setting = `STRIPE_WEBHOOK_SECRET="${secret}"`;
    const updated = /^STRIPE_WEBHOOK_SECRET=/m.test(current)
      ? current.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, setting)
      : `${current.trimEnd()}\n${setting}\n`;
    if (updated !== current) writeFileSync(".env", updated);
  }
  process.stdout.write(line.replace(/whsec_[A-Za-z0-9]+/g, "[saved in local .env]"));
}

// Buffer complete lines so a key split across stream chunks cannot leak.
for (const stream of [cli.stdout, cli.stderr]) {
  stream.setEncoding("utf8");
  let pending = "";
  stream.on("data", (chunk) => {
    pending += chunk;
    let end;
    while ((end = pending.indexOf("\n")) !== -1) {
      handleLine(pending.slice(0, end + 1));
      pending = pending.slice(end + 1);
    }
  });
  stream.on("end", () => { if (pending) handleLine(pending); });
}
cli.on("error", () => {
  console.error("Could not start Stripe CLI. Check npm and network access.");
  process.exitCode = 1;
});
cli.on("exit", (code) => { process.exitCode = code ?? 1; });
