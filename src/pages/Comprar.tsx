import { useState } from "react";
import { Navigate, useParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Loader2, ArrowRight, Lock, ShieldCheck, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logError } from "@/lib/log";
import { track, newEventId } from "@/lib/metaPixel";
import { PLAN_FEATURES } from "@/pages/PlanoComparacao";
import TermosDeUsoContent from "@/components/legal/TermosDeUsoContent";
import PoliticaDePrivacidadeContent from "@/components/legal/PoliticaDePrivacidadeContent";

type PlanoSlug = "essencial" | "pro" | "elite";

interface PlanoMeta {
  name: string;
  price: string;
  desc: string;
}

const PLAN_META: Record<PlanoSlug, PlanoMeta> = {
  essencial: {
    name: "Atlas Essencial",
    price: "R$ 15,90",
    desc: "Controle financeiro e organização da vida financeira.",
  },
  pro: {
    name: "Atlas Pro",
    price: "R$ 24,90",
    desc: "Planejamento financeiro completo + automações + Atlas Negócios + Mapa do Futuro.",
  },
  elite: {
    name: "Atlas Elite",
    price: "R$ 32,90",
    desc: "Tudo do Pro + educação financeira premium e conteúdos exclusivos.",
  },
};

const VALID_PLANOS: PlanoSlug[] = ["essencial", "pro", "elite"];
const PLAN_VALUE: Record<PlanoSlug, number> = { essencial: 15.9, pro: 24.9, elite: 32.9 };

function isPlanoSlug(value: string | undefined): value is PlanoSlug {
  return value !== undefined && (VALID_PLANOS as string[]).includes(value);
}

// Pulls the list of included features for a given plan from PlanoComparacao
function includedFeatures(plano: PlanoSlug): string[] {
  const included: string[] = [];
  for (const group of PLAN_FEATURES) {
    for (const item of group.items) {
      if (item[plano]) {
        included.push(item.label);
      }
    }
  }
  return included;
}

// Brazilian phone mask with DDD: (11) 91234-5678 / (11) 1234-5678
function maskTelefone(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CheckoutResponse {
  url?: string;
}

const Comprar = () => {
  const { plano } = useParams<{ plano: string }>();
  const { toast } = useToast();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [errors, setErrors] = useState<{ nome?: string; email?: string; telefone?: string }>({});
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [aceitoTermos, setAceitoTermos] = useState(false);
  const [aceitoMarketing, setAceitoMarketing] = useState(false);
  // Documento legal aberto no modal (não desmonta o formulário ao abrir/fechar)
  const [legalDoc, setLegalDoc] = useState<null | "termos" | "privacidade">(null);

  // Invalid plan → redirect to landing page
  if (!isPlanoSlug(plano)) {
    return <Navigate to="/" replace />;
  }

  const meta = PLAN_META[plano];
  const features = includedFeatures(plano);
  const featuresDestaque = features.slice(0, 4);
  const featuresRestante = features.slice(4);

  const validate = (): boolean => {
    const next: { nome?: string; email?: string; telefone?: string } = {};
    if (nome.trim().length < 3) next.nome = "Informe seu nome completo.";
    if (!EMAIL_RE.test(email.trim())) next.email = "Informe um e-mail válido.";
    const telDigits = telefone.replace(/\D/g, "");
    if (telDigits.length < 10 || telDigits.length > 11) next.telefone = "Informe um telefone válido com DDD.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      // Se houver usuario logado, amarra a compra a conta dele (evita provisionar
      // plano em conta errada quando paga com e-mail diferente do cadastro).
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke<CheckoutResponse>("create-checkout", {
        body: {
          plano,
          nome: nome.trim(),
          email: email.trim(),
          telefone: telefone.trim(),
          client_reference_id: session?.user?.id ?? null,
          aceito_marketing: aceitoMarketing,
        },
      });

      if (error) throw error;
      if (data?.url) {
        // Meta Pixel: início de checkout + guarda dados pra disparar a Purchase no retorno
        const value = PLAN_VALUE[plano] ?? 0;
        const eventId = newEventId();
        try {
          sessionStorage.setItem("atlas_checkout", JSON.stringify({ plano, value, eventId, name: PLAN_META[plano]?.name }));
        } catch { /* ignore */ }
        track("InitiateCheckout", { value, currency: "BRL", content_name: PLAN_META[plano]?.name, content_ids: [plano] }, eventId);
        window.location.href = data.url;
        return;
      }
      throw new Error("Resposta inválida do servidor de pagamento.");
    } catch (err) {
      logError("create-checkout error:", err);
      toast({
        title: "Não foi possível iniciar o pagamento",
        description: "Tente novamente em alguns instantes. Se persistir, fale com o suporte.",
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[#F5F1E8] px-4 py-8 font-['Outfit'] text-[#3F3D4A] sm:py-12">
      <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-3xl shadow-[0_30px_80px_-20px_rgba(26,26,46,0.45)] lg:grid-cols-[46%_54%]">
        {/* ── Painel esquerdo: marca ── */}
        <div className="relative min-h-[280px] overflow-hidden lg:min-h-full">
          <img
            src="/images/Atlas_Caminho.webp"
            alt="Caminho até o topo da montanha"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2e]/85 via-[#1a1a2e]/70 to-[#1a1a2e]/90" />

          <div className="relative z-10 flex h-full flex-col p-8 text-[#F5F1E8] sm:p-10">
            <Link to="/" className="inline-block">
              <img src="/images/atlas-logo-branca.webp" alt="Atlas" className="h-10 w-auto" />
            </Link>

            <div className="mt-8 flex-1">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#D3C7AD]">
                Você escolheu
              </p>
              <h1 className="mt-3 font-['Instrument_Serif'] text-4xl italic leading-tight sm:text-5xl">
                {meta.name}
              </h1>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="font-['Instrument_Serif'] text-4xl italic text-[#D3C7AD]">
                  {meta.price}
                </span>
                <span className="text-sm text-[#F5F1E8]/70">/mês</span>
              </div>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-[#F5F1E8]/80">{meta.desc}</p>

              <ul className="mt-6 space-y-3">
                {featuresDestaque.map((label) => (
                  <li key={label} className="flex items-start gap-3 text-sm text-[#F5F1E8]/90">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#D3C7AD]">
                      <Check className="h-3 w-3 text-[#1a1a2e]" />
                    </span>
                    <span>{label}</span>
                  </li>
                ))}
              </ul>

              {featuresRestante.length > 0 && (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#D3C7AD] transition-colors hover:text-[#F5F1E8]"
                    aria-expanded={showAll}
                  >
                    Ver todas as {features.length} funcionalidades
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${showAll ? "rotate-180" : ""}`}
                    />
                  </button>

                  {showAll && (
                    <ul className="mt-3 grid max-h-44 grid-cols-1 gap-x-4 gap-y-2 overflow-y-auto pr-1 sm:grid-cols-2">
                      {featuresRestante.map((label) => (
                        <li
                          key={label}
                          className="flex items-start gap-2 text-xs text-[#F5F1E8]/75"
                        >
                          <Check className="mt-0.5 h-3 w-3 shrink-0 text-[#D3C7AD]" />
                          <span>{label}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <p className="mt-8 font-['Instrument_Serif'] text-base italic text-[#F5F1E8]/70">
              Toda montanha precisa de um caminho.
            </p>
          </div>
        </div>

        {/* ── Painel direito: formulário ── */}
        <div className="bg-[#F5F1E8] p-8 sm:p-10">
          {/* Indicador de passos */}
          <div className="flex items-center gap-3 text-xs">
            <span className="inline-flex items-center gap-2 font-semibold text-[#1a1a2e]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1a1a2e] text-[10px] text-[#F5F1E8]">
                1
              </span>
              Seus dados
            </span>
            <span className="h-px w-8 bg-[#8E8B82]/40" />
            <span className="inline-flex items-center gap-2 text-[#8E8B82]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-[#8E8B82]/50 text-[10px]">
                2
              </span>
              Pagamento seguro
            </span>
          </div>

          <h2 className="mt-6 font-['Instrument_Serif'] text-3xl italic text-[#1a1a2e]">Quase lá</h2>
          <p className="mt-1 text-sm text-[#8E8B82]">
            Preencha seus dados para ir ao pagamento seguro.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <Label htmlFor="nome" className="text-sm font-medium text-[#3F3D4A]">
                Nome completo
              </Label>
              <Input
                id="nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                autoComplete="name"
                className="mt-1.5 rounded-xl border-[#8E8B82]/30 bg-white focus-visible:ring-[#1a1a2e]"
                aria-invalid={!!errors.nome}
              />
              {errors.nome && <p className="mt-1 text-xs text-red-600">{errors.nome}</p>}
            </div>

            <div>
              <Label htmlFor="email" className="text-sm font-medium text-[#3F3D4A]">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
                autoComplete="email"
                className="mt-1.5 rounded-xl border-[#8E8B82]/30 bg-white focus-visible:ring-[#1a1a2e]"
                aria-invalid={!!errors.email}
              />
              {errors.email
                ? <p className="mt-1 text-xs text-red-600">{errors.email}</p>
                : <p className="mt-1 text-xs text-[#8E8B82]">É com este e-mail que sua conta será criada e acessada. Se você já tem conta no Atlas, use o mesmo e-mail.</p>}
            </div>

            <div>
              <Label htmlFor="telefone" className="text-sm font-medium text-[#3F3D4A]">
                Telefone (com DDD)
              </Label>
              <Input
                id="telefone"
                type="tel"
                inputMode="numeric"
                value={telefone}
                onChange={(e) => setTelefone(maskTelefone(e.target.value))}
                placeholder="(11) 91234-5678"
                autoComplete="tel"
                className="mt-1.5 rounded-xl border-[#8E8B82]/30 bg-white focus-visible:ring-[#1a1a2e]"
                aria-invalid={!!errors.telefone}
              />
              {errors.telefone && <p className="mt-1 text-xs text-red-600">{errors.telefone}</p>}
            </div>

            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-3 text-sm text-[#3F3D4A]">
                <Checkbox
                  checked={aceitoTermos}
                  onCheckedChange={(v) => setAceitoTermos(v === true)}
                  className="mt-0.5 border-[#8E8B82]/50 data-[state=checked]:border-[#1a1a2e] data-[state=checked]:bg-[#1a1a2e]"
                  aria-label="Aceitar termos de uso e política de privacidade"
                />
                <span>
                  Li e aceito os{" "}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLegalDoc("termos"); }}
                    className="inline cursor-pointer border-0 bg-transparent p-0 align-baseline font-medium text-[#1a1a2e] underline"
                  >
                    termos de uso
                  </button>{" "}
                  e a{" "}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLegalDoc("privacidade"); }}
                    className="inline cursor-pointer border-0 bg-transparent p-0 align-baseline font-medium text-[#1a1a2e] underline"
                  >
                    política de privacidade
                  </button>
                  .
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm text-[#8E8B82]">
                <Checkbox
                  checked={aceitoMarketing}
                  onCheckedChange={(v) => setAceitoMarketing(v === true)}
                  className="mt-0.5 border-[#8E8B82]/50 data-[state=checked]:border-[#1a1a2e] data-[state=checked]:bg-[#1a1a2e]"
                  aria-label="Receber dicas e novidades do Atlas"
                />
                <span>Quero receber dicas e novidades do Atlas (opcional)</span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading || !aceitoTermos}
              className="mt-2 h-12 w-full rounded-xl bg-[#1a1a2e] text-base font-semibold text-[#F5F1E8] transition-colors hover:bg-[#1a1a2e]/90 disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Redirecionando...
                </>
              ) : (
                <>
                  Ir para o pagamento seguro <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>

            <div className="flex items-center justify-center gap-4 pt-1 text-xs text-[#8E8B82]">
              <span className="inline-flex items-center gap-1">
                <Lock className="h-3 w-3" /> Pagamento seguro
              </span>
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3 w-3" /> Cancele quando quiser
              </span>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de termos / privacidade — controlado por estado, não desmonta o formulário */}
      <Dialog open={legalDoc !== null} onOpenChange={(open) => { if (!open) setLegalDoc(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Instrument_Serif'] text-2xl italic text-[#1a1a2e]">
              {legalDoc === "termos" ? "Termos de Uso" : "Política de Privacidade"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 text-sm text-[#3F3D4A]">
            {legalDoc === "termos" ? <TermosDeUsoContent /> : legalDoc === "privacidade" ? <PoliticaDePrivacidadeContent /> : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Comprar;
