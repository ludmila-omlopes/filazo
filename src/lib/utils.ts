import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function toIntlLocale(locale: string) {
  return locale === "en" ? "en-US" : locale;
}

export function cleanGameTitle(value: string) {
  return value
    .replace(/[™®©]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTitle(value: string) {
  return cleanGameTitle(value)
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const minecraftCanonicalTitles = new Set([
  "minecraft",
  "minecraft bedrock",
  "minecraft bedrock edition",
  "minecraft for windows",
  "minecraft java",
  "minecraft java edition",
  "minecraft java bedrock edition for pc",
  "minecraft launcher",
  "minecraft nintendo switch edition",
  "minecraft vanilla",
  "minecraft windows 10 edition",
  "minecraft xbox 360 edition",
  "minecraft xbox one edition",
]);

export function canonicalizeGameTitle(value: string) {
  const normalizedTitle = normalizeTitle(value);

  if (
    minecraftCanonicalTitles.has(normalizedTitle) ||
    /^minecraft for playstation\d*$/.test(normalizedTitle) ||
    /^minecraft playstation\d* edition$/.test(normalizedTitle)
  ) {
    return "Minecraft";
  }

  return cleanGameTitle(value);
}

export function slugify(value: string) {
  return normalizeTitle(value)
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function uniqueSlug(base: string, suffix?: string) {
  if (!suffix) {
    return slugify(base);
  }

  return `${slugify(base)}-${suffix.toLowerCase()}`;
}

export function formatPlaytime(
  minutes: number | null | undefined,
  completionPercent?: number | null,
) {
  if (!minutes || minutes < 1) {
    if (completionPercent && completionPercent > 0) {
      return "No time logged";
    }

    return "Not started";
  }

  if (minutes < 60) {
    return `${minutes}m played`;
  }

  const hours = minutes / 60;
  if (hours < 10) {
    return `${hours.toFixed(1)}h played`;
  }

  return `${Math.round(hours)}h played`;
}

export function formatTimeEstimate(
  minutes: number | null | undefined,
  locale = "en-US",
) {
  if (!minutes || minutes < 1) {
    return "Time not logged";
  }

  const intlLocale = toIntlLocale(locale);
  const compactNumber = new Intl.NumberFormat(intlLocale, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = minutes / 60;
  if (hours < 10) {
    return `${compactNumber.format(hours)}h`;
  }

  return `${compactNumber.format(Math.round(hours))}h`;
}

export function formatRemainingTime(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) {
    return "Time not logged";
  }

  if (minutes < 1) {
    return "Credits rolled";
  }

  return `~${formatTimeEstimate(minutes)} to credits`;
}

export function formatCompletionPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Not tracked";
  }

  return `${value}% achievements`;
}

export function formatLastPlayed(
  date: Date | null | undefined,
  completionPercent?: number | null,
) {
  if (!date) {
    if (completionPercent && completionPercent > 0) {
      return "No play date";
    }

    return "Never played";
  }

  return `Last played ${formatDate(date)}`;
}

export function formatDate(
  date: Date | null | undefined,
  locale = "en-US",
) {
  if (!date) {
    return "TBA";
  }

  return new Intl.DateTimeFormat(toIntlLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatNumber(
  value: number | null | undefined,
  locale = "en-US",
) {
  if (value === null || value === undefined) {
    return "0";
  }

  return new Intl.NumberFormat(toIntlLocale(locale)).format(value);
}
