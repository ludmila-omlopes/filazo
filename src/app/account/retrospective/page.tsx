import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { requirePlatformAccess } from "@/lib/beta-access";
import { hasProAccess } from "@/lib/account-plans";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { planCopy } from "@/lib/plan-copy";
import { ProFeatureGate } from "@/components/pro-feature-gate";
import { Button } from "@/components/ui/button";
import { noIndexMetadata } from "@/lib/site-metadata";

export const metadata = noIndexMetadata;

export default async function RetrospectivePage({ searchParams }: { searchParams: Promise<{ year?: string; before?: string }> }) {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  const user = await requirePlatformAccess(userId);
  const locale = await getRequestLocale();
  const copy = planCopy(locale);
  if (!hasProAccess(user)) return <main id="main-content" className="mx-auto w-full max-w-3xl"><ProFeatureGate title={copy.recap} description={copy.recapBody} locale={locale} /></main>;
  const query = await searchParams;
  const currentYear = new Date().getUTCFullYear();
  const requestedYear = Number(query.year);
  const year = Number.isInteger(requestedYear) && requestedYear >= 1970 && requestedYear <= currentYear ? requestedYear : currentYear;
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  // Resolve the cursor within this person's selected year; never expose others' entries.
  const cursor = query.before ? await prisma.gameJournalEntry.findFirst({
    where: { id: query.before, userId, occurredAt: { gte: start, lt: end } }, select: { id: true, occurredAt: true },
  }) : null;
  const memories = await prisma.gameJournalEntry.findMany({
    where: { userId, occurredAt: { gte: start, lt: end },
      ...(cursor ? { OR: [{ occurredAt: { lt: cursor.occurredAt } }, { occurredAt: cursor.occurredAt, id: { lt: cursor.id } }] } : {}),
    },
    select: { id: true, userGameEntryId: true, title: true, body: true, audioTranscript: true, occurredAt: true, game: { select: { name: true } } },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }], take: 25,
  });
  const page = memories.slice(0, 24);
  return <main id="main-content" className="mx-auto grid w-full max-w-3xl gap-6">
    <Link href="/profile?tab=journal" className="text-sm underline underline-offset-4">{copy.back}</Link>
    <header><p className="section-label">Pro</p><h1 className="text-page-title">{copy.memories}</h1><p className="mt-3 text-ink-soft">{copy.recapBody}</p></header>
    <form className="flex flex-wrap items-end gap-3">
      <label className="grid gap-2 text-sm">{copy.year}<input className="w-28 rounded-inner border border-edge bg-surface p-3" type="number" name="year" min="1970" max={currentYear} defaultValue={year} required /></label>
      <Button type="submit" variant="outline">{copy.show}</Button>
    </form>
    {!page.length ? <p className="text-ink-soft">{copy.empty}</p> : null}
    {page.map((memory) => <article key={memory.id} className="grid gap-3 rounded-card border border-edge bg-surface p-5">
      <time className="text-xs text-ink-soft" dateTime={memory.occurredAt.toISOString()}>{new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(memory.occurredAt)}</time>
      <h2 className="font-display text-xl">{memory.game.name}</h2>
      {memory.title ? <p className="font-medium">{memory.title}</p> : null}
      <blockquote className="whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{(memory.body || memory.audioTranscript || copy.saved).slice(0, 600)}</blockquote>
      <Link className="text-sm underline underline-offset-4" href={`/profile?tab=journal&entryId=${encodeURIComponent(memory.userGameEntryId)}`}>{copy.diary}</Link>
    </article>)}
    {memories.length > 24 ? <Button asChild variant="outline"><Link href={`/account/retrospective?year=${year}&before=${encodeURIComponent(page[page.length - 1].id)}`}>{copy.more}</Link></Button> : null}
  </main>;
}
