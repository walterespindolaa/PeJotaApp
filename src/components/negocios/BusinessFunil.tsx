import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GripVertical, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, Target, CheckCircle2, Circle, FileText } from "lucide-react";
import { useBusinessLeads, type BusinessLead } from "@/hooks/useBusinessLeads";
import { useBusinessLeadTasks } from "@/hooks/useBusinessLeadTasks";
import { useBusinessInventory } from "@/hooks/useBusinessInventory";
import { MoneyInput, parseBRL } from "@/components/ui/money-input";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { useToast } from "@/hooks/use-toast";

const ORIGENS = ["Indicação", "Instagram", "WhatsApp", "Anúncio (Meta/Google)", "Site/Google", "Evento", "Outro"];

function maskTelefone(v: string): string {
  if (/[a-zA-Z@]/.test(v)) return v; // e-mail ou texto livre: não formata
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const STAGES = [
  { key: "lead", label: "Lead" },
  { key: "contato", label: "Contato" },
  { key: "proposta", label: "Proposta" },
  { key: "negociacao", label: "Negociação" },
  { key: "ganho", label: "Ganho" },
  { key: "perdido", label: "Perdido" },
] as const;
const STAGE_KEYS = STAGES.map(s => s.key) as string[];

const emptyForm = { nome: "", contato: "", valor_proposta: "", produto: "", origem: "", estagio: "lead", proximo_passo: "", data_proximo_passo: "", notas: "" };

export default function BusinessFunil({ companyId }: { companyId: string }) {
  const { leads, loading, addLead, updateLead, moveLead, deleteLead } = useBusinessLeads(companyId);
  const { tasks, addTask, toggleTask, deleteTask } = useBusinessLeadTasks(companyId);
  const [newTask, setNewTask] = useState({ titulo: "", data: "" });
  const { items: invItems } = useBusinessInventory(companyId);
  const produtos = invItems.filter(i => i.tipo === "produto");
  const { fmt } = usePrivacyFmt();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  // ── Drag & drop por alça (pointer events: toque + mouse) ──
  const colRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const dragLead = useRef<BusinessLead | null>(null);
  const overRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number; nome: string } | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);

  const hitTest = (x: number, y: number): string | null => {
    for (const k of STAGE_KEYS) {
      const el = colRefs.current[k];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return k;
    }
    return null;
  };
  const onHandleDown = (e: React.PointerEvent, lead: BusinessLead) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    dragLead.current = lead;
    setDraggingId(lead.id);
    setGhost({ x: e.clientX, y: e.clientY, nome: lead.nome });
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!dragLead.current) return;
    setGhost({ x: e.clientX, y: e.clientY, nome: dragLead.current.nome });
    const found = hitTest(e.clientX, e.clientY);
    overRef.current = found;
    setOverStage(found);
  };
  const onHandleUp = () => {
    const lead = dragLead.current;
    if (lead && overRef.current && overRef.current !== lead.estagio) {
      moveLead(lead.id, overRef.current);
    }
    dragLead.current = null;
    setDraggingId(null);
    setGhost(null);
    setOverStage(null);
    overRef.current = null;
  };

  const moveByArrow = (lead: BusinessLead, dir: -1 | 1) => {
    const i = STAGE_KEYS.indexOf(lead.estagio);
    const next = STAGE_KEYS[i + dir];
    if (next) moveLead(lead.id, next);
  };

  const openNew = () => { setEditingId(null); setForm(emptyForm); setOpen(true); };
  const openEdit = (l: BusinessLead) => {
    setEditingId(l.id);
    setForm({
      nome: l.nome, contato: l.contato || "", valor_proposta: String(l.valor_proposta || ""),
      produto: l.produto || "", origem: l.origem || "", estagio: l.estagio,
      proximo_passo: l.proximo_passo || "", data_proximo_passo: l.data_proximo_passo || "", notas: l.notas || "",
    });
    setOpen(true);
  };
  const save = async () => {
    if (!form.nome.trim()) { toast({ title: "Informe o nome do lead", variant: "destructive" }); return; }
    const payload = {
      nome: form.nome.trim(), contato: form.contato || null,
      valor_proposta: parseBRL(form.valor_proposta) || 0, produto: form.produto || null,
      origem: form.origem || null, estagio: form.estagio,
      proximo_passo: form.proximo_passo || null, data_proximo_passo: form.data_proximo_passo || null,
      notas: form.notas || null,
    };
    if (editingId) await updateLead(editingId, payload);
    else await addLead(payload);
    setOpen(false);
    toast({ title: editingId ? "Lead atualizado" : "Lead adicionado" });
  };

  const emNegociacao = leads
    .filter(l => l.estagio === "proposta" || l.estagio === "negociacao")
    .reduce((s, l) => s + Number(l.valor_proposta || 0), 0);

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Em negociação</p>
            <p className="text-lg font-heading font-bold text-primary">{fmt(emNegociacao)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Leads ativos</p>
            <p className="text-lg font-heading font-bold">{leads.filter(l => l.estagio !== "ganho" && l.estagio !== "perdido").length}</p>
          </div>
        </div>
        <Button size="sm" className="rounded-xl gap-2" onClick={openNew}><Plus className="h-4 w-4" /> Novo lead</Button>
      </div>

      <p className="text-[11px] text-muted-foreground">Arraste pela alça <GripVertical className="inline h-3 w-3" /> para mover entre etapas, ou use as setas. Funciona no toque e no mouse.</p>

      {/* Quadro */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Carregando…</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {STAGES.map(stage => {
            const items = leads.filter(l => l.estagio === stage.key);
            const total = items.reduce((s, l) => s + Number(l.valor_proposta || 0), 0);
            const isOver = overStage === stage.key;
            return (
              <div
                key={stage.key}
                ref={el => (colRefs.current[stage.key] = el)}
                className={`flex-shrink-0 w-[240px] rounded-2xl border p-2 transition-colors ${isOver ? "border-primary bg-primary/5" : "border-border/60 bg-muted/20"}`}
              >
                <div className="flex items-center justify-between px-1 py-1.5">
                  <span className="text-xs font-heading font-bold">{stage.label}</span>
                  <span className="text-[10px] text-muted-foreground">{items.length} · {fmt(total)}</span>
                </div>
                <div className="space-y-2 min-h-[55vh]">
                  {items.map(l => {
                    const i = STAGE_KEYS.indexOf(l.estagio);
                    return (
                      <Card key={l.id} className={`transition-all duration-150 ${draggingId === l.id ? "opacity-50 border-2 border-dashed border-primary/40 bg-primary/5 shadow-none scale-[0.98]" : "shadow-none border-border/60 hover:shadow-soft hover:-translate-y-0.5"}`}>
                        <CardContent className="p-2.5">
                          <div className="flex items-start gap-1.5">
                            <button
                              type="button"
                              onPointerDown={e => onHandleDown(e, l)}
                              onPointerMove={onHandleMove}
                              onPointerUp={onHandleUp}
                              className="flex-shrink-0 mt-0.5 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
                              aria-label="Arrastar"
                            >
                              <GripVertical className="h-4 w-4" />
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{l.nome}</p>
                              {Number(l.valor_proposta) > 0 && <p className="text-xs font-heading font-bold text-primary">{fmt(Number(l.valor_proposta))}</p>}
                              {l.produto && <p className="text-[10px] text-muted-foreground truncate">{l.produto}</p>}
                              {l.proximo_passo && <p className="text-[10px] text-muted-foreground truncate mt-0.5">→ {l.proximo_passo}{l.data_proximo_passo ? ` (${l.data_proximo_passo.split("-").reverse().join("/")})` : ""}</p>}
                              {(() => {
                                const n = tasks.filter(t => t.lead_id === l.id && !t.concluida).length;
                                return n > 0 ? (
                                  <p className="text-[10px] text-primary font-medium mt-0.5 flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3" />{n} tarefa{n > 1 ? "s" : ""} pendente{n > 1 ? "s" : ""}
                                  </p>
                                ) : null;
                              })()}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <div className="flex items-center gap-0.5">
                              <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i <= 0} onClick={() => moveByArrow(l, -1)} aria-label="Etapa anterior"><ChevronLeft className="h-3.5 w-3.5" /></Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" disabled={i >= STAGE_KEYS.length - 1} onClick={() => moveByArrow(l, 1)} aria-label="Próxima etapa"><ChevronRight className="h-3.5 w-3.5" /></Button>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-primary" onClick={() => navigate(`/dashboard/negocios/propostas?lead=${l.id}`)} aria-label="Gerar proposta" title="Gerar proposta"><FileText className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(l)} aria-label="Editar"><Pencil className="h-3 w-3" /></Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteLead(l.id)} aria-label="Excluir"><Trash2 className="h-3 w-3" /></Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {items.length === 0 && <p className="text-[10px] text-muted-foreground/60 text-center py-3">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && leads.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center">
            <Target className="h-7 w-7 mx-auto text-primary mb-2" />
            <p className="text-sm font-medium">Seu funil está vazio</p>
            <p className="text-xs text-muted-foreground mt-1 mb-3">Cadastre seus contatos e propostas para acompanhar quem está perto de fechar.</p>
            <Button size="sm" className="rounded-xl gap-2" onClick={openNew}><Plus className="h-4 w-4" /> Adicionar primeiro lead</Button>
          </CardContent>
        </Card>
      )}

      {/* Tarefas pendentes por cliente */}
      {(() => {
        const hoje = new Date().toISOString().split("T")[0];
        const ativos = leads.filter(l => l.estagio !== "ganho" && l.estagio !== "perdido");
        const comTarefa = ativos.filter(l => tasks.some(t => t.lead_id === l.id && !t.concluida));
        if (comTarefa.length === 0) return null;
        const urg = (l: BusinessLead) => tasks
          .filter(t => t.lead_id === l.id && !t.concluida)
          .reduce((min, t) => (t.data_prevista && t.data_prevista < min ? t.data_prevista : min), "9999-99-99");
        const ordenados = [...comTarefa].sort((a, b) => urg(a).localeCompare(urg(b)));
        return (
          <Card>
            <CardContent className="p-4">
              <p className="text-xs font-heading font-bold mb-3 flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-primary" />Tarefas pendentes por cliente</p>
              <div className="space-y-3">
                {ordenados.map(l => {
                  const lt = tasks
                    .filter(t => t.lead_id === l.id && !t.concluida)
                    .sort((a, b) => (a.data_prevista || "9999").localeCompare(b.data_prevista || "9999"));
                  return (
                    <div key={l.id}>
                      <button onClick={() => openEdit(l)} className="text-[11px] font-semibold text-foreground hover:text-primary transition-colors">{l.nome}</button>
                      <div className="space-y-1 mt-1">
                        {lt.map(t => {
                          const atrasada = !!t.data_prevista && t.data_prevista < hoje;
                          return (
                            <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border/50 px-2.5 py-1.5">
                              <button onClick={() => toggleTask(t.id, true)} aria-label="Concluir tarefa" className="text-muted-foreground hover:text-success flex-shrink-0">
                                <Circle className="h-3.5 w-3.5" />
                              </button>
                              <span className="flex-1 text-xs truncate">{t.titulo}</span>
                              {t.data_prevista && (
                                <span className={`text-[10px] font-medium flex-shrink-0 ${atrasada ? "text-destructive" : "text-muted-foreground"}`}>
                                  {t.data_prevista.split("-").reverse().join("/")}{atrasada ? " · atrasada" : ""}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Card "levantado" seguindo o dedo (estilo Trello: solto do board, inclinado) */}
      {ghost && dragLead.current && (
        <div
          className="fixed z-[80] pointer-events-none w-[216px] will-change-transform"
          style={{ left: ghost.x, top: ghost.y, transform: "translate(-50%, -50%) rotate(3.5deg) scale(1.04)" }}
        >
          <div className="rounded-xl border border-primary/40 bg-card p-2.5 shadow-elevated ring-2 ring-primary/15">
            <p className="text-sm font-medium truncate">{dragLead.current.nome}</p>
            {Number(dragLead.current.valor_proposta) > 0 && <p className="text-xs font-heading font-bold text-primary">{fmt(Number(dragLead.current.valor_proposta))}</p>}
            {dragLead.current.produto && <p className="text-[10px] text-muted-foreground truncate">{dragLead.current.produto}</p>}
          </div>
        </div>
      )}

      {/* Dialog de lead */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">{editingId ? "Editar lead" : "Novo lead"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: Maria / Empresa X" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Contato</Label><Input value={form.contato} onChange={e => setForm(f => ({ ...f, contato: maskTelefone(e.target.value) }))} placeholder="(11) 99999-9999 ou e-mail" /></div>
              <div><Label className="text-xs">Valor da proposta</Label><MoneyInput value={form.valor_proposta} onChange={v => setForm(f => ({ ...f, valor_proposta: v }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Produto / serviço</Label>
                {produtos.length > 0 ? (
                  <Select value={form.produto} onValueChange={v => setForm(f => ({ ...f, produto: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {produtos.map(p => <SelectItem key={p.id} value={p.nome}>{p.nome} (estoque: {p.saldo})</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={form.produto} onChange={e => setForm(f => ({ ...f, produto: e.target.value }))} placeholder="Cadastre no Estoque p/ listar" />
                )}
              </div>
              <div>
                <Label className="text-xs">Origem</Label>
                <Select value={form.origem} onValueChange={v => setForm(f => ({ ...f, origem: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {ORIGENS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs">Etapa</Label>
              <Select value={form.estagio} onValueChange={v => setForm(f => ({ ...f, estagio: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Próximo passo</Label><Input value={form.proximo_passo} onChange={e => setForm(f => ({ ...f, proximo_passo: e.target.value }))} placeholder="Ligar, enviar proposta…" /></div>
              <div><Label className="text-xs">Quando</Label><Input type="date" value={form.data_proximo_passo} onChange={e => setForm(f => ({ ...f, data_proximo_passo: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs">Notas</Label><Textarea rows={2} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} className="resize-none" /></div>

            {editingId && (
              <div className="border-t pt-3">
                <Label className="text-xs flex items-center gap-1.5 mb-2"><CheckCircle2 className="h-3.5 w-3.5 text-primary" />Tarefas deste cliente</Label>
                <div className="space-y-1.5 mb-2">
                  {tasks.filter(t => t.lead_id === editingId).length === 0 && (
                    <p className="text-[11px] text-muted-foreground">Nenhuma tarefa ainda. Adicione abaixo.</p>
                  )}
                  {tasks.filter(t => t.lead_id === editingId)
                    .sort((a, b) => Number(a.concluida) - Number(b.concluida) || (a.data_prevista || "9999").localeCompare(b.data_prevista || "9999"))
                    .map(t => (
                      <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border/50 px-2.5 py-1.5">
                        <button onClick={() => toggleTask(t.id, !t.concluida)} aria-label="Concluir tarefa" className="flex-shrink-0">
                          {t.concluida ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                        </button>
                        <span className={`flex-1 text-xs truncate ${t.concluida ? "line-through text-muted-foreground" : ""}`}>{t.titulo}</span>
                        {t.data_prevista && <span className="text-[10px] text-muted-foreground flex-shrink-0">{t.data_prevista.split("-").reverse().join("/")}</span>}
                        <button onClick={() => deleteTask(t.id)} aria-label="Excluir tarefa" className="text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={newTask.titulo}
                    onChange={e => setNewTask(s => ({ ...s, titulo: e.target.value }))}
                    placeholder="Nova tarefa…"
                    className="h-8 text-xs"
                    onKeyDown={e => { if (e.key === "Enter" && newTask.titulo.trim()) { addTask(editingId, newTask.titulo, newTask.data || null); setNewTask({ titulo: "", data: "" }); } }}
                  />
                  <Input type="date" value={newTask.data} onChange={e => setNewTask(s => ({ ...s, data: e.target.value }))} className="h-8 text-xs w-[130px]" aria-label="Data da tarefa" />
                  <Button size="sm" variant="outline" className="h-8 px-2" disabled={!newTask.titulo.trim()} aria-label="Adicionar tarefa"
                    onClick={() => { addTask(editingId, newTask.titulo, newTask.data || null); setNewTask({ titulo: "", data: "" }); }}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            <Button onClick={save} className="w-full rounded-xl">{editingId ? "Salvar" : "Adicionar lead"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
