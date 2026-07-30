import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  getMobileNavigationCurrent,
  getMobileProfileHref,
  getMobileProfileTab,
  isMobileProductRoute,
} from "../src/lib/mobile-navigation.ts";

test("mobile product navigation only appears on signed-in product routes", () => {
  for (const pathname of [
    "/profile",
    "/tonight",
    "/games/hades",
  ]) {
    assert.equal(isMobileProductRoute(pathname), true, pathname);
  }

  for (const pathname of [
    "/",
    "/login",
    "/beta",
    "/terms",
    "/privacy",
    "/auth/browser-required",
    "/admin",
    "/admin/feedback",
  ]) {
    assert.equal(isMobileProductRoute(pathname), false, pathname);
  }
});

test("mobile navigation marks profile destinations from the tab query", () => {
  assert.equal(getMobileNavigationCurrent("/profile", new URLSearchParams()), "home");
  assert.equal(
    getMobileNavigationCurrent(
      "/profile",
      new URLSearchParams("tab=overview"),
    ),
    "home",
  );
  assert.equal(
    getMobileNavigationCurrent("/profile", new URLSearchParams("tab=games")),
    "catalog",
  );
  assert.equal(
    getMobileNavigationCurrent("/profile", new URLSearchParams("tab=journal")),
    "journal",
  );
  assert.equal(
    getMobileNavigationCurrent("/profile", new URLSearchParams("tab=diary")),
    "journal",
  );
  assert.equal(
    getMobileNavigationCurrent("/profile", new URLSearchParams("tab=unknown")),
    "home",
  );
});

test("mobile navigation keeps context on Tonight and game detail routes", () => {
  assert.equal(
    getMobileNavigationCurrent("/tonight", new URLSearchParams()),
    "tonight",
  );
  assert.equal(
    getMobileNavigationCurrent("/games/hades", new URLSearchParams()),
    "catalog",
  );
  assert.equal(
    getMobileNavigationCurrent(
      "/profile",
      new URLSearchParams("tab=integrations"),
    ),
    undefined,
  );
});

test("mobile secondary navigation follows every supported profile tab alias", () => {
  assert.equal(getMobileProfileTab(new URLSearchParams("tab=sources")), "integrations");
  assert.equal(getMobileProfileTab(new URLSearchParams("tab=profile")), "playerProfile");
  assert.equal(getMobileProfileTab(new URLSearchParams("tab=coach")), "assistant");
  assert.equal(getMobileProfileTab(new URLSearchParams("tab=setup")), "setup");
  assert.equal(getMobileProfileTab(new URLSearchParams("tab=invalid")), "overview");
});

test("mobile profile destinations preserve admin view-as context", () => {
  const params = new URLSearchParams("tab=calendar&viewAs=user-123&status=ok");

  assert.equal(
    getMobileProfileHref("journal", params),
    "/profile?tab=journal&viewAs=user-123",
  );
  assert.equal(
    getMobileProfileHref("integrations", new URLSearchParams()),
    "/profile?tab=integrations",
  );
});

test("compact buttons preserve 44px touch targets on mobile", () => {
  const buttonSource = readFileSync(
    new URL("../src/components/ui/button.tsx", import.meta.url),
    "utf8",
  );

  assert.match(buttonSource, /xs: .*max-lg:min-h-11/);
  assert.match(buttonSource, /sm: .*max-lg:min-h-11/);
  assert.match(buttonSource, /"icon-xs": .*max-lg:size-11/);
  assert.match(buttonSource, /"icon-sm": .*max-lg:size-11/);
});

test("mobile account controls preserve 44px touch targets", () => {
  const accountMenuSource = readFileSync(
    new URL("../src/components/mobile-app-navigation.tsx", import.meta.url),
    "utf8",
  );

  assert.match(accountMenuSource, /\[&_button\]:min-h-11 \[&_button\]:min-w-11/);
  assert.match(accountMenuSource, /\[&_input\]:min-h-11/);
});

test("mobile shell enables safe-area insets and closes its account menu after navigation", () => {
  const layoutSource = readFileSync(
    new URL("../src/app/layout.tsx", import.meta.url),
    "utf8",
  );
  const accountMenuSource = readFileSync(
    new URL("../src/components/mobile-app-navigation.tsx", import.meta.url),
    "utf8",
  );
  const appNavigationSource = readFileSync(
    new URL("../src/components/mobile-app-navigation.tsx", import.meta.url),
    "utf8",
  );
  const profileRailSource = readFileSync(
    new URL(
      "../src/app/profile/_components/profile-rail.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  const profilePageSource = readFileSync(
    new URL("../src/app/profile/page.tsx", import.meta.url),
    "utf8",
  );
  const globalsSource = readFileSync(
    new URL("../src/app/globals.css", import.meta.url),
    "utf8",
  );

  assert.match(layoutSource, /viewportFit:\s*"cover"/);
  assert.match(layoutSource, /safe-area-inset-left/);
  assert.match(layoutSource, /safe-area-inset-right/);
  assert.match(layoutSource, /signedIn=\{Boolean\(navigationUser\)\}/);
  assert.match(layoutSource, /accountAction=/);
  assert.match(accountMenuSource, /aria-current=/);
  assert.match(accountMenuSource, /lg:hidden/);
  assert.match(accountMenuSource, /removeAttribute\("open"\)/);
  assert.match(accountMenuSource, /event\.key === "Escape"/);
  assert.match(accountMenuSource, /contains\(event\.target as Node\)/);
  assert.match(accountMenuSource, /max-h-\[calc\(100dvh/);
  assert.match(appNavigationSource, /lg:hidden/);
  assert.match(appNavigationSource, /safe-area-inset-left/);
  assert.match(appNavigationSource, /safe-area-inset-right/);
  assert.match(profileRailSource, /max-lg:hidden/);
  assert.doesNotMatch(profileRailSource, /<h1/);
  assert.match(profilePageSource, /<h1 className="sr-only">/);
  assert.match(globalsSource, /safe-area-inset-top/);
});
