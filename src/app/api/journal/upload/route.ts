import { del } from "@vercel/blob";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { z } from "zod";
import {
  canUploadJournalPath,
  journalUploadPayloadSchema,
} from "@/lib/journal-media";
import { getAiSettings } from "@/lib/ai-settings";
import { getAllowedUploadMimeTypes } from "@/lib/upload-file-type";
import { getSessionUserId } from "@/lib/session";
import { ABUSE_LIMITS } from "@/lib/abuse-policy";
import { checkApiAbuse } from "@/lib/abuse-request";
import { JOURNAL_UPLOAD_REQUEST_MAX_BYTES, journalUploadMaxBytes } from "@/lib/journal-upload-limits";
import { readLimitedJson, RequestBodyError } from "@/lib/request-body";

const uploadRequestSchema = z.object({
  kind: z.enum(["image", "audio"]),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  try {
    const limited = await checkApiAbuse([ABUSE_LIMITS.uploadBurst], userId);
    if (limited) return limited;
    const body = await readLimitedJson(request, JOURNAL_UPLOAD_REQUEST_MAX_BYTES) as HandleUploadBody;
    if (body?.type !== "blob.generate-client-token") {
      return Response.json({ error: "Invalid upload request." }, { status: 400 });
    }
    // Reserve daily allowance only after path validation, before issuing a token.
    // handleUpload wraps callback failures, so retain the structured 429/503.
    let quotaResponse: Response | null = null;
    const response = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const parsedPayload = journalUploadPayloadSchema.safeParse(
          clientPayload ? JSON.parse(clientPayload) : null,
        );
        if (!parsedPayload.success) {
          throw new Error("Invalid journal upload request.");
        }

        const payload = parsedPayload.data;
        if (payload.pathname !== pathname || !canUploadJournalPath(pathname, userId, payload.kind)) {
          throw new Error("Invalid journal upload path.");
        }

        const aiSettings = await getAiSettings();
        quotaResponse = await checkApiAbuse([ABUSE_LIMITS.uploadDaily], userId);
        if (quotaResponse) throw new Error("Upload allowance unavailable.");
        return {
          allowedContentTypes: getAllowedUploadMimeTypes(payload.kind),
          maximumSizeInBytes: journalUploadMaxBytes(payload.kind, aiSettings.voiceMaxFileBytes),
          addRandomSuffix: false,
          allowOverwrite: false,
          validUntil: Date.now() + 5 * 60 * 1000,
        };
      },
    }).catch((error: unknown) => {
      if (quotaResponse) return null;
      throw error;
    });

    if (quotaResponse) return quotaResponse;

    return Response.json(response);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    const message =
      error instanceof Error ? error.message : "Could not prepare journal upload.";
    return Response.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const limited = await checkApiAbuse([ABUSE_LIMITS.uploadDelete], userId);
  if (limited) return limited;
  let body: unknown;
  try {
    body = await readLimitedJson(request, JOURNAL_UPLOAD_REQUEST_MAX_BYTES);
  } catch (error) {
    return Response.json({ error: "Invalid upload request." }, {
      status: error instanceof RequestBodyError ? error.status : 400,
    });
  }
  const parsed = uploadRequestSchema
    .extend({ pathname: z.string().trim().min(1).max(320) })
    .safeParse(body);
  if (!parsed.success || !canUploadJournalPath(parsed.data.pathname, userId, parsed.data.kind)) {
    return Response.json({ error: "Invalid journal upload path." }, { status: 400 });
  }

  await del(parsed.data.pathname);
  return new Response(null, { status: 204 });
}
