import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput, parseBRL } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuickAddMutations } from "@/hooks/useQuickAddMutations";
import { useHouseholdView } from "@/contexts/HouseholdViewContext";
import { CATEGORIAS_RECEITAS } from "@/lib/categories";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const NovoGanhoDialog = ({ open, onOpenChange, onSaved }: Props) => {
  const { addReceita } = useQuickAddMutations();
  const { nomePessoa1, nomePessoa2, labels, hasPessoa2 } = useHouseholdView();
  const responsavelOptions = hasPessoa2
    ? [
        { value: "Pessoa 1", label: nomePessoa1 },
        { value: "Pessoa 2", label: nomePessoa2 },
        { value: "Compartilhado", label: labels.casal },
      ]
    : [{ value: "Pessoa 1", label: nomePessoa1 }];

  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS_RECEITAS[0] || "Salário");
  const [tipo, setTipo] = useState<"fixo" | "variavel">("fixo");
  const [data, setData] = useState(todayISO());
  const [responsavel, setResponsavel] = useState("Pessoa 1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDescricao("");
      setValor("");
      setCategoria(CATEGORIAS_RECEITAS[0] || "Salário");
      setTipo("fixo");
      setData(todayISO());
      setResponsavel("Pessoa 1");
    }
  }, [open]);

  const handleSubmit = async () => {
    const v = parseBRL(valor);
    if (!v) return;
    setSaving(true);
    const ok = await addReceita({
      descricao,
      valor: v,
      categoria,
      tipo,
      status: "pendente",
      data,
      responsavel,
      recorrente: false,
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
        <DialogHeader><DialogTitle>Novo ganho</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Descrição</Label>
            <Input
              placeholder="Ex: Salário do mês"
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
                {CATEGORIAS_RECEITAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={v => setTipo(v as "fixo" | "variavel")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixo">Fixo</SelectItem>
                <SelectItem value="variavel">Variável</SelectItem>
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

export default NovoGanhoDialog;
