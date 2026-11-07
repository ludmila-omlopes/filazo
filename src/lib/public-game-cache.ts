import { revalidateTag } from "next/cache";

/** Tag shared by every cached public read of one game page. */
export function publicGameTag(slug: string) {
  return `game:${slug}`;
}

/**
 * Call after writing public game data (metadata, prices, reviews, related
 * games). Anonymous copies never expire by time, so this is what refreshes
 * them; the next visit reads the database once.
 */
export function revalidateGamePage(slug: string) {
  try {
    revalidateTag(publicGameTag(slug), { expire: 0 });
  } catch (error) {
    // Scripts and tests run outside a request; the page then refreshes when a
    // member's five-minute copy expires or the game is written again.
    console.warn("Could not revalidate the public game page.", error instanceof Error ? error.message : error);
  }
}
