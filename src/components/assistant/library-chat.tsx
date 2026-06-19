"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import Markdown from "react-markdown";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STARTER_PROMPT_KEYS = [
  "libraryChat.prompt.shortSession",
  "libraryChat.prompt.taste",
  "libraryChat.prompt.return",
] as const;

const TOOL_LABEL_KEYS: Record<string, string> = {
  "tool-get_library_overview": "libraryChat.tool.overview",
  "tool-list_games": "libraryChat.tool.games",
  "tool-get_player_feedback": "libraryChat.tool.feedback",
  "tool-get_genre_stats": "libraryChat.tool.genres",
};

export function LibraryChat({ aiConfigured }: { aiConfigured: boolean }) {
  const t = useTranslations();
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
        <span className="section-label">{t("libraryChat.label")}</span>
        <h2 className="text-section-title leading-snug">
          {t("libraryChat.title")}
        </h2>
        <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed text-ink-soft">
          {t("libraryChat.body")}
        </p>
      </div>

      {!aiConfigured ? (
        <div className="rounded-card border border-edge bg-clay-soft p-5">
          <p className="font-semibold">{t("libraryChat.unavailableTitle")}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            {t("libraryChat.unavailableBody")}
          </p>
        </div>
      ) : (
        <div className="grid gap-3.5">
          <div
            className="max-h-[420px] min-h-[120px] overflow-y-auto rounded-card border border-edge bg-canvas/60 p-4"
            ref={scrollRef}
          >
            {messages.length === 0 ? (
              <div className="grid gap-2.5">
                <p className="text-sm font-semibold text-ink-soft">
                  {t("libraryChat.tryOne")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {STARTER_PROMPT_KEYS.map((promptKey) => {
                    const prompt = t(promptKey);
                    return (
                    <button
                      className="cursor-pointer rounded-pill border border-edge bg-surface px-3.5 py-1.5 text-left text-xs font-semibold transition-[background-color,box-shadow] hover:bg-sky-soft hover:shadow-rest motion-safe:transition-[transform,background-color,box-shadow] motion-safe:hover:-translate-y-0.5"
                      key={promptKey}
                      onClick={() => submitPrompt(prompt)}
                      type="button"
                    >
                      {prompt}
                    </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                {messages.map((message) => (
                  <div
                    className={cn(
                      "max-w-[85%] rounded-inner px-4 py-2.5 text-sm leading-relaxed shadow-rest",
                      message.role === "user"
                        ? "justify-self-end bg-sage-soft"
                        : "justify-self-start bg-surface",
                    )}
                    key={message.id}
                  >
                    {message.parts.map((part, index) => {
                      if (part.type === "text") {
                        return (
                          <div
                            className="grid gap-2 [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc [&_a]:underline [&_code]:rounded-[6px] [&_code]:bg-canvas [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.85em] [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold"
                            key={index}
                          >
                            <Markdown>{part.text}</Markdown>
                          </div>
                        );
                      }

                      const toolLabelKey = TOOL_LABEL_KEYS[part.type];
                      const toolLabel = toolLabelKey ? t(toolLabelKey as never) : null;
                      if (toolLabel) {
                        return (
                          <span
                            className="mb-1 mr-1 inline-block rounded-pill bg-sky-soft px-2 py-0.5 text-[0.64rem] font-bold text-ink-soft"
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
                    {t("libraryChat.checking")}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {error ? (
            <p className="rounded-inner border border-edge bg-clay-soft px-3 py-2 text-xs font-semibold">
              {t("libraryChat.paused")} {error.message || t("libraryChat.unexpectedError")} {t("libraryChat.tryAgain")}
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
              className="min-h-11 flex-1 rounded-pill border border-edge bg-surface px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sage focus-visible:ring-offset-2"
              disabled={busy}
              onChange={(event) => setInput(event.target.value)}
              placeholder={t("libraryChat.placeholder")}
              value={input}
            />
            <Button
              disabled={busy || !input.trim()}
              loading={busy}
              type="submit"
            >
              {busy ? t("libraryChat.thinking") : t("libraryChat.send")}
            </Button>
          </form>
        </div>
      )}
    </section>
  );
}
