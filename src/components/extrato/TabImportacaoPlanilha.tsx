import { useState, useCallback, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCustomCategories } from "@/hooks/useCustomCategories";
import { ALL_DESPESA_CATEGORY_NAMES, CATEGORIAS_RECEITAS } from "@/lib/categories";
import { inferFromName } from "@/lib/investimento-inference";
import { findMatch, type ExistingInvestimento, type MatchResult } from "@/lib/investimento-matching";
import HistoricoImportacoesInvestimentos from "./HistoricoImportacoesInvestimentos";
import {
  FileSpreadsheet, Download, Upload, Loader2, CheckCircle2,
  AlertTriangle, ArrowRight, Clock, FileText, Info, Lightbulb, Plus,
} from "lucide-react";
import * as XLSX from "xlsx";

type ImportType = "financeiro" | "investimentos";
type ImportStep = "upload" | "review" | "done";

interface ParsedRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: string[];
  valid: boolean;
}

interface ImportLog {
  id: string;
  filename: string;
  import_type: string;
  rows_count: number;
  status: string;
  created_at: string;
}

const FINANCEIRO_COLUMNS = ["Data", "Tipo", "Descrição", "Categoria", "Valor", "Responsável", "Recorrente", "Observações"];
const INVESTIMENTOS_COLUMNS = ["Instituição", "Classe", "Nome", "Ticker", "Quantidade", "Preço Médio", "Valor Investido", "Valor Atual", "Indexador", "Vencimento", "Liquidez", "Observações"];

/** Parse date in DD/MM/AAAA, DD-MM-AAAA, AAAA-MM-DD or Excel serial and return AAAA-MM-DD */
function parseDateBR(raw: unknown): string | null {
  const toIso = (year: number, month: number, day: number): string | null => {
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return null;
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (dt.getUTCFullYear() !== year || dt.getUTCMonth() + 1 !== month || dt.getUTCDate() !== day) return null;
    return `${String(year)}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };

  const fromExcelSerial = (serial: number): string | null => {
    if (!Number.isFinite(serial) || serial <= 0) return null;
    const epoch = Date.UTC(1899, 11, 30); // Excel epoch (with 1900 leap-year behavior)
    const dt = new Date(epoch + Math.floor(serial) * 86400000);
    return toIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  };

  if (typeof raw === "number") {
    return fromExcelSerial(raw);
  }

  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;

  // Excel serial as string (e.g. "46097")
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    return fromExcelSerial(Number(trimmed));
  }

  // DD/MM/AAAA or DD-MM-AAAA or DD.MM.AAAA
  const brMatch = trimmed.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch;
    return toIso(Number(yyyy), Number(mm), Number(dd));
  }

  // AAAA-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return toIso(Number(yyyy), Number(mm), Number(dd));
  }

  return null;
}

function generateTemplate(
  type: ImportType,
  userCategories: string[],
  responsaveis: string[],
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  if (type === "financeiro") {
    // Main data sheet
    const data = [
      FINANCEIRO_COLUMNS,
      ["11/03/2026", "despesa", "Aluguel", "Moradia", "2500", responsaveis[0] || "Pessoa 1", "sim", ""],
      ["15/03/2026", "receita", "Salário", "Salário", "8000", responsaveis[0] || "Pessoa 1", "sim", ""],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = FINANCEIRO_COLUMNS.map(() => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, "Receitas e Despesas");

    // Instructions sheet
    const instrucoes = [
      ["📋 Instruções de preenchimento"],
      [""],
      ["Coluna", "Descrição", "Exemplo"],
      ["Data", "Use o formato DD/MM/AAAA", "11/03/2026"],
      ["Tipo", "receita ou despesa (minúsculo)", "despesa"],
      ["Descrição", "Texto livre descrevendo o lançamento", "Aluguel do apartamento"],
      ["Categoria", "Veja as categorias disponíveis na aba 'Categorias'", "Moradia"],
      ["Valor", "Valor numérico positivo (sem R$)", "2500"],
      ["Responsável", "Veja os responsáveis na aba 'Responsáveis'", responsaveis[0] || "Pessoa 1"],
      ["Recorrente", "sim ou não", "sim"],
      ["Observações", "Campo opcional", ""],
      [""],
      ["⚠️ Dicas importantes:"],
      ["- Não altere os nomes das colunas na primeira linha"],
      ["- Preencha pelo menos: Data, Tipo, Categoria e Valor"],
      ["- Valores devem ser positivos (sem sinal de menos)"],
      ["- Aceita formato brasileiro de data: DD/MM/AAAA"],
    ];
    const wsInstr = XLSX.utils.aoa_to_sheet(instrucoes);
    wsInstr["!cols"] = [{ wch: 22 }, { wch: 50 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsInstr, "Instruções");

    // Categories sheet
    const catData: string[][] = [["Categorias de Despesa", "Categorias de Receita"]];
    const allDespesa = userCategories.length > 0 ? userCategories : ALL_DESPESA_CATEGORY_NAMES;
    const allReceita = CATEGORIAS_RECEITAS;
    const maxLen = Math.max(allDespesa.length, allReceita.length);
    for (let i = 0; i < maxLen; i++) {
      catData.push([allDespesa[i] || "", allReceita[i] || ""]);
    }
    const wsCat = XLSX.utils.aoa_to_sheet(catData);
    wsCat["!cols"] = [{ wch: 25 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, wsCat, "Categorias");

    // Responsáveis sheet
    const respData = [["Responsáveis cadastrados"], ...responsaveis.map(r => [r])];
    const wsResp = XLSX.utils.aoa_to_sheet(respData);
    wsResp["!cols"] = [{ wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsResp, "Responsáveis");
  } else {
    const data = [
      INVESTIMENTOS_COLUMNS,
      ["XP", "Renda Fixa", "CDB XP", "", "", "", "10000", "10500", "CDI", "01/06/2027", "D+1", ""],
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
    FINANCEIRO_COLUMNS.forEach((h, ci) => { data[h] = String(row[ci] ?? "").trim(); });

    if (!data["Data"]) {
      errors.push("Data obrigatória");
    } else {
      const parsed = parseDateBR(data["Data"]);
      if (!parsed) {
        errors.push("Use a data no formato DD/MM/AAAA, DD-MM-AAAA ou AAAA-MM-DD. Exemplo: 11/03/2026");
      } else {
        data["Data"] = parsed; // normalize to ISO
      }
    }

    const tipo = (data["Tipo"] || "").toLowerCase();
    if (!["receita", "despesa"].includes(tipo)) errors.push("Tipo deve ser 'receita' ou 'despesa'");

    const valor = parseFloat(data["Valor"]);
    if (isNaN(valor) || valor <= 0) errors.push("Valor deve ser um número positivo. Exemplo: 2500");

    if (!data["Categoria"]) errors.push("Categoria obrigatória. Veja as categorias disponíveis no modelo.");

    return { rowIndex: i + 2, data, errors, valid: errors.length === 0 };
  });
}

function parseInvestimentos(rows: any[]): ParsedRow[] {
  return rows.map((row, i) => {
    const errors: string[] = [];
    const data: Record<string, string> = {};
    INVESTIMENTOS_COLUMNS.forEach((h, ci) => { data[h] = String(row[ci] ?? "").trim(); });
    if (!data["Nome"] && !data["Ticker"]) errors.push("Preencha o Nome ou o Ticker do investimento.");
    if (!data["Instituição"]) errors.push("Instituição é obrigatória. Exemplo: XP, Nu Invest");
    const valorAtual = parseFloat(data["Valor Atual"]);
    if (isNaN(valorAtual) || valorAtual < 0) errors.push("Valor Atual deve ser um número válido. Exemplo: 10500");
    return { rowIndex: i + 2, data, errors, valid: errors.length === 0 };
  });
}

interface Props {
  forceType?: "financeiro" | "investimentos";
}

export default function TabImportacaoPlanilha({ forceType }: Props = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { customs } = useCustomCategories();
  const [importType, setImportType] = useState<ImportType>(forceType || "financeiro");

  // Quando forceType é passado, fixa o importType e esconde o seletor
  useEffect(() => {
    if (forceType && importType !== forceType) setImportType(forceType);
  }, [forceType]);
  const [step, setStep] = useState<ImportStep>("upload");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [importHistory, setImportHistory] = useState<ImportLog[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [profileData, setProfileData] = useState<{ nome_pessoa2?: string; vinculo_pessoa2?: string } | null>(null);
  const [importedFilename, setImportedFilename] = useState<string | null>(null);
  const [existingInvs, setExistingInvs] = useState<ExistingInvestimento[]>([]);
  const [reviewActions, setReviewActions] = useState<Record<number, "create" | "replace" | "merge" | "skip">>({});
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [reviewEdits, setReviewEdits] = useState<Record<number, {
    nome?: string;
    categoria_titulo?: string;
    indexador?: string;
    taxa?: number;
    instituicao?: string;
    quantidade?: number;
    preco_medio?: number;
    valor_investido?: number;
    valor_atual?: number;
    vencimento?: string;
    liquidez?: string;
  }>>({});

  const validRows = useMemo(() => parsedRows.filter(r => r.valid), [parsedRows]);
  const errorRows = useMemo(() => parsedRows.filter(r => !r.valid), [parsedRows]);

  // Investimentos existentes para detectar duplicatas
  useEffect(() => {
    if (importType !== "investimentos" || !user) return;
    (async () => {
      const { data } = await supabase
        .from("investimentos_financeiros")
        .select("id,nome,ticker,instituicao,tipo")
        .eq("user_id", user.id);
      setExistingInvs((data || []) as ExistingInvestimento[]);
    })();
  }, [importType, user]);

  // Match de cada linha contra a carteira existente
  const reviewMatches = useMemo(() => {
    if (importType !== "investimentos") return {} as Record<number, MatchResult>;
    const map: Record<number, MatchResult> = {};
    for (const r of validRows) {
      const candidate = {
        nome: r.data["Nome"] || r.data["Ticker"] || "",
        ticker: r.data["Ticker"] || null,
        instituicao: r.data["Instituição"] || null,
      };
      map[r.rowIndex] = findMatch(candidate, existingInvs);
    }
    return map;
  }, [validRows, existingInvs, importType]);

  // Default das ações de review quando entra na review de investimentos
  useEffect(() => {
    if (step !== "review" || importType !== "investimentos") return;
    const actions: Record<number, "create" | "replace" | "merge" | "skip"> = {};
    for (const r of validRows) {
      const m = reviewMatches[r.rowIndex];
      if (!m || m.confidence === "none") actions[r.rowIndex] = "create";
      else if (m.confidence === "exact") actions[r.rowIndex] = "replace";
      else actions[r.rowIndex] = "merge";
    }
    setReviewActions(actions);
  }, [step, importType, validRows, reviewMatches]);

  // Build user categories list
  const userAllCategories = useMemo(() => {
    const customNames = customs.map(c => c.nome);
    const merged = [...ALL_DESPESA_CATEGORY_NAMES];
    customNames.forEach(n => { if (!merged.includes(n)) merged.push(n); });
    return merged;
  }, [customs]);

  // Build responsáveis list from profile
  const responsaveis = useMemo(() => {
    const list = ["Pessoa 1"];
    if (profileData?.nome_pessoa2) list.push("Pessoa 2");
    list.push("Compartilhado");
    return list;
  }, [profileData]);

  // Load profile for responsáveis
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome_pessoa2, vinculo_pessoa2").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setProfileData(data as any); });
  }, [user]);

  // Load import history
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      try {
        const { data } = await supabase.from("spreadsheet_imports" as any).select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
        setImportHistory((data as unknown as ImportLog[]) || []);
      } catch {} finally { setLoadingHistory(false); }
    };
    load();
  }, [user, savedCount]);

  const handleDownloadTemplate = () => {
    const wb = generateTemplate(importType, userAllCategories, responsaveis);
    XLSX.writeFile(wb, importType === "financeiro" ? "modelo_receitas_despesas.xlsx" : "modelo_investimentos.xlsx");
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportedFilename(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        const dataRows = json.slice(1).filter(row => row.some(cell => cell !== undefined && cell !== ""));
        if (dataRows.length === 0) { toast({ title: "Planilha vazia", description: "Nenhuma linha de dados encontrada após o cabeçalho.", variant: "destructive" }); return; }
        const parsed = importType === "financeiro" ? parseFinanceiro(dataRows) : parseInvestimentos(dataRows);
        setParsedRows(parsed);
        setStep("review");
      } catch (err: any) { toast({ title: "Erro ao ler arquivo", description: err.message, variant: "destructive" }); }
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
              user_id: user.id, data: r.data["Data"], categoria: r.data["Categoria"],
              descricao: r.data["Descrição"] || r.data["Categoria"], valor: parseFloat(r.data["Valor"]),
              responsavel: r.data["Responsável"] || "Pessoa 1",
              recorrente: ["sim", "s", "yes", "true", "1"].includes((r.data["Recorrente"] || "").toLowerCase()),
              status: "pendente", tipo: "fixa",
            }))
          );
          if (error) throw error;
        }
        if (despesas.length > 0) {
          const { error } = await supabase.from("despesas").insert(
            despesas.map(r => ({
              user_id: user.id, data: r.data["Data"], categoria: r.data["Categoria"],
              descricao: r.data["Descrição"] || r.data["Categoria"], valor: parseFloat(r.data["Valor"]),
              responsavel: r.data["Responsável"] || "Pessoa 1",
              recorrente: ["sim", "s", "yes", "true", "1"].includes((r.data["Recorrente"] || "").toLowerCase()),
              status: "a_pagar", tipo: "variavel",
            }))
          );
          if (error) throw error;
        }
        setSavedCount(receitas.length + despesas.length);
      } else {
        // 1) Cria registro de import lot
        const { data: importLot, error: lotErr } = await (supabase as any)
          .from("investimento_imports")
          .insert({
            user_id: user.id,
            filename: importedFilename || null,
            source: "planilha",
            rows_count: validRows.length,
            status: "completed",
          })
          .select()
          .single();

        if (lotErr || !importLot) {
          toast({ title: "Erro ao criar lote", description: lotErr?.message, variant: "destructive" });
          setSaving(false);
          return;
        }

        let inserted = 0, updated = 0, skipped = 0;

        for (const r of validRows) {
          const action = reviewActions[r.rowIndex] || "create";
          const edit = reviewEdits[r.rowIndex] || {};
          const m = reviewMatches[r.rowIndex];
          const planilhaNome = r.data["Nome"] || r.data["Ticker"] || "";
          const finalNome = edit.nome ?? planilhaNome;

          if (action === "skip") { skipped++; continue; }

          const inf = inferFromName(finalNome);
          const payload: any = {
            user_id: user.id,
            instituicao: edit.instituicao ?? r.data["Instituição"],
            classe: r.data["Classe"] || "Renda Fixa",
            nome: finalNome,
            tipo: r.data["Classe"] || "Renda Fixa",
            ticker: r.data["Ticker"] || null,
            quantidade: edit.quantidade ?? (parseFloat(r.data["Quantidade"]) || 0),
            preco_medio: edit.preco_medio ?? (parseFloat(r.data["Preço Médio"]) || 0),
            total_aportado: edit.valor_investido ?? (parseFloat(r.data["Valor Investido"]) || 0),
            valor: edit.valor_investido ?? (parseFloat(r.data["Valor Investido"]) || 0),
            valor_atual: edit.valor_atual ?? (parseFloat(r.data["Valor Atual"]) || 0),
            indexador: edit.indexador ?? (r.data["Indexador"] || inf.indexador || ""),
            taxa_contratada: edit.taxa ?? (inf.taxa_contratada || 0),
            categoria_titulo: edit.categoria_titulo ?? (inf.categoria_titulo || null),
            vencimento_data: edit.vencimento ?? (r.data["Vencimento"] || null),
            liquidez: edit.liquidez ?? (r.data["Liquidez"] || "D+0"),
            import_id: importLot.id,
          };

          if (action === "create" || !m?.match) {
            const { error } = await (supabase as any).from("investimentos_financeiros").insert(payload);
            if (!error) inserted++;
          } else if (action === "replace") {
            // Substitui campos do investimento existente — preserva id
            const { user_id: _uid, ...patch } = payload;
            const { error } = await (supabase as any)
              .from("investimentos_financeiros")
              .update(patch)
              .eq("id", m.match.id);
            if (!error) updated++;
          } else if (action === "merge") {
            // Soma quantidade/aportado/atual; mantém nome/categoria existentes se já tinham
            const { data: full } = await (supabase as any)
              .from("investimentos_financeiros")
              .select("quantidade,total_aportado,valor_atual,nome,categoria_titulo,indexador")
              .eq("id", m.match.id)
              .single();
            const merged = {
              quantidade: (Number(full?.quantidade) || 0) + payload.quantidade,
              total_aportado: (Number(full?.total_aportado) || 0) + payload.total_aportado,
              valor: (Number(full?.total_aportado) || 0) + payload.total_aportado,
              valor_atual: (Number(full?.valor_atual) || 0) + payload.valor_atual,
              nome: full?.nome || payload.nome,
              categoria_titulo: full?.categoria_titulo || payload.categoria_titulo,
              indexador: full?.indexador || payload.indexador,
            };
            const { error } = await (supabase as any)
              .from("investimentos_financeiros")
              .update(merged)
              .eq("id", m.match.id);
            if (!error) updated++;
          }
        }

        // 2) Atualiza contadores no lote
        await (supabase as any)
          .from("investimento_imports")
          .update({ inserted_count: inserted, updated_count: updated, skipped_count: skipped })
          .eq("id", importLot.id);

        setSavedCount(inserted + updated);
      }
      setStep("done");
      toast({ title: "Importação concluída!" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleReset = () => { setStep("upload"); setParsedRows([]); setSavedCount(0); };

  return (
    <div className="space-y-6">
      {/* A) Import History */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" /> Histórico de importações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : importHistory.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma importação realizada ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Arquivo</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Linhas</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {importHistory.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs flex items-center gap-1.5"><FileText className="h-3 w-3 text-muted-foreground" />{log.filename || "—"}</TableCell>
                      <TableCell className="text-xs">{new Date(log.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-xs">{log.import_type === "financeiro" ? "Receitas/Despesas" : "Investimentos"}</TableCell>
                      <TableCell className="text-xs">{log.rows_count}</TableCell>
                      <TableCell><Badge variant={log.status === "completed" ? "default" : "outline"} className="text-[10px]">{log.status === "completed" ? "Concluído" : log.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {importType === "investimentos" && (
        <HistoricoImportacoesInvestimentos refreshKey={savedCount} />
      )}

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[{ key: "upload", label: "Upload" }, { key: "review", label: "Revisão" }, { key: "done", label: "Concluído" }].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="h-3 w-3 text-muted-foreground" />}
            <Badge variant={step === s.key ? "default" : "outline"} className="text-xs">{s.label}</Badge>
          </div>
        ))}
      </div>

      {step === "upload" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-heading">
                {forceType === "investimentos"
                  ? "Importar carteira por planilha"
                  : forceType === "financeiro"
                  ? "Importar receitas/despesas por planilha"
                  : "1. Escolha o tipo e baixe o modelo"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!forceType && (
                <Select value={importType} onValueChange={v => setImportType(v as ImportType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="financeiro">Receitas e Despesas</SelectItem>
                    <SelectItem value="investimentos">Investimentos</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <div className="space-y-2">
                <Button variant="outline" className="gap-2" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4" /> Baixar modelo personalizado
                </Button>
                <p className="text-[10px] text-muted-foreground inline-flex items-start gap-1.5">
                  <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />O modelo já inclui suas categorias e responsáveis cadastrados, além de instruções de preenchimento.
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm font-heading">2. Faça upload da planilha preenchida</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all">
                <Upload className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Clique para selecionar arquivo</p>
                <p className="text-xs text-muted-foreground mt-1">Formatos: .xlsx, .xls, .csv</p>
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
              </label>
              <Alert className="border-primary/20 bg-primary/5">
                <Info className="h-4 w-4 text-primary" />
                <AlertDescription className="text-xs">
                  <strong>Formato de data aceito:</strong> DD/MM/AAAA, DD-MM-AAAA (ex: 11/03/2026) ou AAAA-MM-DD (ex: 2026-03-11).
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          <Alert className="border-warning/40 bg-warning/5">
            <Info className="h-4 w-4 text-warning" />
            <AlertDescription className="text-xs text-warning">
              Após confirmar a importação, os dados serão adicionados ao sistema e eventuais ajustes deverão ser feitos manualmente. Itens duplicados devem ser removidos manualmente.
            </AlertDescription>
          </Alert>

          <div className="flex items-center gap-4">
            <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3 text-success" />{validRows.length} válidos</Badge>
            {errorRows.length > 0 && <Badge variant="outline" className="gap-1 text-destructive border-destructive/30"><AlertTriangle className="h-3 w-3" />{errorRows.length} com erros</Badge>}
          </div>

          {errorRows.length > 0 && (
            <Card className="border-destructive/20">
              <CardHeader className="pb-2"><CardTitle className="text-sm text-destructive flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Linhas com erros</CardTitle></CardHeader>
              <CardContent>
                {errorRows.slice(0, 10).map(r => (
                  <p key={r.rowIndex} className="text-xs text-muted-foreground"><span className="font-medium text-destructive">Linha {r.rowIndex}:</span> {r.errors.join(", ")}</p>
                ))}
                {errorRows.length > 10 && <p className="text-xs text-muted-foreground">... e mais {errorRows.length - 10}</p>}
              </CardContent>
            </Card>
          )}

          {validRows.length > 0 && importType === "financeiro" && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-heading">Pré-visualização ({validRows.length} registros)</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">#</TableHead>
                        {Object.keys(validRows[0]?.data || {}).slice(0, 6).map(h => <TableHead key={h} className="text-xs">{h}</TableHead>)}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validRows.slice(0, 20).map(r => (
                        <TableRow key={r.rowIndex}>
                          <TableCell className="text-xs text-muted-foreground">{r.rowIndex}</TableCell>
                          {Object.values(r.data).slice(0, 6).map((v, i) => <TableCell key={i} className="text-xs">{v || "—"}</TableCell>)}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {validRows.length > 20 && <p className="text-xs text-muted-foreground text-center mt-2">Exibindo 20 de {validRows.length}</p>}
                </div>
              </CardContent>
            </Card>
          )}

          {validRows.length > 0 && importType === "investimentos" && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-heading">Revisar e classificar ({validRows.length} registros)</CardTitle>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Para cada linha, escolha o que fazer: criar novo, substituir, mesclar ou pular. Edite os campos antes de salvar.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {validRows.map(r => {
                    const m = reviewMatches[r.rowIndex];
                    const action = reviewActions[r.rowIndex] || "create";
                    const edit = reviewEdits[r.rowIndex] || {};
                    const planilhaNome = r.data["Nome"] || r.data["Ticker"] || "";
                    const inf = inferFromName(planilhaNome);

                    const setEdit = (patch: Partial<typeof edit>) =>
                      setReviewEdits(prev => ({ ...prev, [r.rowIndex]: { ...prev[r.rowIndex], ...patch } }));

                    return (
                      <div key={r.rowIndex} className="rounded-xl border border-border/40 p-4 bg-muted/5 space-y-3">
                        {/* Cabeçalho da linha: Status + Ação */}
                        <div
                          className="flex items-center justify-between gap-3 flex-wrap cursor-pointer sm:cursor-default"
                          onClick={(e) => {
                            if (window.innerWidth >= 640) return;
                            const target = e.target as HTMLElement;
                            if (target.closest('[role="combobox"]') || target.closest('button')) return;
                            setExpandedRows(prev => ({ ...prev, [r.rowIndex]: !prev[r.rowIndex] }));
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {!m || m.confidence === "none" ? (
                              <Badge variant="default" className="text-[10px] bg-emerald-100 text-emerald-700 gap-1"><Plus className="h-3 w-3" />Novo</Badge>
                            ) : m.confidence === "exact" ? (
                              <Badge variant="default" className="text-[10px] bg-amber-100 text-amber-700 gap-1" title={m.reason}><AlertTriangle className="h-3 w-3" />Duplicado</Badge>
                            ) : (
                              <Badge variant="default" className="text-[10px] bg-blue-100 text-blue-700 gap-1" title={m.reason}><AlertTriangle className="h-3 w-3" />Similar</Badge>
                            )}
                            <span className="text-xs font-medium truncate max-w-[140px] sm:max-w-none">
                              {edit.nome ?? planilhaNome}
                            </span>
                            <span className="sm:hidden text-[10px] text-muted-foreground ml-auto">
                              {expandedRows[r.rowIndex] ? "▲" : "▼"}
                            </span>
                          </div>
                          <Select
                            value={action}
                            onValueChange={v => setReviewActions(prev => ({ ...prev, [r.rowIndex]: v as any }))}
                            disabled={!m || m.confidence === "none"}
                          >
                            <SelectTrigger className="h-8 text-xs w-32 sm:w-36" onClick={(e) => e.stopPropagation()}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="create">Criar novo</SelectItem>
                              {m && m.confidence !== "none" && (
                                <>
                                  <SelectItem value="replace">Substituir</SelectItem>
                                  <SelectItem value="merge">Mesclar</SelectItem>
                                  <SelectItem value="skip">Pular</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Campos editáveis em grid */}
                        <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 ${
                          expandedRows[r.rowIndex] ? "" : "hidden sm:grid"
                        }`}>
                          <div>
                            <Label className="text-[10px]">Nome</Label>
                            <input
                              type="text"
                              className="text-xs px-2 py-1 rounded border w-full bg-background"
                              defaultValue={edit.nome ?? planilhaNome}
                              onBlur={e => setEdit({ nome: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Instituição</Label>
                            <input
                              type="text"
                              className="text-xs px-2 py-1 rounded border w-full bg-background"
                              defaultValue={edit.instituicao ?? (r.data["Instituição"] || "")}
                              onBlur={e => setEdit({ instituicao: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Categoria</Label>
                            <Select
                              value={edit.categoria_titulo ?? (inf.categoria_titulo || "none")}
                              onValueChange={v => setEdit({ categoria_titulo: v === "none" ? "" : v })}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">—</SelectItem>
                                <SelectItem value="Bancário">Bancário</SelectItem>
                                <SelectItem value="Crédito Privado">Crédito Privado</SelectItem>
                                <SelectItem value="Tesouro Direto">Tesouro Direto</SelectItem>
                                <SelectItem value="Fundo de Investimento">Fundo</SelectItem>
                                <SelectItem value="Outro">Outro</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-[10px]">Quantidade</Label>
                            <input
                              type="number"
                              step="0.000001"
                              className="text-xs px-2 py-1 rounded border w-full bg-background"
                              defaultValue={edit.quantidade ?? (parseFloat(r.data["Quantidade"]) || 0)}
                              onBlur={e => setEdit({ quantidade: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Preço Médio (R$)</Label>
                            <input
                              type="number"
                              step="0.01"
                              className="text-xs px-2 py-1 rounded border w-full bg-background"
                              defaultValue={edit.preco_medio ?? (parseFloat(r.data["Preço Médio"]) || 0)}
                              onBlur={e => setEdit({ preco_medio: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Valor Investido (R$)</Label>
                            <input
                              type="number"
                              step="0.01"
                              className="text-xs px-2 py-1 rounded border w-full bg-background"
                              defaultValue={edit.valor_investido ?? (parseFloat(r.data["Valor Investido"]) || 0)}
                              onBlur={e => setEdit({ valor_investido: parseFloat(e.target.value) || 0 })}
                            />
                          </div>

                          <div>
                            <Label className="text-[10px]">Valor Atual (R$)</Label>
                            <input
                              type="number"
                              step="0.01"
                              className="text-xs px-2 py-1 rounded border w-full bg-background"
                              defaultValue={edit.valor_atual ?? (parseFloat(r.data["Valor Atual"]) || 0)}
                              onBlur={e => setEdit({ valor_atual: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Indexador</Label>
                            <Select
                              value={edit.indexador ?? (r.data["Indexador"] || inf.indexador || "none")}
                              onValueChange={v => setEdit({ indexador: v === "none" ? "" : v })}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">—</SelectItem>
                                <SelectItem value="CDI">CDI</SelectItem>
                                <SelectItem value="IPCA+">IPCA+</SelectItem>
                                <SelectItem value="Prefixado">Prefixado</SelectItem>
                                <SelectItem value="Selic">Selic</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-[10px]">Taxa (%)</Label>
                            <input
                              type="number"
                              step="0.01"
                              className="text-xs px-2 py-1 rounded border w-full bg-background"
                              defaultValue={edit.taxa ?? (inf.taxa_contratada ?? 0)}
                              onBlur={e => setEdit({ taxa: parseFloat(e.target.value) || 0 })}
                            />
                          </div>

                          <div>
                            <Label className="text-[10px]">Vencimento</Label>
                            <input
                              type="date"
                              className="text-xs px-2 py-1 rounded border w-full bg-background"
                              defaultValue={edit.vencimento ?? (r.data["Vencimento"] || "")}
                              onBlur={e => setEdit({ vencimento: e.target.value })}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px]">Liquidez</Label>
                            <Select
                              value={edit.liquidez ?? (r.data["Liquidez"] || "D+0")}
                              onValueChange={v => setEdit({ liquidez: v })}
                            >
                              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="D+0">D+0</SelectItem>
                                <SelectItem value="D+1">D+1</SelectItem>
                                <SelectItem value="D+2">D+2</SelectItem>
                                <SelectItem value="D+30">D+30</SelectItem>
                                <SelectItem value="D+90">D+90</SelectItem>
                                <SelectItem value="No vencimento">No vencimento</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
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
        <Card>
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-3" />
            <h2 className="text-lg font-heading font-bold">Importação concluída!</h2>
            <p className="text-muted-foreground text-sm mt-1">{savedCount} registros importados com sucesso.</p>
            <p className="text-xs text-muted-foreground mt-2">Os itens importados recebem automaticamente um marcador de origem "Importado por planilha".</p>
            <Button className="mt-4" onClick={handleReset}>Nova importação</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
