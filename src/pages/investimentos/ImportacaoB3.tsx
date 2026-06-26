import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertTriangle, ArrowUpRight } from "lucide-react";
import TabImportacaoPlanilha from "@/components/extrato/TabImportacaoPlanilha";
import B3ImportDialog from "@/components/investimentos/B3ImportDialog";

const B3_STEPS = [
  {
    step: "1",
    title: "Acesse o portal do Investidor B3",
    desc: "Vá em investidor.b3.com.br e faça login com seu CPF e senha.",
    action: { label: "Abrir Portal B3", url: "https://www.investidor.b3.com.br" },
  },
  {
    step: "2",
    title: "Navegue até Minha Carteira → Investimentos",
    desc: "No menu lateral, clique em Minha Carteira e depois em Investimentos.",
  },
  {
    step: "3",
    title: "Clique em BAIXAR e escolha Excel",
    desc: "No canto superior direito, clique no botão BAIXAR e escolha o formato Excel (.xlsx).",
  },
  {
    step: "4",
    title: "Importe aqui no Atlas",
    desc: "Clique em Importar arquivo da B3 abaixo e selecione o .xlsx que você baixou.",
  },
];

const ATLAS_STEPS = [
  {
    step: "1",
    title: "Baixe o modelo personalizado",
    desc: "Clique em Baixar modelo abaixo. O Excel já vem com instruções e categorias pré-preenchidas.",
  },
  {
    step: "2",
    title: "Preencha sua carteira",
    desc: "Adicione uma linha por ativo, com instituição, nome, quantidade, preço médio, valor investido e valor atual. Pode usar dados do extrato da sua corretora (XP, BTG, Inter, Avenue, etc.).",
  },
  {
    step: "3",
    title: "Faça upload aqui",
    desc: "Selecione o arquivo .xlsx preenchido. O Atlas vai detectar duplicatas com sua carteira atual e permitir editar antes de salvar.",
  },
  {
    step: "4",
    title: "Revise e salve",
    desc: "Para cada linha você pode escolher: criar novo, substituir, mesclar ou pular. Depois é só importar.",
  },
];

export default function ImportacaoB3() {
  const [b3DialogOpen, setB3DialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Card className="shadow-soft rounded-2xl border-primary/40">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            <CardTitle className="font-heading text-base">Importar direto da B3</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Baixe o extrato direto do portal investidor.b3.com.br e faça upload aqui.
            O Atlas detecta ativos novos, atualiza quantidades de duplicatas e
            permite ajustar preço médio antes de confirmar.
          </p>

          <div className="space-y-3">
            <p className="text-sm font-medium">Como exportar sua carteira da B3:</p>
            {B3_STEPS.map(item => (
              <div
                key={item.step}
                className="flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-muted/20 border border-border/40"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] sm:text-xs font-bold text-primary-foreground">{item.step}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                  {(item as any).action && (
                    <a
                      href={(item as any).action.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs text-primary font-medium hover:underline break-all"
                    >
                      {(item as any).action.label}
                      <ArrowUpRight className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-900">
              A B3 não exporta o preço médio de compra. Atlas usa o preço atual de mercado
              como preço médio inicial — ajuste depois em cada ativo se quiser histórico
              de rentabilidade correto.
            </p>
          </div>

          <Button
            size="lg"
            className="w-full rounded-xl gap-2"
            onClick={() => setB3DialogOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Importar arquivo da B3
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <CardTitle className="font-heading text-base">Importar por planilha Atlas</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <p className="text-sm font-medium">Como importar com a planilha Atlas:</p>
            {ATLAS_STEPS.map(item => (
              <div
                key={item.step}
                className="flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-muted/20 border border-border/40"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <span className="text-[11px] sm:text-xs font-bold text-primary-foreground">{item.step}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <TabImportacaoPlanilha forceType="investimentos" />
        </CardContent>
      </Card>

      <B3ImportDialog open={b3DialogOpen} onOpenChange={setB3DialogOpen} />
    </div>
  );
}
