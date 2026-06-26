import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Target, TrendingUp, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useHouseholdLabels } from "@/hooks/useHouseholdLabels";
import { usePrivacyFmt } from "@/components/PrivacyValue";


type Meta = {
  id: string;
  nome: string;
  valor_objetivo: number;
  valor_acumulado: number;
  aporte_mensal: number;
  data_objetivo: string | null;
  responsavel: string;
  imagem_url: string | null;
};

interface Props {
  nomePessoa1: string;
  nomePessoa2: string;
  onAportar: (metaId: string, valor: number, responsavel: string) => Promise<void>;
}

const TabMetas = ({ nomePessoa1, nomePessoa2, onAportar }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fmt } = usePrivacyFmt();
  const { responsavelOptions, getLabel } = useHouseholdLabels(nomePessoa1, nomePessoa2);
  const [metas, setMetas] = useState<Meta[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [aporteDialog, setAporteDialog] = useState<Meta | null>(null);
  const [aporteValor, setAporteValor] = useState("");

  const [form, setForm] = useState({
    nome: "", valor_objetivo: "", aporte_mensal: "", data_objetivo: "", responsavel: "Pessoa 1",
  });

  const fetchMetas = async () => {
    if (!user) return;
    const { data } = await supabase.from("objetivos").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setMetas((data as Meta[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchMetas(); }, [user]);

  const handleCreate = async () => {
    if (!user || !form.nome || !form.valor_objetivo) return;
    const { error } = await supabase.from("objetivos").insert({
      user_id: user.id,
      nome: form.nome,
      valor_objetivo: Number(form.valor_objetivo),
      aporte_mensal: form.aporte_mensal ? Number(form.aporte_mensal) : 0,
      data_objetivo: form.data_objetivo || null,
      responsavel: form.responsavel,
    } as any);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      setForm({ nome: "", valor_objetivo: "", aporte_mensal: "", data_objetivo: "", responsavel: "Pessoa 1" });
      setOpenNew(false);
      fetchMetas();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("objetivos").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchMetas();
  };

  const handleAportar = async () => {
    if (!aporteDialog || !aporteValor) return;
    const val = Number(aporteValor);
    if (val <= 0) return;

    // Update accumulated value
    const newAccum = Number(aporteDialog.valor_acumulado) + val;
    const { error } = await supabase.from("objetivos").update({ valor_acumulado: newAccum } as any).eq("id", aporteDialog.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }

    // Register as economia
    await onAportar(aporteDialog.id, val, aporteDialog.responsavel);

    toast({ title: "Aporte realizado!", description: `${fmt(val)} adicionado à meta "${aporteDialog.nome}".` });
    setAporteDialog(null);
    setAporteValor("");
    fetchMetas();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-20"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-heading font-bold flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" /> Metas
        </h3>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Nova Meta</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Meta</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input aria-label="Nome da meta" placeholder="Nome da meta" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              <Input aria-label="Valor alvo da meta (R$)" placeholder="Valor alvo (R$)" type="number" value={form.valor_objetivo} onChange={e => setForm(f => ({ ...f, valor_objetivo: e.target.value }))} />
              <Input aria-label="Aporte mensal (R$)" placeholder="Aporte mensal (R$)" type="number" value={form.aporte_mensal} onChange={e => setForm(f => ({ ...f, aporte_mensal: e.target.value }))} />
              <Input aria-label="Data alvo da meta" type="date" placeholder="Data alvo" value={form.data_objetivo} onChange={e => setForm(f => ({ ...f, data_objetivo: e.target.value }))} />
              <Select value={form.responsavel} onValueChange={v => setForm(f => ({ ...f, responsavel: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {responsavelOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={handleCreate} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {metas.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="p-6 text-center">
            <Target className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Nenhuma meta criada ainda.</p>
            <p className="text-muted-foreground text-xs mt-1">Crie uma meta para acompanhar seu progresso!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metas.map(m => {
            const pct = Number(m.valor_objetivo) > 0 ? (Number(m.valor_acumulado) / Number(m.valor_objetivo)) * 100 : 0;
            return (
              <Card key={m.id} className="shadow-soft overflow-hidden">
                {m.imagem_url && (
                  <div className="h-32 bg-muted bg-cover bg-center" style={{ backgroundImage: `url(${m.imagem_url})` }} />
                )}
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-heading font-bold text-sm">{m.nome}</h4>
                      <Badge variant="outline" className="text-[10px] mt-1">{getLabel(m.responsavel)}</Badge>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(m.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{fmt(Number(m.valor_acumulado))}</span>
                      <span>{fmt(Number(m.valor_objetivo))}</span>
                    </div>
                    <Progress value={Math.min(pct, 100)} className="h-2.5" />
                    <p className="text-xs text-muted-foreground text-center">{pct.toFixed(1)}% concluído</p>
                  </div>

                  {m.data_objetivo && (
                    <p className="text-xs text-muted-foreground">
                      Prazo: {new Date(m.data_objetivo + "T12:00:00").toLocaleDateString("pt-BR")}
                    </p>
                  )}
                  {Number(m.aporte_mensal) > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Aporte mensal: {fmt(Number(m.aporte_mensal))}
                    </p>
                  )}

                  <Button
                    size="sm"
                    className="w-full gap-1"
                    onClick={() => { setAporteDialog(m); setAporteValor(""); }}
                  >
                    <TrendingUp className="h-3.5 w-3.5" /> Aportar agora
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Aporte dialog */}
      <Dialog open={!!aporteDialog} onOpenChange={() => setAporteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aportar em "{aporteDialog?.nome}"</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Acumulado: {fmt(Number(aporteDialog?.valor_acumulado || 0))} de {fmt(Number(aporteDialog?.valor_objetivo || 0))}
            </p>
            <Input
              placeholder="Valor do aporte (R$)"
              type="number"
              value={aporteValor}
              onChange={e => setAporteValor(e.target.value)}
            />
            <Button onClick={handleAportar} className="w-full">Confirmar Aporte</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TabMetas;
