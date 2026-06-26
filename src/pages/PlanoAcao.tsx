import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList } from "lucide-react";

const PlanoAcao = () => (
  <div className="space-y-6 animate-fade-in">
    <div>
      <h1 className="text-2xl font-heading font-bold">Plano de Ação</h1>
      <p className="text-muted-foreground mt-1">Ações práticas para cada objetivo + direcionamento de investimentos.</p>
    </div>
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-warning/10">
            <ClipboardList className="h-5 w-5 text-warning" />
          </div>
          <CardTitle className="font-heading">Em construção</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Módulo exclusivo do Planejamento 360. Monte planos de ação para cada objetivo e receba 
          direcionamento de investimentos por prazo (curto, médio e longo).
        </p>
      </CardContent>
    </Card>
  </div>
);

export default PlanoAcao;
