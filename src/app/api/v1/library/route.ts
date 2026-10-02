import { ABUSE_LIMITS } from "@/lib/abuse-policy";
import { checkApiAbuse } from "@/lib/abuse-request";
import { parseLibraryApiQuery } from "@/lib/api-token-policy";
import { authenticateApiToken } from "@/lib/api-tokens";
import { getLibraryPageForApi } from "@/lib/library-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const auth = await authenticateApiToken(request.headers.get("authorization"));
  if (!auth) {
    return Response.json(
      { error: "Missing or invalid API key.", code: "UNAUTHORIZED" },
      { status: 401, headers: { ...noStore, "WWW-Authenticate": "Bearer" } },
    );
  }

  const limited = await checkApiAbuse([ABUSE_LIMITS.libraryApi], auth.tokenId);
  if (limited) return limited;

  const parsed = parseLibraryApiQuery(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error, code: "INVALID_QUERY" }, { status: 400, headers: noStore });
  }

  try {
    return Response.json(await getLibraryPageForApi(auth.userId, parsed.query), { headers: noStore });
  } catch {
    console.error("Library API could not read the library.");
    return Response.json({ error: "Library unavailable.", code: "UNAVAILABLE" }, { status: 503, headers: noStore });
  }
}
