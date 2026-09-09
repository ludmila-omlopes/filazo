import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

function readPngDimensions(path) {
  const png = readFileSync(new URL(path, import.meta.url));
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  };
}

test("PWA manifest stays installable and online-first", () => {
  const manifestSource = readFileSync(
    new URL("../src/app/manifest.ts", import.meta.url),
    "utf8",
  );

  assert.match(manifestSource, /id:\s*"\/"/);
  assert.match(manifestSource, /scope:\s*"\/"/);
  assert.match(manifestSource, /start_url:\s*"\/profile"/);
  assert.match(manifestSource, /display:\s*"standalone"/);
  assert.match(manifestSource, /purpose:\s*"maskable"/);
  assert.match(manifestSource, /\/profile\?tab=games/);
  assert.match(manifestSource, /\/tonight/);
  assert.match(manifestSource, /\/profile\?tab=journal/);
  assert.doesNotMatch(manifestSource, /serviceWorker|cache|offline/i);
});

test("PWA icons have the declared dimensions", () => {
  assert.deepEqual(readPngDimensions("../public/icons/filazo-192.png"), {
    width: 192,
    height: 192,
  });
  assert.deepEqual(readPngDimensions("../public/icons/filazo-512.png"), {
    width: 512,
    height: 512,
  });
  assert.deepEqual(
    readPngDimensions("../public/icons/filazo-maskable-512.png"),
    { width: 512, height: 512 },
  );
});

test("install help handles platform guidance, standalone mode, and dismissal", () => {
  const installSource = readFileSync(
    new URL("../src/components/install-app-card.tsx", import.meta.url),
    "utf8",
  );
  const accountMenuSource = readFileSync(
    new URL("../src/components/mobile-app-navigation.tsx", import.meta.url),
    "utf8",
  );

  assert.match(installSource, /beforeinstallprompt/);
  assert.match(installSource, /appinstalled/);
  assert.match(installSource, /display-mode: standalone/);
  assert.match(installSource, /navigator.*standalone/s);
  assert.match(installSource, /localStorage\.setItem/);
  assert.match(installSource, /install\.iosHelp/);
  assert.match(installSource, /install\.browserHelp/);
  assert.match(accountMenuSource, /<InstallAppCard \/>/);
});
