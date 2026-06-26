import { Building2, FileSpreadsheet, BarChart3, Database } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import TabLancamentos from "@/components/extrato/TabLancamentos";
import TabBancosExtratos from "@/components/extrato/TabBancosExtratos";
import TabImportacaoPlanilha from "@/components/extrato/TabImportacaoPlanilha";

const ExtratoBancario = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" /> Fluxo de Caixa
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visualize seu fluxo financeiro completo: receitas, despesas, extratos e importações em um só lugar.
        </p>
      </div>

      <Tabs defaultValue="lancamentos" className="w-full">
        <TabsList className="w-full grid grid-cols-3 h-auto">
          <TabsTrigger value="lancamentos" className="gap-1.5 py-2.5 text-xs sm:text-sm">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Lançamentos</span>
            <span className="sm:hidden">Lanç.</span>
          </TabsTrigger>
          <TabsTrigger value="bancos" className="gap-1.5 py-2.5 text-xs sm:text-sm">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Bancos & Extratos</span>
            <span className="sm:hidden">Bancos</span>
          </TabsTrigger>
          <TabsTrigger value="planilha" className="gap-1.5 py-2.5 text-xs sm:text-sm">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">Importação por Planilha</span>
            <span className="sm:hidden">Planilha</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lancamentos" className="mt-4">
          <TabLancamentos />
        </TabsContent>
        <TabsContent value="bancos" className="mt-4">
          <TabBancosExtratos />
        </TabsContent>
        <TabsContent value="planilha" className="mt-4">
          <TabImportacaoPlanilha forceType="financeiro" />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ExtratoBancario;
