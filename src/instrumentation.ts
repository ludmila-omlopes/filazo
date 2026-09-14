import * as Sentry from "@sentry/nextjs";
import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  await Promise.allSettled([
    Promise.resolve().then(() => Sentry.captureRequestError(error, request, context)),
    process.env.NEXT_RUNTIME === "nodejs"
      ? import("./lib/platform-telemetry").then(({ recordPlatformError }) => recordPlatformError(error, context))
      : Promise.resolve(),
  ]);
};
