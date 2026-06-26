import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading, isRecovery } = useAuth();
  const location = useLocation();
  const [mustChangePassword, setMustChangePassword] = useState<boolean | null>(null);
  const [negociosOnly, setNegociosOnly] = useState(false);

  useEffect(() => {
    if (!user) { setMustChangePassword(false); return; }

    let cancelled = false;
    supabase
      .from("profiles")
      .select("must_change_password, access_scope")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setMustChangePassword((data as any)?.must_change_password === true);
        setNegociosOnly((data as any)?.access_scope === "negocios");
      }, () => {
        // Falha de rede ao buscar o perfil: libera a navegação em vez de travar
        // o usuário num loader infinito (assume os defaults seguros).
        if (cancelled) return;
        setMustChangePassword(false);
      });
    return () => { cancelled = true; };
  }, [user, location.pathname]);

  if (loading || mustChangePassword === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F1EC]">
        <img src="/logo.png" alt="Atlas" className="w-16 h-16 mb-4 animate-pulse" />
        <div className="h-1 w-32 bg-[#E0D9CC] rounded-full overflow-hidden">
          <div className="h-full w-1/2 bg-[#4A4035] rounded-full animate-[shimmer_1.2s_ease-in-out_infinite]" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  // Recovery session must complete password reset first
  if (isRecovery) return <Navigate to="/auth/reset" replace />;

  // Force password change for temp-password accounts
  if (mustChangePassword && location.pathname !== "/force-password-change") {
    return <Navigate to="/force-password-change" replace />;
  }

  // Convidado com acesso restrito: só Atlas Negócios
  if (negociosOnly && !location.pathname.startsWith("/dashboard/negocios") && location.pathname !== "/force-password-change") {
    return <Navigate to="/dashboard/negocios" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
