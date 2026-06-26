import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { logError } from "@/lib/log";

const ForcePasswordChange = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Detecta modo: "initial" (primeira senha via convite) vs "change" (user logado trocando senha forcadamente)
  const inviteToken = params.get("token");
  const inviteEmail = params.get("email");
  const isInitialMode = !!inviteToken && !!inviteEmail;

  // Se nao esta em modo initial e nao tem user logado, redireciona pra /auth
  useEffect(() => {
    if (!isInitialMode && !user) {
      navigate("/auth", { replace: true });
    }
  }, [isInitialMode, user, navigate]);

  const requirements = [
    { label: "Pelo menos 8 caracteres", test: (p: string) => p.length >= 8 },
    { label: "Pelo menos 1 letra", test: (p: string) => /[a-zA-Z]/.test(p) },
    { label: "Pelo menos 1 número", test: (p: string) => /\d/.test(p) },
    { label: "Senha e confirmação iguais", test: (p: string) => p.length > 0 && p === confirmPassword },
  ];
  const allRequirementsMet = requirements.every(r => r.test(password));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRequirementsMet) {
      toast({ title: "Verifique os requisitos", description: "A senha precisa atender todos os requisitos listados.", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      if (isInitialMode) {
        // === MODO INITIAL: primeira senha via convite ===
        await handleInitialPassword();
      } else {
        // === MODO CHANGE: user ja logado mudando senha (compatibilidade com fluxo antigo) ===
        await handleChangePassword();
      }
    } catch (err: any) {
      logError("[ForcePasswordChange] error:", err);
      const msg = err?.message || "Erro desconhecido";
      toast({
        title: "Erro ao salvar senha",
        description: msg,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const handleInitialPassword = async () => {
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/set-initial-password`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ token: inviteToken, password }),
      },
    );

    const result = await resp.json();

    if (!resp.ok || !result.success) {
      if (result.error === "invalid_or_expired_token") {
        throw new Error("Este link expirou ou já foi usado. Peça um novo convite.");
      }
      if (result.error === "password_invalid") {
        throw new Error("A senha não atende aos requisitos mínimos.");
      }
      throw new Error("Não foi possível salvar a senha. Tente novamente.");
    }

    // Senha definida com sucesso. Agora setar sessao.
    if (result.fallback) {
      // EF não conseguiu gerar magic link — faz fallback pra signInWithPassword
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: result.email,
        password,
      });
      if (signInErr) {
        throw new Error("Senha salva, mas falha ao iniciar sessão. Faça login manualmente.");
      }
    } else if (result.hashed_token) {
      // Caminho preferido: verifyOtp com hashed_token
      const { error: otpErr } = await supabase.auth.verifyOtp({
        type: "magiclink",
        token_hash: result.hashed_token,
      });
      if (otpErr) {
        // Fallback: signInWithPassword (a senha acabou de ser definida)
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: result.email,
          password,
        });
        if (signInErr) {
          throw new Error("Senha salva, mas falha ao iniciar sessão. Faça login manualmente.");
        }
      }
    }

    setSuccess(true);
    toast({ title: "Senha definida!", description: "Bem-vindo ao Atlas!" });

    setTimeout(() => {
      navigate("/dashboard", { replace: true });
    }, 1000);
  };

  const handleChangePassword = async () => {
    // Fluxo antigo pra users já logados (raro agora, fica como fallback)
    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) {
      let msg = pwError.message || "Erro desconhecido";
      if (/different from the old password/i.test(msg) || /same_password/i.test(msg)) {
        msg = "Escolha uma senha diferente da anterior.";
      } else if (/weak|pwned/i.test(msg)) {
        msg = "Essa senha é muito comum. Escolha algo mais forte.";
      }
      throw new Error(msg);
    }

    const { error: clearError } = await supabase.functions.invoke("clear-must-change-password");
    if (clearError) {
      throw new Error("Senha atualizada, mas falha ao liberar acesso. Faça logout e login novamente.");
    }

    setSuccess(true);
    toast({ title: "Senha definida!", description: "Sua nova senha foi salva com sucesso." });

    // Polling do flag (read-after-write lag mitigation)
    const userId = user?.id;
    if (userId) {
      for (let attempt = 1; attempt <= 8; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 300));
        const { data } = await supabase
          .from("profiles")
          .select("must_change_password")
          .eq("user_id", userId)
          .maybeSingle();
        if ((data as any)?.must_change_password === false) break;
      }
    }

    navigate("/dashboard", { replace: true });
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F1EC" }}>
        <div className="text-center animate-fade-in">
          <CheckCircle2 className="h-12 w-12 mx-auto mb-4" style={{ color: "#6B8F71" }} />
          <h2 className="text-lg font-heading font-bold mb-2" style={{ color: "#3D3428" }}>
            {isInitialMode ? "Bem-vindo ao Atlas!" : "Senha definida com sucesso!"}
          </h2>
          <p className="text-sm font-body" style={{ color: "#8B7D6B" }}>Redirecionando…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center" style={{ background: "#F4F1EC" }}>
      <div className="absolute top-0 left-0 right-0 h-[400px] pointer-events-none">
        <svg viewBox="0 0 1440 400" fill="none" className="w-full h-full" preserveAspectRatio="none">
          <path d="M0,160 C360,260 720,80 1080,180 C1260,230 1380,150 1440,120 L1440,0 L0,0 Z" fill="#D6CEBC" fillOpacity="0.18" />
          <path d="M0,220 C240,140 480,280 720,200 C960,140 1200,240 1440,180 L1440,0 L0,0 Z" fill="#A09472" fillOpacity="0.06" />
        </svg>
      </div>

      <div className="relative z-10 w-full max-w-sm mx-6 animate-fade-in">
        <div className="text-center mb-10">
          <img src="/logo.png" alt="Atlas" className="w-14 h-14 mx-auto mb-6 rounded-2xl object-contain" style={{ filter: "drop-shadow(0 4px 12px rgba(74,64,53,0.08))" }} />
          <h1 className="text-xl md:text-2xl font-heading font-bold leading-snug mb-2" style={{ color: "#3D3428" }}>
            {isInitialMode ? "Crie sua senha de acesso" : "Defina sua nova senha"}
          </h1>
          <p className="text-sm font-body" style={{ color: "#8B7D6B" }}>
            {isInitialMode
              ? <>Última etapa: crie uma senha pessoal para acessar o Atlas.</>
              : <>Por segurança, você precisa criar uma senha <strong>pessoal</strong> antes de acessar a plataforma.</>
            }
          </p>
          {isInitialMode && inviteEmail && (
            <p className="text-xs font-body mt-2" style={{ color: "#A09472" }}>
              Conta: <strong>{decodeURIComponent(inviteEmail)}</strong>
            </p>
          )}
        </div>

        <div className="rounded-2xl p-8 border" style={{ background: "rgba(255,255,255,0.85)", borderColor: "#E8E2D6", backdropFilter: "blur(16px)", boxShadow: "0 8px 40px rgba(74,64,53,0.06)" }}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-[#5C5245] font-body text-xs tracking-wide uppercase">Nova Senha</Label>
              <PasswordInput id="new-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" className="border-[#E0D9CC] bg-white focus-visible:ring-[#A0845C] placeholder:text-[#C4B9A4] rounded-xl h-11" minLength={8} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-[#5C5245] font-body text-xs tracking-wide uppercase">Confirmar Senha</Label>
              <PasswordInput id="confirm-password" required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" className="border-[#E0D9CC] bg-white focus-visible:ring-[#A0845C] placeholder:text-[#C4B9A4] rounded-xl h-11" minLength={8} />
            </div>

            <div className="space-y-1.5 p-3 rounded-xl" style={{ background: "#F9F6F0" }}>
              <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: "#8B7D6B" }}>Requisitos da senha</p>
              <ul className="space-y-1">
                {requirements.map((req, idx) => {
                  const ok = req.test(password);
                  return (
                    <li key={idx} className="flex items-center gap-2 text-xs">
                      {ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#6B8F71" }} />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#C4B9A4" }} />
                      )}
                      <span style={{ color: ok ? "#3D3428" : "#8B7D6B" }}>{req.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <Button type="submit" className="w-full text-white font-heading font-semibold text-sm tracking-wide h-11 rounded-xl transition-all duration-200 hover:opacity-90 disabled:opacity-50" style={{ background: "linear-gradient(135deg, #4A5568, #3D3428)", boxShadow: "0 4px 16px rgba(61,52,40,0.15)" }} disabled={loading || !allRequirementsMet}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando…</> : <><KeyRound className="h-4 w-4 mr-2" /> {isInitialMode ? "Criar Senha e Entrar" : "Definir Senha"}</>}
            </Button>
          </form>
        </div>

        <div className="flex items-center justify-center gap-1.5 mt-6">
          <KeyRound className="h-3 w-3" style={{ color: "#B8AE9E" }} />
          <span className="text-[11px] font-body" style={{ color: "#B8AE9E" }}>Você não pode pular esta etapa.</span>
        </div>
      </div>
    </div>
  );
};

export default ForcePasswordChange;
