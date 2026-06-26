import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Pencil, CheckSquare, X, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_ITEMS = [
  "Ganhos registrados",
  "Recebimentos confirmados",
  "Fixas quitadas",
  "Parcelas registradas",
  "Economia separada",
];

const SUGESTOES = [
  "Revisei meu Score do PeJota",
  "Conversei sobre as finanças do mês",
  "Separei comprovantes importantes",
];

type Item = {
  id: string;
  user_id: string;
  mes_ano: string;
  label: string;
  done: boolean;
  sort_order: number;
};

interface Props {
  mesAno: string;
}

const ChecklistMensal = ({ mesAno }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from("checklist_items")
        .select("*")
        .eq("user_id", user.id)
        .eq("mes_ano", mesAno)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (cancelled) return;

      if (error) {
        toast({ title: "Erro ao carregar checklist", description: error.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      if (!data || data.length === 0) {
        const rows = DEFAULT_ITEMS.map((label, i) => ({
          user_id: user.id, mes_ano: mesAno, label, done: false, sort_order: i,
        }));
        const { data: inserted, error: insertErr } = await (supabase as any)
          .from("checklist_items").insert(rows).select();
        if (cancelled) return;
        if (insertErr) {
          toast({ title: "Erro ao inicializar checklist", description: insertErr.message, variant: "destructive" });
        } else {
          setItems((inserted || []) as Item[]);
        }
      } else {
        setItems(data as Item[]);
      }
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, [user?.id, mesAno, toast]);

  const toggle = async (item: Item) => {
    const next = !item.done;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, done: next } : i));
    const { error } = await (supabase as any)
      .from("checklist_items").update({ done: next }).eq("id", item.id);
    if (error) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, done: item.done } : i));
      toast({ title: "Erro ao atualizar item", description: error.message, variant: "destructive" });
    }
  };

  const addItem = async (label: string) => {
    const trimmed = label.trim();
    if (!trimmed || !user?.id) return;
    const maxOrder = items.reduce((m, i) => Math.max(m, i.sort_order), -1);
    const tempId = `temp-${Date.now()}`;
    const optimistic: Item = {
      id: tempId, user_id: user.id, mes_ano: mesAno,
      label: trimmed, done: false, sort_order: maxOrder + 1,
    };
    setItems(prev => [...prev, optimistic]);
    setNewLabel("");

    const { data, error } = await (supabase as any)
      .from("checklist_items")
      .insert({ user_id: user.id, mes_ano: mesAno, label: trimmed, done: false, sort_order: maxOrder + 1 })
      .select()
      .single();

    if (error) {
      setItems(prev => prev.filter(i => i.id !== tempId));
      toast({ title: "Erro ao adicionar item", description: error.message, variant: "destructive" });
    } else if (data) {
      setItems(prev => prev.map(i => i.id === tempId ? (data as Item) : i));
    }
  };

  const saveEdit = async (item: Item) => {
    const trimmed = editingLabel.trim();
    if (!trimmed || trimmed === item.label) {
      setEditingId(null);
      return;
    }
    const prevLabel = item.label;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, label: trimmed } : i));
    setEditingId(null);
    const { error } = await (supabase as any)
      .from("checklist_items").update({ label: trimmed }).eq("id", item.id);
    if (error) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, label: prevLabel } : i));
      toast({ title: "Erro ao editar item", description: error.message, variant: "destructive" });
    }
  };

  const removeItem = async (item: Item) => {
    setItems(prev => prev.filter(i => i.id !== item.id));
    const { error } = await (supabase as any)
      .from("checklist_items").delete().eq("id", item.id);
    if (error) {
      setItems(prev => [...prev, item].sort((a, b) => a.sort_order - b.sort_order));
      toast({ title: "Erro ao excluir item", description: error.message, variant: "destructive" });
    }
  };

  const clearDone = async () => {
    const doneItems = items.filter(i => i.done);
    if (doneItems.length === 0) return;
    const backup = doneItems;
    setItems(prev => prev.filter(i => !i.done));
    const ids = doneItems.map(i => i.id);
    const { error } = await (supabase as any)
      .from("checklist_items").delete().in("id", ids);
    if (error) {
      setItems(prev => [...prev, ...backup].sort((a, b) => a.sort_order - b.sort_order));
      toast({ title: "Erro ao limpar concluídos", description: error.message, variant: "destructive" });
    }
  };

  const completedCount = items.filter(i => i.done).length;
  const total = items.length;
  const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const existingLabels = new Set(items.map(i => i.label.toLowerCase()));
  const sugestoesDisponiveis = SUGESTOES.filter(s => !existingLabels.has(s.toLowerCase()));

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          Checklist Mensal
          {percent === 100 && total > 0 && (
            <Badge className="bg-success text-success-foreground text-[10px]">Método aplicado</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={percent} className="h-2.5" />
        <p className="text-xs text-muted-foreground">
          {completedCount} de {total} concluído{total === 1 ? "" : "s"} · {percent}%
        </p>

        {loading ? (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        ) : (
          <div className="space-y-1.5">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-2 text-sm group">
                <Checkbox checked={item.done} onCheckedChange={() => toggle(item)} />
                {editingId === item.id ? (
                  <>
                    <Input
                      value={editingLabel}
                      onChange={e => setEditingLabel(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") saveEdit(item);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="h-7 text-sm flex-1"
                    />
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => saveEdit(item)}>
                      <Check className="h-3.5 w-3.5 text-success" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(null)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span
                      className={`flex-1 cursor-pointer ${item.done ? "line-through text-muted-foreground" : ""}`}
                      onClick={() => toggle(item)}
                    >
                      {item.label}
                    </span>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => { setEditingId(item.id); setEditingLabel(item.label); }}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                      onClick={() => removeItem(item)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t">
          <Input
            placeholder="Adicionar novo item..."
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") addItem(newLabel); }}
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={() => addItem(newLabel)} disabled={!newLabel.trim()} className="gap-1 h-8">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>

        {completedCount > 0 && (
          <Button variant="outline" size="sm" onClick={clearDone} className="gap-1 text-xs">
            <CheckSquare className="h-3.5 w-3.5" /> Limpar concluídos
          </Button>
        )}

        {sugestoesDisponiveis.length > 0 && (
          <div className="pt-2 border-t space-y-2">
            <p className="text-[11px] font-heading font-medium text-muted-foreground">Ideias de itens</p>
            <div className="flex flex-wrap gap-1.5">
              {sugestoesDisponiveis.map(s => (
                <button
                  key={s}
                  onClick={() => addItem(s)}
                  className="text-[11px] px-2 py-1 rounded-full bg-muted hover:bg-muted/70 border border-border/50 transition-colors"
                >
                  + {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ChecklistMensal;
