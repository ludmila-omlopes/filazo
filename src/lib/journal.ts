import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  EntrySource,
  ImportJobStatus,
  ImportRowStatus,
  type Prisma,
  UserGameStatus,
} from "@prisma/client";
import { z } from "zod";
import { resolveCatalogGame } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";
import {
  getAllowedUploadExtension,
  type UploadKind,
} from "@/lib/upload-file-type";
import { normalizeTitle } from "@/lib/utils";
import { getOpenAiConfig } from "@/lib/openai";
import { runWithAiBudget } from "./ai-budget.ts";
import { getAiSettings, type AiSettingsValues } from "./ai-settings.ts";

type UploadedMedia = {
  kind: "image" | "audio";
  url: string;
  storageKey: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
};

type PhotoImportCandidate = {
  title: string;
  platformName: string | null;
  statusText: string | null;
  notes: string | null;
  confidence: number;
};

const PhotoImportSchema = z.object({
  candidates: z.array(
    z.object({
      title: z.string().min(1),
      platformName: z.string().nullable().default(null),
      statusText: z.string().nullable().default(null),
      notes: z.string().nullable().default(null),
      confidence: z.number().min(0).max(1).default(0.5),
    }),
  ),
});

function isUsableFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

function formatFileSize(bytes: number) {
  const megabytes = bytes / (1024 * 1024);
  return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
}

function getSafeFileName(file: File) {
  const fallback = `${randomUUID()}.bin`;
  const baseName = (file.name || fallback)
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return baseName || fallback;
}

async function saveUpload(
  file: File,
  folder: "journal" | "imports",
  kind: UploadKind,
) {
  const safeFileName = getSafeFileName(file);
  const extension = getAllowedUploadExtension(file.type, kind);
  if (!extension) {
    throw new Error(
      kind === "image"
        ? "Screenshot uploads must be PNG, JPEG, WebP, or GIF files."
        : "Voice uploads must be WebM, MP3, M4A, WAV, or OGG files.",
    );
  }
  const storageKey = `uploads/${folder}/${randomUUID()}${extension}`;
  const diskPath = path.join(process.cwd(), "public", ...storageKey.split("/"));

  await mkdir(path.dirname(diskPath), { recursive: true });
  await writeFile(diskPath, Buffer.from(await file.arrayBuffer()));

  return {
    url: `/${storageKey}`,
    storageKey,
    mimeType: file.type || "application/octet-stream",
    fileName: safeFileName,
    sizeBytes: file.size,
  };
}

function extractOutputText(response: unknown) {
  if (!response || typeof response !== "object") {
    return null;
  }

  const maybeText = (response as { output_text?: unknown }).output_text;
  if (typeof maybeText === "string") {
    return maybeText;
  }

  const output = (response as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) {
      continue;
    }
    for (const contentItem of content) {
      if (!contentItem || typeof contentItem !== "object") {
        continue;
      }
      const text = (contentItem as { text?: unknown }).text;
      if (typeof text === "string") {
        return text;
      }
    }
  }

  return null;
}

async function transcribeAudio(
  file: File,
  userId: string,
  aiSettings: AiSettingsValues,
) {
  // Audio transcription stays on OpenAI directly: OpenRouter has no
  // transcription endpoint, so this ignores OPENAI_BASE_URL. When the rest of
  // the app is pointed at a gateway, set OPENAI_TRANSCRIPTION_API_KEY to a real
  // OpenAI key to keep voice journaling working.
  const apiKey =
    process.env.OPENAI_TRANSCRIPTION_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey || !aiSettings.voiceTranscriptionEnabled) {
    return null;
  }

  const model = process.env.OPENAI_TRANSCRIPTION_MODEL || "gpt-4o-mini-transcribe";

  try {
    return await runWithAiBudget({
      feature: "voice_transcription",
      inputSummary: {
        fileSize: file.size,
        mimeType: file.type || "application/octet-stream",
      },
      model,
      userId,
      execute: async () => {
        const body = new FormData();
        body.set("file", file, file.name || "voice-note.webm");
        body.set("model", model);

        const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body,
        });

        if (!response.ok) {
          return null;
        }

        const json = (await response.json()) as {
          text?: string;
          language?: string;
        };

        return {
          text: json.text?.trim() || null,
          language: json.language ?? null,
        };
      },
    });
  } catch {
    return null;
  }
}

function shouldTranslateTranscript(
  sourceLanguage: string | null | undefined,
  targetLanguage: string,
) {
  const source = sourceLanguage?.toLowerCase() ?? "";
  const target = targetLanguage.toLowerCase();

  if (!source) {
    return true;
  }

  if (target.includes("english") && /^en(g|$)/.test(source)) {
    return false;
  }

  if (target.includes("portuguese") && /^(pt|por|portugu)/.test(source)) {
    return false;
  }

  return true;
}

async function translateTranscript(
  text: string,
  targetLanguage: string,
  userId: string,
  aiSettings: AiSettingsValues,
) {
  const config = getOpenAiConfig();
  if (!config || !text.trim() || !aiSettings.voiceTranslationEnabled) {
    return null;
  }

  try {
    return await runWithAiBudget({
      feature: "voice_translation",
      inputSummary: {
        targetLanguage,
        textLength: text.length,
      },
      model: config.model,
      userId,
      execute: async () => {
        const response = await fetch(`${config.baseUrl}/responses`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: config.model,
            max_output_tokens: aiSettings.voiceTranslationMaxOutputTokens,
            input: [
              {
                role: "system",
                content:
                  "Translate gameplay journal transcripts only when needed. Preserve concrete game details and keep the result concise. Return plain text.",
              },
              {
                role: "user",
                content: `Target language: ${targetLanguage}\n\nTranscript:\n${text}`,
              },
            ],
          }),
        });

        if (!response.ok) {
          return null;
        }

        return extractOutputText(await response.json())?.trim() ?? null;
      },
    });
  } catch {
    return null;
  }
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trim()}...`;
}

function buildMechanicsRecap(entry: {
  status: UserGameStatus;
  platformName: string | null;
  playtimeMinutes: number | null;
  completionPercent: number | null;
  game: {
    name: string;
    summary: string | null;
    genres: Prisma.JsonValue;
  };
}) {
  const summary = entry.game.summary
    ? truncateText(entry.game.summary, 280)
    : `${entry.game.name} has limited metadata in the catalog, so this recap is based on your saved progress.`;
  const progress = [
    entry.platformName ? `Platform: ${entry.platformName}.` : null,
    entry.playtimeMinutes ? `Recorded playtime: ${entry.playtimeMinutes} minutes.` : null,
    entry.completionPercent !== null
      ? `Achievement or trophy progress: ${entry.completionPercent}%.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");

  return [summary, progress].filter(Boolean).join(" ");
}

function buildAchievementSummary(entry: {
  finishedAt: Date | null;
  completionPercent: number | null;
  game: {
    providerLinks: Array<{
      storyAchievementName: string | null;
      storyAchievementSource: string | null;
    }>;
  };
}) {
  const storyAchievement = entry.game.providerLinks.find(
    (link) => link.storyAchievementName,
  );

  if (entry.finishedAt && storyAchievement?.storyAchievementName) {
    return {
      latestAchievementName: storyAchievement.storyAchievementName,
      summary: `Inferred from the cached story-completion achievement: ${storyAchievement.storyAchievementName}.`,
      confidence: storyAchievement.storyAchievementSource === "ai" ? 72 : 58,
    };
  }

  if (entry.completionPercent !== null) {
    return {
      latestAchievementName: null,
      summary: `Latest provider progress shows ${entry.completionPercent}% achievement or trophy completion. No latest unlock event is available yet.`,
      confidence: 45,
    };
  }

  return {
    latestAchievementName: null,
    summary: null,
    confidence: null,
  };
}

async function removeUploadedFile(storageKey: string) {
  // storageKey is a repo-relative path like "uploads/<folder>/<uuid>.<ext>".
  // Uploads live under public/, so map it back the same way the writer does.
  if (!storageKey || storageKey.includes("..")) {
    return;
  }

  const diskPath = path.join(process.cwd(), "public", ...storageKey.split("/"));
  try {
    await unlink(diskPath);
  } catch {
    // Best-effort: the file may already be gone or stored externally.
  }
}

export async function deleteJournalEntryForUser({
  journalEntryId,
  userId,
}: {
  journalEntryId: string;
  userId: string;
}): Promise<{ slug: string | null }> {
  const entry = await prisma.gameJournalEntry.findFirst({
    where: { id: journalEntryId, userId },
    select: {
      id: true,
      game: { select: { slug: true } },
      media: { select: { storageKey: true } },
    },
  });

  if (!entry) {
    // Already gone or not owned by this user; treat deletion as a no-op.
    return { slug: null };
  }

  // Deleting the entry cascade-removes its JournalMedia rows (see schema).
  await prisma.gameJournalEntry.delete({ where: { id: entry.id } });

  await Promise.all(
    entry.media.map((media) => removeUploadedFile(media.storageKey)),
  );

  return { slug: entry.game.slug };
}

export async function createJournalEntryForUser({
  audioFile,
  body,
  imageFile,
  mediaCaption,
  occurredAt,
  targetLanguage,
  title,
  userGameEntryId,
  userId,
}: {
  audioFile: FormDataEntryValue | null;
  body: string | null;
  imageFile: FormDataEntryValue | null;
  mediaCaption: string | null;
  occurredAt: Date | null;
  targetLanguage: string;
  title: string | null;
  userGameEntryId: string;
  userId: string;
}) {
  const entry = await prisma.userGameEntry.findFirst({
    where: {
      id: userGameEntryId,
      userId,
    },
    include: {
      game: {
        include: {
          providerLinks: true,
        },
      },
    },
  });

  if (!entry) {
    throw new Error("Choose a game from your own catalog before journaling.");
  }

  const aiSettings = await getAiSettings();
  const media: UploadedMedia[] = [];
  if (isUsableFile(imageFile)) {
    if (!imageFile.type.startsWith("image/")) {
      throw new Error("Screenshot uploads must be image files.");
    }
    media.push({
      kind: "image",
      ...(await saveUpload(imageFile, "journal", "image")),
    });
  }

  let transcript: Awaited<ReturnType<typeof transcribeAudio>> = null;
  let translatedTranscript: string | null = null;
  if (isUsableFile(audioFile)) {
    if (!audioFile.type.startsWith("audio/")) {
      throw new Error("Voice uploads must be audio files.");
    }
    if (audioFile.size > aiSettings.voiceMaxFileBytes) {
      throw new Error(
        `Voice uploads must be ${formatFileSize(aiSettings.voiceMaxFileBytes)} or smaller.`,
      );
    }
    media.push({
      kind: "audio",
      ...(await saveUpload(audioFile, "journal", "audio")),
    });
    transcript = await transcribeAudio(audioFile, userId, aiSettings);
    translatedTranscript =
      transcript?.text &&
      shouldTranslateTranscript(transcript.language, targetLanguage)
        ? await translateTranscript(
            transcript.text,
            targetLanguage,
            userId,
            aiSettings,
          )
      : null;
  }

  const achievement = buildAchievementSummary(entry);

  return prisma.gameJournalEntry.create({
    data: {
      userId,
      userGameEntryId: entry.id,
      gameId: entry.gameId,
      title: title || undefined,
      body: body || undefined,
      source: "manual",
      occurredAt: occurredAt ?? new Date(),
      mechanicsRecap: buildMechanicsRecap(entry),
      achievementSummary: achievement.summary,
      latestAchievementName: achievement.latestAchievementName,
      latestAchievementUnlockedAt: entry.finishedAt ?? undefined,
      inferenceConfidence: achievement.confidence ?? undefined,
      audioTranscript: transcript?.text ?? undefined,
      translatedTranscript: translatedTranscript ?? undefined,
      transcriptLanguage: transcript?.language ?? undefined,
      rawData: {
        targetLanguage,
        mediaCount: media.length,
      } as Prisma.InputJsonValue,
      media: {
        create: media.map((item) => ({
          kind: item.kind,
          url: item.url,
          storageKey: item.storageKey,
          mimeType: item.mimeType,
          fileName: item.fileName,
          sizeBytes: item.sizeBytes,
          caption: mediaCaption || undefined,
          source: "manual-upload",
        })),
      },
    },
  });
}

async function imageFileToDataUrl(file: File) {
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  return `data:${file.type || "image/jpeg"};base64,${base64}`;
}

async function extractPhotoCandidates(
  file: File,
  userId: string,
  aiSettings: AiSettingsValues,
) {
  const config = getOpenAiConfig();
  if (!config || !aiSettings.photoImportEnabled) {
    return [];
  }

  return runWithAiBudget({
    feature: "photo_import",
    inputSummary: {
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
    },
    model: config.model,
    userId,
    execute: async () => {
      const response = await fetch(`${config.baseUrl}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.model,
          max_output_tokens: aiSettings.photoImportMaxOutputTokens,
          input: [
            {
              role: "system",
              content:
                "Extract video game catalog entries from screenshots or photos. Return JSON only. Do not invent titles that are not visible.",
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text:
                    "Identify visible game titles. Include platform/status/notes only when visible or strongly implied. Confidence must be 0 to 1.",
                },
                {
                  type: "input_image",
                  image_url: await imageFileToDataUrl(file),
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "photo_catalog_import",
              strict: true,
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  candidates: {
                    type: "array",
                    maxItems: aiSettings.photoImportMaxCandidates,
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        title: { type: "string" },
                        platformName: { type: ["string", "null"] },
                        statusText: { type: ["string", "null"] },
                        notes: { type: ["string", "null"] },
                        confidence: { type: "number" },
                      },
                      required: [
                        "title",
                        "platformName",
                        "statusText",
                        "notes",
                        "confidence",
                      ],
                    },
                  },
                },
                required: ["candidates"],
              },
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Photo extraction did not complete.");
      }

      const outputText = extractOutputText(await response.json());
      if (!outputText) {
        return [];
      }

      return PhotoImportSchema.parse(JSON.parse(outputText)).candidates.slice(
        0,
        aiSettings.photoImportMaxCandidates,
      );
    },
  });
}

function parsePhotoStatus(statusText: string | null) {
  const normalized = String(statusText ?? "").toLowerCase();

  if (normalized.includes("wish")) {
    return UserGameStatus.WISHLIST;
  }

  if (
    normalized.includes("playing next") ||
    normalized.includes("play next") ||
    normalized.includes("up next") ||
    normalized === "next"
  ) {
    return UserGameStatus.PLAYING_NEXT;
  }

  if (normalized.includes("play")) {
    return UserGameStatus.PLAYING;
  }

  if (normalized.includes("complete") || normalized.includes("finish")) {
    return UserGameStatus.COMPLETED;
  }

  if (normalized.includes("drop") || normalized.includes("abandon")) {
    return UserGameStatus.DROPPED;
  }

  if (normalized.includes("backlog")) {
    return UserGameStatus.BACKLOG;
  }

  return UserGameStatus.OWNED;
}

async function upsertPhotoImportedEntry({
  candidate,
  sourceImageUrl,
  userId,
}: {
  candidate: PhotoImportCandidate;
  sourceImageUrl: string;
  userId: string;
}) {
  const status = parsePhotoStatus(candidate.statusText);
  const game = await resolveCatalogGame({
    title: candidate.title,
    platformName: candidate.platformName,
    rawData: {
      source: "photo-import",
      confidence: candidate.confidence,
      sourceImageUrl,
    },
  });
  const entryData = {
    source: EntrySource.PHOTO,
    platformName: candidate.platformName ?? undefined,
    notes: candidate.notes ?? undefined,
    activeBacklog: status === UserGameStatus.DROPPED ? false : undefined,
    abandonedAt: status === UserGameStatus.DROPPED ? new Date() : undefined,
    finishedAt: status === UserGameStatus.COMPLETED ? new Date() : undefined,
    finishedSource: status === UserGameStatus.COMPLETED ? "import" : undefined,
    rawData: {
      source: "photo-import",
      confidence: candidate.confidence,
      sourceImageUrl,
      statusText: candidate.statusText,
    } as Prisma.InputJsonValue,
  };
  const [existingAnyStatus, existingTargetStatus] = await Promise.all([
    prisma.userGameEntry.findFirst({
      where: {
        userId,
        gameId: game.id,
      },
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.userGameEntry.findUnique({
      where: {
        userId_gameId_status: {
          userId,
          gameId: game.id,
          status,
        },
      },
    }),
  ]);

  if (existingTargetStatus) {
    await prisma.userGameEntry.update({
      where: { id: existingTargetStatus.id },
      data: entryData,
    });
    if (existingAnyStatus && existingAnyStatus.id !== existingTargetStatus.id) {
      await prisma.userGameEntry.delete({ where: { id: existingAnyStatus.id } });
    }
    return game;
  }

  if (existingAnyStatus) {
    await prisma.userGameEntry.update({
      where: { id: existingAnyStatus.id },
      data: {
        status,
        ...entryData,
      },
    });
    return game;
  }

  await prisma.userGameEntry.create({
    data: {
      userId,
      gameId: game.id,
      status,
      ...entryData,
    },
  });

  return game;
}

export async function importPhotoCatalogForUser({
  files,
  messages,
  userId,
}: {
  files: File[];
  messages: {
    uploadAtLeastOne: string;
    onlyImages: string;
    noVisibleGames: string;
    visionUnavailable: string;
    needsAiKey: string;
    fileTooLarge: string;
    aiDisabled: string;
    lowConfidence: string;
    rowFailed: string;
    importFailed: string;
  };
  userId: string;
}) {
  const aiSettings = await getAiSettings();
  const usableFiles = files
    .filter((file) => file.size > 0)
    .slice(0, aiSettings.photoImportMaxFiles);
  if (!usableFiles.length) {
    throw new Error(messages.uploadAtLeastOne);
  }
  if (!aiSettings.photoImportEnabled) {
    throw new Error(messages.aiDisabled);
  }

  const job = await prisma.importJob.create({
    data: {
      userId,
      fileName: usableFiles.map((file) => file.name || "catalog-photo").join(", "),
      status: ImportJobStatus.PROCESSING,
      columnMapping: {
        source: "photo-import",
      } as Prisma.InputJsonValue,
    },
  });

  let importedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let rowIndex = 0;

  try {
    for (const file of usableFiles) {
      if (
        !file.type.startsWith("image/") ||
        !getAllowedUploadExtension(file.type, "image")
      ) {
        failedCount += 1;
        await prisma.importRow.create({
          data: {
            jobId: job.id,
            rowIndex: rowIndex,
            rawData: {
              fileName: file.name,
              mimeType: file.type,
            } as Prisma.InputJsonValue,
            outcome: ImportRowStatus.FAILED,
            error: messages.onlyImages,
          },
        });
        rowIndex += 1;
        continue;
      }

      if (file.size > aiSettings.photoImportMaxFileBytes) {
        failedCount += 1;
        await prisma.importRow.create({
          data: {
            jobId: job.id,
            rowIndex,
            rawData: {
              fileName: file.name,
              fileSize: file.size,
              maxFileSize: aiSettings.photoImportMaxFileBytes,
              mimeType: file.type,
            } as Prisma.InputJsonValue,
            outcome: ImportRowStatus.FAILED,
            error: messages.fileTooLarge,
          },
        });
        rowIndex += 1;
        continue;
      }

      const upload = await saveUpload(file, "imports", "image");
      const candidates = await extractPhotoCandidates(file, userId, aiSettings);
      if (!candidates.length) {
        skippedCount += 1;
        await prisma.importRow.create({
          data: {
            jobId: job.id,
            rowIndex,
            rawData: {
              fileName: upload.fileName,
              sourceImageUrl: upload.url,
              reason: process.env.OPENAI_API_KEY
                ? messages.noVisibleGames
                : messages.visionUnavailable,
            } as Prisma.InputJsonValue,
            outcome: ImportRowStatus.SKIPPED,
            error: process.env.OPENAI_API_KEY
              ? messages.noVisibleGames
              : messages.needsAiKey,
          },
        });
        rowIndex += 1;
        continue;
      }

      for (const candidate of candidates) {
        try {
          if (candidate.confidence < 0.55) {
            skippedCount += 1;
            await prisma.importRow.create({
              data: {
                jobId: job.id,
                rowIndex,
                rawData: {
                  ...candidate,
                  sourceImageUrl: upload.url,
                } as Prisma.InputJsonValue,
                normalizedTitle: normalizeTitle(candidate.title),
                platformName: candidate.platformName ?? undefined,
                statusText: candidate.statusText ?? undefined,
                notes: candidate.notes ?? undefined,
                outcome: ImportRowStatus.SKIPPED,
                error: messages.lowConfidence,
              },
            });
            rowIndex += 1;
            continue;
          }

          const game = await upsertPhotoImportedEntry({
            candidate,
            sourceImageUrl: upload.url,
            userId,
          });
          importedCount += 1;
          await prisma.importRow.create({
            data: {
              jobId: job.id,
              rowIndex,
              rawData: {
                ...candidate,
                sourceImageUrl: upload.url,
              } as Prisma.InputJsonValue,
              normalizedTitle: normalizeTitle(candidate.title),
              platformName: candidate.platformName ?? undefined,
              statusText: parsePhotoStatus(candidate.statusText),
              notes: candidate.notes ?? undefined,
              outcome: ImportRowStatus.IMPORTED,
              matchedGameId: game.id,
            },
          });
        } catch (error) {
          failedCount += 1;
          await prisma.importRow.create({
            data: {
              jobId: job.id,
              rowIndex,
              rawData: {
                ...candidate,
                sourceImageUrl: upload.url,
              } as Prisma.InputJsonValue,
              normalizedTitle: normalizeTitle(candidate.title),
              platformName: candidate.platformName ?? undefined,
              statusText: candidate.statusText ?? undefined,
              notes: candidate.notes ?? undefined,
              outcome: ImportRowStatus.FAILED,
              error:
                error instanceof Error
                  ? error.message
                  : messages.rowFailed,
            },
          });
        } finally {
          rowIndex += 1;
        }
      }
    }

    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.COMPLETED,
        completedAt: new Date(),
        summary: {
          importedCount,
          skippedCount,
          failedCount,
          totalRows: rowIndex,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      importedCount,
      skippedCount,
      failedCount,
      totalRows: rowIndex,
    };
  } catch (error) {
    await prisma.importJob.update({
      where: { id: job.id },
      data: {
        status: ImportJobStatus.FAILED,
        completedAt: new Date(),
        summary: {
          error:
            error instanceof Error
              ? error.message
              : messages.importFailed,
        } as Prisma.InputJsonValue,
      },
    });

    throw error;
  }
}

export function getFormFile(value: FormDataEntryValue | null) {
  return isUsableFile(value) ? value : null;
}
