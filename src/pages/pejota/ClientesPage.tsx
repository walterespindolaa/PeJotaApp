import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import BusinessClientes from "@/components/negocios/BusinessClientes";

const db = supabase as any;

export default function ClientesPage() {
  const { selected, loading } = useCompanies();
  const navigate = useNavigate();
  const [tx, setTx] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);

  useEffect(() => {
    if (!selected) { setTx([]); setCats([]); return; }
    (async () => {
      const [a, b] = await Promise.all([
        db.from("business_transactions").select("*").eq("company_id", selected.id).order("date", { ascending: false }).limit(5000),
        db.from("business_categories").select("*").eq("company_id", selected.id).order("sort_order"),
      ]);
      setTx(a.data || []); setCats(b.data || []);
    })();
  }, [selected]);

  if (!loading && !selected) return (
    <div className="max-w-3xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para ver os clientes.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      <div><h1 className="text-xl font-heading font-semibold">Clientes (CRM)</h1>
      <p className="text-sm text-muted-foreground">Seus clientes e o histórico com cada um {selected ? `· ${selected.name}` : ""}.</p></div>
      {selected && (
        <BusinessClientes
          companyId={selected.id}
          transactions={tx as any}
          categories={cats as any}
          onNovoLancamento={() => navigate("/dashboard/negocios")}
        />
      )}
    </div>
  );
}
