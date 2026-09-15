import { getPlanLimits, applyPlanAiLimits } from "@/lib/plan-policy";
import { planCopy } from "@/lib/plan-copy";
import { getAiSettings } from "@/lib/ai-settings";
import type { Locale } from "@/lib/i18n";

export async function PlanComparison({ locale }: { locale: Locale }) {
  const copy = planCopy(locale);
  const free = getPlanLimits({ plan: "FREE" });
  const pro = getPlanLimits({ plan: "PRO" });
  const settings = await getAiSettings();
  const freeAi = applyPlanAiLimits(settings, { plan: "FREE" });
  const proAi = applyPlanAiLimits(settings, { plan: "PRO" });
  const format = new Intl.NumberFormat(locale);
  const rows = [
    [copy.library, copy.unlimited, copy.unlimited],
    [copy.sync, copy.manual, copy.automatic],
    [copy.calendar, "—", copy.included],
    [copy.storage, `${format.format(free.journalStorageBytes / 1024 / 1024)} MB`, `${format.format(pro.journalStorageBytes / 1024 / 1024)} MB`],
    [copy.voice, format.format(freeAi.voiceTranscriptionDailyCallLimit), format.format(proAi.voiceTranscriptionDailyCallLimit)],
    [copy.chat, format.format(freeAi.chatDailyTokenLimit), format.format(proAi.chatDailyTokenLimit)],
    [copy.web, "—", copy.included],
    [copy.recap, "—", copy.included],
  ];
  return <section className="grid min-w-0 gap-4">
    <h2 className="font-display text-2xl">{copy.compare}</h2>
    <div className="overflow-x-auto rounded-inner border border-edge">
      <table className="w-full text-left text-sm">
        <thead><tr className="bg-surface"><th scope="col" className="p-3">{copy.feature}</th><th scope="col" className="p-3">{copy.free}</th><th scope="col" className="p-3">{copy.pro}</th></tr></thead>
        <tbody>{rows.map(([label, gratis, paid]) => <tr key={label} className="border-t border-edge"><th scope="row" className="p-3 font-medium">{label}</th><td className="p-3 text-ink-soft">{gratis}</td><td className="p-3">{paid}</td></tr>)}</tbody>
      </table>
    </div>
    <p className="text-sm leading-relaxed text-ink-soft">{copy.retained}</p>
    <p className="text-xs leading-relaxed text-ink-soft">{copy.ceilings}</p>
  </section>;
}
