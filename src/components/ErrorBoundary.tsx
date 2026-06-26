import React from "react";
import * as Sentry from "@sentry/react";
import { logError } from "@/lib/log";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  componentStack?: string;
  errorId?: string;
  retryCount: number;
  copied: boolean;
}

const shortId = () => Math.random().toString(36).slice(2, 10);

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0, copied: false };
  }

  // Detecta erros de chunk obsoleto (deploy novo + aba antiga)
  static isChunkLoadError(error: Error): boolean {
    const msg = error?.message || "";
    return (
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("error loading dynamically imported module") ||
      msg.includes("Loading chunk") ||
      msg.includes("Loading CSS chunk") ||
      msg.includes("ChunkLoadError") ||
      msg.includes("Load failed") ||
      msg.includes("is not a valid JavaScript MIME type") ||
      /Importing a module script failed/.test(msg)
    );
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Chunk obsoleto: dispara reload silencioso pra pegar HTML novo com refs aos chunks atuais.
    // Guard de 30s evita loop caso o reload não resolva.
    if (ErrorBoundary.isChunkLoadError(error)) {
      const reloadKey = "atlas_chunk_reload_attempt";
      const lastAttempt = sessionStorage.getItem(reloadKey);
      const now = Date.now();
      if (!lastAttempt || now - Number(lastAttempt) > 30000) {
        sessionStorage.setItem(reloadKey, String(now));
        setTimeout(() => window.location.reload(), 100);
        return { hasError: false };
      }
    }
    return { hasError: true, error, errorId: shortId() };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (ErrorBoundary.isChunkLoadError(error)) {
      console.warn("[ErrorBoundary] Chunk obsoleto detectado, recarregando...", error.message);
      return;
    }

    console.error("[ErrorBoundary] Uncaught error:", error);
    console.error("[ErrorBoundary] stack:", error.stack);
    console.error("[ErrorBoundary] componentStack:", info?.componentStack);

    logError("[ErrorBoundary] Uncaught error:", error, info);

    try {
      Sentry.captureException(error, {
        tags: { source: "ErrorBoundary", errorId: this.state.errorId },
        extra: { componentStack: info?.componentStack },
      });
    } catch {}

    this.setState({ componentStack: info?.componentStack ?? undefined });
  }

  handleRetry = () => {
    this.setState(prev => ({
      hasError: false,
      error: undefined,
      componentStack: undefined,
      errorId: undefined,
      retryCount: prev.retryCount + 1,
      copied: false,
    }));
  };

  handleCopy = async () => {
    const { error, componentStack, errorId } = this.state;
    const payload = [
      `Error ID: ${errorId || "—"}`,
      `Message: ${error?.message || "—"}`,
      `URL: ${typeof window !== "undefined" ? window.location.href : "—"}`,
      `User-Agent: ${typeof navigator !== "undefined" ? navigator.userAgent : "—"}`,
      ``,
      `Stack:`,
      error?.stack || "—",
      ``,
      `Component Stack:`,
      componentStack || "—",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(payload);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch {
      // fallback noop — clipboard pode estar bloqueada
    }
  };

  render() {
    if (this.state.hasError) {
      const isDev = typeof import.meta !== "undefined" && (import.meta as any).env?.DEV;
      const { error, componentStack, errorId } = this.state;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="text-center space-y-4 max-w-2xl w-full">
            <h1 className="text-2xl font-heading font-bold text-foreground">Algo deu errado</h1>
            <p className="text-muted-foreground font-body">
              Ocorreu um erro inesperado. Tente novamente ou recarregue a página.
            </p>
            {errorId && (
              <p className="text-xs text-muted-foreground font-mono">ID: {errorId}</p>
            )}

            {isDev && error && (
              <details className="text-left bg-muted/30 rounded-lg p-3 border border-border/40">
                <summary className="cursor-pointer text-xs font-semibold text-foreground">
                  {error.message}
                </summary>
                <pre className="mt-2 text-[10px] text-muted-foreground whitespace-pre-wrap break-all overflow-auto max-h-64">
                  {error.stack || "(sem stack)"}
                  {componentStack ? `\n\nComponent stack:${componentStack}` : ""}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center flex-wrap">
              {this.state.retryCount < 2 && (
                <button
                  onClick={this.handleRetry}
                  className="px-6 py-2 rounded-lg bg-primary text-primary-foreground font-body"
                >
                  Tentar novamente
                </button>
              )}
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 rounded-lg bg-muted text-foreground font-body"
              >
                Recarregar página
              </button>
              <button
                onClick={this.handleCopy}
                className="px-6 py-2 rounded-lg border border-border text-foreground font-body"
              >
                {this.state.copied ? "Copiado ✓" : "Copiar diagnóstico"}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
