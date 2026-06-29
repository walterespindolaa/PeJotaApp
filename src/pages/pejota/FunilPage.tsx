import { Link } from "react-router-dom";
import { useCompanies } from "@/hooks/useCompanies";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import BusinessFunil from "@/components/negocios/BusinessFunil";

export default function FunilPage() {
  const { selected, loading } = useCompanies();
  if (!loading && !selected) return (
    <div className="max-w-5xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para usar o funil.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      <div><h1 className="text-xl font-heading font-semibold">Funil de vendas</h1>
      <p className="text-sm text-muted-foreground">Arraste os cards entre as etapas {selected ? `· ${selected.name}` : ""}.</p></div>
      {selected && <BusinessFunil companyId={selected.id} />}
    </div>
  );
}
