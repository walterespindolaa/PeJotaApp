import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Lock, Rocket, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import { useI18n } from "@/contexts/I18nContext";

const Auth = () => {
  const { signIn } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const handleForgotPassword = async () => {
    const email = loginEmail || prompt(t("auth.prompt_email"));
    if (!email) return;
    setLoading(true);
    toast({ title: t("auth.enviando"), description: t("auth.enviando_desc") });
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/auth/reset`,
      });
      if (error) {
        toast({ title: t("auth.falha_email"), description: error.message, variant: "destructive" });
      } else {
        toast({ title: t("auth.email_enviado"), description: t("auth.email_enviado_desc") });
      }
    } catch (e: any) {
      toast({ title: t("auth.falha_email"), description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(loginEmail, loginPassword);
    setLoading(false);
    if (error) {
      toast({ title: t("auth.erro_entrar"), description: error.message, variant: "destructive" });
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <>
      <SEO
        title="Entrar no Atlas | Acesse sua conta"
        description="Acesse sua conta Atlas para organizar finanças, acompanhar objetivos e visualizar seu planejamento financeiro pessoal."
        path="/auth"
      />
      <div className="min-h-screen relative overflow-hidden">
        {/* Fundo: ilustração responsiva (mobile retrato / desktop paisagem) */}
        <div className="absolute inset-0 bg-cover bg-center lg:hidden" style={{ backgroundImage: "url('/images/auth-bg-mobile.webp')" }} aria-hidden="true" />
        <div className="absolute inset-0 bg-cover bg-center hidden lg:block" style={{ backgroundImage: "url('/images/auth-bg-desktop.webp')" }} aria-hidden="true" />
        {/* Escurecimento à esquerda (desktop) para o texto da marca ficar legível sobre a arte */}
        <div className="hidden lg:block absolute inset-y-0 left-0 w-3/5 pointer-events-none bg-gradient-to-r from-black/55 via-black/25 to-transparent" aria-hidden="true" />
        {/* Scrim suave no topo para o "Voltar" */}
        <div className="absolute inset-x-0 top-0 h-24 pointer-events-none bg-gradient-to-b from-black/25 to-transparent lg:hidden" aria-hidden="true" />

        <Link
          to="/"
          className="absolute top-4 left-4 md:top-6 md:left-6 z-20 flex items-center gap-2 text-sm font-body text-white bg-black/25 backdrop-blur-sm px-3 py-1.5 rounded-full hover:bg-black/40 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> {t("auth.voltar")}
        </Link>

        <div className="relative z-10 min-h-screen flex items-end justify-center px-6 pb-10 lg:items-center lg:pb-0">
          <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-10 lg:gap-12 items-center animate-fade-in">
            {/* ── Texto da marca (desktop) — sobre painel translúcido ── */}
            <div className="hidden lg:flex flex-col text-white bg-black/35 backdrop-blur-md rounded-3xl p-9 border border-white/10">
              <span className="inline-flex items-center gap-2 self-start px-[14px] py-[6px] rounded-full bg-[#f2ab0c]/18 border border-[#f2ab0c]/40 text-[#f2ab0c] text-xs font-semibold tracking-wide mb-6">
                <Zap className="h-3.5 w-3.5" /> {t("auth.badge")}
              </span>
              <h1 className="font-black leading-[1.04] tracking-tight" style={{ fontSize: "clamp(40px, 4.2vw, 58px)", textShadow: "0 2px 24px rgba(0,0,0,0.35)" }}>
                {t("auth.hero_l1")}<br />{t("auth.hero_l2")}
              </h1>
              <p className="mt-5 text-[15px] max-w-[380px]" style={{ color: "rgba(255,255,255,0.85)", textShadow: "0 1px 12px rgba(0,0,0,0.35)" }}>
                {t("auth.hero_sub")}
              </p>
              <div className="mt-7 flex flex-col gap-3">
                {[t("auth.bullet1"), t("auth.bullet2"), t("auth.bullet3")].map((b) => (
                  <div key={b} className="flex items-center gap-2.5 text-[14px]" style={{ color: "rgba(255,255,255,0.9)", textShadow: "0 1px 10px rgba(0,0,0,0.4)" }}>
                    <span className="h-1.5 w-1.5 rounded-full bg-[#f2ab0c] flex-shrink-0" />
                    {b}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Card de login ── */}
            <div className="w-full max-w-sm mx-auto lg:ml-auto">
              <div
                className="rounded-2xl p-6 md:p-8 border"
                style={{ background: "rgba(250,244,232,0.96)", borderColor: "#E8E2D6", backdropFilter: "blur(8px)", boxShadow: "0 20px 60px -15px rgba(16,28,38,0.5)" }}
              >
                {/* pill só no mobile (no desktop já aparece à esquerda) */}
                <span className="lg:hidden inline-flex items-center gap-2 px-[13px] py-[5px] rounded-full bg-[#f2ab0c]/15 border border-[#f2ab0c]/35 text-[#9a6c08] text-[11px] font-semibold tracking-wide mb-4">
                  <Zap className="h-3 w-3" /> {t("auth.badge")}
                </span>
                <h2 className="font-heading font-bold text-[22px] md:text-2xl" style={{ color: "#2a2218" }}>
                  {t("auth.welcome")}
                </h2>
                <p className="text-sm mb-5" style={{ color: "#8B7D6B" }}>
                  {t("auth.welcome_sub")}
                </p>

                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="login-email" className="text-[#5C5245] font-body text-xs tracking-wide uppercase">
                      {t("auth.email")}
                    </Label>
                    <Input
                      id="login-email"
                      type="email"
                      required
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="border-[#E0D9CC] bg-white focus-visible:ring-[#f2ab0c]/50 placeholder:text-[#C4B9A4] rounded-xl h-12 md:h-11 text-base md:text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="login-password" className="text-[#5C5245] font-body text-xs tracking-wide uppercase">
                      {t("auth.senha")}
                    </Label>
                    <PasswordInput
                      id="login-password"
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="border-[#E0D9CC] bg-white focus-visible:ring-[#f2ab0c]/50 placeholder:text-[#C4B9A4] rounded-xl h-12 md:h-11 text-base md:text-sm"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full font-heading font-semibold text-base md:text-sm tracking-wide h-[50px] md:h-11 rounded-xl transition-all duration-200 hover:opacity-90"
                    style={{ background: "#f2ab0c", color: "#2a1c02", boxShadow: "0 4px 18px rgba(242,171,12,0.28)" }}
                    disabled={loading}
                  >
                    {loading ? t("auth.entrando") : t("auth.entrar")}
                  </Button>

                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="w-full text-center text-xs font-body hover:underline mt-1 transition-opacity"
                    style={{ color: "#9a6c08" }}
                  >
                    {t("auth.esqueci")}
                  </button>
                </form>

                <div className="mt-5 pt-4 border-t text-center" style={{ borderColor: "#E8E2D6" }}>
                  <span className="text-sm font-body" style={{ color: "#5C5245" }}>
                    {t("auth.sem_conta")}{" "}
                  </span>
                  <Link to="/comece" className="inline-flex items-center gap-1.5 text-sm font-semibold hover:opacity-80 transition-opacity" style={{ color: "#2a2218" }}>
                    {t("auth.criar_conta")} <Rocket className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="flex items-center justify-center gap-1.5 mt-5">
                  <Lock className="h-3 w-3" style={{ color: "#B8AE9E" }} />
                  <span className="text-[11px] font-body" style={{ color: "#B8AE9E" }}>
                    {t("auth.seguro")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Auth;
