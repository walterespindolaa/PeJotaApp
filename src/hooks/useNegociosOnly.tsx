import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Indica se o usuário atual tem acesso restrito só ao Atlas Negócios.
export function useNegociosOnly() {
  const { user } = useAuth();
  const [restricted, setRestricted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setRestricted(false); setLoading(false); return; }
    let cancelled = false;
    supabase.from("profiles").select("access_scope").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setRestricted((data as any)?.access_scope === "negocios");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [user]);

  return { restricted, loading };
}
