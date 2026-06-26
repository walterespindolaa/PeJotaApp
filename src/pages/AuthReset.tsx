import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, KeyRound, Loader2, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

const AuthReset = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut, clearRecovery } = useAuth();

  const [searchParams] = useSearchParams();
  const customToken = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const readyRef = useRef(false);

  const traduzErroSenha = (msg: string): string => {
    if (/different from the old password/i.test(msg) || /same_password/i.test(msg)) return "Escolha uma senha diferente da anterior.";
    if (/weak|pwned|known to be|easy to guess/i.test(msg)) return "Essa senha é muito comum ou fraca. Escolha uma mais forte.";
    if (/at least|minimum|too short|length|6 characters|8 characters/i.test(msg)) return "A senha precisa ter pelo menos 8 caracteres.";
    return msg;
  };

  useEffect(() => {
    // Custom token from Sistema B — no need to wait for Supabase session
    if (customToken) {
      readyRef.current = true;
      setReady(true);
      return;
    }

    // Listen for PASSWORD_RECOVERY event — this fires when Supabase processes the hash tokens
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        if (session) {
          readyRef.current = true;
          setReady(true);
        }
      }
    });

    // Also try to get existing session (in case event already fired)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        readyRef.current = true;
        setReady(true);
      }
    });

    // Check URL hash for recovery tokens — Supabase puts them there
    const hash = window.location.hash;
    if (hash && (hash.includes("type=recovery") || hash.includes("access_token"))) {
      // Supabase JS client auto-processes hash tokens on init, just wait a bit
    }

    // Fallback timeout — give enough time for Supabase to process the hash
    const timeout = setTimeout(async () => {
      if (readyRef.current) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        readyRef.current = true;
        setReady(true);
      } else {
        setError("Link inválido ou expirado. Solicite um novo na tela de login.");
      }
    }, 5000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F1EC" }}>
        <div className="text-center space-y-4 max-w-md mx-6">
          <KeyRound className="h-12 w-12 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-heading font-bold" style={{ color: "#4A4035" }}>Link inválido ou expirado</h1>
          <p className="text-sm" style={{ color: "#8B7D6B" }}>{error}</p>
          <Link to="/auth">
            <Button variant="outline" className="mt-4">Voltar ao Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F1EC" }}>
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 mx-auto animate-spin" style={{ color: "#8B7D6B" }} />
          <p className="text-sm" style={{ color: "#8B7D6B" }}>Verificando link de recuperação...</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F4F1EC" }}>
        <div className="text-center space-y-4 max-w-md mx-6">
          <CheckCircle2 className="h-12 w-12 mx-auto text-green-600" />
          <h1 className="text-xl font-heading font-bold" style={{ color: "#4A4035" }}>Senha redefinida com sucesso!</h1>
          <p className="text-sm" style={{ color: "#8B7D6B" }}>Agora você pode fazer login com sua nova senha.</p>
          <Link to="/auth">
            <Button className="mt-4 text-white font-heading font-semibold" style={{ background: "#5C5245" }}>Ir para Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Senha muito curta", description: "A senha deve ter no mínimo 8 caracteres.", variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Senhas não conferem", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (customToken) {
        // Sistema B: token custom via Edge Function
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        if (!projectId) {
          // Falha visível em vez de cair num ref de projeto hardcoded (bug fantasma ao trocar de projeto).
          console.error("[AuthReset] VITE_SUPABASE_PROJECT_ID não configurado — impossível redefinir a senha via token custom.");
          throw new Error("Configuração do servidor ausente. Contate o suporte.");
        }
        const res = await fetch(`https://${projectId}.supabase.co/functions/v1/confirm-password-reset`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: customToken, new_password: password }),
        });
        const data = await res.json();
        if (!res.ok) {
          toast({ title: "Erro", description: traduzErroSenha(data.error || "Falha ao redefinir senha."), variant: "destructive" });
        } else {
          setSuccess(true);
          window.history.replaceState(null, "", window.location.pathname);
        }
      } else {
        // Sistema A: Supabase nativo via session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast({ title: "Sessão expirada", description: "O link de recuperação expirou. Solicite um novo.", variant: "destructive" });
          setError("Sessão expirada. Solicite um novo link na tela de login.");
          setLoading(false);
          return;
        }
        const { error: updateError } = await supabase.auth.updateUser({ password });
        if (updateError) {
          toast({ title: "Erro", description: traduzErroSenha(updateError.message), variant: "destructive" });
        } else {
          setSuccess(true);
          clearRecovery();
          window.history.replaceState(null, "", window.location.pathname);
          await signOut();
        }
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center" style={{ background: "#F4F1EC" }}>
      <div className="absolute top-0 left-0 right-0 h-[400px] pointer-events-none">
        <svg viewBox="0 0 1440 400" fill="none" className="w-full h-full" preserveAspectRatio="none">
          <path d="M0,160 C360,260 720,80 1080,180 C1260,230 1380,150 1440,120 L1440,0 L0,0 Z" fill="#D6CEBC" fillOpacity="0.25" />
        </svg>
      </div>

      <Link to="/auth" className="absolute top-6 left-6 z-20 flex items-center gap-2 text-sm font-body hover:opacity-70 transition-opacity" style={{ color: "#6B5E50" }}>
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <div className="relative z-10 w-full max-w-md mx-6 animate-fade-in">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img src="/logo.png" alt="Atlas" className="w-10 h-10 rounded-lg object-contain" />
            <span className="text-xl font-heading font-bold" style={{ color: "#4A4035" }}>Atlas</span>
          </div>
          <p className="text-sm font-body" style={{ color: "#8B7D6B" }}>Defina sua nova senha</p>
        </div>

        <div className="rounded-2xl p-8 border" style={{ background: "rgba(255,255,255,0.7)", borderColor: "#DDD5C5", backdropFilter: "blur(12px)", boxShadow: "0 8px 32px rgba(74,64,53,0.06)" }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-[#5C5245] font-body text-sm">Nova senha</Label>
              <PasswordInput id="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres" className="border-[#D6CEBC] bg-white/80 focus-visible:ring-[#A0845C] placeholder:text-[#B8AE9E]" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-[#5C5245] font-body text-sm">Confirmar senha</Label>
              <PasswordInput id="confirm-password" required minLength={8} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" className="border-[#D6CEBC] bg-white/80 focus-visible:ring-[#A0845C] placeholder:text-[#B8AE9E]" />
            </div>
            <Button type="submit" className="w-full text-white font-heading font-semibold" style={{ background: "#5C5245" }} disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...</> : "Redefinir Senha"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthReset;
