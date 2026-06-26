import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, ArrowDownRight, RefreshCw, Upload, Rocket, Lightbulb } from "lucide-react";

interface Props {
  onAddIncome: () => void;
  onAddExpense: () => void;
  onOpenRecurring: () => void;
  onOpenImport: () => void;
}

export default function BusinessQuickStart({ onAddIncome, onAddExpense, onOpenRecurring, onOpenImport }: Props) {
  return (
    <Card className="border-dashed border-2 border-primary/30 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-heading flex items-center gap-1.5"><Rocket className="h-4 w-4" />Comece por aqui (2 min)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Registre suas primeiras entradas e saídas para começar a visualizar a saúde financeira do negócio.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button size="sm" className="h-9 text-xs gap-1.5" onClick={onAddIncome}>
            <ArrowUpRight className="h-3.5 w-3.5" /> Registrar entrada
          </Button>
          <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5" onClick={onAddExpense}>
            <ArrowDownRight className="h-3.5 w-3.5" /> Registrar saída
          </Button>
          <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5" onClick={onOpenRecurring}>
            <RefreshCw className="h-3.5 w-3.5" /> Ver recorrências
          </Button>
          <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5" onClick={onOpenImport}>
            <Upload className="h-3.5 w-3.5" /> Importar CSV
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground italic inline-flex items-center gap-1.5">
          <Lightbulb className="h-3 w-3 flex-shrink-0" />Regras fiscais variam. Valide com seu contador.
        </p>
      </CardContent>
    </Card>
  );
}
