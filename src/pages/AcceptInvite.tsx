import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { logError } from "@/lib/log";
import SEO from "@/components/SEO";

type State =
  | { kind: "loading" }
  | { kind: "redirecting" }
  | { kind: "error"; reason: string };

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setState({ kind: "error", reason: "Link inválido. Token ausente." });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/accept-invite`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${anonKey}`,
              apikey: anonKey,
            },
            body: JSON.stringify({ token }),
          },
        );

        const result = await resp.json();

        if (!resp.ok || !result.success) {
          if (cancelled) return;
          const reason =
            result.error === "invalid_or_expired_token"
              ? "Este link expirou ou já foi usado. Peça um novo convite."
              : "Não foi possível ativar seu acesso. Tente novamente em instantes.";
          setState({ kind: "error", reason });
          return;
        }

        if (cancelled) return;
        setState({ kind: "redirecting" });

        // Navega pra tela de definir senha, passando token e email pela URL
        // (token continua valido — accept-invite usou peek, nao consumiu)
        const email = encodeURIComponent(result.email);
        setTimeout(() => {
          if (!cancelled) {
            navigate(`/force-password-change?token=${token}&email=${email}`, { replace: true });
          }
        }, 800);
      } catch (e) {
        if (cancelled) return;
        logError("[AcceptInvite] unexpected:", e);
        setState({ kind: "error", reason: "Erro inesperado. Tente novamente." });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [params, navigate]);

  return (
    <>
    <SEO title="Aceitar convite | Atlas" description="Valide seu convite para participar de um household no Atlas e comece a compartilhar o planejamento financeiro." path="/aceitar-convite" noindex />
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Atlas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.kind === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Validando seu convite...</p>
            </div>
          )}
          {state.kind === "redirecting" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <p className="text-sm">Convite válido. Redirecionando para criar sua senha...</p>
            </div>
          )}
          {state.kind === "error" && (
            <div className="flex flex-col items-center gap-3 py-8">
              <XCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-center">{state.reason}</p>
              <Button variant="outline" onClick={() => navigate("/auth", { replace: true })}>
                Ir para login
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
