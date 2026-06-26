import { Scale } from "lucide-react";
import SimuladorFinanciamentoComponent from "@/components/strategic-planning/SimuladorFinanciamento";
import AIReportDisclaimer from "@/components/legal/AIReportDisclaimer";

const SimuladorFinanciamento = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Scale className="h-6 w-6 text-primary" /> Consórcio x Financiamento
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Compare consórcio, tabela Price e SAC e descubra qual modalidade faz mais sentido para você.
        </p>
      </div>

      <AIReportDisclaimer />

      <SimuladorFinanciamentoComponent />
    </div>
  );
};

export default SimuladorFinanciamento;
