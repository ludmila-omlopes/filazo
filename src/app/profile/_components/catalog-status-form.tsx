"use client";

import { useActionState, useId } from "react";
import { UserGameStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { getStatusDisplayLabel } from "@/lib/copy";
import type { Locale } from "@/lib/i18n";
import { saveCatalogStatusAction } from "../catalog-status-actions";

export function CatalogStatusForm({ entryId, status, locale, compact = false }: {
  entryId: string; status: UserGameStatus; locale: Locale; compact?: boolean;
}) {
  const [state, action, pending] = useActionState(saveCatalogStatusAction, { result: "" });
  const id = useId();
  const pt = locale === "pt-BR";
  return (
    <form action={action} className={`flex min-w-0 flex-wrap items-end gap-2 ${compact ? "w-full" : ""}`}>
      <input name="entryId" type="hidden" value={entryId} />
      <label htmlFor={id} className="min-w-0 flex-1 text-xs">
        Status
        <select id={id} key={status} name="status" defaultValue={status} disabled={pending}
          className="mt-1 block w-full rounded-inner border border-edge bg-surface px-2 py-2 text-sm text-ink">
          {Object.values(UserGameStatus).map(value => <option key={value} value={value}>{getStatusDisplayLabel(value, locale)}</option>)}
        </select>
      </label>
      <Button type="submit" size="xs" disabled={pending}>{pending ? (pt ? "Salvando…" : "Saving…") : (pt ? "Salvar" : "Save")}</Button>
      <p aria-live="polite" className="w-full text-xs">
        {state.result === "saved" ? (pt ? "Status salvo em todas as plataformas." : "Status saved across all platforms.") :
          state.result === "error" ? (pt ? "Não foi possível salvar. Tente novamente." : "Could not save. Please try again.") : null}
      </p>
    </form>
  );
}
