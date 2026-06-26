import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ResponsiveEditDialog from "@/components/ui/responsive-edit-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Inbox, MessageSquareText, AlertTriangle, CheckCircle2, Mail, ChevronLeft, ChevronRight, RefreshCw, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type Feedback = {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  user_plan: string | null;
  category: string;
  urgency: string;
  title: string;
  description: string;
  page_url: string | null;
  user_agent: string | null;
  status: string;
  admin_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
  attachments?: string[] | null;
};

function FeedbackAttachmentPreview({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.storage
        .from("feedback-attachments")
        .createSignedUrl(path, 60 * 60);
      if (alive) setUrl(data?.signedUrl ?? null);
    })();
    return () => { alive = false; };
  }, [path]);

  if (!url) {
    return (
      <div className="aspect-square rounded-md bg-muted flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block aspect-square rounded-md overflow-hidden border border-border"
    >
      <img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
    </a>
  );
}

const STATUS_OPTIONS = [
  { value: "novo", label: "Novo" },
  { value: "em_analise", label: "Em análise" },
  { value: "em_desenvolvimento", label: "Em desenvolvimento" },
  { value: "resolvido", label: "Resolvido" },
  { value: "descartado", label: "Descartado" },
];

const CATEGORY_OPTIONS = [
  { value: "bug", label: "Bug" },
  { value: "melhoria", label: "Melhoria" },
  { value: "ideia", label: "Ideia" },
  { value: "elogio", label: "Elogio" },
  { value: "cobrança", label: "Cobrança" },
  { value: "outro", label: "Outro" },
];

const URGENCY_OPTIONS = [
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "urgente", label: "Urgente" },
];

const categoryBadge = (cat: string): string => {
  switch (cat) {
    case "bug": return "bg-destructive/15 text-destructive border-destructive/30";
    case "melhoria": return "bg-primary/15 text-primary border-primary/30";
    case "ideia": return "bg-accent/15 text-accent-foreground border-accent/30";
    case "elogio": return "bg-success/15 text-success border-success/30";
    case "cobrança": return "bg-destructive/15 text-destructive border-destructive/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const urgencyBadge = (u: string): string => {
  switch (u) {
    case "urgente": return "bg-destructive text-destructive-foreground animate-pulse";
    case "normal": return "bg-secondary text-secondary-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};

const statusBadge = (s: string): string => {
  switch (s) {
    case "novo": return "bg-primary/15 text-primary border-primary/30";
    case "em_analise": return "bg-secondary text-secondary-foreground";
    case "em_desenvolvimento": return "bg-warning/15 text-warning border-warning/30";
    case "resolvido": return "bg-success/15 text-success border-success/30";
    case "descartado": return "bg-muted text-muted-foreground";
    default: return "bg-muted text-muted-foreground";
  }
};

const PAGE_SIZE = 25;

const FeedbackAdminPanel = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("abertos");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [urgencyFilter, setUrgencyFilter] = useState<string>("todas");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Feedback | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [sheetStatus, setSheetStatus] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(0); }, [statusFilter, categoryFilter, urgencyFilter, debouncedSearch, sortDesc]);

  const fetchFeedbacks = async () => {
    setLoading(true);
    let q: any = (supabase as any).from("user_feedback").select("*");

    if (statusFilter === "abertos") {
      q = q.not("status", "in", "(resolvido,descartado)");
    } else if (statusFilter !== "todos") {
      q = q.eq("status", statusFilter);
    }
    if (categoryFilter !== "todas") q = q.eq("category", categoryFilter);
    if (urgencyFilter !== "todas") q = q.eq("urgency", urgencyFilter);

    q = q.order("created_at", { ascending: !sortDesc });

    const { data, error } = await q;
    if (error) {
      toast({ title: "Erro ao carregar feedbacks", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    setItems((data as Feedback[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchFeedbacks(); }, [statusFilter, categoryFilter, urgencyFilter, sortDesc]);

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return items;
    const needle = debouncedSearch.toLowerCase();
    return items.filter(f =>
      f.title.toLowerCase().includes(needle) ||
      f.description.toLowerCase().includes(needle)
    );
  }, [items, debouncedSearch]);

  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page],
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const kpis = useMemo(() => {
    const naoLidos = items.filter(f => f.status === "novo").length;
    const urgentesAbertos = items.filter(
      f => f.urgency === "urgente" && f.status !== "resolvido" && f.status !== "descartado",
    ).length;
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const resolvidos30d = items.filter(
      f => f.status === "resolvido" && f.resolved_at && new Date(f.resolved_at).getTime() >= thirtyDaysAgo,
    ).length;
    return { naoLidos, urgentesAbertos, resolvidos30d };
  }, [items]);

  const openDetails = (fb: Feedback) => {
    setSelected(fb);
    setAdminNotes(fb.admin_notes ?? "");
    setSheetStatus(fb.status);
  };

  const closeDetails = () => {
    setSelected(null);
    setAdminNotes("");
    setSheetStatus("");
  };

  const inlineStatusChange = async (fb: Feedback, newStatus: string) => {
    const prev = fb.status;
    setItems(list => list.map(x => x.id === fb.id ? { ...x, status: newStatus } : x));
    const updates: Record<string, any> = { status: newStatus };
    if (newStatus === "resolvido") {
      updates.resolved_at = new Date().toISOString();
      updates.resolved_by = user?.id ?? null;
    }
    const { error } = await (supabase as any).from("user_feedback").update(updates).eq("id", fb.id);
    if (error) {
      setItems(list => list.map(x => x.id === fb.id ? { ...x, status: prev } : x));
      toast({ title: "Erro ao atualizar status", description: error.message, variant: "destructive" });
    }
  };

  const saveDetails = async () => {
    if (!selected) return;
    setSaving(true);
    const updates: Record<string, any> = {
      status: sheetStatus,
      admin_notes: adminNotes,
    };
    if (sheetStatus === "resolvido" && selected.status !== "resolvido") {
      updates.resolved_at = new Date().toISOString();
      updates.resolved_by = user?.id ?? null;
    }
    const { error } = await (supabase as any).from("user_feedback").update(updates).eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setItems(list => list.map(x => x.id === selected.id ? { ...x, ...updates } as Feedback : x));
    toast({ title: "Feedback atualizado" });
    closeDetails();
  };

  const statusLabel = (s: string) => STATUS_OPTIONS.find(x => x.value === s)?.label || s;

  const mailtoHref = selected
    ? `mailto:${selected.user_email ?? ""}?subject=${encodeURIComponent(`Re: ${selected.title}`)}&body=${encodeURIComponent(
        `Olá${selected.user_name ? `, ${selected.user_name}` : ""},\n\nRecebemos seu feedback "${selected.title}" e estamos retornando.\n\n`,
      )}`
    : "#";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="shadow-soft">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10"><Inbox className="h-4 w-4 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Não lidos</p>
              <p className="text-lg font-heading font-bold">{kpis.naoLidos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10"><AlertTriangle className="h-4 w-4 text-destructive" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Urgentes em aberto</p>
              <p className="text-lg font-heading font-bold text-destructive">{kpis.urgentesAbertos}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10"><CheckCircle2 className="h-4 w-4 text-success" /></div>
            <div>
              <p className="text-xs text-muted-foreground">Resolvidos (30d)</p>
              <p className="text-lg font-heading font-bold text-success">{kpis.resolvidos30d}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <MessageSquareText className="h-4 w-4" /> Feedbacks
            </CardTitle>
            <Button variant="outline" size="sm" onClick={fetchFeedbacks} className="gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Atualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="abertos">Em aberto</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
                {STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas categorias</SelectItem>
                {CATEGORY_OPTIONS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas urgências</SelectItem>
                {URGENCY_OPTIONS.map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input
              placeholder="Buscar no título ou descrição..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <Inbox className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum feedback encontrado com esses filtros.</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => setSortDesc(d => !d)}
                      >
                        Data {sortDesc ? "↓" : "↑"}
                      </TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Urgência</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paged.map(fb => (
                      <TableRow
                        key={fb.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => openDetails(fb)}
                      >
                        <TableCell className="whitespace-nowrap text-xs">
                          {new Date(fb.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                          <br />
                          <span className="text-muted-foreground">
                            {new Date(fb.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </TableCell>
                        <TableCell className="max-w-[180px] truncate text-xs">
                          <span className="font-medium">{fb.user_name ?? "—"}</span>
                          <br />
                          <span className="text-muted-foreground">{fb.user_email ?? "—"}</span>
                        </TableCell>
                        <TableCell className="text-xs">{fb.user_plan ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={categoryBadge(fb.category)}>{fb.category}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={urgencyBadge(fb.urgency)}>{fb.urgency}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[260px] truncate">{fb.title}</TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Select value={fb.status} onValueChange={v => inlineStatusChange(fb, v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <Badge variant="outline" className={statusBadge(fb.status)}>
                                {statusLabel(fb.status)}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map(s => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Página {page + 1} de {totalPages} · {filtered.length} feedback{filtered.length === 1 ? "" : "s"}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <ResponsiveEditDialog
        open={!!selected}
        onOpenChange={(v) => { if (!v) closeDetails(); }}
        title={selected?.title ?? ""}
        footer={
          selected ? (
            <>
              <Button variant="ghost" size="sm" onClick={closeDetails}>Fechar</Button>
              <div className="flex flex-wrap gap-2 ml-auto">
                {selected.user_email && (
                  <a href={mailtoHref}>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Mail className="h-3.5 w-3.5" /> Responder por email
                    </Button>
                  </a>
                )}
                <Button onClick={saveDetails} disabled={saving} size="sm">
                  {saving ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </>
          ) : null
        }
      >
        {selected && (
          <>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={categoryBadge(selected.category)}>{selected.category}</Badge>
              <Badge className={urgencyBadge(selected.urgency)}>{selected.urgency}</Badge>
            </div>

            <div className="space-y-1 text-xs">
              <p><span className="text-muted-foreground">Usuário:</span> <span className="font-medium">{selected.user_name ?? "—"}</span></p>
              <p><span className="text-muted-foreground">Email:</span> {selected.user_email ?? "—"}</p>
              <p><span className="text-muted-foreground">Plano:</span> {selected.user_plan ?? "—"}</p>
              <p><span className="text-muted-foreground">Página:</span> {selected.page_url ?? "—"}</p>
              <p><span className="text-muted-foreground">Recebido:</span> {new Date(selected.created_at).toLocaleString("pt-BR")}</p>
            </div>

            <div>
              <Label className="text-xs">Descrição</Label>
              <div className="mt-1 p-3 rounded-lg bg-muted/40 text-sm whitespace-pre-wrap">
                {selected.description}
              </div>
            </div>

            {selected.attachments && selected.attachments.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs font-semibold">
                  Anexos ({selected.attachments.length})
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  {selected.attachments.map((path) => (
                    <FeedbackAttachmentPreview key={path} path={path} />
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">Status</Label>
              <Select value={sheetStatus} onValueChange={setSheetStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Notas internas</Label>
              <Textarea
                value={adminNotes}
                onChange={e => setAdminNotes(e.target.value)}
                rows={5}
                placeholder="Notas do admin (não visíveis ao usuário)"
              />
            </div>
          </>
        )}
      </ResponsiveEditDialog>
    </div>
  );
};

export default FeedbackAdminPanel;
