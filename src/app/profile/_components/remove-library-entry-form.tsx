"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/i18n";
import { removeLibraryEntryAction } from "../remove-library-actions";

export function RemoveLibraryEntryForm({ entryId, gameName, platformName, locale }: {
  entryId: string;
  gameName: string;
  platformName: string;
  locale: Locale;
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(removeLibraryEntryAction, { result: "" });
  const descriptionId = useId();
  const pt = locale === "pt-BR";

  if (state.result === "removed") {
    return <p role="status" className="text-xs">{pt ? "Jogo removido da estante." : "Game removed from your shelf."}</p>;
  }

  if (!confirming) {
    return <Button type="button" variant="link" size="xs" onClick={() => setConfirming(true)}
      aria-label={pt ? `Remover ${gameName} da estante (${platformName})` : `Remove ${gameName} from shelf (${platformName})`}>
      {pt ? "Remover da estante" : "Remove from shelf"}
    </Button>;
  }

  return (
    <form action={action} aria-describedby={descriptionId} className="w-full rounded-inner border border-edge p-3 text-xs">
      <input type="hidden" name="entryId" value={entryId} />
      <input type="hidden" name="confirmed" value="yes" />
      <div id={descriptionId} className="space-y-2">
        <p className="font-bold">{pt ? `Remover ${gameName} (${platformName})?` : `Remove ${gameName} (${platformName})?`}</p>
        <p>{pt
          ? "Isso apaga esta cópia e seus dados no filazo, incluindo avaliações, diário e registros no calendário. Não é possível desfazer. Cópias em outras plataformas ficam na estante."
          : "This deletes this copy and its data in filazo, including reviews, diary pages and calendar records. This cannot be undone. Copies on other platforms stay on your shelf."}</p>
        <p>{pt
          ? "Se o jogo vier de uma conta conectada ou importação, ele poderá voltar na próxima sincronização ou importação."
          : "If the game comes from a connected account or import, it may return on the next sync or import."}</p>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="xs" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
          {pt ? "Cancelar" : "Cancel"}
        </Button>
        <Button type="submit" size="xs" variant="destructive" disabled={pending}>
          {pending ? (pt ? "Removendo…" : "Removing…") : (pt ? "Confirmar remoção" : "Confirm removal")}
        </Button>
      </div>
      {state.result === "error" ? <p role="alert" className="mt-2">{pt
        ? "Não foi possível remover. Atualize a página e tente novamente."
        : "Could not remove the game. Refresh the page and try again."}</p> : null}
    </form>
  );
}
