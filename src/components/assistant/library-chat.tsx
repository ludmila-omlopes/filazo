"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Markdown from "react-markdown";
import { cn } from "@/lib/utils";

const STARTER_PROMPTS = [
  "What should I play tonight in under 2 hours?",
  "What does my library say about my taste?",
  "Which abandoned game deserves a second chance?",
];

const TOOL_LABELS: Record<string, string> = {
  "tool-get_library_overview": "checked library overview",
  "tool-list_games": "listed games",
  "tool-get_player_feedback": "read your feedback",
  "tool-get_genre_stats": "crunched genre stats",
};

export function LibraryChat({ aiConfigured }: { aiConfigured: boolean }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/assistant/chat" }),
    // Each exchange is logged as an AssistantRun on the server; refresh the
    // server-rendered usage chips so spent AI calls show up immediately.
    onFinish: () => router.refresh(),
  });
  const busy = status === "submitted" || status === "streaming";

  function submitPrompt(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) {
      return;
    }

    void sendMessage({ text: trimmed });
    setInput("");
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }

  return (
    <section className="panel">
      <div className="mb-6">
        <span className="section-label">Library chat</span>
        <h2 className="text-[clamp(1.35rem,2.6vw,1.9rem)] leading-snug">
          Ask your collection anything
        </h2>
        <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed text-ink-soft">
          Answers come from live lookups into your own games, playtime, and
          reviews — nothing invented.
        </p>
      </div>

      {!aiConfigured ? (
        <div className="rounded-card border border-edge bg-clay-soft p-5">
          <p className="font-semibold">AI module unavailable.</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            Library chat needs OPENAI_API_KEY. The rule-based assistant panels
            keep working without it.
          </p>
        </div>
      ) : (
        <div className="grid gap-3.5">
          <div
            className="max-h-[420px] min-h-[120px] overflow-y-auto rounded-card border border-edge bg-bg/60 p-4"
            ref={scrollRef}
          >
            {messages.length === 0 ? (
              <div className="grid gap-2.5">
                <p className="text-sm font-semibold text-ink-soft">
                  Try one of these to start:
                </p>
                <div className="flex flex-wrap gap-2">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      className="cursor-pointer rounded-pill border border-edge bg-paper px-3.5 py-1.5 text-left text-xs font-semibold transition-all hover:-translate-y-0.5 hover:bg-blue-soft hover:shadow-hard-xs"
                      key={prompt}
                      onClick={() => submitPrompt(prompt)}
                      type="button"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                {messages.map((message) => (
                  <div
                    className={cn(
                      "max-w-[85%] rounded-inner px-4 py-2.5 text-sm leading-relaxed shadow-hard-xs",
                      message.role === "user"
                        ? "justify-self-end bg-sage-soft"
                        : "justify-self-start bg-paper",
                    )}
                    key={message.id}
                  >
                    {message.parts.map((part, index) => {
                      if (part.type === "text") {
                        return (
                          <div
                            className="grid gap-2 [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc [&_a]:underline [&_code]:rounded-[6px] [&_code]:bg-bg [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em] [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold"
                            key={index}
                          >
                            <Markdown>{part.text}</Markdown>
                          </div>
                        );
                      }

                      const toolLabel = TOOL_LABELS[part.type];
                      if (toolLabel) {
                        return (
                          <span
                            className="mb-1 mr-1 inline-block rounded-pill bg-blue-soft px-2 py-0.5 text-[0.64rem] font-bold tracking-wide text-ink-soft"
                            key={index}
                          >
                            {toolLabel}
                          </span>
                        );
                      }

                      return null;
                    })}
                  </div>
                ))}
                {status === "submitted" ? (
                  <p
                    aria-live="polite"
                    className="justify-self-start text-xs font-semibold text-ink-soft"
                    role="status"
                  >
                    Checking your library...
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {error ? (
            <p className="rounded-inner border border-edge bg-clay-soft px-3 py-2 text-xs font-semibold">
              Chat failed: {error.message || "unexpected error."} Try again.
            </p>
          ) : null}

          <form
            className="flex gap-2.5 max-sm:flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              submitPrompt(input);
            }}
          >
            <input
              className="min-h-11 flex-1 rounded-pill border border-edge bg-paper px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
              disabled={busy}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about your games, taste, or what to play next"
              value={input}
            />
            <button
              className="btn btn-primary disabled:cursor-wait disabled:opacity-70"
              disabled={busy || !input.trim()}
              type="submit"
            >
              {busy ? "Thinking..." : "Send"}
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
