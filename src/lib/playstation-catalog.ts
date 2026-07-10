import { cleanGameTitle, normalizeTitle } from "./utils.ts";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getSyncSources(rawData: unknown) {
  if (!isRecord(rawData) || !Array.isArray(rawData.playStationSyncSources)) {
    return [];
  }

  return rawData.playStationSyncSources.filter(isRecord);
}

function getMediaImages(source: JsonRecord) {
  const media = isRecord(source.media) ? source.media : null;
  const concept = isRecord(source.concept) ? source.concept : null;
  const conceptMedia = concept && isRecord(concept.media) ? concept.media : null;
  const images = [
    ...(media && Array.isArray(media.images) ? media.images : []),
    ...(conceptMedia && Array.isArray(conceptMedia.images)
      ? conceptMedia.images
      : []),
  ];

  return images.filter(isRecord);
}

function findImageUrl(sources: JsonRecord[], preferredTypes: string[]) {
  const images = sources.flatMap(getMediaImages);

  for (const type of preferredTypes) {
    const match = images.find(
      (image) => image.type === type && typeof image.url === "string",
    );
    if (match && typeof match.url === "string") {
      return match.url;
    }
  }

  return null;
}

export function canonicalizePlayStationGameTitle(value: string) {
  if (normalizeTitle(value) === "the last of us parte i") {
    return "The Last of Us Part I";
  }

  return cleanGameTitle(value);
}

export function getPlayStationArtworkFallback(rawData: unknown) {
  const sources = getSyncSources(rawData);
  const sourceImage = sources.find(
    (source) => typeof source.imageUrl === "string",
  )?.imageUrl;
  const trophyImage = sources.find(
    (source) => typeof source.trophyTitleIconUrl === "string",
  )?.trophyTitleIconUrl;

  const coverUrl =
    findImageUrl(sources, [
      "GAMEHUB_COVER_ART",
      "PORTRAIT_BANNER",
      "MASTER",
    ]) ??
    (typeof sourceImage === "string" ? sourceImage : null) ??
    (typeof trophyImage === "string" ? trophyImage : null);
  const heroUrl =
    findImageUrl(sources, [
      "BACKGROUND_LAYER_ART",
      "FOUR_BY_THREE_BANNER",
      "HERO_CHARACTER",
      "MASTER",
    ]) ??
    (typeof sourceImage === "string" ? sourceImage : null) ??
    coverUrl;

  return coverUrl ? { coverUrl, heroUrl: heroUrl ?? coverUrl } : null;
}
