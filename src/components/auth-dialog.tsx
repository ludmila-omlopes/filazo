"use client";

import { useEffect, useId, useState } from "react";
import { Eye, EyeOff, Lock, Mail, X } from "lucide-react";
import Link from "next/link";
import { emailAuthAction } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { useTranslations } from "./locale-provider";

type AuthMode = "signup" | "signin";

type ButtonVariant = "default" | "ghost" | "outline" | "secondary" | "link";
type ButtonSize = "default" | "sm" | "lg";

export function AuthDialog({
  defaultOpen = false,
  error,
  showTrigger = true,
  triggerClassName,
  triggerLabel = "Sign in",
  triggerSize = "sm",
  triggerVariant = "default",
}: {
  defaultOpen?: boolean;
  error?: string;
  showTrigger?: boolean;
  triggerClassName?: string;
  triggerLabel?: string;
  triggerSize?: ButtonSize;
  triggerVariant?: ButtonVariant;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [mode] = useState<AuthMode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const titleId = useId();
  const t = useTranslations();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <>
      {showTrigger ? (
        <Button
          className={triggerClassName}
          onClick={() => setIsOpen(true)}
          size={triggerSize}
          type="button"
          variant={triggerVariant}
        >
          {triggerLabel}
        </Button>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-dusk-deep/72 px-4 py-8 backdrop-blur-md">
          <button
            aria-label={t("auth.dialog.close")}
            className="absolute inset-0 cursor-default"
            onClick={() => setIsOpen(false)}
            type="button"
          />
          <section
            aria-labelledby={titleId}
            aria-modal="true"
            className="relative z-10 w-full max-w-[520px] overflow-hidden rounded-card border border-cream/12 bg-dusk-deep p-7 text-cream shadow-float max-sm:p-5"
            role="dialog"
          >
            <button
              aria-label={t("auth.dialog.close")}
              className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-inner border border-cream/10 bg-cream/8 text-cream/70 transition-colors hover:bg-cream/14 hover:text-cream"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-6 text-center">
              <p className="text-kicker font-bold uppercase text-glow/80">
                {t("auth.dialog.account")}
              </p>
              <h2
                className="mt-2 font-display text-3xl font-medium leading-tight"
                id={titleId}
              >
                {t("auth.dialog.title")}
              </h2>
            </div>

            {error ? (
              <div className="mb-5 rounded-inner border border-clay/50 bg-clay/15 px-4 py-3 text-sm font-semibold text-cream">
                {error}
              </div>
            ) : null}

            <div className="mb-5 rounded-inner border border-cream/10 bg-cream/6 p-4 text-sm leading-relaxed text-cream/78">
              {t("auth.dialog.registrationClosed")}
            </div>

            <form action={emailAuthAction} className="grid gap-4">
              <input name="mode" type="hidden" value={mode} />

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-cream/80">
                  {t("auth.dialog.email")}
                </span>
                <span className="relative block">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/42" />
                  <input
                    autoComplete="email"
                    className="min-h-13 w-full rounded-inner border border-cream/8 bg-cream/8 px-11 text-cream placeholder:text-cream/38 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow"
                    name="email"
                    placeholder={t("auth.dialog.emailPlaceholder")}
                    required
                    type="email"
                  />
                </span>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-semibold text-cream/80">
                  {t("auth.dialog.password")}
                </span>
                <span className="relative block">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/42" />
                  <input
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    className="min-h-13 w-full rounded-inner border border-cream/8 bg-cream/8 px-11 pr-12 text-cream placeholder:text-cream/38 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-glow"
                    maxLength={128}
                    minLength={8}
                    name="password"
                    placeholder={t("auth.dialog.passwordPlaceholder")}
                    required
                    type={showPassword ? "text" : "password"}
                  />
                  <button
                    aria-label={
                      showPassword
                        ? t("auth.dialog.hidePassword")
                        : t("auth.dialog.showPassword")
                    }
                    className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-cream/55 hover:bg-cream/8 hover:text-cream"
                    onClick={() => setShowPassword((value) => !value)}
                    type="button"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </span>
              </label>

              <Button
                className="mt-1 min-h-13 bg-glow text-base text-dusk-deep hover:bg-cream"
                type="submit"
              >
                {t("auth.dialog.signIn")}
              </Button>
            </form>

            <div className="my-6 flex items-center gap-4 text-xs font-bold uppercase tracking-[0.18em] text-cream/45">
              <span className="h-px flex-1 bg-cream/10" />
              {t("auth.dialog.or")}
              <span className="h-px flex-1 bg-cream/10" />
            </div>

            <Button
              asChild
              className="min-h-13 w-full border-cream/10 bg-cream/8 text-base text-cream hover:bg-cream/14"
              variant="ghost"
            >
              <a href="/api/auth/google">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-cream text-sm font-black text-[#4285f4]">
                  G
                </span>
                {t("auth.dialog.google")}
              </a>
            </Button>

            <Button
              asChild
              className="mt-3 min-h-13 w-full border-cream/10 bg-transparent text-base text-cream hover:bg-cream/10"
              variant="ghost"
            >
              <Link href="/beta">{t("auth.dialog.requestBeta")}</Link>
            </Button>
          </section>
        </div>
      ) : null}
    </>
  );
}
