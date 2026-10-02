"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { createTranslator, type Locale } from "@/lib/i18n";
import {
  createApiTokenAction,
  revokeApiTokenAction,
  type CreateApiTokenState,
  type RevokeApiTokenState,
} from "../api-token-actions";

export type ApiTokenListItem = {
  id: string;
  name: string;
  prefix: string;
  /** Preformatted on the server so dates match the page locale. */
  meta: string;
};

const createErrors = {
  invalid: "profile.api.invalidName",
  limit: "profile.api.limitReached",
  rateLimited: "profile.api.rateLimited",
  error: "profile.api.error",
} as const;

function CreatedKey({ locale, token }: { locale: Locale; token: string }) {
  const t = createTranslator(locale);
  const [copied, setCopied] = useState(false);

  return (
    <div role="status" className="rounded-inner border border-sand/70 bg-sand-soft px-4 py-3 text-sm leading-relaxed">
      <p className="font-bold">{t("profile.api.createdTitle")}</p>
      <p className="mt-1 text-ink-soft">{t("profile.api.createdBody")}</p>
      <code className="mt-3 block select-all break-all rounded-inner border border-edge bg-surface px-3 py-2 font-mono text-xs">
        {token}
      </code>
      <Button
        type="button"
        size="xs"
        variant="ghost"
        className="mt-2"
        onClick={() => {
          navigator.clipboard.writeText(token).then(() => setCopied(true), () => undefined);
        }}
      >
        {copied ? t("profile.api.copied") : t("profile.api.copy")}
      </Button>
    </div>
  );
}

function ApiTokenRow({ locale, token }: { locale: Locale; token: ApiTokenListItem }) {
  const t = createTranslator(locale);
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<RevokeApiTokenState, FormData>(
    revokeApiTokenAction,
    { result: "" },
  );
  const descriptionId = useId();

  return (
    <li className="grid gap-2 rounded-inner border border-edge bg-canvas/60 px-4 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold">{token.name}</p>
          <p className="text-xs text-ink-soft">
            <code className="font-mono">{token.prefix}…</code> · {token.meta}
          </p>
        </div>
        {!confirming ? (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            aria-label={t("profile.api.revokeLabel", { name: token.name })}
            onClick={() => setConfirming(true)}
          >
            {t("profile.api.revoke")}
          </Button>
        ) : null}
      </div>
      {confirming ? (
        <form action={action} aria-describedby={descriptionId} className="grid gap-2 text-xs">
          <input type="hidden" name="tokenId" value={token.id} />
          <p id={descriptionId} className="font-semibold">
            {t("profile.api.revokeConfirm", { name: token.name })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="xs" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
              {t("profile.api.cancel")}
            </Button>
            <Button type="submit" size="xs" variant="destructive" disabled={pending}>
              {pending ? t("profile.api.revoking") : t("profile.api.revokeConfirmButton")}
            </Button>
          </div>
          {state.result === "error" ? <p role="alert">{t("profile.api.revokeError")}</p> : null}
        </form>
      ) : null}
    </li>
  );
}

export function ApiTokenManager({
  locale,
  tokens,
}: {
  locale: Locale;
  tokens: ApiTokenListItem[];
}) {
  const t = createTranslator(locale);
  const [state, action, pending] = useActionState<CreateApiTokenState, FormData>(
    createApiTokenAction,
    { result: "" },
  );
  const errorKey = state.result && state.result !== "created" ? createErrors[state.result] : null;

  return (
    <div className="grid gap-4">
      {state.result === "created" && state.token ? (
        <CreatedKey key={state.token} locale={locale} token={state.token} />
      ) : null}

      <div>
        <h4 className="mb-2 text-sm font-bold">{t("profile.api.keysTitle")}</h4>
        {tokens.length ? (
          <ul className="grid gap-2">
            {tokens.map((token) => (
              <ApiTokenRow key={token.id} locale={locale} token={token} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-soft">{t("profile.api.noKeys")}</p>
        )}
      </div>

      <form action={action} className="grid gap-2">
        <label className="grid gap-2">
          <span className="text-sm font-semibold">{t("profile.api.nameLabel")}</span>
          <input
            className="min-h-11 rounded-inner border border-edge bg-surface px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            name="name"
            maxLength={60 /* API_TOKEN_NAME_MAX_LENGTH, kept out of the client bundle */}
            autoComplete="off"
            placeholder={t("profile.api.namePlaceholder")}
            required
          />
        </label>
        <div>
          <Button type="submit" disabled={pending} loading={pending}>
            {pending ? t("profile.api.creating") : t("profile.api.create")}
          </Button>
        </div>
        {errorKey ? <p role="alert" className="text-sm font-semibold">{t(errorKey)}</p> : null}
      </form>
    </div>
  );
}
