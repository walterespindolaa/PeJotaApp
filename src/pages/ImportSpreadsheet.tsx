import { useState, useCallback, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { FileSpreadsheet, Download, Upload, Loader2, CheckCircle2, AlertTriangle, ArrowRight } from "lucide-react";
import * as XLSX from "xlsx";

type ImportType = "financeiro" | "investimentos";
type ImportStep = "upload" | "review" | "done";

interface ParsedRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: string[];
  valid: boolean;
}

const FINANCEIRO_COLUMNS = ["Data", "Tipo", "Descrição", "Categoria", "Valor", "Responsável", "Recorrente", "Observações"];
const INVESTIMENTOS_COLUMNS = ["Instituição", "Classe", "Nome", "Ticker", "Quantidade", "Preço Médio", "Valor Investido", "Valor Atual", "Indexador", "Vencimento", "Liquidez", "Observações"];

function generateTemplate(type: ImportType): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  if (type === "financeiro") {
    const data = [
      FINANCEIRO_COLUMNS,
      ["2026-03-01", "despesa", "Aluguel", "Moradia", "2500", "Pessoa 1", "sim", ""],
      ["2026-03-05", "receita", "Salário", "Salário", "8000", "Pessoa 1", "sim", ""],
      ["2026-03-10", "despesa", "Supermercado", "Alimentação", "450", "Compartilhado", "não", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = FINANCEIRO_COLUMNS.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, ws, "Receitas e Despesas");
  } else {
    const data = [
      INVESTIMENTOS_COLUMNS,
      ["XP", "Renda Fixa", "CDB XP", "", "", "", "10000", "10500", "CDI", "2027-06-01", "D+1", ""],
      ["Nu Invest", "Ações", "PETR4", "PETR4", "100", "35.50", "3550", "3800", "", "", "D+2", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = INVESTIMENTOS_COLUMNS.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, ws, "Investimentos");
  }
  return wb;
}

function parseFinanceiro(rows: any[]): ParsedRow[] {
  return rows.map((row, i) => {
    const errors: string[] = [];
    const data: Record<string, string> = {};
    const headers = FINANCEIRO_COLUMNS;

    headers.forEach((h, ci) => { data[h] = String(row[ci] ?? "").trim(); });

    if (!data["Data"]) errors.push("Data obrigatória");
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(data["Data"])) errors.push("Data deve ser AAAA-MM-DD");

    const tipo = (data["Tipo"] || "").toLowerCase();
    if (!["receita", "despesa"].includes(tipo)) errors.push("Tipo deve ser 'receita' ou 'despesa'");

    const valor = parseFloat(data["Valor"]);
    if (isNaN(valor) || valor <= 0) errors.push("Valor inválido");

    if (!data["Categoria"]) errors.push("Categoria obrigatória");

    return { rowIndex: i + 2, data, errors, valid: errors.length === 0 };
  });
}

function parseInvestimentos(rows: any[]): ParsedRow[] {
  return rows.map((row, i) => {
    const errors: string[] = [];
    const data: Record<string, string> = {};
    const headers = INVESTIMENTOS_COLUMNS;

    headers.forEach((h, ci) => { data[h] = String(row[ci] ?? "").trim(); });

    if (!data["Nome"] && !data["Ticker"]) errors.push("Nome ou Ticker obrigatório");
    if (!data["Instituição"]) errors.push("Instituição obrigatória");

    const valorAtual = parseFloat(data["Valor Atual"]);
    if (isNaN(valorAtual) || valorAtual < 0) errors.push("Valor Atual inválido");

    return { rowIndex: i + 2, data, errors, valid: errors.length === 0 };
  });
}

const ImportSpreadsheet = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [importType, setImportType] = useState<ImportType>("financeiro");
  const [step, setStep] = useState<ImportStep>("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const validRows = useMemo(() => parsedRows.filter(r => r.valid), [parsedRows]);
  const errorRows = useMemo(() => parsedRows.filter(r => !r.valid), [parsedRows]);

  const handleDownloadTemplate = () => {
    const wb = generateTemplate(importType);
    XLSX.writeFile(wb, importType === "financeiro" ? "modelo_receitas_despesas.xlsx" : "modelo_investimentos.xlsx");
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        // Skip header row
        const dataRows = json.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ""));

        if (dataRows.length === 0) {
          toast({ title: "Planilha vazia", description: "Nenhum dado encontrado.", variant: "destructive" });
          return;
        }

        const parsed = importType === "financeiro" ? parseFinanceiro(dataRows) : parseInvestimentos(dataRows);
        setParsedRows(parsed);
        setStep("review");
      } catch (err: any) {
        toast({ title: "Erro ao ler arquivo", description: err.message, variant: "destructive" });
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  }, [importType, toast]);

  const handleSave = async () => {
    if (!user || validRows.length === 0) return;
    setSaving(true);

    try {
      if (importType === "financeiro") {
        const receitas = validRows.filter(r => (r.data["Tipo"] || "").toLowerCase() === "receita");
        const despesas = validRows.filter(r => (r.data["Tipo"] || "").toLowerCase() === "despesa");

        if (receitas.length > 0) {
          const { error } = await supabase.from("receitas").insert(
            receitas.map(r => ({
              user_id: user.id,
              data: r.data["Data"],
              categoria: r.data["Categoria"],
              descricao: r.data["Descrição"] || r.data["Categoria"],
              valor: parseFloat(r.data["Valor"]),
              responsavel: r.data["Responsável"] || "Pessoa 1",
              recorrente: ["sim", "s", "yes", "true", "1"].includes((r.data["Recorrente"] || "").toLowerCase()),
              status: "pendente",
              tipo: "fixa",
            }))
          );
          if (error) throw error;
        }

        if (despesas.length > 0) {
          const { error } = await supabase.from("despesas").insert(
            despesas.map(r => ({
              user_id: user.id,
              data: r.data["Data"],
              categoria: r.data["Categoria"],
              descricao: r.data["Descrição"] || r.data["Categoria"],
              valor: parseFloat(r.data["Valor"]),
              responsavel: r.data["Responsável"] || "Pessoa 1",
              recorrente: ["sim", "s", "yes", "true", "1"].includes((r.data["Recorrente"] || "").toLowerCase()),
              status: "a_pagar",
              tipo: "variavel",
            }))
          );
          if (error) throw error;
        }

        setSavedCount(receitas.length + despesas.length);
      } else {
        const rows = validRows.map(r => ({
          user_id: user.id,
          instituicao: r.data["Instituição"],
          classe: r.data["Classe"] || "Renda Fixa",
          nome: r.data["Nome"] || r.data["Ticker"] || "",
          tipo: r.data["Classe"] || "Renda Fixa",
          quantidade: parseFloat(r.data["Quantidade"]) || 0,
          preco_medio: parseFloat(r.data["Preço Médio"]) || 0,
          total_aportado: parseFloat(r.data["Valor Investido"]) || 0,
          valor: parseFloat(r.data["Valor Investido"]) || 0,
          valor_atual: parseFloat(r.data["Valor Atual"]) || 0,
          indexador: r.data["Indexador"] || "",
          vencimento_data: r.data["Vencimento"] || null,
          liquidez: r.data["Liquidez"] || "D+0",
        }));

        const { error } = await supabase.from("investimentos_financeiros").insert(rows);
        if (error) throw error;
        setSavedCount(rows.length);
      }

      setStep("done");
      toast({ title: "Importação concluída!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setStep("upload");
    setParsedRows([]);
    setSavedCount(0);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <FileSpreadsheet className="h-6 w-6 text-primary" /> Importar Planilha
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Importe dados de planilhas Excel ou CSV para o sistema.
        </p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[
          { key: "upload", label: "Upload" },
          { key: "review", label: "Revisão" },
          { key: "done", label: "Concluído" },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            <Badge variant={step === s.key ? "default" : "outline"} className="text-xs">
              {s.label}
            </Badge>
          </div>
        ))}
      </div>

      {step === "upload" && (
        <div className="space-y-4">
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-heading">1. Escolha o tipo de importação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={importType} onValueChange={v => setImportType(v as ImportType)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="financeiro">Receitas e Despesas</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" className="gap-2" onClick={handleDownloadTemplate}>
                <Download className="h-4 w-4" />
                Baixar modelo de planilha
              </Button>
              <p className="text-xs text-muted-foreground">
                Baixe o modelo, preencha com seus dados e faça o upload abaixo.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="text-base font-heading">2. Faça upload da planilha</CardTitle>
            </CardHeader>
            <CardContent>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all">
                <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Clique para selecionar arquivo</p>
                <p className="text-xs text-muted-foreground mt-1">Formatos aceitos: .xlsx, .xls, .csv</p>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
              </label>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="gap-1">
              <CheckCircle2 className="h-3 w-3 text-success" />
              {validRows.length} válidos
            </Badge>
            {errorRows.length > 0 && (
              <Badge variant="outline" className="gap-1 text-destructive border-destructive/30">
                <AlertTriangle className="h-3 w-3" />
                {errorRows.length} com erros
              </Badge>
            )}
          </div>

          {errorRows.length > 0 && (
            <Card className="shadow-soft border-destructive/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Linhas com erros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {errorRows.slice(0, 10).map(r => (
                    <p key={r.rowIndex} className="text-xs text-muted-foreground">
                      <span className="font-medium text-destructive">Linha {r.rowIndex}:</span> {r.errors.join(", ")}
                    </p>
                  ))}
                  {errorRows.length > 10 && (
                    <p className="text-xs text-muted-foreground">... e mais {errorRows.length - 10} linhas com erros</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {validRows.length > 0 && (
            <Card className="shadow-soft">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-heading">Pré-visualização ({validRows.length} registros)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">#</TableHead>
                        {Object.keys(validRows[0]?.data || {}).slice(0, 6).map(h => (
                          <TableHead key={h} className="text-xs">{h}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validRows.slice(0, 20).map(r => (
                        <TableRow key={r.rowIndex}>
                          <TableCell className="text-xs text-muted-foreground">{r.rowIndex}</TableCell>
                          {Object.values(r.data).slice(0, 6).map((v, i) => (
                            <TableCell key={i} className="text-xs">{v || "—"}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {validRows.length > 20 && (
                    <p className="text-xs text-muted-foreground text-center mt-2">Exibindo 20 de {validRows.length} registros</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset}>Voltar</Button>
            <Button onClick={handleSave} disabled={saving || validRows.length === 0} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Importar {validRows.length} registros
            </Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <Card className="shadow-soft">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
            <h2 className="text-lg font-heading font-bold">Importação concluída!</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {savedCount} registros importados com sucesso.
            </p>
            <Button className="mt-4" onClick={handleReset}>Nova importação</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ImportSpreadsheet;
