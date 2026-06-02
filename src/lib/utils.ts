import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeTitle(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
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

export function formatPlaytime(minutes: number | null | undefined) {
  if (!minutes || minutes < 1) {
    return "Freshly added";
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

export function formatTimeEstimate(minutes: number | null | undefined) {
  if (!minutes || minutes < 1) {
    return "Unknown";
  }

  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = minutes / 60;
  if (hours < 10) {
    return `${hours.toFixed(1)}h`;
  }

  return `${Math.round(hours)}h`;
}

export function formatCompletionPercent(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "Not tracked";
  }

  return `${value}% complete`;
}

export function formatLastPlayed(date: Date | null | undefined) {
  if (!date) {
    return "Never played";
  }

  return `Last played ${formatDate(date)}`;
}

export function formatDate(date: Date | null | undefined) {
  if (!date) {
    return "TBA";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "0";
  }

  return new Intl.NumberFormat("en-US").format(value);
}
