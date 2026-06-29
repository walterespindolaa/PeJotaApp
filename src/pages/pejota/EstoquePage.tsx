import { Link } from "react-router-dom";
import { useCompanies, companyControlsStock, nichoCategorias } from "@/hooks/useCompanies";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Package } from "lucide-react";
import BusinessEstoque from "@/components/negocios/BusinessEstoque";

export default function EstoquePage() {
  const { selected, loading } = useCompanies();
  if (!loading && !selected) return (
    <div className="max-w-3xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para usar o estoque.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );
  if (selected && !companyControlsStock(selected)) return (
    <div className="max-w-3xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Package className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-2">Esta empresa está como “serviços” (sem estoque).</p>
      <p className="text-xs text-muted-foreground mb-4">Ative “Controla estoque/produção” em Configuração → Empresa para usar este módulo.</p>
      <Link to="/dashboard/empresa"><Button variant="outline">Configurar empresa</Button></Link>
    </CardContent></Card></div>
  );
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4">
      <div><h1 className="text-xl font-heading font-semibold">Estoque</h1>
      <p className="text-sm text-muted-foreground">Produtos, insumos, ficha técnica e movimentações {selected ? `· ${selected.name}` : ""}.</p></div>
      {selected && <BusinessEstoque companyId={selected.id} categorias={nichoCategorias(selected)} />}
    </div>
  );
}
