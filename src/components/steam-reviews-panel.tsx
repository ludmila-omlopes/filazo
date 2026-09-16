"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/locale-provider";
import type { SteamReview, SteamReviewsResult, SteamReviewsSnapshot } from "@/lib/steam-reviews";
import { Button } from "@/components/ui/button";
import { ThumbsDown, ThumbsUp } from "lucide-react";

const copy = {
  "pt-BR": {
    heading: "Reviews da Steam em português",
    description: "As avaliações públicas mais relevantes em português (Brasil), organizadas pela utilidade na Steam.",
    search: "Buscar reviews da Steam",
    refresh: "Atualizar reviews",
    searching: "Buscando reviews na Steam…",
    empty: "A Steam não retornou reviews públicas para este jogo.",
    noSteam: "Este jogo ainda não tem um vínculo com a Steam no catálogo.",
    error: "Não foi possível carregar as reviews da Steam agora.",
    limit: "Este jogo já atingiu o limite de atualizações de reviews hoje. Tente novamente mais tarde.",
    rateLimit: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
    refreshing: "Outra atualização deste jogo já está em andamento…",
    checked: "Consultado em",
    note: "A consulta foi restrita ao idioma configurado na plataforma. Leia o contexto completo na Steam.",
    recommended: "Recomendado",
    notRecommended: "Não recomendado",
    unknownRecommendation: "Sem recomendação",
    helpfulVotes: "votos úteis",
    comments: "comentários",
    publicReviews: "reviews públicas",
    reviewScore: "Recepção na Steam",
    read: "Ler na Steam",
    language: "Idioma",
    playtime: "jogadas no momento da review",
    unknownAuthor: "Usuário da Steam",
  },
  en: {
    heading: "Steam reviews in English",
    description: "The most relevant public reviews in English, ranked by helpfulness on Steam.",
    search: "Load Steam reviews",
    refresh: "Update reviews",
    searching: "Loading Steam reviews…",
    empty: "Steam did not return public reviews for this game.",
    noSteam: "This game does not have a Steam link in the catalog yet.",
    error: "Could not load Steam reviews right now.",
    limit: "This game has reached today's review refresh limit. Try again later.",
    rateLimit: "Too many attempts in a short time. Please wait a few minutes and try again.",
    refreshing: "Another refresh for this game is already in progress…",
    checked: "Checked",
    note: "The request was restricted to the platform's configured language. Read the full context on Steam.",
    recommended: "Recommended",
    notRecommended: "Not recommended",
    unknownRecommendation: "No recommendation",
    helpfulVotes: "helpful votes",
    comments: "comments",
    publicReviews: "public reviews",
    reviewScore: "Steam sentiment",
    read: "Read on Steam",
    language: "Language",
    playtime: "played at review time",
    unknownAuthor: "Steam user",
  },
} as const;

const languageNames: Record<string, string> = {
  brazilian: "Português (Brasil)",
  portuguese: "Português",
  english: "English",
  spanish: "Español",
  french: "Français",
  german: "Deutsch",
  russian: "Русский",
  schinese: "简体中文",
  tchinese: "繁體中文",
  japanese: "日本語",
  korean: "한국어",
};

export function SteamReviewsPanel({
  gameId,
  initialSnapshot,
}: {
  gameId: string;
  initialSnapshot: SteamReviewsSnapshot | null;
}) {
  const locale = useLocale();
  const text = copy[locale];
  const [result, setResult] = useState<SteamReviewsResult | null>(initialSnapshot);
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
    try {
      const response = await fetch(`/api/games/${encodeURIComponent(gameId)}/steam-reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
        signal: requestController.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = payload.code === "NO_STEAM" ? text.noSteam
          : payload.code === "STEAM_REVIEWS_LIMIT" ? text.limit
          : payload.code === "RATE_LIMITED" ? text.rateLimit
          : text.error;
        throw new Error(message);
      }
      if (!requestController.signal.aborted) setResult(payload as SteamReviewsResult);
    } catch (failure) {
      if (!requestController.signal.aborted) setError(failure instanceof Error ? failure.message : text.error);
    } finally {
      if (!requestController.signal.aborted) setLoading(false);
    }
  }

  return (
    <section className="panel min-w-0 bg-dusk-lavender-soft/70 max-sm:p-4" aria-label={text.heading}>
      <div>
        <h2 className="font-display text-2xl">{text.heading}</h2>
        <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-ink-soft">{text.description}</p>
      </div>
      <Button type="button" variant="outline" className="justify-self-start" disabled={loading} loading={loading} onClick={search}>
        {loading ? text.searching : result ? text.refresh : text.search}
      </Button>
      <div aria-live="polite" role="status" className="text-sm">
        {error || (result && !result.reviews.length && !result.refreshing ? text.empty : null)}
      </div>
      {result?.refreshing ? <p className="text-sm text-ink-soft" role="status">{text.refreshing}</p> : null}
      {result?.summary.reviewScoreDesc ? (
        <div className="grid gap-1 rounded-inner border border-edge bg-surface p-4">
          <span className="text-caption font-bold uppercase text-ink-soft">{text.reviewScore}</span>
          <strong className="font-display text-2xl">{result.summary.reviewScoreDesc}</strong>
          {result.summary.totalReviews ? (
            <span className="text-sm text-ink-soft">
              {new Intl.NumberFormat(locale).format(result.summary.totalReviews)} {text.publicReviews}
            </span>
          ) : null}
        </div>
      ) : null}
      {result?.reviews.length ? (
        <ul className="grid min-w-0 gap-4">
          {result.reviews.map((review) => <SteamReviewCard key={review.id} review={review} locale={locale} text={text} />)}
        </ul>
      ) : null}
      {result && !result.refreshing ? (
        <p className="text-xs leading-relaxed text-ink-soft">
          {text.checked} <time dateTime={result.checkedAt}>{new Date(result.checkedAt).toLocaleString(locale)}</time>. {text.note}
        </p>
      ) : null}
    </section>
  );
}

function SteamReviewCard({
  review,
  locale,
  text,
}: {
  review: SteamReview;
  locale: "en" | "pt-BR";
  text: (typeof copy)[keyof typeof copy];
}) {
  const language = review.language ? languageNames[review.language] ?? review.language : null;
  const playtime = review.playtimeMinutes === null ? null : review.playtimeMinutes >= 60
    ? `${Math.round(review.playtimeMinutes / 60)}h ${text.playtime}`
    : `${review.playtimeMinutes}m ${text.playtime}`;
  const sentiment = review.recommended === true
    ? { label: text.recommended, cardClass: "border-l-sage bg-sage-soft/35", badgeClass: "border-sage/70 bg-sage-soft text-ink", icon: ThumbsUp }
    : review.recommended === false
      ? { label: text.notRecommended, cardClass: "border-l-sand-strong bg-sand-soft/35", badgeClass: "border-sand-strong/70 bg-sand-soft text-ink", icon: ThumbsDown }
      : { label: text.unknownRecommendation, cardClass: "border-l-edge", badgeClass: "border-edge bg-surface text-ink-soft", icon: null };
  const SentimentIcon = sentiment.icon;
  return (
    <li className={`grid min-w-0 gap-3 rounded-inner border border-edge border-l-4 p-4 ${sentiment.cardClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{review.author || text.unknownAuthor}</p>
          <p className="mt-1 text-xs text-ink-soft">
            {[language ? `${text.language}: ${language}` : null, playtime].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-bold ${sentiment.badgeClass}`}>
          {SentimentIcon ? <SentimentIcon className="size-3.5" aria-hidden="true" /> : null}
          {sentiment.label}
        </span>
      </div>
      <p className="max-h-60 overflow-y-auto whitespace-pre-line text-sm leading-relaxed">{review.body}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-soft">
        <span>{new Intl.NumberFormat(locale).format(review.votesUp)} {text.helpfulVotes}</span>
        {review.commentCount ? <span>{new Intl.NumberFormat(locale).format(review.commentCount)} {text.comments}</span> : null}
        <a className="font-semibold underline underline-offset-4" href={review.url} target="_blank" rel="noopener noreferrer">
          {text.read} ↗
        </a>
      </div>
    </li>
  );
}
