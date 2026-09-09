import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const VIEWPORTS = [
  { name: "360x800", width: 360, height: 800 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "844x390", width: 844, height: 390 },
];

const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/beta",
  "/terms",
  "/privacy",
  "/auth/browser-required",
];

function getArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA
      ? path.join(
          process.env.LOCALAPPDATA,
          "Google",
          "Chrome",
          "Application",
          "chrome.exe",
        )
      : null,
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);

  return candidates.find((candidate) => existsSync(candidate));
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForJson(url, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response.json();
      }
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }

  throw new Error(
    `Chrome DevTools did not become ready: ${lastError instanceof Error ? lastError.message : "timeout"}`,
  );
}

class DevToolsClient {
  constructor(url) {
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.socket = new WebSocket(url);
  }

  async connect() {
    if (this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });

    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) {
          return;
        }
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
        return;
      }

      const listeners = this.listeners.get(message.method) ?? [];
      for (const listener of listeners) {
        listener(message.params);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    const response = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    this.socket.send(JSON.stringify({ id, method, params }));
    return response;
  }

  once(method, timeoutMs = 15_000) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.off(method, listener);
        reject(new Error(`Timed out waiting for ${method}`));
      }, timeoutMs);
      const listener = (params) => {
        clearTimeout(timeout);
        this.off(method, listener);
        resolve(params);
      };
      const listeners = this.listeners.get(method) ?? [];
      listeners.push(listener);
      this.listeners.set(method, listeners);
    });
  }

  off(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    this.listeners.set(
      method,
      listeners.filter((candidate) => candidate !== listener),
    );
  }

  close() {
    this.socket.close();
  }
}

async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });

  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text ?? "Browser evaluation failed");
  }

  return result.result.value;
}

async function navigate(client, url) {
  const loaded = client.once("Page.loadEventFired");
  await client.send("Page.navigate", { url });
  await loaded;
  await evaluate(
    client,
    "document.fonts.ready.then(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))",
  );
}

function assertCheck(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

const baseUrl = new URL(
  getArgument("--base-url") ??
    process.env.FILAZO_QA_BASE_URL ??
    "http://localhost:3001",
);
const chromePath = getArgument("--chrome") ?? findChrome();
if (!chromePath) {
  throw new Error("Chrome was not found. Set CHROME_PATH or pass --chrome.");
}

const outputDirectory = path.resolve(
  getArgument("--output") ??
    process.env.FILAZO_QA_OUTPUT ??
    path.join(tmpdir(), "filazo-mobile-browser-qa"),
);
await mkdir(outputDirectory, { recursive: true });

const browserProfile = await mkdtemp(path.join(tmpdir(), "filazo-qa-chrome-"));
const debuggingPort = 19_000 + Math.floor(Math.random() * 1_000);
const browser = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${debuggingPort}`,
    `--user-data-dir=${browserProfile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

let client;
const failures = [];
const results = [];

try {
  await waitForJson(`http://127.0.0.1:${debuggingPort}/json/version`);
  const targetResponse = await fetch(
    `http://127.0.0.1:${debuggingPort}/json/new?${encodeURIComponent("about:blank")}`,
    { method: "PUT" },
  );
  if (!targetResponse.ok) {
    throw new Error(`Could not create Chrome target: HTTP ${targetResponse.status}`);
  }
  const target = await targetResponse.json();
  client = new DevToolsClient(target.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });

  for (const viewport of VIEWPORTS) {
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      screenWidth: viewport.width,
      screenHeight: viewport.height,
      deviceScaleFactor: 1,
      mobile: true,
    });
    await navigate(client, new URL("/", baseUrl).href);

    const shell = await evaluate(
      client,
      `(() => {
        const header = document.querySelector(".site-header");
        const trigger = header?.querySelector("details summary");
        const headerRect = header?.getBoundingClientRect();
        const triggerRect = trigger?.getBoundingClientRect();
        return {
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          scrollWidth: document.documentElement.scrollWidth,
          headerVisible: Boolean(headerRect && headerRect.bottom > 0 && headerRect.top < window.innerHeight),
          triggerWidth: triggerRect?.width ?? 0,
          triggerHeight: triggerRect?.height ?? 0,
          bottomNavigationPresent: Boolean(document.querySelector(".mobile-app-navigation")),
        };
      })()`,
    );

    assertCheck(
      shell.viewportWidth === viewport.width &&
        shell.viewportHeight === viewport.height,
      `${viewport.name}: Chrome emulation returned ${shell.viewportWidth}x${shell.viewportHeight}`,
      failures,
    );
    assertCheck(
      shell.scrollWidth <= shell.viewportWidth + 1,
      `${viewport.name}: horizontal overflow (${shell.scrollWidth}px > ${shell.viewportWidth}px)`,
      failures,
    );
    assertCheck(shell.headerVisible, `${viewport.name}: header is not visible`, failures);
    assertCheck(
      shell.triggerWidth >= 44 && shell.triggerHeight >= 44,
      `${viewport.name}: account trigger is smaller than 44x44`,
      failures,
    );
    assertCheck(
      !shell.bottomNavigationPresent,
      `${viewport.name}: signed-out landing rendered the product bottom navigation`,
      failures,
    );

    const screenshot = await client.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(
      path.join(outputDirectory, `landing-${viewport.name}.png`),
      Buffer.from(screenshot.data, "base64"),
    );

    if (viewport.width <= 430) {
      await evaluate(
        client,
        'document.querySelector(".site-header details summary")?.click()',
      );
      await evaluate(
        client,
        "new Promise((resolve) => requestAnimationFrame(resolve))",
      );
      const menu = await evaluate(
        client,
        `(() => {
          const panel = document.querySelector(".site-header details[open] > div");
          const rect = panel?.getBoundingClientRect();
          const targets = panel ? [...panel.querySelectorAll("a, button, input, summary")] : [];
          const undersized = targets.filter((target) => {
            const targetRect = target.getBoundingClientRect();
            return targetRect.width < 44 || targetRect.height < 44;
          }).length;
          return {
            open: Boolean(panel),
            left: rect?.left ?? -1,
            right: rect?.right ?? Number.POSITIVE_INFINITY,
            top: rect?.top ?? -1,
            bottom: rect?.bottom ?? Number.POSITIVE_INFINITY,
            visualBottom: visualViewport ? visualViewport.offsetTop + visualViewport.height : innerHeight,
            undersized,
          };
        })()`,
      );
      assertCheck(menu.open, `${viewport.name}: account menu did not open`, failures);
      assertCheck(
        menu.left >= 0 && menu.right <= viewport.width + 1,
        `${viewport.name}: account menu exceeds horizontal viewport bounds`,
        failures,
      );
      assertCheck(
        menu.top >= 0 && menu.bottom <= menu.visualBottom + 1,
        `${viewport.name}: account menu exceeds the visual viewport`,
        failures,
      );
      assertCheck(
        menu.undersized === 0,
        `${viewport.name}: account menu has ${menu.undersized} targets below 44x44`,
        failures,
      );
    }

    results.push({ viewport: viewport.name, ...shell });
  }

  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    screenWidth: 390,
    screenHeight: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  for (const route of PUBLIC_ROUTES) {
    await navigate(client, new URL(route, baseUrl).href);
    const routeCheck = await evaluate(
      client,
      `({
        path: location.pathname,
        viewportWidth: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        bottomNavigationPresent: Boolean(document.querySelector(".mobile-app-navigation")),
      })`,
    );
    assertCheck(
      routeCheck.scrollWidth <= routeCheck.viewportWidth + 1,
      `${route}: horizontal overflow at 390x844`,
      failures,
    );
    assertCheck(
      !routeCheck.bottomNavigationPresent,
      `${route}: signed-out public route rendered the product bottom navigation`,
      failures,
    );
  }

  await client.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await navigate(client, new URL("/", baseUrl).href);
  const textScaleCheck = await evaluate(
    client,
    `(() => {
      document.documentElement.style.fontSize = "200%";
      document.querySelectorAll("details[open]").forEach((details) => details.removeAttribute("open"));
      window.scrollTo(0, 0);
      const bodyStyle = getComputedStyle(document.body);
      const heading = document.querySelector("main h1");
      const headingRect = heading?.getBoundingClientRect();
      const headingParentRect = heading?.parentElement?.getBoundingClientRect();
      const headingParentStyle = heading?.parentElement ? getComputedStyle(heading.parentElement) : null;
      return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => {
        const clippedText = [...document.querySelectorAll("body *")]
          .filter((element) => element.getAttribute("aria-hidden") !== "true")
          .filter((element) => [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()))
          .map((element) => ({ element, rect: element.getBoundingClientRect() }))
          .filter(({ element, rect }) => {
            const style = getComputedStyle(element);
            return element.checkVisibility() && style.display !== "none" && style.visibility !== "hidden" && rect.bottom > 0 && rect.top < innerHeight;
          })
          .filter(({ rect }) => rect.left < -1 || rect.right > innerWidth + 1)
          .map(({ element, rect }) => ({
            text: element.textContent?.trim().slice(0, 80),
            left: Math.round(rect.left),
            right: Math.round(rect.right),
          }));
        resolve({
          viewportWidth: innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          bodyTransitionDuration: bodyStyle.transitionDuration,
          headingClientWidth: heading?.clientWidth ?? 0,
          headingScrollWidth: heading?.scrollWidth ?? Number.POSITIVE_INFINITY,
          headingLeft: headingRect?.left ?? -1,
          headingRight: headingRect?.right ?? Number.POSITIVE_INFINITY,
          headingParentWidth: headingParentRect?.width ?? 0,
          headingParentMinWidth: headingParentStyle?.minWidth ?? "missing",
          headingParentCssWidth: headingParentStyle?.width ?? "missing",
          headingParentFlexBasis: headingParentStyle?.flexBasis ?? "missing",
          clippedText,
        });
      })));
    })()`,
  );
  assertCheck(
    textScaleCheck.scrollWidth <= textScaleCheck.viewportWidth + 1,
    `200% text scale: horizontal overflow (${textScaleCheck.scrollWidth}px > ${textScaleCheck.viewportWidth}px)`,
    failures,
  );
  assertCheck(
    textScaleCheck.headingLeft >= 0 &&
      textScaleCheck.headingRight <= textScaleCheck.viewportWidth + 1,
    `200% text scale: heading exceeds viewport bounds (${textScaleCheck.headingLeft}px..${textScaleCheck.headingRight}px; parent ${textScaleCheck.headingParentWidth}px, min ${textScaleCheck.headingParentMinWidth}, width ${textScaleCheck.headingParentCssWidth}, basis ${textScaleCheck.headingParentFlexBasis})`,
    failures,
  );
  assertCheck(
    textScaleCheck.clippedText.length === 0,
    `200% text scale: visible text is clipped ${JSON.stringify(textScaleCheck.clippedText)}`,
    failures,
  );
  assertCheck(
    textScaleCheck.headingScrollWidth <= textScaleCheck.headingClientWidth + 1,
    `200% text scale: heading is clipped (${textScaleCheck.headingScrollWidth}px > ${textScaleCheck.headingClientWidth}px)`,
    failures,
  );
  assertCheck(
    textScaleCheck.bodyTransitionDuration
      .split(",")
      .every((duration) => Number.parseFloat(duration) === 0),
    `reduced motion: body transition remains ${textScaleCheck.bodyTransitionDuration}`,
    failures,
  );
  const textScaleScreenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  await writeFile(
    path.join(outputDirectory, "landing-390x844-text-200.png"),
    Buffer.from(textScaleScreenshot.data, "base64"),
  );
} finally {
  client?.close();
  if (browser.exitCode === null) {
    const browserExited = new Promise((resolve) =>
      browser.once("exit", resolve),
    );
    browser.kill();
    await Promise.race([browserExited, delay(2_000)]);
  }
  await rm(browserProfile, { recursive: true, force: true }).catch(() => {});
}

console.log(JSON.stringify({ baseUrl: baseUrl.href, outputDirectory, results }, null, 2));

if (failures.length > 0) {
  console.error("\nMobile browser QA failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("\nMobile browser QA passed.");
}
