import { Link, useNavigate } from "react-router-dom";
import { useCompanies, companyControlsStock } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";
import BusinessPropostas from "@/components/negocios/BusinessPropostas";

export default function PropostasPage() {
  const { selected, loading } = useCompanies();
  const { toast } = useToast();
  const navigate = useNavigate();
  if (!loading && !selected) return (
    <div className="max-w-5xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para enviar propostas.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      <div><h1 className="text-xl font-heading font-semibold">Propostas</h1>
      <p className="text-sm text-muted-foreground">Crie, envie e acompanhe propostas {selected ? `· ${selected.name}` : ""}.</p></div>
      {selected && (
        <BusinessPropostas
          companyId={selected.id}
          controlsStock={companyControlsStock(selected)}
          onPrefillLancamento={() => { toast({ title: "Lance no Caixa", description: "Use Financeiro → Fluxo de caixa para registrar o valor, ou “Gerar conta a receber”." }); navigate("/dashboard/negocios"); }}
        />
      )}
    </div>
  );
}
