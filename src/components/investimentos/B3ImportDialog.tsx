import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Upload, FileSpreadsheet, AlertTriangle, AlertCircle, CheckCircle2,
  Loader2, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useInvestimentos } from "@/contexts/InvestimentosContext";
import { parseB3File, detectDuplicates, type B3Candidate } from "@/lib/investimentos/b3Parser";
import { calcularAcrualValorAplicado } from "@/lib/investimentos/rendaFixaAcrual";
import { INSTITUICOES } from "@/lib/investimentos/constants";

const SELECT_INSTITUICOES = INSTITUICOES.filter(i => i !== "Bancos");

type ImportPhase = "idle" | "parsing" | "preview" | "saving" | "done";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function B3ImportDialog({ open, onOpenChange }: Props) {
  const { user, investimentos, fetchAll, macroData } = useInvestimentos();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [candidates, setCandidates] = useState<B3Candidate[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [totalsBySheet, setTotalsBySheet] = useState<Record<string, number>>({});
  const [savingProgress, setSavingProgress] = useState({ current: 0, total: 0 });
  const [importedCount, setImportedCount] = useState(0);

  const reset = () => {
    setPhase("idle");
    setCandidates([]);
    setWarnings([]);
    setTotalsBySheet({});
    setSavingProgress({ current: 0, total: 0 });
    setImportedCount(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) reset();
    onOpenChange(isOpen);
  };

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast({ title: "Formato inválido — selecione um arquivo .xlsx", variant: "destructive" });
      return;
    }
    setPhase("parsing");
    try {
      const result = await parseB3File(file);
      const withDups = detectDuplicates(result.candidates, investimentos);
      setCandidates(withDups);
      setWarnings(result.warnings);
      setTotalsBySheet(result.totalsBySheet);
      setPhase("preview");
    } catch (e: any) {
      console.error("B3 parse error:", e);
      toast({
        title: "Erro ao ler o arquivo",
        description: e?.message || "Verifique se é um XLSX válido da Posição Consolidada B3.",
        variant: "destructive",
      });
      setPhase("idle");
    }
  };

  const updateCandidate = (id: string, patch: Partial<B3Candidate>) => {
    setCandidates(prev => prev.map(c => (c.id === id ? { ...c, ...patch } : c)));
  };

  const toggleAllSelected = (selected: boolean) => {
    setCandidates(prev => prev.map(c =>
      c.dup_status === "duplicate_match" ? c : { ...c, is_selected: selected }
    ));
  };

  const handleConfirm = async () => {
    if (!user) return;
    const toProcess = candidates.filter(c => c.is_selected);
    if (toProcess.length === 0) {
      toast({ title: "Nenhum ativo selecionado", variant: "destructive" });
      return;
    }
    setPhase("saving");
    setSavingProgress({ current: 0, total: toProcess.length });

    const { data: importLot, error: lotErr } = await (supabase as any)
      .from("investimento_imports")
      .insert({
        user_id: user.id,
        filename: "Posição B3.xlsx",
        source: "b3",
        rows_count: toProcess.length,
        status: "completed",
      })
      .select()
      .single();

    if (lotErr || !importLot) {
      toast({
        title: "Erro ao criar lote de importação",
        description: lotErr?.message || "Tente novamente.",
        variant: "destructive",
      });
      setPhase("preview");
      return;
    }
    const importId: string = importLot.id;

    let imported = 0;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < toProcess.length; i++) {
      const c = toProcess[i];
      setSavingProgress({ current: i + 1, total: toProcess.length });

      let valorTotal: number;
      if (c.ticker) {
        valorTotal = c.preco_medio * c.quantidade;
      } else if (
        c.taxa_contratada && c.taxa_contratada > 0 &&
        c.data_compra &&
        c.indexador
      ) {
        const acrual = calcularAcrualValorAplicado({
          valorAtual: c.valor_atual,
          dataInicio: c.data_compra,
          indexador: c.indexador,
          taxaContratada: c.taxa_contratada,
          macroData,
        });
        valorTotal = acrual.valorAplicadoEstimado;
        if (acrual.warnings.length > 0) {
          console.info(`[B3 acrual] ${c.nome}:`, acrual.warnings.join("; "));
        }
      } else {
        valorTotal = c.valor_atual;
      }

      const payload: Record<string, any> = {
        user_id: user.id,
        nome: c.nome,
        ticker: c.ticker || "",
        tipo: c.tipo,
        classe: c.classe,
        instituicao: c.instituicao,
        valor: valorTotal,
        valor_atual: c.valor_atual,
        total_aportado: valorTotal,
        quantidade: c.quantidade,
        preco_medio: c.preco_medio,
        indexador: c.indexador || "",
        taxa_contratada: c.taxa_contratada || 0,
        vencimento_data: c.vencimento_data || null,
        liquidez: c.tipo === "Renda Fixa" ? "No vencimento" : "D+2",
        perfil_risco: c.classe === "Renda Fixa" ? "Conservador" : "Arrojado",
        is_reserva_emergencia: false,
        recebe_proventos: c.tipo === "FII" || c.tipo === "Ação",
        frequencia_proventos: c.tipo === "FII" ? "mensal" : "sem_proventos",
        meses_proventos: "",
        categoria_titulo: c.categoria_titulo || null,
        import_id: importId,
      };

      try {
        if (c.dup_status === "duplicate_qty_diff" && c.existing_id) {
          const { error } = await supabase
            .from("investimentos_financeiros")
            .update({
              quantidade: c.quantidade,
              valor_atual: c.valor_atual,
              total_aportado: valorTotal,
              valor: valorTotal,
              preco_medio: c.preco_medio,
            } as any)
            .eq("id", c.existing_id);
          if (error) { errors++; continue; }
          updated++;
        } else {
          const { error } = await supabase.from("investimentos_financeiros").insert(payload as any);
          if (error) { errors++; continue; }
          imported++;
        }
      } catch (e) {
        console.error("Insert/update error:", e);
        errors++;
      }
    }

    setImportedCount(imported + updated);

    await (supabase as any)
      .from("investimento_imports")
      .update({
        inserted_count: imported,
        updated_count: updated,
        skipped_count: candidates.length - toProcess.length,
        rows_count: toProcess.length,
        status: errors === toProcess.length ? "failed" : "completed",
      })
      .eq("id", importId);

    setPhase("done");
    toast({
      title: errors === 0 ? "Importação concluída ✓" : `Importação parcial`,
      description: [
        imported > 0 && `${imported} novo(s)`,
        updated > 0 && `${updated} atualizado(s)`,
        errors > 0 && `${errors} erro(s)`,
      ].filter(Boolean).join(" · "),
    });
    fetchAll();
  };

  const numNovos = candidates.filter(c => c.dup_status === "new").length;
  const numDupExatas = candidates.filter(c => c.dup_status === "duplicate_match").length;
  const numDupQtyDiff = candidates.filter(c => c.dup_status === "duplicate_qty_diff").length;
  const numSelecionados = candidates.filter(c => c.is_selected).length;
  const valorTotalSelecionado = candidates
    .filter(c => c.is_selected)
    .reduce((s, c) => s + c.valor_atual, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar carteira da B3
          </DialogTitle>
        </DialogHeader>

        {phase === "idle" && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium mb-1">Clique para selecionar o arquivo .xlsx</p>
              <p className="text-xs text-muted-foreground">
                Arquivo exportado em investidor.b3.com.br &gt; Minha Carteira &gt; Investimentos &gt; BAIXAR &gt; Excel
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
            </div>
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-900 leading-relaxed">
                <span className="font-semibold">A B3 não exporta o preço médio de compra.</span>{" "}
                Atlas usa o preço de fechamento atual como preço médio inicial. Para ter rentabilidade
                histórica correta, ajuste o preço médio de cada ativo após a importação (ou edite a
                coluna "PM" na tabela de preview antes de confirmar).
              </p>
            </div>
          </div>
        )}

        {phase === "parsing" && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Lendo arquivo da B3...</p>
          </div>
        )}

        {phase === "preview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-3 rounded-xl bg-emerald-50/40 border border-emerald-200/40">
                <p className="text-[10px] text-muted-foreground uppercase">Novos</p>
                <p className="text-lg font-heading font-bold text-emerald-700">{numNovos}</p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/40 border border-amber-200/40">
                <p className="text-[10px] text-muted-foreground uppercase">Atualizar quantidade</p>
                <p className="text-lg font-heading font-bold text-amber-700">{numDupQtyDiff}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 border border-border/40">
                <p className="text-[10px] text-muted-foreground uppercase">Já cadastrados</p>
                <p className="text-lg font-heading font-bold text-muted-foreground">{numDupExatas}</p>
              </div>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                <p className="text-[10px] text-muted-foreground uppercase">Valor selecionado</p>
                <p className="text-sm font-heading font-bold text-primary">
                  R$ {valorTotalSelecionado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(totalsBySheet).map(([sheet, n]) => (
                n > 0 && (
                  <Badge key={sheet} variant="outline" className="text-[10px]">
                    {sheet}: {n}
                  </Badge>
                )
              ))}
            </div>

            {warnings.length > 0 && (
              <div className="space-y-1">
                {warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-amber-50/60 border border-amber-200/40">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-amber-900">{w}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{numSelecionados} de {candidates.length} selecionados</span>
              <span className="text-muted-foreground">·</span>
              <button onClick={() => toggleAllSelected(true)} className="text-primary hover:underline">
                Selecionar todos
              </button>
              <span className="text-muted-foreground">·</span>
              <button onClick={() => toggleAllSelected(false)} className="text-muted-foreground hover:underline">
                Desmarcar todos
              </button>
            </div>

            <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30 border border-border/40">
              <AlertCircle className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Coluna <strong>PM (preço médio)</strong> é editável apenas para renda variável.
                Para renda fixa, Tesouro e COE, o sistema usa o valor atualizado da B3 como referência
                (preço médio não se aplica).
              </p>
            </div>

            {candidates.some(c => !c.ticker) && (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-50/60 border border-amber-200/60">
                <AlertCircle className="h-3.5 w-3.5 text-amber-700 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-amber-900 leading-relaxed">
                  Para renda fixa, a <strong>Data de Compra</strong> abaixo vem preenchida com a Data de
                  Emissão do título — <strong>revise antes de importar</strong> se você comprou no
                  mercado secundário (depois da emissão). Se você preencher a <strong>Taxa (%)</strong> contratada,
                  o sistema calcula o valor aplicado inicial via acrual de juros usando histórico de SELIC/IPCA.
                </p>
              </div>
            )}

            <div className="hidden sm:block overflow-x-auto max-h-[400px] overflow-y-auto border border-border/40 rounded-xl">
              <Table>
                <TableHeader className="bg-muted/30 sticky top-0">
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="text-[10px]">Tipo</TableHead>
                    <TableHead className="text-[10px]">Ativo</TableHead>
                    <TableHead className="text-[10px]">Inst.</TableHead>
                    <TableHead className="text-[10px] text-right">Qtd</TableHead>
                    <TableHead className="text-[10px] text-right">Valor Atual</TableHead>
                    <TableHead className="text-[10px] text-right">PM (R$)</TableHead>
                    <TableHead className="text-[10px] text-center">Data Compra</TableHead>
                    <TableHead className="text-[10px] text-right">Taxa (%)</TableHead>
                    <TableHead className="text-[10px]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {candidates.map(c => (
                    <TableRow
                      key={c.id}
                      className={
                        c.dup_status === "duplicate_match" ? "opacity-50" :
                        c.dup_status === "duplicate_qty_diff" ? "bg-amber-50/20" :
                        ""
                      }
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={c.is_selected}
                          disabled={c.dup_status === "duplicate_match"}
                          onChange={e => updateCandidate(c.id, { is_selected: e.target.checked })}
                          className="rounded"
                        />
                      </TableCell>
                      <TableCell className="text-[10px]">{c.tipo}</TableCell>
                      <TableCell className="text-[10px] font-medium max-w-[220px]">
                        <div className="flex items-center gap-1 whitespace-nowrap overflow-hidden">
                          {c.ticker && <span className="font-mono font-bold flex-shrink-0">{c.ticker}</span>}
                          {c.ticker && c.nome && <span className="text-muted-foreground flex-shrink-0"> · </span>}
                          <span className="text-muted-foreground overflow-hidden text-ellipsis" title={c.nome}>
                            {c.nome}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={c.instituicao}
                          onValueChange={v => updateCandidate(c.id, { instituicao: v })}
                        >
                          <SelectTrigger className="h-7 text-[10px] rounded-lg w-[110px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {SELECT_INSTITUICOES.map(i => (
                              <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-[10px] text-right font-mono">
                        {c.quantidade.toLocaleString("pt-BR", {
                          minimumFractionDigits: c.quantidade < 100 ? 2 : 0,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-[10px] text-right font-mono">
                        {c.valor_atual > 0
                          ? `R$ ${c.valor_atual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          : <span className="text-amber-600">—</span>}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.ticker ? (
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={c.preco_medio || ""}
                            onChange={e => updateCandidate(c.id, { preco_medio: Math.max(0, +e.target.value) })}
                            className="h-7 text-[10px] rounded-lg text-right w-[110px]"
                          />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {c.ticker ? (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        ) : (
                          <Input
                            type="date"
                            value={c.data_compra || ""}
                            onChange={e => updateCandidate(c.id, { data_compra: e.target.value })}
                            className="h-7 text-[10px] rounded-lg w-[120px]"
                          />
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.ticker ? (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        ) : (
                          <Input
                            type="number"
                            step="0.01"
                            min={0}
                            value={c.taxa_contratada || ""}
                            placeholder="opcional"
                            onChange={e => updateCandidate(c.id, { taxa_contratada: Math.max(0, +e.target.value) })}
                            className="h-7 text-[10px] rounded-lg text-right w-[100px]"
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {c.dup_status === "new" && (
                          <Badge variant="outline" className="text-[9px] bg-emerald-50/60 border-emerald-300 text-emerald-700">
                            Novo
                          </Badge>
                        )}
                        {c.dup_status === "duplicate_match" && (
                          <Badge variant="outline" className="text-[9px]">Já existe</Badge>
                        )}
                        {c.dup_status === "duplicate_qty_diff" && (
                          <Badge variant="outline" className="text-[9px] bg-amber-50/60 border-amber-300 text-amber-700">
                            Atualizar quantidade
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="sm:hidden space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {candidates.map(c => (
                <div
                  key={c.id}
                  className={`p-3 rounded-xl border space-y-2 ${
                    c.dup_status === "duplicate_match" ? "opacity-50 border-border/30 bg-muted/10" :
                    c.dup_status === "duplicate_qty_diff" ? "border-amber-200 bg-amber-50/30" :
                    "border-border/40 bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={c.is_selected}
                        disabled={c.dup_status === "duplicate_match"}
                        onChange={e => updateCandidate(c.id, { is_selected: e.target.checked })}
                        className="rounded mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">
                          {c.ticker && <span className="font-mono font-bold">{c.ticker}</span>}
                          {c.ticker && c.nome && <span className="text-muted-foreground"> · </span>}
                          <span className="text-muted-foreground">{c.nome}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground">{c.tipo}</p>
                      </div>
                    </div>
                    {c.dup_status === "new" && (
                      <Badge variant="outline" className="text-[9px] bg-emerald-50/60 border-emerald-300 text-emerald-700 flex-shrink-0">Novo</Badge>
                    )}
                    {c.dup_status === "duplicate_match" && (
                      <Badge variant="outline" className="text-[9px] flex-shrink-0">Já existe</Badge>
                    )}
                    {c.dup_status === "duplicate_qty_diff" && (
                      <Badge variant="outline" className="text-[9px] bg-amber-50/60 border-amber-300 text-amber-700 flex-shrink-0">
                        Atualizar qtd
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase">Qtd</p>
                      <p className="font-mono">{c.quantidade.toLocaleString("pt-BR", { minimumFractionDigits: c.quantidade < 100 ? 2 : 0, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase">Valor atual</p>
                      <p className="font-mono">
                        {c.valor_atual > 0
                          ? `R$ ${c.valor_atual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          : <span className="text-amber-600">—</span>}
                      </p>
                    </div>
                  </div>

                  <div>
                    <Label className="text-[10px] text-muted-foreground">Instituição</Label>
                    <Select value={c.instituicao} onValueChange={v => updateCandidate(c.id, { instituicao: v })}>
                      <SelectTrigger className="h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SELECT_INSTITUICOES.map(i => (
                          <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {c.ticker ? (
                    <div>
                      <Label className="text-[10px] text-muted-foreground">PM (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        value={c.preco_medio || ""}
                        onChange={e => updateCandidate(c.id, { preco_medio: Math.max(0, +e.target.value) })}
                        className="h-8 text-xs rounded-lg"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Data Compra</Label>
                        <Input
                          type="date"
                          value={c.data_compra || ""}
                          onChange={e => updateCandidate(c.id, { data_compra: e.target.value })}
                          className="h-8 text-xs rounded-lg"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Taxa (%)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          value={c.taxa_contratada || ""}
                          placeholder="opcional"
                          onChange={e => updateCandidate(c.id, { taxa_contratada: Math.max(0, +e.target.value) })}
                          className="h-8 text-xs rounded-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => handleClose(false)}>
                <X className="h-4 w-4 mr-1" /> Cancelar
              </Button>
              <Button
                className="flex-1 rounded-xl"
                disabled={numSelecionados === 0}
                onClick={handleConfirm}
              >
                Importar {numSelecionados > 0 && `${numSelecionados} ativo${numSelecionados > 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        )}

        {phase === "saving" && (
          <div className="py-12 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <div>
              <p className="text-sm font-medium">Salvando ativos...</p>
              <p className="text-xs text-muted-foreground mt-1">
                {savingProgress.current} de {savingProgress.total}
              </p>
            </div>
            <div className="max-w-xs mx-auto h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${(savingProgress.current / savingProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {phase === "done" && (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-600" />
            <div>
              <p className="font-heading font-bold">Importação concluída</p>
              <p className="text-xs text-muted-foreground mt-1">
                {importedCount} ativo{importedCount !== 1 ? "s" : ""} processado{importedCount !== 1 ? "s" : ""}
              </p>
            </div>
            <Button onClick={() => handleClose(false)} className="rounded-xl">Fechar</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
