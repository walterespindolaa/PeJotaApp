import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyInput, parseBRL } from "@/components/ui/money-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, AlertTriangle, Pencil } from "lucide-react";
import { useHouseholdLabels } from "@/hooks/useHouseholdLabels";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { useToast } from "@/hooks/use-toast";
import { logWarn } from "@/lib/log";
import type { Despesa } from "@/hooks/useOrganiza";
import { gerarTabelaAmortizacao, taxaMensalDeAnual, totaisTabela, type SistemaAmortizacao } from "@/lib/amortizacao";

interface Props {
  fixas: Despesa[]; // despesas em atraso (entram em "Despesas em atraso" abaixo)
  dividas: Despesa[]; // financiamentos / empréstimos
  mesAno: string;
  mesFechado: boolean;
  onAdd: (data: Partial<Despesa>) => Promise<void>;
  onUpdate: (id: string, data: Partial<Despesa>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdateInstanceStatus?: (instanceId: string, status: string) => Promise<void>;
  nomePessoa1: string;
  nomePessoa2: string;
}

const statusColor: Record<string, string> = {
  pago: "bg-success text-success-foreground",
  a_pagar: "bg-warning text-warning-foreground",
  em_atraso: "bg-destructive text-destructive-foreground",
};
const statusLabel: Record<string, string> = { pago: "✓ Pago", a_pagar: "A pagar", em_atraso: "Em atraso" };

const TabDividas = ({ fixas, dividas, mesAno, mesFechado, onAdd, onUpdate, onDelete, onUpdateInstanceStatus, nomePessoa1, nomePessoa2 }: Props) => {
  const { fmt } = usePrivacyFmt();
  const { toast } = useToast();
  const { responsavelOptions, getLabel } = useHouseholdLabels(nomePessoa1, nomePessoa2);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [savedParcela, setSavedParcela] = useState<number | null>(null);
  const [modo, setModo] = useState<"simples" | "detalhada">("simples");
  const [form, setForm] = useState({
    descricao: "", valor_parcela: "", valor_total: "", total_parcelas: "", parcela_atual: "",
    sistema: "sac", taxa_juros: "", valor_financiado: "",
    categoria: "Dívidas", data: `${mesAno}-01`, responsavel: "Pessoa 1",
  });

  const emAtraso = fixas.filter(d => d.status === "em_atraso");
  const totalAtraso = emAtraso.reduce((s, d) => s + Number(d.valor), 0);
  const totalComprometido = dividas.reduce((s, p) => {
    const remaining = Number(p.total_parcelas) - Number(p.parcela_atual) + 1;
    return s + Number(p.valor) * remaining;
  }, 0);

  const totalMensal = dividas.reduce((s, d) => s + Number(d.valor), 0);

  const valorParcela = form.valor_parcela ? parseBRL(form.valor_parcela) : 0;
  const parcelasRestantes = form.total_parcelas && form.parcela_atual
    ? Math.max(Number(form.total_parcelas) - Number(form.parcela_atual) + 1, 0) : 0;

  const valorFinanciado = form.valor_financiado ? parseBRL(form.valor_financiado) : 0;
  const totalP = Number(form.total_parcelas) || 0;
  const atualP = Number(form.parcela_atual) || 1;
  const taxaMensal = form.taxa_juros ? taxaMensalDeAnual(parseFloat(form.taxa_juros.replace(",", "."))) : 0;
  // Tabela completa desde a origem; parcela e saldo "atuais" vêm da posição informada.
  const tabelaCompleta = modo === "detalhada"
    ? gerarTabelaAmortizacao(form.sistema as SistemaAmortizacao, valorFinanciado, taxaMensal, totalP)
    : [];
  const tabelaAmort = tabelaCompleta.slice(Math.max(atualP - 1, 0));
  const parcelaDetalhada = tabelaAmort.length ? tabelaAmort[0].parcela : 0;
  const saldoDevedorDerivado = atualP <= 1 ? valorFinanciado : (tabelaCompleta[atualP - 2]?.saldo ?? valorFinanciado);
  const totaisAmort = totaisTabela(tabelaAmort);

  const resetForm = () => {
    setForm({ descricao: "", valor_parcela: "", valor_total: "", total_parcelas: "", parcela_atual: "", sistema: "sac", taxa_juros: "", valor_financiado: "", categoria: "Dívidas", data: `${mesAno}-01`, responsavel: "Pessoa 1" });
    setEditingId(null);
    setModo("simples");
  };

  const handleSubmit = async () => {
    const isDet = modo === "detalhada";
    if (!form.descricao || !form.total_parcelas || !form.parcela_atual) {
      toast({ title: "Preencha descrição e o número de parcelas", variant: "destructive" });
      return;
    }
    if (isDet && (!form.valor_financiado || !form.taxa_juros)) {
      toast({ title: "No modo detalhado, informe o valor financiado e a taxa de juros", variant: "destructive" });
      return;
    }
    if (!isDet && !form.valor_parcela) {
      toast({ title: "Informe o valor da parcela", variant: "destructive" });
      return;
    }
    const vp = isDet ? parcelaDetalhada : parseBRL(form.valor_parcela);
    const vt = isDet ? saldoDevedorDerivado : (parseBRL(form.valor_total) || 0);
    const tp = Number(form.total_parcelas);
    const pa = Number(form.parcela_atual);
    if (pa > tp) {
      toast({ title: "Parcela atual maior que o total", variant: "destructive" });
      return;
    }
    if (vp <= 0) {
      toast({ title: "Não foi possível calcular a parcela. Confira a taxa e o saldo.", variant: "destructive" });
      return;
    }

    if (editingId) {
      await onUpdate(editingId, {
        descricao: form.descricao, valor: vp, valor_total: vt,
        total_parcelas: tp, parcela_atual: pa, categoria: form.categoria,
        data: form.data, responsavel: form.responsavel,
        tipo_parcelamento: "divida",
        data_inicio_parcelas: form.data,
      } as any);
      toast({ title: "Dívida atualizada" });
    } else {
      await onAdd({
        descricao: form.descricao, valor: vp, valor_total: vt,
        total_parcelas: tp, parcela_atual: pa, categoria: form.categoria,
        tipo: "fixa", status: "a_pagar", data: form.data,
        is_parcelada: true, data_inicio_parcelas: form.data,
        responsavel: form.responsavel,
        tipo_parcelamento: "divida",
      } as any);
      toast({ title: "Dívida adicionada" });
    }
    setOpen(false);
    resetForm();
    setSavedParcela(vp);
  };

  const handleEdit = (d: Despesa) => {
    const realId = (d as any)._originalId || d.id;
    setEditingId(realId);
    setForm({
      descricao: d.descricao || "",
      valor_parcela: String(d.valor || 0),
      valor_total: String(d.valor_total || 0),
      total_parcelas: String(d.total_parcelas || 1),
      parcela_atual: String((d as any)._originalParcela || d.parcela_atual || 1),
      sistema: "sac", taxa_juros: "", valor_financiado: "",
      categoria: d.categoria || "Dívidas",
      data: d.data_inicio_parcelas || d.data,
      responsavel: d.responsavel || "Pessoa 1",
    });
    setModo("simples");
    setOpen(true);
  };

  const handleDelete = async (d: Despesa) => {
    try {
      const realId = (d as any)._originalId || d.id;
      await onDelete(realId);
      toast({ title: "Dívida excluída" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err?.message, variant: "destructive" });
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const displayStatus = (d: Despesa): string => {
    const raw = (d as any)._rawStatus;
    const due = (d as any)._dueDate;
    if (raw === "paid") return "pago";
    if (raw === "pending" && due && due < today) return "em_atraso";
    if (raw === "late") return "em_atraso";
    return "a_pagar";
  };

  const cycleStatus = (d: Despesa) => {
    if (mesFechado) return;
    const instanceId = (d as any)._instanceId;
    const rawStatus = (d as any)._rawStatus;
    const next = rawStatus === "paid" ? "a_pagar" : "pago";

    if (instanceId && onUpdateInstanceStatus) {
      onUpdateInstanceStatus(instanceId, next);
    } else {
      logWarn("[TabDividas] missing _instanceId for divida:", d.id);
      onUpdate(d.id, { status: next });
    }
  };

  return (
    <div className="space-y-4">
      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="shadow-soft border-destructive/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-xs text-muted-foreground">Em Atraso</p>
            </div>
            <p className="text-lg font-heading font-bold text-destructive">{fmt(totalAtraso)}</p>
            <p className="text-xs text-muted-foreground mt-1">{emAtraso.length} despesa(s)</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Comprometido (futuro)</p>
            <p className="text-lg font-heading font-bold text-warning">{fmt(totalComprometido)}</p>
            <p className="text-xs text-muted-foreground mt-1">{dividas.length} dívida(s) ativa(s)</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Parcela mensal total</p>
            <p className="text-lg font-heading font-bold">{fmt(totalMensal)}</p>
            <p className="text-xs text-muted-foreground mt-1">Mês de {mesAno}</p>
          </CardContent>
        </Card>
      </div>

      {/* Botão Adicionar */}
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-xl gap-2" disabled={mesFechado}>
              <Plus className="h-4 w-4" /> Adicionar Dívida
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-heading">{editingId ? "Editar dívida" : "Nova dívida"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Descrição</Label>
                <Input
                  value={form.descricao}
                  onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Ex: Financiamento imóvel Caixa"
                />
              </div>
              {/* Modo simples × detalhado */}
              <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 text-xs">
                {([
                  { k: "simples" as const, label: "Simples" },
                  { k: "detalhada" as const, label: "Detalhada (SAC/Price)" },
                ]).map(opt => (
                  <button
                    key={opt.k}
                    type="button"
                    onClick={() => setModo(opt.k)}
                    className={`flex-1 px-3 py-1.5 rounded-md transition-colors ${modo === opt.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {modo === "simples" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Valor da parcela (R$/mês)</Label>
                    <MoneyInput value={form.valor_parcela} onChange={v => setForm(f => ({ ...f, valor_parcela: v }))} />
                    <p className="text-[10px] text-muted-foreground mt-1">O valor que vem no boleto. Em financiamento com juros, use o valor real — não é o total ÷ parcelas.</p>
                  </div>
                  <div>
                    <Label className="text-xs">Categoria</Label>
                    <Input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} />
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Sistema de amortização</Label>
                      <Select value={form.sistema} onValueChange={v => setForm(f => ({ ...f, sistema: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sac">SAC (parcela cai com o tempo)</SelectItem>
                          <SelectItem value="price">Price (parcela fixa)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Categoria</Label>
                      <Input value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Valor financiado (original)</Label>
                      <MoneyInput value={form.valor_financiado} onChange={v => setForm(f => ({ ...f, valor_financiado: v }))} />
                    </div>
                    <div>
                      <Label className="text-xs">Taxa de juros (% ao ano)</Label>
                      <Input
                        type="text" inputMode="decimal" placeholder="Ex: 9,5"
                        value={form.taxa_juros}
                        onChange={e => setForm(f => ({ ...f, taxa_juros: e.target.value }))}
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Use o valor original do contrato e a taxa (estão no contrato/informe do banco). O Atlas calcula a parcela da sua posição atual, o saldo devedor e a amortização até o fim.</p>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Total de parcelas</Label>
                  <Input
                    type="number" min={1}
                    value={form.total_parcelas}
                    onChange={e => setForm(f => ({ ...f, total_parcelas: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Em qual parcela você está?</Label>
                  <Input
                    type="number" min={1}
                    value={form.parcela_atual}
                    onChange={e => setForm(f => ({ ...f, parcela_atual: e.target.value }))}
                  />
                </div>
              </div>

              {modo === "simples" && (
                <div>
                  <Label className="text-xs">Saldo devedor atual (opcional)</Label>
                  <MoneyInput value={form.valor_total} onChange={v => setForm(f => ({ ...f, valor_total: v }))} />
                  <p className="text-[10px] text-muted-foreground mt-1">Quanto ainda falta pagar — você encontra no informe de rendimentos do banco. Usado no seu patrimônio.</p>
                </div>
              )}

              {modo === "simples" && (valorParcela > 0 || parcelasRestantes > 0) && (
                <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  {parcelasRestantes > 0 && <>Faltam <span className="font-semibold text-foreground">{parcelasRestantes}</span> parcela(s)</>}
                  {parcelasRestantes > 0 && valorParcela > 0 && " · "}
                  {valorParcela > 0 && <>Parcela de <span className="font-semibold text-foreground">{fmt(valorParcela)}</span>/mês</>}
                </div>
              )}

              {modo === "detalhada" && tabelaAmort.length > 0 && (
                <div className="rounded-lg border border-border/60 overflow-hidden">
                  <div className="bg-muted/40 px-3 py-2 text-xs">
                    Próxima parcela: <span className="font-semibold text-foreground">{fmt(parcelaDetalhada)}</span>
                    {form.sistema === "sac" && tabelaAmort.length > 1 && <> · cai até <span className="font-semibold text-foreground">{fmt(tabelaAmort[tabelaAmort.length - 1].parcela)}</span></>}
                    <span className="block text-[10px] text-muted-foreground mt-0.5">Saldo devedor atual ≈ {fmt(saldoDevedorDerivado)} · juros restantes ≈ {fmt(totaisAmort.totalJuros)} · total a pagar ≈ {fmt(totaisAmort.totalPago)}</span>
                  </div>
                  <div className="max-h-40 overflow-auto">
                    <table className="w-full text-[10px]">
                      <thead className="sticky top-0 bg-card">
                        <tr className="text-muted-foreground">
                          <th className="text-left font-medium px-2 py-1">Nº</th>
                          <th className="text-right font-medium px-2 py-1">Parcela</th>
                          <th className="text-right font-medium px-2 py-1">Juros</th>
                          <th className="text-right font-medium px-2 py-1">Amort.</th>
                          <th className="text-right font-medium px-2 py-1">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tabelaAmort.slice(0, 60).map(l => (
                          <tr key={l.n} className="border-t border-border/40">
                            <td className="px-2 py-1">{l.n}</td>
                            <td className="text-right px-2 py-1 font-medium text-foreground">{fmt(l.parcela)}</td>
                            <td className="text-right px-2 py-1">{fmt(l.juros)}</td>
                            <td className="text-right px-2 py-1">{fmt(l.amortizacao)}</td>
                            <td className="text-right px-2 py-1">{fmt(l.saldo)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {tabelaAmort.length > 60 && <div className="px-2 py-1 text-[10px] text-muted-foreground text-center">mostrando as primeiras 60 de {tabelaAmort.length} parcelas</div>}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Data de início</Label>
                  <Input
                    type="date"
                    value={form.data}
                    onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                  />
                </div>
                <div>
                  <Label className="text-xs">Responsável</Label>
                  <Select value={form.responsavel} onValueChange={v => setForm(f => ({ ...f, responsavel: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {responsavelOptions.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleSubmit} className="w-full rounded-xl">
                {editingId ? "Salvar alterações" : "Adicionar dívida"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Lista */}
      {emAtraso.length === 0 && dividas.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="p-6 text-center">
            <p className="text-success font-heading font-bold">Parabéns!</p>
            <p className="text-muted-foreground text-sm mt-1">Você não possui dívidas em atraso nem financiamentos ativos.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {emAtraso.length > 0 && (
            <div>
              <p className="text-sm font-heading font-medium mb-2 text-destructive">Despesas em atraso</p>
              {emAtraso.map(d => (
                <Card key={d.id} className="shadow-soft border-destructive/20 mb-2">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.descricao || d.categoria}</p>
                      <p className="text-xs text-muted-foreground">Venc: dia {d.vencimento || "—"} · {getLabel(d.responsavel)}</p>
                    </div>
                    <p className="font-heading font-bold text-sm text-destructive">{fmt(Number(d.valor))}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {dividas.length > 0 && (
            <div>
              <p className="text-sm font-heading font-medium mb-2">Dívidas ativas (empréstimos/financiamentos)</p>
              {dividas.map(d => {
                const status = displayStatus(d);
                const remaining = Number(d.total_parcelas) - Number(d.parcela_atual) + 1;
                return (
                  <Card key={d.id} className="shadow-soft mb-2">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium truncate">{d.descricao || d.categoria}</p>
                          <Badge
                            className={`${statusColor[status]} text-[10px] cursor-pointer`}
                            onClick={() => cycleStatus(d)}
                          >
                            {statusLabel[status]}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Parcela {d.parcela_atual} de {d.total_parcelas} · Restante: {fmt(Number(d.valor) * remaining)} · {getLabel(d.responsavel)}
                        </p>
                      </div>
                      <p className="font-heading font-bold text-sm whitespace-nowrap">{fmt(Number(d.valor))}/mês</p>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(d)} disabled={mesFechado}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" disabled={mesFechado}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir dívida?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Esta ação não pode ser desfeita. Todas as parcelas mensais associadas serão removidas.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(d)} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      <AlertDialog open={savedParcela !== null} onOpenChange={(v) => { if (!v) setSavedParcela(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dívida lançada no seu orçamento</AlertDialogTitle>
            <AlertDialogDescription>
              A parcela{savedParcela ? ` de ${fmt(savedParcela)}` : ""} já entra automaticamente no seu orçamento mensal — ela aparece aqui em Dívidas e soma no total de despesas do mês. Se você também lançou essa parcela como <strong>despesa fixa</strong> em outro lugar, remova de lá para não contar duas vezes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setSavedParcela(null)}>Entendi</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TabDividas;
