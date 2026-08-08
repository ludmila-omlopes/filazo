import { prisma } from "./prisma.ts";

export const BETA_SETTINGS_ID = "default";
export const DEFAULT_BETA_SUBMISSIONS_OPEN = false;

export async function getBetaSubmissionsOpen() {
  const settings = await prisma.betaSettings.findUnique({
    where: { id: BETA_SETTINGS_ID },
  });

  return settings?.testerApplicationsOpen ?? DEFAULT_BETA_SUBMISSIONS_OPEN;
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
