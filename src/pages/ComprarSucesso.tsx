import { useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Mail } from "lucide-react";
import { track } from "@/lib/metaPixel";

const ComprarSucesso = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = searchParams.get("session_id"); // optional, for reference

  // Meta Pixel: conversão (pagamento confirmado). Usa o valor guardado no checkout.
  useEffect(() => {
    let info: { plano?: string; value?: number; eventId?: string; name?: string } = {};
    try { info = JSON.parse(sessionStorage.getItem("atlas_checkout") || "{}"); } catch { /* ignore */ }
    const params = { value: info.value ?? 0, currency: "BRL", content_name: info.name, content_ids: info.plano ? [info.plano] : undefined };
    track("Purchase", params, info.eventId);
    track("Subscribe", params, info.eventId ? `${info.eventId}-sub` : undefined);
    try { sessionStorage.removeItem("atlas_checkout"); } catch { /* ignore */ }
  }, []);

  return (
    <div className="min-h-screen w-full bg-[#F5EDE0] text-[#0A0A0B] font-['Outfit'] px-4 py-16">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center">
        <Card className="w-full rounded-3xl border-0 bg-white shadow-[0_20px_60px_-15px_rgba(10,10,11,0.25)] ring-1 ring-[#0A0A0B]/5">
          <CardContent className="p-8 text-center sm:p-10">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[#2F6173]/12">
              <CheckCircle2 className="h-9 w-9 text-[#2F6173]" />
            </div>

            <h1 className="font-['Instrument_Serif'] text-3xl italic leading-tight sm:text-4xl">
              Pagamento confirmado!
            </h1>

            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[#F5EDE0]/60 p-4 text-left">
              <Mail className="mt-0.5 h-5 w-5 shrink-0 text-[#E07856]" />
              <p className="text-sm leading-relaxed text-[#0A0A0B]/75">
                Enviamos um e-mail com o link para criar sua senha e acessar o PeJota.
                <strong className="text-[#0A0A0B]"> Não esqueça de checar a caixa de spam/promoções</strong> —
                se encontrar lá, marque como "não é spam" para receber os próximos avisos. O e-mail pode levar
                alguns minutos para chegar.
              </p>
            </div>

            <Button
              onClick={() => navigate("/auth")}
              className="mt-7 h-12 w-full rounded-xl bg-[#E07856] text-base font-semibold text-white transition-colors hover:bg-[#cc6646]"
            >
              Ir para o login <ArrowRight className="ml-2 h-4 w-4" />
            </Button>

            {sessionId && (
              <p className="mt-4 text-[11px] text-[#0A0A0B]/40">
                Referência: {sessionId}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ComprarSucesso;
