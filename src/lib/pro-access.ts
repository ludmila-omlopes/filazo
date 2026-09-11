import { assertProAccess } from "@/lib/account-plans";
import { requirePlatformAccess } from "@/lib/beta-access";
import { getSessionUserId } from "@/lib/session";

/** Call before running a future Pro-only action or route handler.
 * Read the current plan from the database, never from a cookie or form field.
 * Login and beta access remain independent prerequisites.
 */
export async function requireProAccess() {
  const user = await requirePlatformAccess(await getSessionUserId());
  assertProAccess(user);
  return user;
}
