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

  const body = (await request.json()) as HandleUploadBody;

  try {
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
        if (!canUploadJournalPath(pathname, userId, payload.kind)) {
          throw new Error("Invalid journal upload path.");
        }

        const aiSettings = await getAiSettings();
        return {
          allowedContentTypes: getAllowedUploadMimeTypes(payload.kind),
          ...(payload.kind === "audio"
            ? { maximumSizeInBytes: aiSettings.voiceMaxFileBytes }
            : {}),
          validUntil: Date.now() + 5 * 60 * 1000,
        };
      },
    });

    return Response.json(response);
  } catch (error) {
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

  const body = await request.json();
  const parsed = uploadRequestSchema
    .extend({ pathname: z.string().trim().min(1).max(320) })
    .safeParse(body);
  if (!parsed.success || !canUploadJournalPath(parsed.data.pathname, userId, parsed.data.kind)) {
    return Response.json({ error: "Invalid journal upload path." }, { status: 400 });
  }

  await del(parsed.data.pathname);
  return new Response(null, { status: 204 });
}
