import { useState, useEffect } from "react";
import ResponsiveEditDialog from "@/components/ui/responsive-edit-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput, parseBRL } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trash2, RefreshCw, Save } from "lucide-react";
import type { Receita } from "@/hooks/useOrganiza";
import { CATEGORIAS_RECEITAS } from "@/lib/categories";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receita: Receita | null;
  responsavelOptions: { value: string; label: string }[];
  onUpdate: (id: string, data: Partial<Receita>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  mesFechado?: boolean;
}

const EditReceitaDrawer = ({ open, onOpenChange, receita, responsavelOptions, onUpdate, onDelete, mesFechado }: Props) => {
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("Salário");
  const [tipo, setTipo] = useState("fixo");
  const [responsavel, setResponsavel] = useState("Pessoa 1");
  const [data, setData] = useState("");
  const [recorrente, setRecorrente] = useState(false);
  const [diaRecebimento, setDiaRecebimento] = useState("");
  const [porcentagemEconomia, setPorcentagemEconomia] = useState("");
  const [status, setStatus] = useState("pendente");
  const [temPrazo, setTemPrazo] = useState(false);
  const [prazoMes, setPrazoMes] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [prazoAno, setPrazoAno] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    if (receita && open) {
      setDescricao(receita.descricao || "");
      setValor(Number(receita.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
      setCategoria(receita.categoria || "Salário");
      setTipo(receita.tipo || "fixo");
      setResponsavel(receita.responsavel || "Pessoa 1");
      setData(receita.data || "");
      setRecorrente(receita.recorrente || false);
      if ((receita as any).recorrente_ate) {
        setTemPrazo(true);
        setPrazoAno((receita as any).recorrente_ate.substring(0, 4));
        setPrazoMes((receita as any).recorrente_ate.substring(5, 7));
      } else {
        setTemPrazo(false);
      }
      setDiaRecebimento(receita.dia_recebimento ? String(receita.dia_recebimento) : "");
      setPorcentagemEconomia(receita.porcentagem_economia ? String(receita.porcentagem_economia) : "");
      setStatus(receita.status || "pendente");
    }
  }, [receita, open]);

  if (!receita) return null;

  const handleSave = async () => {
    const val = parseBRL(valor);
    await onUpdate(receita.id, {
      descricao, categoria, tipo, responsavel, data, recorrente, status,
      ...(val && val > 0 ? { valor: val } : {}),
      dia_recebimento: diaRecebimento ? Number(diaRecebimento) : null,
      porcentagem_economia: porcentagemEconomia ? Number(porcentagemEconomia) : null,
      recorrente_ate: recorrente && temPrazo && prazoMes && prazoAno ? `${prazoAno}-${prazoMes}` : null,
    } as any);
    onOpenChange(false);
  };

  const handleDelete = async () => {
    await onDelete(receita.id);
    onOpenChange(false);
  };

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
      title="Editar Receita"
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
          <SelectContent>{CATEGORIAS_RECEITAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Tipo</Label>
        <Select value={tipo} onValueChange={setTipo} disabled={mesFechado}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="fixo">Fixo</SelectItem>
            <SelectItem value="variavel">Variável</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Status</Label>
        <Select value={status} onValueChange={setStatus} disabled={mesFechado}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pendente">Pendente</SelectItem>
            <SelectItem value="recebido">Recebido</SelectItem>
            <SelectItem value="em_atraso">Atrasado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Responsável</Label>
        <Select value={responsavel} onValueChange={setResponsavel} disabled={mesFechado}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{responsavelOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Data</Label>
        <Input type="date" value={data} onChange={e => setData(e.target.value)} disabled={mesFechado} />
      </div>
      <div className="border-t pt-3 space-y-3">
        <div className="flex items-center gap-3">
          <Switch checked={recorrente} onCheckedChange={setRecorrente} id="edit-rec-receita" disabled={mesFechado} />
          <Label htmlFor="edit-rec-receita" className="flex items-center gap-1 text-sm"><RefreshCw className="h-3 w-3" /> Recorrente mensal</Label>
        </div>
        {recorrente && (
          <>
            <div>
              <Label className="text-xs">Dia do recebimento (1-31)</Label>
              <Input type="number" value={diaRecebimento} onChange={e => setDiaRecebimento(e.target.value)} disabled={mesFechado} />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={temPrazo} onCheckedChange={setTemPrazo} id="edit-tem-prazo" disabled={mesFechado} />
              <Label htmlFor="edit-tem-prazo" className="text-sm">Tem prazo? (recebo até um mês específico)</Label>
            </div>
            {temPrazo && (
              <div className="flex gap-2">
                <Select value={prazoMes} onValueChange={setPrazoMes} disabled={mesFechado}>
                  <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                  <SelectContent>
                    {[["01","Janeiro"],["02","Fevereiro"],["03","Março"],["04","Abril"],["05","Maio"],["06","Junho"],["07","Julho"],["08","Agosto"],["09","Setembro"],["10","Outubro"],["11","Novembro"],["12","Dezembro"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={prazoAno} onValueChange={setPrazoAno} disabled={mesFechado}>
                  <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 11 }, (_, i) => String(new Date().getFullYear() + i)).map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}
        <div>
          <Label className="text-xs">% economia automática</Label>
          <Input aria-label="Percentual de economia automática" placeholder="Ex: 20" type="number" value={porcentagemEconomia} onChange={e => setPorcentagemEconomia(e.target.value)} disabled={mesFechado} />
        </div>
      </div>
    </ResponsiveEditDialog>
  );
};

export default EditReceitaDrawer;
