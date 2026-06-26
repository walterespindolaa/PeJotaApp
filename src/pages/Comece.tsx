import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Lock, Rocket, Tag, CheckCircle2, Sparkles, Crown, ChevronDown, Mountain, Target, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/metaPixel";
import { logError } from "@/lib/log";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import SEO from "@/components/SEO";
import Footer from "@/components/Footer";
import { useI18n } from "@/contexts/I18nContext";

interface CouponData {
  plan_slug: string | null;
  client_cost_zero: boolean;
  client_discount_type: string | null;
  client_discount_value: number | null;
  pricing_model: string | null;
}

const PLAN_LABELS: Record<string, string> = {
  atlas_essencial: "Atlas Essencial",
  atlas_pro: "Atlas Pro",
  atlas_elite: "Atlas Elite",
};

const PLANS = [
  {
    slug: "atlas_essencial",
    name: "Essencial",
    tagline: "Para organizar sua vida financeira com clareza.",
    bullets: ["Controle de gastos", "Calendário financeiro", "Rotina simples"],
  },
  {
    slug: "atlas_pro",
    name: "Pro",
    tagline: "Para planejar melhor e evoluir com consistência.",
    bullets: ["Metas e projeções", "Automação financeira", "Visão de patrimônio"],
  },
  {
    slug: "atlas_elite",
    name: "Elite",
    tagline: "Para quem quer controle total da vida financeira e estratégia.",
    bullets: ["Tudo do Pro", "Conteúdo premium", "Decisões mais avançadas"],
    icon: Crown,
  },
];

const Comece = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [searchParams] = useSearchParams();
  const [plansOpen, setPlansOpen] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [couponValid, setCouponValid] = useState<null | boolean>(null);
  const [couponInfo, setCouponInfo] = useState<string>("");
  const [couponData, setCouponData] = useState<CouponData | null>(null);
  const [aceitoMarketing, setAceitoMarketing] = useState(false);
  const [aceitoTermos, setAceitoTermos] = useState(false);

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      const code = ref.toUpperCase();
      setCouponCode(code);
      setTimeout(() => validateCoupon(code), 300);
    }
  }, [searchParams]);

  if (!authLoading && user) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const validateCoupon = async (code: string) => {
    if (!code.trim()) { setCouponValid(null); setCouponInfo(""); setCouponData(null); return; }
    try {
    const { data: rows, error } = await supabase.rpc("validate_coupon", { coupon_code: code.trim().toUpperCase() }) as any;
    if (error) throw error;
    const data = rows?.[0] ?? null;
    if (data && !data.is_valid) { setCouponValid(false); setCouponInfo(t("comece.c_invalido")); setCouponData(null); return; }

    if (!data) { setCouponValid(false); setCouponInfo(t("comece.c_invalido")); setCouponData(null); return; }
    if (data.usage_limit && data.usage_count >= data.usage_limit) { setCouponValid(false); setCouponInfo(t("comece.c_esgotado")); setCouponData(null); return; }
    const now = new Date();
    if (data.valid_from && new Date(data.valid_from) > now) { setCouponValid(false); setCouponInfo(t("comece.c_nao_ativo")); setCouponData(null); return; }
    if (data.valid_until && new Date(data.valid_until) < now) { setCouponValid(false); setCouponInfo(t("comece.c_expirado")); setCouponData(null); return; }

    setCouponValid(true);
    setCouponData({ plan_slug: data.plan_slug, client_cost_zero: data.client_cost_zero, client_discount_type: data.client_discount_type, client_discount_value: data.client_discount_value, pricing_model: data.pricing_model });

    const parts: string[] = [];
    if (data.client_cost_zero) parts.push(t("comece.c_sem_custo"));
    else if (data.client_discount_type === "percent" && data.client_discount_value) parts.push(`${data.client_discount_value}% ${t("comece.c_off")}`);
    else if (data.client_discount_type === "fixed" && data.client_discount_value) parts.push(`R$ ${data.client_discount_value} ${t("comece.c_off")}`);
    if (data.plan_slug) parts.push(`${t("comece.c_plano")} ${PLAN_LABELS[data.plan_slug] || data.plan_slug}`);
    setCouponInfo(parts.length > 0 ? parts.join(" • ") : t("comece.c_valido"));
    } catch (e) {
      logError("validateCoupon:", e);
      setCouponValid(false);
      setCouponInfo(t("comece.c_erro"));
      setCouponData(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { toast({ title: t("comece.t_senha_curta"), description: t("comece.t_senha_curta_d"), variant: "destructive" }); return; }
    if (!aceitoTermos) { toast({ title: "Aceite necessário", description: "É necessário aceitar os Termos de Uso e a Política de Privacidade para criar sua conta.", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/register-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), password, coupon_code: couponCode.trim().toUpperCase() || undefined, aceito_marketing: aceitoMarketing, aceito_termos: aceitoTermos }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "email_exists" || data.error === "phone_exists") toast({ title: t("comece.t_existe"), description: data.message, variant: "destructive" });
        else if (data.error === "invalid_coupon") toast({ title: t("comece.t_cupom_invalido"), description: data.message, variant: "destructive" });
        else toast({ title: t("comece.t_erro_cad"), description: data.message || t("comece.t_tente"), variant: "destructive" });
        setLoading(false); return;
      }
      // Meta Pixel: cadastro de trial concluído
      track("CompleteRegistration", { content_name: "trial", status: true });
      track("Lead", { content_name: "trial" });
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (loginError) { toast({ title: t("comece.t_conta_criada"), description: t("comece.t_faca_login"), variant: "default" }); navigate("/auth"); }
      else { toast({ title: t("comece.t_bemvindo"), description: data.coupon_applied ? `${t("comece.t_cupom_word")} ${couponCode} ${t("comece.t_cupom_ok")}` : t("comece.t_trial") }); navigate("/dashboard"); }
    } catch { toast({ title: t("comece.t_erro_conexao"), description: t("comece.t_tente"), variant: "destructive" }); }
    setLoading(false);
  };

  const hasCoupon = couponValid === true && couponData;
  const headerTitle = hasCoupon ? "Seu acesso especial está pronto." : "Comece a organizar sua vida financeira.";
  const headerSubtitle = hasCoupon ? "Você recebeu uma condição exclusiva. Crie sua conta para ativar." : "Teste grátis por 7 dias. Acesso completo, sem cartão de crédito.";
  const submitLabel = hasCoupon ? t("comece.submit_cupom") : t("comece.submit_normal");

  const valueBullets = [
    { text: "Organização financeira completa", sub: "Controle de gastos, lançamentos e visão mensal" },
    { text: "Planejamento estratégico", sub: "Metas, projeções e acompanhamento de evolução" },
    { text: "Automação financeira", sub: "Importação de dados e menos esforço manual" },
    ...((hasCoupon && couponData?.plan_slug && couponData.plan_slug !== "atlas_essencial")
      ? [{ text: "Visão do patrimônio", sub: "Projeção patrimonial e mapa do futuro" }]
      : []),
  ];

  return (
    <>
    <SEO
      title="Comece com o Atlas | Crie sua conta e organize suas finanças"
      description="Crie sua conta Atlas em minutos. Escolha seu plano, aplique cupons de parceiros e comece a organizar sua vida financeira."
      path="/comece"
    />
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center py-16 px-6 md:px-10">
      {/* Fundo: ilustração Atlas (mesma do /auth) — retrato no mobile, paisagem no desktop */}
      <div className="absolute inset-0 bg-cover bg-center md:hidden" style={{ backgroundImage: "url('/images/auth-bg-mobile.webp')" }} aria-hidden="true" />
      <div className="absolute inset-0 bg-cover bg-center hidden md:block" style={{ backgroundImage: "url('/images/auth-bg-desktop.webp')" }} aria-hidden="true" />
      {/* Gradiente de legibilidade (texto/painel à esquerda) */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.12) 100%)" }} aria-hidden="true" />
      <Link to="/" className="absolute top-7 left-7 z-20 flex items-center gap-2 text-sm font-body hover:opacity-70 transition-opacity" style={{ color: "rgba(255,255,255,0.7)" }}>
        <ArrowLeft className="h-4 w-4" /> {t("auth.voltar")}
      </Link>

      <div className="relative z-10 w-full max-w-[1100px] mx-auto animate-fade-in">
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr,1fr] gap-12 md:gap-20 items-center">

          {/* ─── LEFT COLUMN ─── */}
          <div 
            className="flex flex-col space-y-8 items-center md:items-start text-center md:text-left pt-12 px-6 pb-6 md:p-8"
            style={{
              background: "rgba(0,0,0,0.25)",
              backdropFilter: "blur(2px)",
              borderRadius: "16px"
            }}
          >
            {/* Badge Pill */}
            <div className="flex justify-center md:justify-start w-full">
              <span 
                className="inline-flex items-center uppercase"
                style={{
                  backgroundColor: "rgba(255,255,255,0.12)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  borderRadius: "999px",
                  padding: "5px 16px",
                  fontSize: "11px",
                  color: "#FFFFFF",
                  letterSpacing: "1.5px"
                }}
              >
                {t("comece.badge")}
              </span>
            </div>

            {/* Title */}
            <h1 
              className="font-black text-white leading-[1.1] text-[26px] md:text-[clamp(28px,4vw,44px)] mt-3.5"
            >
              {t("comece.title_l1")}<br />{t("comece.title_l2")}
            </h1>

            {/* Subtitle */}
            <p 
              className="font-body text-white/70 text-sm md:text-base leading-relaxed mt-3.5 max-w-[300px] md:max-w-[400px] mx-auto md:mx-0"
            >
              {t("comece.subtitle")}
            </p>

            {/* Items Section */}
            <div className="block mt-[20px] md:mt-[36px]">
              <p 
                className="uppercase font-bold hidden md:block"
                style={{ 
                  color: "rgba(255,255,255,0.45)",
                  fontSize: "11px",
                  letterSpacing: "1.5px",
                  marginBottom: "16px"
                }}
              >
                {t("comece.muda_hoje")}
              </p>

              <div className="flex flex-col space-y-[12px] md:space-y-[20px] text-center md:text-left">
                {[
                  {
                    icon: Mountain,
                    title: t("comece.item1_t"),
                    desc: t("comece.item1_d")
                  },
                  {
                    icon: Target,
                    title: t("comece.item2_t"),
                    desc: t("comece.item2_d")
                  },
                  {
                    icon: TrendingUp,
                    title: t("comece.item3_t"),
                    desc: t("comece.item3_d")
                  }
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row items-center md:items-start gap-[14px]">
                    <div 
                      className="hidden md:flex items-center justify-center shrink-0"
                      style={{ 
                        width: "40px", 
                        height: "40px", 
                        backgroundColor: "rgba(255,255,255,0.1)", 
                        borderRadius: "50%" 
                      }}
                    >
                      <item.icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex flex-col">
                      <h2 className="text-white font-bold text-[14px] md:text-[15px]">{item.title}</h2>
                      <p 
                        className="text-[12px] md:text-[13px] leading-[1.4] md:leading-[1.5] text-white/65 md:text-white/60"
                      >
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer line */}
            <p 
              className="block text-center md:text-left mt-[14px] md:mt-[32px] mb-[24px] md:mb-0 text-[11px] md:text-[12px] text-white/45 md:text-white/35"
            >
              {t("comece.footer_line")}
            </p>
          </div>

          {/* ─── RIGHT COLUMN — FORM ─── */}
          <div className="flex flex-col items-center">
            <div
              className="w-full max-w-[440px] rounded-2xl p-8 md:p-9 border"
              style={{
                background: "rgba(255,255,255,0.9)",
                borderColor: "rgba(255,255,255,0.2)",
                backdropFilter: "blur(20px)",
                boxShadow: "0 12px 48px rgba(0,0,0,0.2)",
              }}
            >

              <p className="hidden md:block text-[11px] font-heading font-semibold tracking-[0.14em] uppercase mb-6" style={{ color: "#A09882" }}>
                {t("comece.crie_conta")}
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="trial-name" className="text-[12px] tracking-wide" style={{ color: "#6B5E50" }}>{t("comece.nome")}</Label>
                  <Input id="trial-name" type="text" required value={name} onChange={e => setName(e.target.value)} placeholder={t("comece.nome_ph")} className="border-[#E0D9CC] bg-white focus-visible:ring-[#B68A3F]/40 placeholder:text-[#C4B9A4] rounded-xl h-11 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="trial-email" className="text-[12px] tracking-wide" style={{ color: "#6B5E50" }}>{t("auth.email")}</Label>
                  <Input id="trial-email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={t("comece.email_ph")} className="border-[#E0D9CC] bg-white focus-visible:ring-[#B68A3F]/40 placeholder:text-[#C4B9A4] rounded-xl h-11 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="trial-phone" className="text-[12px] tracking-wide" style={{ color: "#6B5E50" }}>
                    {t("comece.telefone")} <span className="text-[#C4B9A4]">{t("comece.opcional")}</span>
                  </Label>
                  <Input id="trial-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder={t("comece.tel_ph")} className="border-[#E0D9CC] bg-white focus-visible:ring-[#B68A3F]/40 placeholder:text-[#C4B9A4] rounded-xl h-11 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="trial-password" className="text-[12px] tracking-wide" style={{ color: "#6B5E50" }}>{t("auth.senha")}</Label>
                  <Input id="trial-password" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder={t("comece.senha_ph")} className="border-[#E0D9CC] bg-white focus-visible:ring-[#B68A3F]/40 placeholder:text-[#C4B9A4] rounded-xl h-11 text-sm" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="trial-coupon" className="text-[12px] tracking-wide flex items-center gap-1" style={{ color: "#6B5E50" }}>
                    <Tag className="h-3 w-3" /> {t("comece.cupom")} <span className="text-[#C4B9A4]">{t("comece.opcional")}</span>
                  </Label>
                  <Input
                    id="trial-coupon" type="text" value={couponCode}
                    onChange={e => { const val = e.target.value.toUpperCase(); setCouponCode(val); setCouponValid(null); setCouponInfo(""); setCouponData(null); }}
                    onBlur={() => validateCoupon(couponCode)}
                    placeholder="ATLAS30OFF"
                    className={`border-[#E0D9CC] bg-white focus-visible:ring-[#B68A3F]/40 placeholder:text-[#C4B9A4] rounded-xl h-11 text-sm font-mono tracking-wider ${couponValid === true ? "border-green-500 bg-green-50/30" : couponValid === false ? "border-red-400" : ""}`}
                  />
                  {couponValid === true && couponInfo && (
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                      <p className="text-[11px] text-green-700 font-body">{couponInfo}</p>
                    </div>
                  )}
                  {couponValid === false && couponInfo && <p className="text-[11px] text-red-500 font-body">{couponInfo}</p>}
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <Checkbox
                    id="trial-terms"
                    checked={aceitoTermos}
                    onCheckedChange={(v) => setAceitoTermos(v === true)}
                    aria-label="Li e aceito os Termos de Uso e a Política de Privacidade"
                    className="mt-0.5 border-[#C4B9A4] data-[state=checked]:bg-[#B68A3F] data-[state=checked]:border-[#B68A3F]"
                  />
                  <Label htmlFor="trial-terms" className="text-[11px] leading-snug font-body cursor-pointer" style={{ color: "#8B7D6B" }}>
                    Li e aceito os{" "}
                    <Link to="/termos-de-uso" target="_blank" rel="noopener" className="underline hover:opacity-70" style={{ color: "#B68A3F" }}>Termos de Uso</Link>
                    {" "}e a{" "}
                    <Link to="/politica-de-privacidade" target="_blank" rel="noopener" className="underline hover:opacity-70" style={{ color: "#B68A3F" }}>Política de Privacidade</Link>.
                  </Label>
                </div>

                <div className="flex items-start gap-2 pt-1">
                  <Checkbox
                    id="trial-marketing"
                    checked={aceitoMarketing}
                    onCheckedChange={(v) => setAceitoMarketing(v === true)}
                    aria-label="Aceito receber novidades e comunicações por e-mail"
                    className="mt-0.5 border-[#C4B9A4] data-[state=checked]:bg-[#B68A3F] data-[state=checked]:border-[#B68A3F]"
                  />
                  <Label htmlFor="trial-marketing" className="text-[11px] leading-snug font-body cursor-pointer" style={{ color: "#8B7D6B" }}>
                    {t("comece.marketing")}
                  </Label>
                </div>

                <Button
                  type="submit"
                  className="w-full text-white font-heading font-semibold text-sm tracking-wide h-11 rounded-xl transition-all duration-200 hover:opacity-90 gap-2 mt-2"
                  style={{ background: "linear-gradient(135deg, #4A5568, #3D3428)", boxShadow: "0 4px 16px rgba(61,52,40,0.15)" }}
                  disabled={loading || !aceitoTermos}
                >
                  {loading ? t("comece.criando") : <>{submitLabel} <Rocket className="h-4 w-4" /></>}
                </Button>
              </form>

              <p className="text-center text-xs mt-5 font-body" style={{ color: "#8B7D6B" }}>
                {t("comece.ja_tem")}{" "}
                <Link to="/auth" className="underline hover:opacity-70" style={{ color: "#B68A3F" }}>{t("comece.entrar")}</Link>
              </p>
            </div>

            <div className="flex items-center justify-center gap-1.5 mt-6">
              <Lock className="h-3 w-3" style={{ color: "rgba(255,255,255,0.4)" }} />
              <span className="text-[11px] font-body" style={{ color: "rgba(255,255,255,0.4)" }}>{t("auth.seguro")}</span>
            </div>
          </div>
        </div>

        {/* RODAPÉ — links legais */}
        <div className="mt-10 [&_p]:text-white/45 [&_a]:text-white/55 hover:[&_a]:text-white/85 [&_footer]:border-white/10">
          <Footer />
        </div>
      </div>
    </div>
    </>
  );
};

export default Comece;
