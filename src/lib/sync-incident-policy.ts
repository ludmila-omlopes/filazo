// Queue workers run in four windows a day, six hours apart (continuations start
// sooner). Waiting for one window is not a stall, so allow a full interval plus
// the time a window's chain needs to pick the run up.
export const SYNC_STALL_MS = (6 * 60 + 45) * 60_000;
export const SYNC_MONITOR_ID = "sync-incident-monitor";
export const CLOSED_FEEDBACK_STATUSES = ["DONE", "DECLINED"] as const;

export type SyncHealthRun = {
  id: string;
  provider: string;
  externalAccountId: string;
  workerScope: string;
  status: string;
  errorCode: string | null;
  lastProgressAt: Date | null;
  startedAt: Date | null;
  createdAt: Date;
  nextAttemptAt: Date;
};

export function getSyncHealth(run: SyncHealthRun, now: Date) {
  if (run.workerScope !== "production" || run.status === "SKIPPED") return null;
  if (run.status === "SUCCEEDED") return "RECOVERED";
  if (run.status === "FAILED") return "FAILED";
  const lastProgress = run.lastProgressAt ?? run.startedAt ?? run.createdAt;
  // A provider-requested backoff is intentional waiting, not a stuck worker.
  if (run.status === "PENDING" && run.nextAttemptAt > now) return "RETRYING";
  const eligibleSince = run.errorCode
    ? Math.max(lastProgress.getTime(), run.nextAttemptAt.getTime())
    : lastProgress.getTime();
  if (now.getTime() - eligibleSince >= SYNC_STALL_MS) return "STALLED";
  return "RETRYING";
}

export function getSyncIncidentKey(run: SyncHealthRun) {
  // Steam uses the application's shared API key, including for OpenID users.
  // Other provider authentication errors can belong to individual accounts.
  return run.provider === "STEAM" && ["CONFIGURATION", "AUTH"].includes(run.errorCode ?? "")
    ? "STEAM:shared-credentials"
    : `${run.provider}:account:${run.externalAccountId}`;
}

function formatStallDuration(ms: number) {
  const minutes = Math.round(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${minutes} minutos`;
  return rest ? `${hours}h${String(rest).padStart(2, "0")}` : `${hours} horas`;
}

export function syncIncidentStateText(state: string) {
  return ({
    FAILED: "Sincronização falhou", STALLED: `Sem avanço há pelo menos ${formatStallDuration(SYNC_STALL_MS)}`,
    RETRYING: "Nova tentativa em andamento", RECOVERED: "Sincronização recuperada",
    DISCONNECTED: "Conta desconectada",
  } as Record<string, string>)[state] ?? state;
}
