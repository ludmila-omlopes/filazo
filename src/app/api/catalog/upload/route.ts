import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getSessionUserId } from "@/lib/session";
import { getAiSettings } from "@/lib/ai-settings";
import { isAiProviderConfigured } from "@/lib/openai";
import { ABUSE_LIMITS } from "@/lib/abuse-policy";
import { checkApiAbuse } from "@/lib/abuse-request";
import { readLimitedJson, RequestBodyError } from "@/lib/request-body";
import { canUploadCatalogPath, catalogUploadSchema, CATALOG_UPLOAD_REQUEST_MAX_BYTES } from "@/lib/catalog-upload-policy";
import { getAllowedUploadMimeTypes } from "@/lib/upload-file-type";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return Response.json({ error: "Authentication required." }, { status: 401 });
  try {
    const limited = await checkApiAbuse([ABUSE_LIMITS.uploadBurst], userId);
    if (limited) return limited;
    const settings = await getAiSettings();
    if (!settings.photoImportEnabled || !isAiProviderConfigured()) return Response.json({ error: "Photo import unavailable." }, { status: 403 });
    const body = await readLimitedJson(request, CATALOG_UPLOAD_REQUEST_MAX_BYTES) as HandleUploadBody;
    if (body?.type !== "blob.generate-client-token") return Response.json({ error: "Invalid upload request." }, { status: 400 });
    let quotaResponse: Response | null = null;
    const response = await handleUpload({ request, body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = catalogUploadSchema.parse(JSON.parse(clientPayload ?? "null"));
        if (payload.pathname !== pathname || !canUploadCatalogPath(pathname, userId)) throw new Error("Invalid upload path.");
        quotaResponse = await checkApiAbuse([ABUSE_LIMITS.uploadDaily], userId);
        if (quotaResponse) throw new Error("Upload allowance unavailable.");
        return {
          allowedContentTypes: getAllowedUploadMimeTypes("image"),
          maximumSizeInBytes: settings.photoImportMaxFileBytes,
          addRandomSuffix: false, allowOverwrite: false,
          validUntil: Date.now() + 5 * 60 * 1000,
        };
      },
    }).catch((error: unknown) => { if (quotaResponse) return null; throw error; });
    return quotaResponse ?? Response.json(response);
  } catch (error) {
    return Response.json({ error: "Could not prepare photo upload." }, {
      status: error instanceof RequestBodyError ? error.status : 400,
    });
  }
}
