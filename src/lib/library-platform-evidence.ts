export type PlatformEvidenceSource = "user" | "sync" | "import" | "unspecified";
export type PlatformEvidence = {
  version: 1;
  source: PlatformEvidenceSource;
  platformKey: string;
  selectedByUser?: boolean;
  provider: string | null;
  providerGameId: string | null;
  externalAccountId: string | null;
};

export function jsonRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

// This is application provenance, never metadata from a game's supported-platform list.
export function readPlatformEvidence(rawData: unknown): PlatformEvidence | null {
  const evidence = jsonRecord(jsonRecord(rawData).libraryPlatformEvidence);
  return evidence.version === 1 && ["user", "sync", "import", "unspecified"].includes(String(evidence.source)) && typeof evidence.platformKey === "string"
    ? evidence as PlatformEvidence : null;
}

export function sameSyncedCopy(rawData: unknown, evidence: PlatformEvidence) {
  const previous = readPlatformEvidence(rawData);
  return !!previous && !previous.selectedByUser && previous.source === "sync" && evidence.source === "sync" &&
    !!evidence.providerGameId && !!evidence.externalAccountId &&
    previous.provider === evidence.provider && previous.providerGameId === evidence.providerGameId &&
    previous.externalAccountId === evidence.externalAccountId;
}

// Only direct provider identifiers count. Titles, supported platforms and related games do not.
export function legacySourceIds(rawData: unknown, provider: string): string[] {
  const raw = jsonRecord(rawData);
  if (provider === "STEAM") return /^\d+$/.test(String(raw.appid)) ? [String(raw.appid)] : [];
  if (provider !== "PLAYSTATION" || !Array.isArray(raw.playStationSyncSources)) return [];
  return [...new Set(raw.playStationSyncSources.flatMap(value => {
    const item = jsonRecord(value);
    return [item.titleId, item.npCommunicationId].filter((id): id is string => typeof id === "string" && id.length > 0);
  }))].sort();
}
