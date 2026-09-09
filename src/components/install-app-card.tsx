"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslations } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";

const INSTALL_CARD_DISMISSED_KEY = "filazo-install-card-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type InstallState = "checking" | "available" | "guidance" | "hidden";

function isIOSDevice() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in navigator &&
      (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );
}

function rememberInstallCardDismissal() {
  try {
    window.localStorage.setItem(INSTALL_CARD_DISMISSED_KEY, "1");
  } catch {
    // Hiding for this render is still useful when storage is unavailable.
  }
}

export function InstallAppCard() {
  const t = useTranslations();
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] =
    useState<InstallState>("checking");
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const displayMode = window.matchMedia("(display-mode: standalone)");

    if (isStandalone()) {
      const frame = window.requestAnimationFrame(() => {
        setInstallState("hidden");
      });
      return () => window.cancelAnimationFrame(frame);
    }

    try {
      if (window.localStorage.getItem(INSTALL_CARD_DISMISSED_KEY)) {
        const frame = window.requestAnimationFrame(() => {
          setInstallState("hidden");
        });
        return () => window.cancelAnimationFrame(frame);
      }
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }

    const iosDevice = isIOSDevice();
    const frame = window.requestAnimationFrame(() => {
      setIsIOS(iosDevice);
      setInstallState((current) =>
        current === "available" || current === "hidden"
          ? current
          : "guidance",
      );
    });

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setInstallState("available");
    }

    function handleDisplayModeChange() {
      if (isStandalone()) {
        setInstallState("hidden");
      }
    }

    function handleAppInstalled() {
      rememberInstallCardDismissal();
      setInstallState("hidden");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    displayMode.addEventListener("change", handleDisplayModeChange);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      displayMode.removeEventListener("change", handleDisplayModeChange);
    };
  }, []);

  function dismiss() {
    rememberInstallCardDismissal();
    setInstallState("hidden");
  }

  async function requestInstall() {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    setInstallPrompt(null);

    if (outcome === "accepted") {
      rememberInstallCardDismissal();
      setInstallState("hidden");
      return;
    }

    setInstallState("guidance");
  }

  if (installState === "checking" || installState === "hidden") {
    return null;
  }

  return (
    <section
      aria-labelledby="install-filazo-title"
      className="relative grid gap-3 rounded-inner border border-edge bg-sand-soft/65 p-4"
    >
      <Button
        aria-label={t("install.dismiss")}
        className="absolute right-2 top-2"
        onClick={dismiss}
        size="icon-xs"
        type="button"
        variant="link"
      >
        <X aria-hidden="true" />
      </Button>

      <div className="pr-8">
        <p
          className="font-display text-base font-semibold text-ink"
          id="install-filazo-title"
        >
          {t("install.title")}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-soft">
          {t("install.description")}
        </p>
      </div>

      {installState === "available" ? (
        <Button onClick={requestInstall} size="sm" type="button">
          <Download aria-hidden="true" />
          {t("install.action")}
        </Button>
      ) : isIOS ? (
        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-soft">
          <Share aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>{t("install.iosHelp")}</span>
        </p>
      ) : (
        <p className="text-xs leading-relaxed text-ink-soft">
          {t("install.browserHelp")}
        </p>
      )}
    </section>
  );
}
