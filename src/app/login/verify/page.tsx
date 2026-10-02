import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getRequestTranslator } from "@/lib/request-locale";
import { validRegistrationProof } from "@/lib/email-registration";
import { confirmEmailRegistrationAction } from "./actions";

export const metadata: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };

// GET is deliberately read-only: mail scanners must never activate credentials.
export default async function VerifyEmailPage({ searchParams }: PageProps<"/login/verify">) {
  const { t } = await getRequestTranslator();
  const query = await searchParams;
  const token = typeof query.token === "string" ? query.token : "";
  return (
    <main id="main-content" className="mx-auto grid w-full max-w-[520px] gap-5 rounded-card border border-edge bg-dusk-deep p-7 text-cream">
      <h1 className="font-display text-3xl">{t("auth.verification.title")}</h1>
      <p className="leading-relaxed text-cream/72">{t(validRegistrationProof(token) ? "auth.verification.body" : "auth.error.verificationInvalid")}</p>
      {validRegistrationProof(token) ? (
        <form action={confirmEmailRegistrationAction}>
          <input type="hidden" name="token" value={token} />
          <Button type="submit" className="min-h-12 w-full">{t("auth.verification.confirm")}</Button>
        </form>
      ) : null}
      <Link href="/login" className="text-sm underline underline-offset-4">{t("auth.dialog.signIn")}</Link>
    </main>
  );
}
