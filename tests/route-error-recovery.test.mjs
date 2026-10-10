import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const React = require("react");
const { ErrorBoundaryHandler } = require("next/dist/client/components/error-boundary");

function load(path, mocks) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const exports = {};
  new Function("require", "exports", outputText)((name) => {
    if (name in mocks) return mocks[name];
    if (name.startsWith("@/")) throw new Error(`Unmocked dependency: ${name}`);
    return require(name);
  }, exports);
  return exports;
}

function findElement(node, predicate) {
  if (!React.isValidElement(node)) return null;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props.children)) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

const { RouteErrorState } = load("../src/components/route-error-state.tsx", {
  react: { ...React, useEffect() {} },
  "next/link": { default: "a" },
  "@/components/illustrations": { MemoryCardIllustration: "svg" },
  "@/components/locale-provider": { useTranslations: () => key => key },
  "@/components/ui/button": { Button: "button" },
});

for (const route of ["", "profile/", "catalog/", "games/[slug]/", "tonight/"]) {
  test(`${route || "root"} error recovery uses the callback supplied by the installed Next.js`, () => {
    const { default: ErrorPage } = load(`../src/app/${route}error.tsx`, {
      "@/components/route-error-state": { RouteErrorState },
    });
    const originalError = new Error("Temporary page failure");
    const boundary = new ErrorBoundaryHandler({ pathname: `/${route}`, errorComponent: ErrorPage });
    let refreshes = 0;
    boundary.context = { refresh() { refreshes++; } };
    boundary.setState = update => { boundary.state = { ...boundary.state, ...update }; };

    // Use real framework props, not a hand-written callback fixture that could
    // accidentally repeat an obsolete API name from the application.
    for (let attempt = 1; attempt <= 3; attempt++) {
      boundary.state = { ...boundary.state, ...ErrorBoundaryHandler.getDerivedStateFromError(originalError) };
      const fallback = findElement(boundary.render(), node => node.type === ErrorPage);
      assert.ok(fallback);
      const shared = ErrorPage(fallback.props);
      assert.equal(shared.props.error, originalError);
      const tree = shared.type(shared.props);
      const button = findElement(tree, node => node.type === "button" && node.props.children === "routeError.retry");
      assert.ok(button, "The recovery button must be present");
      assert.doesNotThrow(() => button.props.onClick());
      assert.equal(refreshes, attempt, "Retry must re-fetch page data, not just clear the error");
      assert.equal(boundary.state.error, null);
    }
  });
}
