import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Megaphone, Eye, Send, Trash2, ChevronRight, Mail } from "lucide-react";

type TargetPlan = "all" | "essencial" | "pro" | "elite";

type RecadoRow = {
  id: string;
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  target_plan: string;
  send_email: boolean;
  created_by: string | null;
  created_at: string;
  expires_at: string | null;
};

type RecadoWithStats = RecadoRow & { reads: number; dismissed: number };

const TITLE_MAX = 120;
const BODY_MAX = 500;
const CTA_LABEL_MAX = 40;

const TARGET_LABEL: Record<string, string> = {
  all: "Todos",
  essencial: "Essencial",
  pro: "Pro",
  elite: "Elite",
};

const RecadosAdminPanel = () => {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [ctaUrl, setCtaUrl] = useState("");
  const [targetPlan, setTargetPlan] = useState<TargetPlan>("all");
  const [sendEmail, setSendEmail] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [history, setHistory] = useState<RecadoWithStats[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    const { data: recados } = await (supabase as any)
      .from("admin_recados")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!recados) {
      setHistory([]);
      setHistoryLoading(false);
      return;
    }

    const ids = recados.map((r: RecadoRow) => r.id);
    const { data: reads } = await (supabase as any)
      .from("user_recado_reads")
      .select("recado_id, read_at, dismissed_at")
      .in("recado_id", ids.length > 0 ? ids : ["__none__"]);

    const statsMap = new Map<string, { reads: number; dismissed: number }>();
    (reads ?? []).forEach((r: any) => {
      const cur = statsMap.get(r.recado_id) ?? { reads: 0, dismissed: 0 };
      if (r.read_at) cur.reads += 1;
      if (r.dismissed_at) cur.dismissed += 1;
      statsMap.set(r.recado_id, cur);
    });

    const merged: RecadoWithStats[] = recados.map((r: RecadoRow) => ({
      ...r,
      reads: statsMap.get(r.id)?.reads ?? 0,
      dismissed: statsMap.get(r.id)?.dismissed ?? 0,
    }));

    setHistory(merged);
    setHistoryLoading(false);
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const resetForm = () => {
    setTitle("");
    setBody("");
    setCtaLabel("");
    setCtaUrl("");
    setTargetPlan("all");
    setSendEmail(false);
    setExpiresAt("");
  };

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !sending;

  const handleSend = async () => {
    if (!canSubmit) return;
    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Sessão expirada", variant: "destructive" });
        setSending(false);
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-recado`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            title: title.trim(),
            body: body.trim(),
            cta_label: ctaLabel.trim() || null,
            cta_url: ctaUrl.trim() || null,
            target_plan: targetPlan,
            send_email: sendEmail,
            expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) {
        toast({
          title: "Erro ao enviar recado",
          description: data?.error ?? `Código ${res.status}`,
          variant: "destructive",
        });
        return;
      }

      const pushSent = data.push_sent ?? 0;
      const emailsSent = data.emails_sent ?? 0;
      toast({
        title: "Recado enviado!",
        description: `${pushSent} push${pushSent === 1 ? "" : "es"} · ${emailsSent} email${emailsSent === 1 ? "" : "s"}`,
      });
      resetForm();
      loadHistory();
    } catch (e: any) {
      toast({
        title: "Erro ao enviar recado",
        description: e?.message ?? "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Apagar este recado? Ele deixará de aparecer para os usuários.")) return;
    const { error } = await (supabase as any).from("admin_recados").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao apagar", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Recado apagado" });
    loadHistory();
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <Megaphone className="h-4 w-4" /> Novo recado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-1.5">
            <Label htmlFor="recado-title">Título</Label>
            <Input
              id="recado-title"
              maxLength={TITLE_MAX}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ex.: Nova funcionalidade disponível"
            />
            <p className="text-[10px] text-muted-foreground text-right">{title.length}/{TITLE_MAX}</p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="recado-body">Corpo</Label>
            <Textarea
              id="recado-body"
              maxLength={BODY_MAX}
              value={body}
              onChange={e => setBody(e.target.value)}
              rows={4}
              placeholder="Escreva a mensagem que os usuários verão no sino de notificações."
            />
            <p className="text-[10px] text-muted-foreground text-right">{body.length}/{BODY_MAX}</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="recado-cta-label">Texto do botão (opcional)</Label>
              <Input
                id="recado-cta-label"
                maxLength={CTA_LABEL_MAX}
                value={ctaLabel}
                onChange={e => setCtaLabel(e.target.value)}
                placeholder="Ex.: Conferir agora"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="recado-cta-url">Link do botão (opcional)</Label>
              <Input
                id="recado-cta-url"
                value={ctaUrl}
                onChange={e => setCtaUrl(e.target.value)}
                placeholder="/dashboard/planos ou https://…"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Segmentação</Label>
              <Select value={targetPlan} onValueChange={v => setTargetPlan(v as TargetPlan)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="essencial">Essencial</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="elite">Elite</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="recado-expires">Expira em (opcional)</Label>
              <Input
                id="recado-expires"
                type="date"
                value={expiresAt}
                onChange={e => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Enviar também por e-mail</p>
                <p className="text-xs text-muted-foreground">Dispara e-mail para os usuários da segmentação.</p>
              </div>
            </div>
            <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2">
            <Button variant="outline" onClick={() => setPreviewOpen(true)} disabled={!title.trim() && !body.trim()} className="rounded-xl gap-2">
              <Eye className="h-4 w-4" /> Pré-visualizar
            </Button>
            <Button onClick={handleSend} disabled={!canSubmit} className="rounded-xl gap-2">
              <Send className="h-4 w-4" /> {sending ? "Enviando…" : "Enviar agora"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-base">Recados enviados</CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum recado enviado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="text-left font-heading font-semibold py-2 pr-3 text-xs">Data</th>
                    <th className="text-left font-heading font-semibold py-2 pr-3 text-xs">Título</th>
                    <th className="text-left font-heading font-semibold py-2 pr-3 text-xs">Segmentação</th>
                    <th className="text-right font-heading font-semibold py-2 pr-3 text-xs">Lidos</th>
                    <th className="text-right font-heading font-semibold py-2 pr-3 text-xs">Dispensados</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {history.map(r => (
                    <tr key={r.id} className="border-b border-border/30 hover:bg-muted/20">
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground">
                        {new Date(r.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="font-medium">{r.title}</span>
                        {r.send_email && <Badge variant="outline" className="ml-2 text-[10px]">E-mail</Badge>}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="secondary" className="text-[10px]">
                          {TARGET_LABEL[r.target_plan] ?? r.target_plan}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{r.reads}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{r.dismissed}</td>
                      <td className="py-2.5 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(r.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Pré-visualização</DialogTitle>
          </DialogHeader>
          <div className="rounded-xl border border-border/30 bg-card/80 p-3">
            <div className="flex items-start gap-2.5">
              <span className="text-base mt-0.5"><Megaphone className="h-4 w-4 text-primary" /></span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-heading font-semibold text-foreground/90">
                    {title.trim() || "Título do recado"}
                  </p>
                  <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed whitespace-pre-wrap">
                  {body.trim() || "Corpo do recado que os usuários verão no sino de notificações."}
                </p>
                {ctaLabel.trim() && (
                  <button className="flex items-center gap-1 text-[11px] text-primary font-medium mt-1.5 hover:underline">
                    {ctaLabel.trim()}
                    <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            Segmentação: {TARGET_LABEL[targetPlan]}
            {sendEmail && " · também por e-mail"}
            {expiresAt && ` · expira em ${new Date(expiresAt).toLocaleDateString("pt-BR")}`}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecadosAdminPanel;
