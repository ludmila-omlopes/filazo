export class RequestBodyError extends Error {
  status: 400 | 413;
  constructor(status: 400 | 413) {
    super(status === 413 ? "Request body is too large." : "Invalid JSON request.");
    this.status = status;
  }
}

export async function readLimitedJson(request: Request, maxBytes: number): Promise<unknown> {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new RequestBodyError(413);
  if (!request.body) throw new RequestBodyError(400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new RequestBodyError(413);
      }
      chunks.push(chunk.value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new RequestBodyError(400);
    }
  } finally {
    reader.releaseLock();
  }
}
