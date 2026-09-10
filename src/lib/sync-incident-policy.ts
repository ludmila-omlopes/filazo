export const SYNC_STALL_MS = 15 * 60_000;
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

export function syncIncidentStateText(state: string) {
  return ({
    FAILED: "Sincronização falhou", STALLED: "Sem avanço há pelo menos 15 minutos",
    RETRYING: "Nova tentativa em andamento", RECOVERED: "Sincronização recuperada",
    DISCONNECTED: "Conta desconectada",
  } as Record<string, string>)[state] ?? state;
}
