import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import PWAUpdateBanner from "@/components/PWAUpdateBanner";

// Deploy novo troca os hashes dos chunks; um módulo lazy antigo pode falhar ao
// carregar. Recarrega 1x (mesma guarda de 30s do ErrorBoundary) pra pegar o build novo.
window.addEventListener("vite:preloadError", () => {
  const key = "atlas_chunk_reload_attempt";
  const last = sessionStorage.getItem(key);
  const now = Date.now();
  if (!last || now - Number(last) > 30000) {
    sessionStorage.setItem(key, String(now));
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
    <PWAInstallPrompt />
    <PWAUpdateBanner />
  </HelmetProvider>
);

function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn || !import.meta.env.PROD) return;

  import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.0,
      replaysOnErrorSampleRate: 1.0,
      ignoreErrors: [
        "ResizeObserver loop limit exceeded",
        "ResizeObserver loop completed with undelivered notifications",
        "Non-Error promise rejection captured",
        "Network request failed",
        "Failed to fetch",
        "Load failed",
        "AbortError",
        "The operation was aborted",
      ],
      denyUrls: [
        /extensions\//i,
        /^chrome:\/\//i,
        /^chrome-extension:\/\//i,
        /^moz-extension:\/\//i,
        /^safari-extension:\/\//i,
      ],
      beforeSend(event) {
        const url = event.request?.url || "";
        if (url.includes("localhost") || url.includes("127.0.0.1")) {
          return null;
        }
        return event;
      },
    });
  });
}

if (typeof requestIdleCallback === "function") {
  requestIdleCallback(() => initSentry());
} else {
  setTimeout(() => initSentry(), 1);
}
