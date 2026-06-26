import { useState, useEffect } from "react";
import ResponsiveEditDialog from "@/components/ui/responsive-edit-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput, parseBRL } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, Link2, RefreshCw, Save } from "lucide-react";
import type { Despesa } from "@/hooks/useOrganiza";
import type { ExpenseLink } from "@/hooks/useExpenseLinks";

const FORMAS = ["Débito automático", "Boleto", "Cartão crédito", "Pix", "Dinheiro"];

type Investimento = { id: string; nome: string; instituicao: string; recebe_proventos: boolean; frequencia_proventos: string };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  despesa: Despesa | null;
  tipo: "fixa" | "variavel";
  categorias: string[];
  responsavelOptions: { value: string; label: string }[];
  investimentos: Investimento[];
  existingLink: ExpenseLink | undefined;
  onUpdate: (id: string, data: Partial<Despesa>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpsertLink: (investmentId: string, expenseId: string, valor: number, tipo: string) => Promise<void>;
  onRemoveLink: (expenseId: string) => Promise<void>;
  mesFechado?: boolean;
}

const EditExpenseDrawer = ({
  open, onOpenChange, despesa, tipo, categorias, responsavelOptions,
  investimentos, existingLink, onUpdate, onDelete, onUpsertLink, onRemoveLink, mesFechado,
}: Props) => {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("Pix");
  const [responsavel, setResponsavel] = useState("Pessoa 1");
  const [vencimento, setVencimento] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [diaVencimento, setDiaVencimento] = useState("");
  const [ajusteVariacao, setAjusteVariacao] = useState(false);
  const [vincular, setVincular] = useState(false);
  const [investimentoId, setInvestimentoId] = useState("");
  const [valorVinculado, setValorVinculado] = useState("");

  const ativosComProventos = investimentos.filter(i => i.recebe_proventos && i.frequencia_proventos !== "sem_proventos");

  useEffect(() => {
    if (despesa && open) {
      setDescricao(despesa.descricao || "");
      setValor(Number(despesa.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
      setCategoria(despesa.categoria || "");
      setFormaPagamento(despesa.forma_pagamento || "Pix");
      setResponsavel(despesa.responsavel || "Pessoa 1");
      setVencimento(String(despesa.vencimento || despesa.dia_vencimento || ""));
      setRecorrente(despesa.recorrente || false);
      setDiaVencimento(String(despesa.dia_vencimento || ""));
      setAjusteVariacao(despesa.ajuste_variacao || false);
      if (existingLink) {
        setVincular(true);
        setInvestimentoId(existingLink.investment_id);
        setValorVinculado(String(existingLink.valor_vinculado));
      } else {
        setVincular(false);
        setInvestimentoId("");
        setValorVinculado("");
      }
    }
  }, [despesa, open, existingLink]);

  if (!despesa) return null;

  const realId = despesa._originalId || despesa.id;

  const handleSave = async () => {
    const val = parseBRL(valor);
    const updates: Partial<Despesa> = {
      descricao, categoria, forma_pagamento: formaPagamento,
      responsavel, recorrente, ajuste_variacao: ajusteVariacao,
    };
    if (val && val > 0) updates.valor = val;
    if (tipo === "fixa") {
      updates.vencimento = vencimento ? Number(vencimento) : null;
      updates.dia_vencimento = diaVencimento ? Number(diaVencimento) : null;
    }
    await onUpdate(despesa.id, updates);

    if (vincular && investimentoId && Number(valorVinculado) > 0) {
      await onUpsertLink(investimentoId, realId, Number(valorVinculado), tipo);
    } else if (!vincular && existingLink) {
      await onRemoveLink(realId);
    }

    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (existingLink) await onRemoveLink(realId);
    await onDelete(despesa.id);
    onOpenChange(false);
  };

  const linkedInv = investimentoId ? investimentos.find(i => i.id === investimentoId) : null;

  const footer = (
    <>
      {!mesFechado && (
        <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1">
          <Trash2 className="h-3.5 w-3.5" /> Excluir
        </Button>
      )}
      <div className="flex-1" />
      <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
      {!mesFechado && (
        <Button size="sm" onClick={handleSave} className="gap-1">
          <Save className="h-3.5 w-3.5" /> Salvar
        </Button>
      )}
    </>
  );

  return (
    <ResponsiveEditDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Editar ${tipo === "fixa" ? "Despesa Fixa" : "Despesa Variável"}`}
      footer={footer}
    >
      <div>
        <Label className="text-xs">Descrição</Label>
        <Input value={descricao} onChange={e => setDescricao(e.target.value)} disabled={mesFechado} />
      </div>
      <div>
        <Label className="text-xs">Valor</Label>
        <MoneyInput value={valor} onChange={setValor} disabled={mesFechado} />
      </div>
      <div>
        <Label className="text-xs">Categoria</Label>
        <Select value={categoria} onValueChange={setCategoria} disabled={mesFechado}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {tipo === "fixa" && (
        <div>
          <Label className="text-xs">Forma de pagamento</Label>
          <Select value={formaPagamento} onValueChange={setFormaPagamento} disabled={mesFechado}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{FORMAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <div>
        <Label className="text-xs">Responsável</Label>
        <Select value={responsavel} onValueChange={setResponsavel} disabled={mesFechado}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{responsavelOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      {tipo === "fixa" && (
        <div>
          <Label className="text-xs">Dia de vencimento (1–31)</Label>
          <Input type="number" min={1} max={31} value={vencimento} onChange={e => { setVencimento(e.target.value); setDiaVencimento(e.target.value); }} disabled={mesFechado} />
        </div>
      )}
      <div className="flex items-center gap-3">
        <Switch checked={recorrente} onCheckedChange={setRecorrente} id="edit-rec" disabled={mesFechado} />
        <Label htmlFor="edit-rec" className="flex items-center gap-1 text-sm"><RefreshCw className="h-3 w-3" /> Recorrente mensal</Label>
      </div>
      {recorrente && (
        <div className="flex items-center gap-3">
          <Switch checked={ajusteVariacao} onCheckedChange={setAjusteVariacao} id="edit-ajuste" disabled={mesFechado} />
          <Label htmlFor="edit-ajuste" className="text-sm">Permite ajuste de valor</Label>
        </div>
      )}

      {ativosComProventos.length > 0 && (
        <div className="border-t pt-3 space-y-3">
          <div className="flex items-center gap-3">
            <Switch checked={vincular} onCheckedChange={setVincular} id="edit-vinc" disabled={mesFechado} />
            <Label htmlFor="edit-vinc" className="flex items-center gap-1 text-sm"><Link2 className="h-3 w-3" /> Vincular a investimento</Label>
          </div>
          {vincular && (
            <>
              <Select value={investimentoId} onValueChange={setInvestimentoId} disabled={mesFechado}>
                <SelectTrigger><SelectValue placeholder="Selecione o ativo" /></SelectTrigger>
                <SelectContent>
                  {ativosComProventos.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.nome} — {i.instituicao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div>
                <Label className="text-xs">Valor vinculado (R$)</Label>
                <Input type="number" value={valorVinculado} onChange={e => setValorVinculado(e.target.value)} disabled={mesFechado} />
              </div>
              {linkedInv && (
                <p className="text-[10px] text-muted-foreground">
                  Frequência: {linkedInv.frequencia_proventos === "mensal" ? "Mensal" : linkedInv.frequencia_proventos === "trimestral" ? "Trimestral" : linkedInv.frequencia_proventos === "semestral" ? "Semestral" : linkedInv.frequencia_proventos === "anual" ? "Anual" : "—"}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </ResponsiveEditDialog>
  );
};

export default EditExpenseDrawer;
