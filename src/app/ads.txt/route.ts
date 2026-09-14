// Site ownership verification is independent of serving advertising scripts.
export function GET() {
  const publisherId = process.env.ADSENSE_PUBLISHER_ID?.trim();
  const valid = publisherId && /^ca-pub-\d{16}$/.test(publisherId);
  return new Response(valid ? `google.com, ${publisherId.slice(3)}, DIRECT, f08c47fec0942fa0\n` : "", {
    status: valid ? 200 : 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
