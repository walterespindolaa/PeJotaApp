import * as Sentry from "@sentry/react";

/**
 * Logger de erro padronizado.
 *
 * Em DEV: preserva console.error pra ver na hora.
 * Em PROD: envia pra Sentry (captureException se houver Error, captureMessage caso contrário).
 *
 * Uso compatível com console.error: aceita N args.
 *   logError("[Tag] msg:", err)
 *   logError(err)
 *   logError("contexto", err, { extra })
 */
export function logError(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.error(...args);
  }

  const errorArg = args.find((a): a is Error => a instanceof Error);
  const stringParts = args
    .filter((a) => a !== errorArg)
    .map((a) => {
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    });
  const contextMsg = stringParts.join(" ");

  if (errorArg) {
    Sentry.captureException(errorArg, {
      extra: { context: contextMsg || undefined },
    });
  } else if (contextMsg) {
    Sentry.captureMessage(contextMsg, "error");
  }
}

/**
 * Logger de warning padronizado. Mesma semântica de logError, severidade warning.
 */
export function logWarn(...args: unknown[]): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(...args);
  }

  const errorArg = args.find((a): a is Error => a instanceof Error);
  const stringParts = args
    .filter((a) => a !== errorArg)
    .map((a) => {
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    });
  const contextMsg = stringParts.join(" ");

  if (errorArg) {
    Sentry.captureException(errorArg, {
      level: "warning",
      extra: { context: contextMsg || undefined },
    });
  } else if (contextMsg) {
    Sentry.captureMessage(contextMsg, "warning");
  }
}
