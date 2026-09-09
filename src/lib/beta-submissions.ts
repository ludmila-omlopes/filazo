import { unstable_cache } from "next/cache";
import { prisma } from "./prisma.ts";

export const BETA_SETTINGS_ID = "default";
export const DEFAULT_BETA_SUBMISSIONS_OPEN = false;
export const BETA_SUBMISSIONS_CACHE_TAG = "beta-submissions";

const getCachedBetaSubmissionsOpen = unstable_cache(async () => {
  const settings = await prisma.betaSettings.findUnique({
    where: { id: BETA_SETTINGS_ID },
  });

  return settings?.testerApplicationsOpen ?? DEFAULT_BETA_SUBMISSIONS_OPEN;
}, [BETA_SUBMISSIONS_CACHE_TAG], {
  tags: [BETA_SUBMISSIONS_CACHE_TAG],
});

export async function getBetaSubmissionsOpen() {
  return getCachedBetaSubmissionsOpen();
}

export async function setBetaSubmissionsOpen(open: boolean) {
  return prisma.betaSettings.upsert({
    where: { id: BETA_SETTINGS_ID },
    update: { testerApplicationsOpen: open },
    create: {
      id: BETA_SETTINGS_ID,
      testerApplicationsOpen: open,
    },
  });
}
