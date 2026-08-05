export type MobileNavigationItem =
  | "home"
  | "catalog"
  | "tonight"
  | "journal";

export type MobileProfileTab =
  | "overview"
  | "games"
  | "journal"
  | "calendar"
  | "playerProfile"
  | "integrations"
  | "assistant"
  | "setup";

type SearchParamsReader = Pick<URLSearchParams, "get">;

export function isMobileProductRoute(pathname: string) {
  return (
    pathname === "/profile" ||
    pathname === "/tonight" ||
    pathname.startsWith("/games/")
  );
}

export function getMobileNavigationCurrent(
  pathname: string,
  searchParams: SearchParamsReader,
): MobileNavigationItem | undefined {
  if (pathname === "/tonight") {
    return "tonight";
  }

  if (pathname.startsWith("/games/")) {
    return "catalog";
  }

  if (pathname !== "/profile") {
    return undefined;
  }

  switch (getMobileProfileTab(searchParams)) {
    case "overview":
      return "home";
    case "games":
      return "catalog";
    case "journal":
      return "journal";
    default:
      return undefined;
  }
}

export function getMobileProfileTab(
  searchParams: SearchParamsReader,
): MobileProfileTab {
  switch (searchParams.get("tab")) {
    case "games":
      return "games";
    case "journal":
    case "diary":
      return "journal";
    case "calendar":
      return "calendar";
    case "player-profile":
    case "playerProfile":
    case "profile":
      return "playerProfile";
    case "integrations":
    case "sources":
      return "integrations";
    case "assistant":
    case "coach":
      return "assistant";
    case "setup":
      return "setup";
    default:
      return "overview";
  }
}

export function getMobileProfileHref(
  tab: MobileProfileTab,
  searchParams: SearchParamsReader,
) {
  const params = new URLSearchParams({
    tab: tab === "playerProfile" ? "player-profile" : tab,
  });
  const viewAsUserId = searchParams.get("viewAs")?.trim();

  if (viewAsUserId) {
    params.set("viewAs", viewAsUserId);
  }

  return `/profile?${params.toString()}`;
}
