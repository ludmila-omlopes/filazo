import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";

/**
 * The beta intake is retired. Keep this route as a compatibility redirect for
 * old bookmarks and links from the former invite-only launch.
 */
export default async function BetaPage() {
  redirect((await getSessionUserId()) ? "/profile" : "/");
}
