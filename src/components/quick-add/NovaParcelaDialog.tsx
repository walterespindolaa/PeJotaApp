import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput, parseBRL } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuickAddMutations } from "@/hooks/useQuickAddMutations";
import { useHouseholdView } from "@/contexts/HouseholdViewContext";
import { CATEGORIAS_PARCELAS } from "@/lib/categories";
import { formatBRLDisplay } from "@/components/ui/money-input";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const NovaParcelaDialog = ({ open, onOpenChange, onSaved }: Props) => {
  const { addParcela } = useQuickAddMutations();
  const { nomePessoa1, nomePessoa2, labels, hasPessoa2 } = useHouseholdView();
  const responsavelOptions = hasPessoa2
    ? [
        { value: "Pessoa 1", label: nomePessoa1 },
        { value: "Pessoa 2", label: nomePessoa2 },
        { value: "Compartilhado", label: labels.casal },
      ]
    : [{ value: "Pessoa 1", label: nomePessoa1 }];

  const [descricao, setDescricao] = useState("");
  const [valorTotal, setValorTotal] = useState("");
  const [totalParcelas, setTotalParcelas] = useState("");
  const [parcelaAtual, setParcelaAtual] = useState("1");
  const [categoria, setCategoria] = useState(CATEGORIAS_PARCELAS[0] || "Outros");
  const [data, setData] = useState(todayISO());
  const [responsavel, setResponsavel] = useState("Pessoa 1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDescricao("");
      setValorTotal("");
      setTotalParcelas("");
      setParcelaAtual("1");
      setCategoria(CATEGORIAS_PARCELAS[0] || "Outros");
      setData(todayISO());
      setResponsavel("Pessoa 1");
    }
  }, [open]);

  const vt = parseBRL(valorTotal);
  const tp = Number(totalParcelas);
  const pa = Number(parcelaAtual);
  const valorParcela = vt && tp ? vt / tp : 0;
  const mesesRestantes = tp && pa ? tp - pa : 0;

  const canSave = vt > 0 && tp > 0 && pa > 0 && pa <= tp;

  const handleSubmit = async () => {
    if (!canSave) return;
    setSaving(true);
    const ok = await addParcela({
      descricao,
      valor: vt / tp,
      valor_total: vt,
      total_parcelas: tp,
      parcela_atual: pa,
      categoria,
      tipo: "fixa",
      status: "a_pagar",
      data,
      is_parcelada: true,
      data_inicio_parcelas: data,
      responsavel,
      tipo_parcelamento: "compra_parcelada",
    } as any);
    setSaving(false);
    if (ok) {
      onOpenChange(false);
      onSaved?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="max-h-[90vh] overflow-y-auto rounded-3xl max-w-[calc(100%-2rem)] sm:max-w-lg"
      >
        <DialogHeader><DialogTitle>Nova parcela</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input
              placeholder="Ex: Geladeira nova"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Valor total</Label>
            <MoneyInput value={valorTotal} onChange={setValorTotal} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Total de parcelas</Label>
              <Input
                type="number"
                placeholder="Ex: 12"
                value={totalParcelas}
                onChange={e => setTotalParcelas(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Parcela atual</Label>
              <Input
                type="number"
                placeholder="Ex: 1"
                value={parcelaAtual}
                onChange={e => setParcelaAtual(e.target.value)}
              />
            </div>
          </div>
          {valorParcela > 0 && (
            <div className="p-2 rounded bg-muted text-sm space-y-1">
              <p>Valor da parcela: <strong>{formatBRLDisplay(valorParcela)}</strong></p>
              <p>Meses restantes: <strong>{mesesRestantes}</strong></p>
            </div>
          )}
          <div>
            <Label className="text-xs">Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS_PARCELAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {hasPessoa2 && (
            <div>
              <Label className="text-xs">Responsável</Label>
              <Select value={responsavel} onValueChange={setResponsavel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {responsavelOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Data de início</Label>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>
          <Button onClick={handleSubmit} disabled={saving || !canSave} className="w-full">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NovaParcelaDialog;
