import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput, parseBRL } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuickAddMutations } from "@/hooks/useQuickAddMutations";
import { useHouseholdView } from "@/contexts/HouseholdViewContext";
import { useCustomCategories } from "@/hooks/useCustomCategories";

const FORMAS = ["Débito automático", "Boleto", "Cartão crédito", "Pix", "Dinheiro"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const NovaFixaDialog = ({ open, onOpenChange, onSaved }: Props) => {
  const { addDespesa } = useQuickAddMutations();
  const { nomePessoa1, nomePessoa2, labels, hasPessoa2 } = useHouseholdView();
  const { allFixas: CATEGORIAS } = useCustomCategories();
  const responsavelOptions = hasPessoa2
    ? [
        { value: "Pessoa 1", label: nomePessoa1 },
        { value: "Pessoa 2", label: nomePessoa2 },
        { value: "Compartilhado", label: labels.casal },
      ]
    : [{ value: "Pessoa 1", label: nomePessoa1 }];

  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS[0] || "Moradia");
  const [diaVencimento, setDiaVencimento] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("Pix");
  const [data, setData] = useState(todayISO());
  const [responsavel, setResponsavel] = useState("Pessoa 1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDescricao("");
      setValor("");
      setCategoria(CATEGORIAS[0] || "Moradia");
      setDiaVencimento("");
      setFormaPagamento("Pix");
      setData(todayISO());
      setResponsavel("Pessoa 1");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async () => {
    const v = parseBRL(valor);
    if (!v) return;
    setSaving(true);
    const diaVenc = diaVencimento ? Number(diaVencimento) : null;
    const ok = await addDespesa({
      descricao,
      valor: v,
      valor_base: v,
      categoria,
      tipo: "fixa",
      status: "a_pagar",
      vencimento: diaVenc,
      dia_vencimento: diaVenc,
      forma_pagamento: formaPagamento,
      data,
      is_parcelada: false,
      recorrente: true,
      ajuste_variacao: false,
      responsavel,
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
        <DialogHeader><DialogTitle>Nova despesa fixa</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input
              placeholder="Ex: Aluguel"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Valor</Label>
            <MoneyInput value={valor} onChange={setValor} />
          </div>
          <div>
            <Label className="text-xs">Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Dia de vencimento (1–31)</Label>
            <Input
              type="number"
              min={1}
              max={31}
              placeholder="Ex: 10"
              value={diaVencimento}
              onChange={e => setDiaVencimento(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Forma de pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {FORMAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
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
            <Label className="text-xs">Data</Label>
            <Input type="date" value={data} onChange={e => setData(e.target.value)} />
          </div>
          <Button onClick={handleSubmit} disabled={saving || !parseBRL(valor)} className="w-full">
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NovaFixaDialog;
