"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import type { MarketplaceInput, MarketplaceOffer, MarketplaceResult } from "@/lib/assistant/marketplace-search";

const copy = {
  "pt-BR": {
    heading: "Onde comprar", description: "Busque lojas e pré-vendas na web com IA em todas as plataformas.",
    region: "Região da loja", search: "Buscar lojas e preços", searching: "Pesquisando lojas e pré-vendas…",
    empty: "Não encontrei páginas de lojas para esse jogo nesta região. Confira o título ou tente outra região.",
    unavailable: "A busca de lojas não está configurada. Você pode informar o preço manualmente.",
    limit: "A busca está desativada ou o limite de IA foi atingido. Você pode informar o preço manualmente.",
    error: "Não foi possível consultar as lojas agora. Tente novamente ou informe o preço manualmente.",
    unauthorized: "Entre na sua conta para pesquisar lojas.",
    noPrice: "Preço não confirmado", visit: "Ver na loja", use: "Usar este preço",
    partial: "Algumas lojas não puderam ser conferidas. Os resultados podem estar incompletos; você pode tentar a busca novamente.",
    checked: "Consultado em", note: "Resultados encontrados na web. Confirme edição, região e valor final na loja; preços e disponibilidade podem mudar.",
    available: "Disponível", preorder: "Pré-venda", announced: "Anunciado · sem reserva confirmada",
    unknown: "Disponibilidade não confirmada", outOfStock: "Indisponível",
    digital: "Digital", key: "Código do jogo", physical: "Mídia física", unknownDelivery: "Entrega não confirmada",
  },
  en: {
    heading: "Where to buy", description: "Search the web with AI for stores and preorders across all platforms.",
    region: "Store region", search: "Find stores and prices", searching: "Searching stores and preorders…",
    empty: "No store pages found for this game in this region. Check the title or try another region.",
    unavailable: "Store search is not configured. You can enter a price manually.",
    limit: "Search is disabled or the AI limit was reached. You can enter a price manually.",
    error: "Could not search stores right now. Try again or enter a price manually.",
    unauthorized: "Sign in to search stores.",
    noPrice: "Price unconfirmed", visit: "View store", use: "Use this price",
    partial: "Some stores could not be checked. Results may be incomplete; you can try searching again.",
    checked: "Checked", note: "Results found on the web. Confirm the edition, region and final price at the store; prices and availability may change.",
    available: "Available", preorder: "Preorder", announced: "Announced · preorder unconfirmed",
    unknown: "Availability unconfirmed", outOfStock: "Unavailable",
    digital: "Digital", key: "Game code", physical: "Physical copy", unknownDelivery: "Delivery unconfirmed",
  },
};

export function MarketplaceSearchPanel({ title, onUsePrice, onRegionChange }: {
  title: string;
  onUsePrice: (price: string) => void;
  onRegionChange: () => void;
}) {
  const locale = useLocale();
  const text = copy[locale];
  const [region, setRegion] = useState<MarketplaceInput["region"]>(locale === "pt-BR" ? "BR" : "US");
  return (
    <section className="grid gap-3 rounded-inner border border-edge bg-canvas/60 p-4" aria-label={text.heading}>
      <div>
        <h3 className="font-semibold">{text.heading}</h3>
        <p className="mt-1 text-sm text-ink-soft">{text.description}</p>
      </div>
      <label className="grid max-w-xs gap-1.5 text-sm font-semibold">
        {text.region}
        <select className="min-h-11 rounded-inner border border-edge bg-surface px-3 py-2 font-normal" value={region} onChange={(event) => { onRegionChange(); setRegion(event.target.value as MarketplaceInput["region"]); }}>
          <option value="BR">Brasil · BRL</option>
          <option value="US">United States · USD</option>
          <option value="PT">Portugal · EUR</option>
          <option value="CA">Canada · CAD</option>
          <option value="GB">United Kingdom · GBP</option>
        </select>
      </label>
      <MarketplaceResults key={JSON.stringify([title.trim(), region, locale])} input={{ title: title.trim(), region, locale }} onUsePrice={onUsePrice} />
    </section>
  );
}

function MarketplaceResults({ input, onUsePrice }: { input: MarketplaceInput; onUsePrice: (price: string) => void }) {
  const text = copy[input.locale];
  const [result, setResult] = useState<MarketplaceResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function search() {
    controller.current?.abort();
    const requestController = new AbortController();
    controller.current = requestController;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/assistant/marketplaces", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input), signal: requestController.signal,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        const message = payload.code === "NOT_CONFIGURED" ? text.unavailable
          : payload.code === "AI_LIMIT" ? text.limit
          : payload.code === "UNAUTHORIZED" ? text.unauthorized : text.error;
        throw new Error(message);
      }
      const payload: MarketplaceResult = await response.json();
      if (!requestController.signal.aborted) setResult(payload);
    } catch (failure) {
      if (!requestController.signal.aborted) setError(failure instanceof Error ? failure.message : text.error);
    } finally {
      if (!requestController.signal.aborted) setLoading(false);
    }
  }

  function priceLabel(offer: MarketplaceOffer) {
    if (offer.price === null || !offer.currency) return null;
    return new Intl.NumberFormat(input.locale, { style: "currency", currency: offer.currency }).format(offer.price);
  }

  return (
    <div className="grid min-w-0 gap-3">
      <Button type="button" variant="outline" className="justify-self-start" disabled={loading || input.title.length < 2} loading={loading} onClick={search}>{text.search}</Button>
      <div aria-live="polite" role="status" className="text-sm">
        {loading ? text.searching : error || (result && !result.offers.length && !result.partial ? text.empty : null)}
      </div>
      {result?.partial ? <p className="text-sm text-ink-soft" role="status">{text.partial}</p> : null}
      {result && result.offers.length > 0 ? (
        <>
          <ul className="grid gap-3">
            {result.offers.map((offer) => {
              const price = priceLabel(offer);
              const status = offer.availability === "unavailable" ? text.outOfStock : text[offer.availability];
              return (
                <li key={offer.url} className="grid min-w-0 gap-2 rounded-inner border border-edge bg-surface p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <strong className="break-words">{offer.store}</strong>
                    <span className="text-xs font-semibold text-ink-soft">{status}</span>
                  </div>
                  <p className="break-words text-sm">{[offer.title, offer.edition, offer.platform].filter(Boolean).join(" · ")}</p>
                  <p className="text-xs text-ink-soft">{offer.purchaseType === "digital" || offer.purchaseType === "key" || offer.purchaseType === "physical" ? text[offer.purchaseType] : text.unknownDelivery}</p>
                  <p className="text-sm font-semibold">{price ? `${price} · ${offer.currency}` : text.noPrice}</p>
                  <p className="break-words text-xs leading-relaxed text-ink-soft">{offer.evidence}</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <a className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-4" href={offer.url} target="_blank" rel="noopener noreferrer">{text.visit} ↗</a>
                    {price ? <Button type="button" variant="secondary" size="sm" onClick={() => onUsePrice(`${offer.currency} ${offer.price!.toFixed(2)}`)}>{text.use}</Button> : null}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-xs leading-relaxed text-ink-soft">{text.checked} <time dateTime={result.checkedAt}>{new Date(result.checkedAt).toLocaleString(input.locale)}</time>. {text.note}</p>
        </>
      ) : null}
    </div>
  );
}
