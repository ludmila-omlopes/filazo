import { getAdsTxt } from "@/lib/adsense";

export function GET() {
  const body = getAdsTxt();
  return new Response(body ?? "", {
    status: body ? 200 : 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
