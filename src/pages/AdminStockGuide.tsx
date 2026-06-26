import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw } from "lucide-react";

function StockGuideUpdateRow({ label, tipo }: { label: string; tipo: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ updated?: number; errors?: number; total?: number } | null>(null);
  const { toast } = useToast();

  const handleUpdate = async () => {
    setLoading(true);
    setResult(null);
    const { data, error } = await supabase.functions.invoke("update-stock-guide", {
      body: { tipo },
    });
    setLoading(false);
    if (error) { toast({ title: `Erro ao atualizar ${label}`, variant: "destructive" }); return; }
    setResult(data);
    toast({ title: `${label}: ${data.updated} atualizados, ${data.errors} erros` });
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/10">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {result && <p className="text-xs text-muted-foreground mt-0.5">{result.updated}/{result.total} atualizados · {result.errors} erros</p>}
      </div>
      <Button size="sm" variant="outline" className="rounded-xl gap-2" onClick={handleUpdate} disabled={loading}>
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Atualizando..." : "Atualizar"}
      </Button>
    </div>
  );
}

const AdminStockGuide = () => {
  const items = [
    { label: "Tudo (todas categorias)", tipo: "all" },
    { label: "Ações BR", tipo: "Ação" },
    { label: "FIIs", tipo: "FII" },
    { label: "ETFs — Renda Fixa", tipo: "Renda Fixa" },
    { label: "ETFs — Renda Variável BR", tipo: "Renda Variável BR" },
    { label: "ETFs — Internacional", tipo: "Internacional" },
    { label: "ETFs — Metais", tipo: "Metais" },
    { label: "ETFs — Cripto", tipo: "Cripto" },
    { label: "BDRs Internacional", tipo: "BDR" },
  ];

  return (
    <Card className="shadow-soft rounded-2xl">
      <CardHeader>
        <CardTitle className="font-heading text-base">Atualizar Stock Guide via BRAPI</CardTitle>
        <p className="text-xs text-muted-foreground">Execute de madrugada para economizar créditos BRAPI.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map(({ label, tipo }) => (
          <StockGuideUpdateRow key={tipo} label={label} tipo={tipo} />
        ))}
      </CardContent>
    </Card>
  );
};

export default AdminStockGuide;
