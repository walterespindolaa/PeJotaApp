import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { FileText, ListTodo, Plus, Trash2, Pin, PinOff, Save, CalendarClock, FileSignature, Link2, ChevronRight } from "lucide-react";

interface Note { id: string; content: string; tipo: string; pinned: boolean; created_at: string; }
interface Task { id: string; title: string; done: boolean; due_date: string | null; created_at: string; }
interface Prop { id: string; titulo: string | null; status: string; token: string | null; created_at: string; }
const PROP_STATUS: Record<string, string> = { enviada: "Enviada", vista: "Vista", aceita: "Aceita · prevista", entregue: "Entregue", recusada: "Recusada", ajuste: "Ajuste pedido", rascunho: "Rascunho" };

const TIPO_LABEL: Record<string, string> = { nota: "Nota", ligacao: "Ligação", reuniao: "Reunião", mensagem: "Mensagem", atendimento: "Atendimento" };
const TIPOS = ["nota", "ligacao", "reuniao", "mensagem", "atendimento"];

export default function BusinessClienteCRM({ clientId, companyId }: { clientId: string; companyId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [info, setInfo] = useState("");
  const [origem, setOrigem] = useState("");
  const [endereco, setEndereco] = useState("");
  const [infoDirty, setInfoDirty] = useState(false);

  const [notes, setNotes] = useState<Note[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [proposals, setProposals] = useState<Prop[]>([]);

  const [noteText, setNoteText] = useState("");
  const [noteTipo, setNoteTipo] = useState("nota");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");

  const load = useCallback(async () => {
    if (!user || !clientId) return;
    const [cli, nts, tks, props] = await Promise.all([
      supabase.from("business_clients").select("info,origem,endereco").eq("id", clientId).maybeSingle(),
      supabase.from("business_client_notes" as any).select("*").eq("client_id", clientId).order("created_at", { ascending: false }).limit(500),
      supabase.from("business_client_tasks" as any).select("*").eq("client_id", clientId).order("done").order("due_date", { nullsFirst: false }).limit(500),
      supabase.from("business_proposals" as any).select("id,titulo,status,token,created_at").eq("client_id", clientId).order("created_at", { ascending: false }).limit(200),
    ]);
    const c = cli.data as any;
    if (c) { setInfo(c.info || ""); setOrigem(c.origem || ""); setEndereco(c.endereco || ""); }
    setNotes(((nts.data as unknown) as Note[]) || []);
    setTasks(((tks.data as unknown) as Task[]) || []);
    setProposals(((props.data as unknown) as Prop[]) || []);
    setInfoDirty(false);
  }, [user, clientId]);

  useEffect(() => { load(); }, [load]);

  const saveInfo = async () => {
    await supabase.from("business_clients").update({ info: info || null, origem: origem || null, endereco: endereco || null } as any).eq("id", clientId);
    setInfoDirty(false);
    toast({ title: "Informações salvas" });
  };

  const addNote = async () => {
    if (!noteText.trim() || !user) return;
    const { data } = await supabase.from("business_client_notes" as any).insert({
      user_id: user.id, company_id: companyId, client_id: clientId, content: noteText.trim(), tipo: noteTipo,
    } as any).select().single();
    if (data) setNotes(prev => [(data as unknown) as Note, ...prev]);
    setNoteText("");
  };
  const togglePin = async (n: Note) => {
    setNotes(prev => prev.map(x => x.id === n.id ? { ...x, pinned: !x.pinned } : x));
    await supabase.from("business_client_notes" as any).update({ pinned: !n.pinned } as any).eq("id", n.id);
  };
  const delNote = async (id: string) => {
    setNotes(prev => prev.filter(x => x.id !== id));
    await supabase.from("business_client_notes" as any).delete().eq("id", id);
  };

  const addTask = async () => {
    if (!taskTitle.trim() || !user) return;
    const { data } = await supabase.from("business_client_tasks" as any).insert({
      user_id: user.id, company_id: companyId, client_id: clientId, title: taskTitle.trim(), due_date: taskDue || null,
    } as any).select().single();
    if (data) setTasks(prev => [...prev, (data as unknown) as Task]);
    setTaskTitle(""); setTaskDue("");
  };
  const toggleTask = async (t: Task) => {
    const done = !t.done;
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, done } : x).sort((a, b) => Number(a.done) - Number(b.done)));
    await supabase.from("business_client_tasks" as any).update({ done, completed_at: done ? new Date().toISOString() : null } as any).eq("id", t.id);
  };
  const delTask = async (id: string) => {
    setTasks(prev => prev.filter(x => x.id !== id));
    await supabase.from("business_client_tasks" as any).delete().eq("id", id);
  };

  const sortedNotes = [...notes].sort((a, b) => Number(b.pinned) - Number(a.pinned) || (a.created_at < b.created_at ? 1 : -1));
  const fmtDate = (s: string) => new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const fmtDateTime = (s: string) => new Date(s).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const overdue = (d: string | null) => d && d < new Date().toISOString().slice(0, 10);

  const copyProp = (token: string) => { navigator.clipboard?.writeText(`${window.location.origin}/proposta/${token}`); toast({ title: "Link copiado" }); };
  const propBadge = (s: string) => s === "entregue" ? "bg-success/15 text-success border-success/30" : s === "aceita" ? "bg-amber-500/15 text-amber-600 border-amber-500/30" : s === "recusada" ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-muted text-muted-foreground border-border";

  return (
    <div className="space-y-4">
      {/* Propostas do cliente */}
      {proposals.length > 0 && (
        <Card className="shadow-soft">
          <CardContent className="p-4 space-y-2">
            <p className="text-sm font-heading font-bold flex items-center gap-1.5"><FileSignature className="h-4 w-4 text-primary" />Propostas</p>
            {proposals.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-sm border-b border-border/40 pb-1.5 last:border-0">
                <button onClick={() => navigate("/dashboard/negocios/propostas")} className="min-w-0 flex-1 text-left group" aria-label="Abrir nas propostas">
                  <p className="truncate group-hover:text-primary transition-colors flex items-center gap-1">{p.titulo || "Proposta"}<ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" /></p>
                  <p className="text-[10px] text-muted-foreground">{fmtDate(p.created_at)}</p>
                </button>
                <Badge variant="outline" className={`text-[10px] ${propBadge(p.status)}`}>{PROP_STATUS[p.status] || p.status}</Badge>
                {p.token && <button onClick={() => copyProp(p.token!)} aria-label="Copiar link" className="text-muted-foreground hover:text-primary"><Link2 className="h-4 w-4" /></button>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Informações */}
      <Card className="shadow-soft">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-heading font-bold flex items-center gap-1.5"><FileText className="h-4 w-4 text-primary" />Informações do cliente</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label className="text-xs">Como chegou (origem)</Label><Input value={origem} onChange={e => { setOrigem(e.target.value); setInfoDirty(true); }} placeholder="Indicação, Instagram..." className="h-9 text-sm" /></div>
            <div><Label className="text-xs">Endereço</Label><Input value={endereco} onChange={e => { setEndereco(e.target.value); setInfoDirty(true); }} className="h-9 text-sm" /></div>
          </div>
          <div>
            <Label className="text-xs">Ficha / observações</Label>
            <Textarea value={info} onChange={e => { setInfo(e.target.value); setInfoDirty(true); }} rows={4}
              placeholder="Tudo que você quer lembrar: preferências, histórico, contexto, anotações importantes..." className="text-sm resize-y" />
          </div>
          {infoDirty && <Button size="sm" onClick={saveInfo} className="gap-1.5"><Save className="h-3.5 w-3.5" />Salvar informações</Button>}
        </CardContent>
      </Card>

      {/* Tarefas */}
      <Card className="shadow-soft">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-heading font-bold flex items-center gap-1.5"><ListTodo className="h-4 w-4 text-primary" />Tarefas</p>
          <div className="flex items-center gap-1.5">
            <Input value={taskTitle} onChange={e => setTaskTitle(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addTask(); }} placeholder="Nova tarefa (ex: enviar orçamento)" className="h-9 text-sm flex-1" />
            <Input type="date" value={taskDue} onChange={e => setTaskDue(e.target.value)} className="h-9 text-sm w-36" />
            <Button size="sm" onClick={addTask} className="h-9 flex-shrink-0"><Plus className="h-4 w-4" /></Button>
          </div>
          {tasks.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma tarefa.</p>
          ) : (
            <div className="space-y-1.5">
              {tasks.map(t => (
                <div key={t.id} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={t.done} onCheckedChange={() => toggleTask(t)} />
                  <span className={`flex-1 ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                  {t.due_date && !t.done && (
                    <span className={`text-[11px] flex items-center gap-0.5 ${overdue(t.due_date) ? "text-destructive" : "text-muted-foreground"}`}>
                      <CalendarClock className="h-3 w-3" />{fmtDate(t.due_date)}
                    </span>
                  )}
                  <button onClick={() => delTask(t.id)} aria-label="Excluir" className="text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico / anotações */}
      <Card className="shadow-soft">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-heading font-bold flex items-center gap-1.5"><FileText className="h-4 w-4 text-primary" />Histórico de interações</p>
          <div className="space-y-2">
            <Textarea value={noteText} onChange={e => setNoteText(e.target.value)} rows={2} placeholder="Registre uma conversa, atendimento, observação..." className="text-sm resize-none" />
            <div className="flex items-center gap-2">
              <Select value={noteTipo} onValueChange={setNoteTipo}>
                <SelectTrigger className="h-8 text-xs w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" onClick={addNote} disabled={!noteText.trim()} className="h-8 gap-1 flex-1"><Plus className="h-3.5 w-3.5" />Adicionar</Button>
            </div>
          </div>
          {sortedNotes.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem registros ainda.</p>
          ) : (
            <div className="space-y-2 pt-1">
              {sortedNotes.map(n => (
                <div key={n.id} className={`rounded-lg border p-2.5 text-sm ${n.pinned ? "border-primary/40 bg-primary/5" : "border-border/50"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{TIPO_LABEL[n.tipo] || n.tipo}</span>
                    <span className="text-[10px] text-muted-foreground flex-1">{fmtDateTime(n.created_at)}</span>
                    <button onClick={() => togglePin(n)} aria-label="Fixar" className="text-muted-foreground hover:text-primary">{n.pinned ? <Pin className="h-3.5 w-3.5 fill-current" /> : <PinOff className="h-3.5 w-3.5" />}</button>
                    <button onClick={() => delNote(n.id)} aria-label="Excluir" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                  <p className="whitespace-pre-line text-foreground">{n.content}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
