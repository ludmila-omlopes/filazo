import type { UIMessage } from "ai";
import { z } from "zod";

export const MAX_HISTORY_MESSAGES = 20;
export const CHAT_USER_TEXT_MAX_CHARS = 4000;
// Generous for any reply allowed by chatMaxOutputTokens (max 4000 tokens).
const CHAT_ASSISTANT_TEXT_MAX_CHARS = 16000;

const chatRequestSchema = z.object({
  messages: z.array(z.object({
    id: z.string().max(200),
    // The server owns the system prompt; clients cannot send one.
    role: z.enum(["user", "assistant"]),
    parts: z.array(z.looseObject({ type: z.string() })).max(200),
  })).min(1),
});

type TextPart = { type: "text"; text: string };

function isTextPart(part: { type: string }): part is TextPart {
  return part.type === "text" && typeof (part as { text?: unknown }).text === "string";
}

/**
 * Rebuilds the client's chat history as plain text only. Users may send text;
 * earlier assistant replies keep their text and drop tool calls, results and
 * other parts, so the browser cannot inject files, image URLs, tool results or
 * system prompts that the budget estimate does not account for.
 */
export function sanitizeChatMessages(value: unknown): UIMessage[] | null {
  const parsed = chatRequestSchema.safeParse(value);
  if (!parsed.success) return null;

  const messages: UIMessage[] = [];
  for (const message of parsed.data.messages.slice(-MAX_HISTORY_MESSAGES)) {
    if (message.role === "user") {
      if (!message.parts.every(isTextPart)) return null;
      const text = message.parts.map((part) => part.text).join("\n").trim();
      if (text.length > CHAT_USER_TEXT_MAX_CHARS) return null;
      if (text) messages.push({ id: message.id, role: "user", parts: [{ type: "text", text }] });
      continue;
    }

    const text = message.parts.filter(isTextPart).map((part) => part.text).join("\n").trim();
    if (text) {
      messages.push({
        id: message.id,
        role: "assistant",
        parts: [{ type: "text", text: text.slice(0, CHAT_ASSISTANT_TEXT_MAX_CHARS) }],
      });
    }
  }

  // Every request answers a new user message.
  return messages.at(-1)?.role === "user" ? messages : null;
}
