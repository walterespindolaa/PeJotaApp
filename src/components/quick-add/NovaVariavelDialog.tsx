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

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const NovaVariavelDialog = ({ open, onOpenChange, onSaved }: Props) => {
  const { addDespesa } = useQuickAddMutations();
  const { nomePessoa1, nomePessoa2, labels, hasPessoa2 } = useHouseholdView();
  const { allVariaveis: CATEGORIAS } = useCustomCategories();
  const responsavelOptions = hasPessoa2
    ? [
        { value: "Pessoa 1", label: nomePessoa1 },
        { value: "Pessoa 2", label: nomePessoa2 },
        { value: "Compartilhado", label: labels.casal },
      ]
    : [{ value: "Pessoa 1", label: nomePessoa1 }];

  const defaultCategoria = CATEGORIAS[0] || "Outros";
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState(defaultCategoria);
  const [data, setData] = useState(todayISO());
  const [responsavel, setResponsavel] = useState("Pessoa 1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDescricao("");
      setValor("");
      setCategoria(CATEGORIAS[0] || "Outros");
      setData(todayISO());
      setResponsavel("Pessoa 1");
    }
    // Resets fire only when the dialog transitions to open — CATEGORIAS may
    // load asynchronously, but we don't want it to overwrite user choice mid-fill.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async () => {
    const v = parseBRL(valor);
    if (!v) return;
    setSaving(true);
    const ok = await addDespesa({
      descricao,
      valor: v,
      categoria,
      tipo: "variavel",
      status: "a_pagar",
      data,
      is_parcelada: false,
      responsavel,
      recorrente: false,
      ajuste_variacao: true,
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
        <DialogHeader><DialogTitle>Nova despesa variável</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input
              placeholder="Ex: Almoço no restaurante"
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

export default NovaVariavelDialog;
