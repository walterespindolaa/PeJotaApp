import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Baby, Plus, Pencil, Trash2, Heart, User, Users } from "lucide-react";
import { useDependentes, type Dependente } from "@/hooks/useDependentes";
import { useToast } from "@/hooks/use-toast";

const TIPO_OPTIONS = [
  { value: "filho", label: "Filho(a)", icon: Baby },
  { value: "mae", label: "Mãe", icon: Heart },
  { value: "pai", label: "Pai", icon: User },
  { value: "conjuge", label: "Cônjuge", icon: Heart },
  { value: "irmao", label: "Irmão(ã)", icon: Users },
  { value: "outro", label: "Outro", icon: User },
];

function getTipoLabel(tipo: string) {
  return TIPO_OPTIONS.find(t => t.value === tipo)?.label || tipo;
}

function getTipoIcon(tipo: string) {
  return TIPO_OPTIONS.find(t => t.value === tipo)?.icon || User;
}

export default function DependentesSection() {
  const { dependentes, loading, add, update, remove, calcIdade } = useDependentes();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    data_nascimento: "",
    tipo: "filho",
    parentesco: "Filho(a)",
    observacoes: "",
  });

  const resetForm = () => {
    setForm({ nome: "", data_nascimento: "", tipo: "filho", parentesco: "Filho(a)", observacoes: "" });
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome", variant: "destructive" });
      return;
    }
    if (editingId) {
      await update(editingId, {
        nome: form.nome,
        data_nascimento: form.data_nascimento || null,
        tipo: form.tipo,
        parentesco: getTipoLabel(form.tipo),
        observacoes: form.observacoes || null,
      });
    } else {
      await add({
        nome: form.nome,
        data_nascimento: form.data_nascimento || null,
        tipo: form.tipo,
        parentesco: getTipoLabel(form.tipo),
        observacoes: form.observacoes || null,
      });
    }
    resetForm();
    setOpen(false);
    toast({ title: editingId ? "Dependente atualizado" : "Dependente adicionado" });
  };

  const handleEdit = (d: Dependente) => {
    setEditingId(d.id);
    setForm({
      nome: d.nome,
      data_nascimento: d.data_nascimento || "",
      tipo: d.tipo,
      parentesco: d.parentesco,
      observacoes: d.observacoes || "",
    });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await remove(id);
    toast({ title: "Dependente removido" });
  };

  if (loading) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold px-1 flex items-center gap-2">
          <Baby className="h-3.5 w-3.5" /> Dependentes
        </p>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 rounded-lg">
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Baby className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                {editingId ? "Editar Dependente" : "Novo Dependente"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome</label>
                <Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="rounded-xl" placeholder="Nome do dependente" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Data de nascimento</label>
                  <Input type="date" value={form.data_nascimento} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} className="rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tipo</label>
                  <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPO_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Observações (opcional)</label>
                <Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} className="rounded-xl min-h-[60px]" placeholder="Notas sobre o dependente..." />
              </div>
              <Button onClick={handleSubmit} className="w-full rounded-xl">
                {editingId ? "Atualizar" : "Adicionar Dependente"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {dependentes.length === 0 ? (
        <Card className="shadow-soft border-dashed border-2 border-border/40">
          <CardContent className="py-10 text-center">
            <Baby className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-muted-foreground">Nenhum dependente cadastrado.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Adicione dependentes para incluir no planejamento.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {dependentes.map(d => {
            const Icon = getTipoIcon(d.tipo);
            const idade = calcIdade(d.data_nascimento);
            return (
              <Card key={d.id} className="shadow-soft rounded-2xl">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center justify-center rounded-full bg-primary/10 shrink-0" style={{ width: 48, height: 48 }}>
                      <Icon className="text-primary" style={{ width: 22, height: 22 }} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-heading font-bold text-sm">{d.nome}</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>{getTipoLabel(d.tipo)}</span>
                        {idade !== null && (
                          <>
                            <span className="text-border">•</span>
                            <span>{idade} {idade === 1 ? "ano" : "anos"}</span>
                          </>
                        )}
                      </div>
                      {d.observacoes && (
                        <p className="text-xs text-muted-foreground/70 mt-1.5 line-clamp-2">{d.observacoes}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(d)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(d.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
