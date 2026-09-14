import { AdSenseSlot } from "@/components/adsense-slot";
import { getAdSenseConfig, getViewerAdSenseConfig, type AdPlacement } from "@/lib/adsense";
import { createTranslator, type Locale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

export async function AdSenseBanner({ placement, locale }: { placement: AdPlacement; locale: Locale }) {
  const configured = getAdSenseConfig(placement);
  if (!configured) return null;

  const config = await getViewerAdSenseConfig(configured, await getSessionUserId(), (id) =>
    prisma.user.findUnique({
      where: { id },
      select: {
        plan: true,
        billingSubscriptions: { select: { status: true, paidThrough: true, livemode: true } },
      },
    }),
  );
  if (!config) return null;

  return <AdSenseSlot key={`${placement}:${config.slotId}`} {...config} label={createTranslator(locale)("ads.label")} />;
}
