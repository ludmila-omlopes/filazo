"use client";

import { Check, Copy } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export function GogVerificationCode({
  code,
  copiedLabel,
  copyLabel,
  label,
}: {
  code: string;
  copiedLabel: string;
  copyLabel: string;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      inputRef.current?.select();
      document.execCommand("copy");
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold">{label}</span>
      <span className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <input
          aria-label={label}
          className="min-h-11 min-w-0 rounded-inner border border-sand bg-canvas px-3 font-mono text-base font-bold tracking-wide text-ink selection:bg-sand"
          readOnly
          ref={inputRef}
          value={code}
        />
        <Button
          aria-label={copied ? copiedLabel : copyLabel}
          onClick={copyCode}
          type="button"
          variant="ghost"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          <span className="max-sm:sr-only">{copied ? copiedLabel : copyLabel}</span>
        </Button>
      </span>
    </label>
  );
}
