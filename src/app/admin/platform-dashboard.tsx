import Link from "next/link";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import type { AdminDashboardData } from "@/lib/admin-dashboard";
import type { Locale } from "@/lib/i18n";

const copy = {
  "pt-BR": {
    title: "A plataforma em perspectiva", subtitle: "Pessoas, catálogo e operação em um só lugar.",
    aiSpend: "Gastos com IA", aiUsed: "Gasto estimado no período", aiToday: "Gasto estimado hoje", aiReserved: "Reservas pendentes", aiFailed: "Estimativa de falhas", aiFeatures: "Ver gastos por recurso", aiResource: "Recurso", aiRuns: "Execuções concluídas", aiEmpty: "Nenhum consumo de IA registrado neste período.",
    aiSpendHelp: "Valores em USD, estimados pelo mesmo cálculo dos limites de IA: tokens informados quando disponíveis, tarifas configuradas e estimativa reservada como fallback. Não são a fatura do provedor. Reservas pendentes e falhas ficam separadas do gasto de execuções concluídas. Somente operações com registro de orçamento entram no cálculo; datas seguem o início da operação em UTC, no banco conectado.",
    period: "Período", days: "dias", refresh: "Atualizar dados", updated: "Atualizado em", range: "Período selecionado",
    users: "Usuários cadastrados", newUsers: "Novos usuários", dau: "DAU · hoje", dauHelp: "Usuários únicos autenticados hoje (UTC).",
    games: "Jogos no catálogo", gamesHelp: "Títulos canônicos, sem multiplicar por usuário ou plataforma.",
    newGames: "Novos jogos no catálogo", additions: "Adições às bibliotecas", additionsHelp: "Pares pessoa/jogo cuja primeira entrada ainda existente foi criada no período. Vários status contam uma vez; exclusões não ficam no histórico.",
    activity: "Atividade e crescimento", active: "Usuários ativos por dia", coverage: "Atividade registrada a partir de", noCoverage: "A coleta de atividade ainda não registrou acessos.",
    methodology: "DAU, WAU e MAU contam usuários únicos com sessão autenticada, incluindo admins. WAU e MAU cobrem os últimos 7 e 30 dias UTC, incluindo hoje, independentemente do filtro. Não incluem visitantes anônimos. A coleta começa com esta versão; janelas anteriores à coleta são parciais. O dia atual ainda está em andamento.",
    unavailable: "Sem histórico", table: "Ver dados diários", date: "Dia (UTC)",
    adoption: "Adoção do produto", wau: "WAU · 7 dias", mau: "MAU · 30 dias", library: "Usuários com biblioteca", onboarding: "Onboarding concluído",
    health: "Saúde da operação", server: "Erros de servidor", sync: "Sincronizações com falha", imports: "Importações com falha", ai: "Registros de IA com erro", rows: "Linhas de importação com falha", bugs: "Bugs abertos",
    healthHelp: "Falhas de sync/importação usam a última atualização; IA usa a criação do registro. Contagens são registros, não incidentes únicos: a mesma falha pode aparecer em mais de uma fonte. Erros de servidor são coletados nesta versão no runtime Node.js. Erros do navegador e diagnóstico completo continuam no Sentry. Falhas de telemetria ou do banco podem impedir o registro.",
    scope: "Servidor e filas no ambiente", dbScope: "Pessoas, catálogo, importações e IA refletem o banco conectado.",
    recentErrors: "Falhas recentes", recentHelp: "Até 8 registros mais recentes no período. Dados técnicos ficam recolhidos.", emptyErrors: "Nenhuma falha registrada nas fontes acima neste período.",
    technical: "Detalhes técnicos", source: "Origem", syncLink: "Investigar sincronizações", sentry: "Abrir Sentry", feedback: "Abrir feedback",
    recentGames: "Adicionados ao catálogo", emptyGames: "Nenhum jogo cadastrado neste período.", latest: "Até 8 títulos mais recentes.",
    sources: "Contas conectadas", noSources: "Nenhuma conta conectada.", metadata: "Qualidade do catálogo", covers: "Jogos sem capa", queue: "Metadados na fila", jobs: "Sincronizações iniciadas no período", succeeded: "Concluídas", pending: "Na fila / executando", failed: "Com falha", skipped: "Ignoradas",
  },
  en: {
    title: "The platform at a glance", subtitle: "People, catalog and operations in one place.",
    aiSpend: "AI spending", aiUsed: "Estimated spend in period", aiToday: "Estimated spend today", aiReserved: "Pending reservations", aiFailed: "Failed-run estimates", aiFeatures: "View spending by feature", aiResource: "Feature", aiRuns: "Completed runs", aiEmpty: "No AI usage recorded in this period.",
    aiSpendHelp: "USD estimates use the same calculation as AI limits: reported tokens when available, configured rates and the reserved estimate as fallback. These are not the provider invoice. Pending reservations and failed-run estimates are separate from completed-run spending. Only operations with budget records are included; dates use the operation start in UTC in the connected database.",
    period: "Period", days: "days", refresh: "Refresh data", updated: "Updated at", range: "Selected period",
    users: "Registered users", newUsers: "New users", dau: "DAU · today", dauHelp: "Unique authenticated users today (UTC).",
    games: "Catalog games", gamesHelp: "Canonical titles, counted once across users and platforms.",
    newGames: "New catalog games", additions: "Library additions", additionsHelp: "User/game pairs whose earliest surviving entry was created in this period. Multiple statuses count once; deletions are not retained.",
    activity: "Activity and growth", active: "Daily active users", coverage: "Activity recorded from", noCoverage: "Activity collection has not recorded any visits yet.",
    methodology: "DAU, WAU and MAU count unique authenticated users, including admins. WAU and MAU cover the last 7 and 30 UTC days including today, regardless of the filter. Anonymous visitors are excluded. Collection begins with this release; windows preceding collection are partial. Today is still in progress.",
    unavailable: "No history", table: "View daily data", date: "Day (UTC)",
    adoption: "Product adoption", wau: "WAU · 7 days", mau: "MAU · 30 days", library: "Users with a library", onboarding: "Onboarding completed",
    health: "Operational health", server: "Server errors", sync: "Failed sync runs", imports: "Failed imports", ai: "AI records with errors", rows: "Failed import rows", bugs: "Open bugs",
    healthHelp: "Sync/import failures use their latest update; AI uses record creation. Counts represent records, not unique incidents: one failure can appear in multiple sources. Server errors are collected from this release in the Node.js runtime. Browser errors and full diagnostics remain in Sentry. Telemetry or database outages can prevent recording.",
    scope: "Server and queues environment", dbScope: "People, catalog, imports and AI reflect the connected database.",
    recentErrors: "Recent failures", recentHelp: "Up to 8 latest records in the selected period. Technical details are collapsed.", emptyErrors: "No failures recorded in the sources above for this period.",
    technical: "Technical details", source: "Source", syncLink: "Investigate syncs", sentry: "Open Sentry", feedback: "Open feedback",
    recentGames: "Added to the catalog", emptyGames: "No games created in this period.", latest: "Up to 8 most recent titles.",
    sources: "Connected accounts", noSources: "No connected accounts.", metadata: "Catalog quality", covers: "Games without covers", queue: "Queued metadata jobs", jobs: "Sync runs started in this period", succeeded: "Succeeded", pending: "Pending / running", failed: "Failed", skipped: "Skipped",
  },
};

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <Card className="min-w-0"><CardContent className="grid gap-4"><h3 className="font-display text-xl font-medium">{title}</h3>{children}</CardContent></Card>;
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return <div className="min-w-0 border-t border-edge pt-4"><dt className="text-sm font-bold text-ink-soft">{label}</dt><dd className="mt-2 font-display text-4xl font-medium tabular-nums tracking-tight">{value}</dd>{note ? <dd className="mt-2 max-w-[45ch] text-xs leading-relaxed text-ink-soft">{note}</dd> : null}</div>;
}

function Trend({ title, values, dates, noHistory }: { title: string; values: Array<number | null>; dates: string[]; noHistory: string }) {
  const max = Math.max(1, ...values.map(v => v ?? 0));
  const point = (value: number, i: number) => `${12 + i * 456 / Math.max(1, values.length - 1)},${108 - value / max * 90}`;
  const points = values.flatMap((value, i) => value === null ? [] : [point(value, i)]).join(" ");
  return <Panel title={title}>
    <svg viewBox="0 0 480 128" role="img" aria-label={`${title}: ${dates[0]} – ${dates.at(-1)}. ${values.map(v => v ?? noHistory).join(", ")}`} className="h-36 w-full text-ink">
      <text x="12" y="11" fill="currentColor" fontSize="10" opacity="0.65">{max}</text>
      <text x="12" y="124" fill="currentColor" fontSize="10" opacity="0.65">0</text>
      <path d="M12 108 H468 M12 18 H468" fill="none" stroke="currentColor" opacity="0.12" />
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      {values.map((value, i) => value === null ? null : <circle key={i} cx={12 + i * 456 / Math.max(1, values.length - 1)} cy={108 - value / max * 90} r="2.5" fill="currentColor"><title>{`${dates[i]}: ${value}`}</title></circle>)}
    </svg>
    <div className="flex justify-between gap-2 text-xs text-ink-soft"><span>{dates[0]}</span><span>{dates.at(-1)} · UTC</span></div>
  </Panel>;
}

export function PlatformDashboard({ data: d, locale, userSearch }: { data: AdminDashboardData; locale: Locale; userSearch: string }) {
  const c = copy[locale];
  const number = (n: number) => n.toLocaleString(locale);
  const money = (n: number) => n.toLocaleString(locale, { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const featureNames = locale === "pt-BR" ? {
    assistant_chat: "Conversa com o assistente", assistant_play_next: "Recomendações de jogos",
    assistant_summary: "Resumos", assistant_marketplace: "Pesquisa de ofertas", photo_import: "Importação por foto",
    player_profile: "Perfil de jogador", story_completion: "Conclusão de jogos", voice_transcription: "Transcrição de áudio",
  } : {
    assistant_chat: "Assistant chat", assistant_play_next: "Game recommendations",
    assistant_summary: "Summaries", assistant_marketplace: "Deal search", photo_import: "Photo import",
    player_profile: "Player profile", story_completion: "Game completion", voice_transcription: "Audio transcription",
  };
  const date = (value: Date, time = false) => new Intl.DateTimeFormat(locale, { timeZone: "UTC", dateStyle: "short", ...(time ? { timeStyle: "short" as const } : {}) }).format(value);
  const recentErrors = [
    ...d.recentSync.map(e => ({ id: e.id, source: c.sync, detail: `${e.provider} · ${e.errorCode ?? "INTERNAL"}`, at: e.updatedAt })),
    ...d.recentImports.map(e => ({ id: e.id, source: c.imports, detail: "FAILED", at: e.updatedAt })),
    ...d.recentAi.map(e => ({ id: e.id, source: c.ai, detail: "AI_ERROR", at: e.createdAt })),
    ...d.recentServer.map(e => ({ id: e.id, source: c.server, detail: `${e.kind} · ${e.route} · ${e.fingerprint}`, at: e.createdAt })),
  ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 8);
  const syncCount = (...statuses: string[]) => d.syncStates.filter(s => statuses.includes(s.status)).reduce((sum, s) => sum + s._count, 0);
  const linkClass = "text-sm font-bold underline decoration-ink/30 underline-offset-4";
  return <section className="grid gap-8 text-ink" aria-labelledby="dashboard-title">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-2"><h2 id="dashboard-title" className="font-display text-3xl font-medium">{c.title}</h2><p className="text-ink-soft">{c.subtitle}</p><p className="text-xs text-ink-soft">{c.updated} {date(d.now, true)} UTC · {date(d.since)} – {date(d.now)}</p></div>
      <form method="get" className="flex flex-wrap items-end gap-3">
        {userSearch ? <input type="hidden" name="user" value={userSearch} /> : null}
        <label className="grid gap-1 text-sm font-bold">{c.period}<select name="days" defaultValue={d.days} className="min-h-11 rounded-inner border border-edge bg-surface px-3">{[7, 30, 90].map(n => <option key={n} value={n}>{n} {c.days}</option>)}</select></label>
        <button type="submit" className="min-h-11 rounded-inner bg-ink px-4 text-sm font-bold text-canvas">{c.refresh}</button>
      </form>
    </div>
    <dl className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label={c.users} value={number(d.users)} note={`${c.newUsers}: ${number(d.newUsers)} · ${c.range.toLowerCase()}`} />
      <Metric label={c.dau} value={d.activity.firstDay ? number(d.activity.dau) : "—"} note={c.dauHelp} />
      <Metric label={c.games} value={number(d.games)} note={c.gamesHelp} />
      <Metric label={c.newGames} value={number(d.newGames)} note={c.range} />
    </dl>
    <section className="grid gap-4" aria-labelledby="growth-title">
      <h2 id="growth-title" className="font-display text-2xl font-medium">{c.activity}</h2>
      <p className="text-sm text-ink-soft">{d.activity.firstDay ? `${c.coverage} ${date(d.activity.firstDay)} (UTC).` : c.noCoverage}</p>
      <div className="grid gap-4 lg:grid-cols-3">
        <Trend title={c.active} values={d.daily.map(x => x.active)} dates={d.daily.map(x => date(x.day))} noHistory={c.unavailable} />
        <Trend title={c.newUsers} values={d.daily.map(x => x.users)} dates={d.daily.map(x => date(x.day))} noHistory={c.unavailable} />
        <Trend title={c.newGames} values={d.daily.map(x => x.games)} dates={d.daily.map(x => date(x.day))} noHistory={c.unavailable} />
      </div>
      <p className="max-w-[110ch] text-xs leading-relaxed text-ink-soft">{c.methodology}</p>
      <details className="rounded-inner border border-edge bg-surface p-4"><summary className="cursor-pointer text-sm font-bold">{c.table}</summary>
        <div className="mt-4 max-h-80 overflow-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{c.activity}</caption><thead><tr>{[c.date, c.active, c.newUsers, c.newGames].map(label => <th scope="col" key={label} className="border-b border-edge p-2">{label}</th>)}</tr></thead><tbody>{d.daily.map(row => <tr key={row.day.toISOString()}><th scope="row" className="p-2 font-normal">{date(row.day)}</th>{[row.active, row.users, row.games].map((n, i) => <td key={i} className="p-2 tabular-nums">{n === null ? c.unavailable : number(n)}</td>)}</tr>)}</tbody></table></div>
      </details>
    </section>
    <Panel title={c.adoption}><dl className="grid gap-6 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label={c.wau} value={d.activity.firstDay ? number(d.activity.wau) : "—"} />
      <Metric label={c.mau} value={d.activity.firstDay ? number(d.activity.mau) : "—"} />
      <Metric label={c.library} value={number(d.libraryUsers)} />
      <Metric label={c.onboarding} value={number(d.onboarded)} />
      <Metric label={c.additions} value={number(d.additions)} note={c.additionsHelp} />
    </dl></Panel>
    <Panel title={c.aiSpend}>
      <dl className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label={c.aiUsed} value={money(d.aiSpend.usedUsd)} note={`${c.aiRuns}: ${number(d.aiSpend.usedRuns)}`} />
        <Metric label={c.aiToday} value={money(d.aiSpend.todayUsd)} note="UTC" />
        <Metric label={c.aiReserved} value={money(d.aiSpend.reservedUsd)} note={c.range} />
        <Metric label={c.aiFailed} value={money(d.aiSpend.failedUsd)} note={c.range} />
      </dl>
      <p className="max-w-[110ch] text-xs leading-relaxed text-ink-soft">{c.aiSpendHelp}</p>
      {d.aiSpend.features.length ? <details>
        <summary className="cursor-pointer text-sm font-bold">{c.aiFeatures}</summary>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
          <caption className="sr-only">{c.aiFeatures}</caption>
          <thead><tr>{[c.aiResource, c.aiUsed, c.aiReserved, c.aiFailed].map(label => <th key={label} scope="col" className="border-b border-edge p-2">{label}</th>)}</tr></thead>
          <tbody>{d.aiSpend.features.map(row => <tr key={row.feature}>
            <th scope="row" className="p-2 font-normal">{featureNames[row.feature]}</th>
            {[row.usedUsd, row.reservedUsd, row.failedUsd].map((amount, i) => <td key={i} className="whitespace-nowrap p-2 tabular-nums">{money(amount)}</td>)}
          </tr>)}</tbody>
        </table></div>
      </details> : <p className="text-sm text-ink-soft">{c.aiEmpty}</p>}
    </Panel>
    <section className="grid gap-4" aria-labelledby="health-title">
      <h2 id="health-title" className="font-display text-2xl font-medium">{c.health}</h2>
      <p className="text-xs text-ink-soft">{c.scope}: <strong>{d.environment}</strong>. {c.dbScope}</p>
      <dl className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{[[c.server, d.serverFailures], [c.sync, d.syncFailures], [c.imports, d.importFailures], [c.ai, d.aiFailures], [c.rows, d.rowFailures], [c.bugs, d.openBugs]].map(([label, value]) => <Metric key={label} label={String(label)} value={number(Number(value))} note={label === c.bugs ? c.feedback : c.range} />)}</dl>
      <p className="max-w-[110ch] text-xs leading-relaxed text-ink-soft">{c.healthHelp}</p>
      <Panel title={c.recentErrors}>
        <p className="text-xs text-ink-soft">{c.recentHelp}</p>
        {recentErrors.length ? <ul className="divide-y divide-edge">{recentErrors.map(e => <li className="py-3" key={`${e.source}-${e.id}`}><div className="flex flex-wrap justify-between gap-2 text-sm"><strong>{e.source}</strong><time dateTime={e.at.toISOString()} className="text-ink-soft">{date(e.at, true)} UTC</time></div><details className="mt-2 text-xs"><summary className="cursor-pointer text-ink-soft">{c.technical}</summary><p className="mt-2 break-all font-mono">{e.detail}</p><p className="mt-1 break-all text-ink-soft">ID: {e.id}</p></details></li>)}</ul> : <p className="text-sm text-ink-soft">{c.emptyErrors}</p>}
        <div className="flex flex-wrap gap-4"><Link className={linkClass} href="/admin/sync">{c.syncLink}</Link><Link className={linkClass} href="/admin/feedback">{c.feedback}</Link><a className={linkClass} href="https://emada.sentry.io/issues/" target="_blank" rel="noreferrer">{c.sentry}</a></div>
      </Panel>
    </section>
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title={c.recentGames}><p className="text-xs text-ink-soft">{c.latest}</p>{d.recentGames.length ? <ul className="divide-y divide-edge">{d.recentGames.map(game => <li key={game.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"><Link className={`${linkClass} min-w-0 break-words`} href={`/games/${game.slug}`}>{game.name}</Link><time className="text-xs text-ink-soft" dateTime={game.createdAt.toISOString()}>{date(game.createdAt)}</time></li>)}</ul> : <p className="text-sm text-ink-soft">{c.emptyGames}</p>}</Panel>
      <div className="grid gap-4">
        <Panel title={c.sources}>{d.providers.length ? <dl className="grid grid-cols-2 gap-3">{d.providers.map(p => <div key={p.provider} className="flex flex-wrap justify-between gap-2 text-sm"><dt>{p.provider}</dt><dd className="font-bold tabular-nums">{number(p._count)}</dd></div>)}</dl> : <p className="text-sm text-ink-soft">{c.noSources}</p>}</Panel>
        <Panel title={c.metadata}><dl className="grid gap-2 text-sm">{[[c.covers, d.missingCovers], [c.queue, d.metadataQueue]].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd className="font-bold tabular-nums">{number(Number(value))}</dd></div>)}</dl></Panel>
        <Panel title={c.jobs}><dl className="grid gap-2 text-sm">{[[c.succeeded, syncCount("SUCCEEDED")], [c.pending, syncCount("PENDING", "RUNNING")], [c.failed, syncCount("FAILED")], [c.skipped, syncCount("SKIPPED")]].map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt>{label}</dt><dd className="font-bold tabular-nums">{number(Number(value))}</dd></div>)}</dl></Panel>
      </div>
    </div>
  </section>;
}
