import { useState, useEffect, lazy, Suspense } from "react";
const NotificationSettings = lazy(() => import("@/components/NotificationSettings"));
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { User, KeyRound, Sparkles, ExternalLink, Globe, Coins, Bell, MessageSquareText, Apple, Smartphone, Trash2, AlertTriangle, Download } from "lucide-react";
import { usePlan } from "@/hooks/usePlan";
import { useUserRole } from "@/hooks/useUserRole";
import { STRIPE_ELITE_URL } from "@/lib/checkout";
import { useI18n } from "@/contexts/I18nContext";
import FeedbackDialog from "@/components/feedback/FeedbackDialog";
import type { SupportedCurrency, SupportedLanguage } from "@/lib/formatMoney";

const LANGUAGE_OPTIONS: { value: SupportedLanguage; label: string }[] = [
  { value: "pt-BR", label: "Português" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

const CURRENCY_OPTIONS: { value: SupportedCurrency; label: string }[] = [
  { value: "BRL", label: "Real (BRL - R$)" },
  { value: "USD", label: "Dollar (USD - $)" },
  { value: "EUR", label: "Euro (EUR - €)" },
  { value: "GBP", label: "Pound (GBP - £)" },
];

const Perfil = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isFull, loading: planLoading } = usePlan();
  const { isAdmin } = useUserRole();
  const { t, language, currency, setLanguage, setCurrency } = useI18n();
  const [loading, setLoading] = useState(false);
  const [resettingPw, setResettingPw] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [exporting, setExporting] = useState(false);

  const handleExportData = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("export-user-data");
      if (error || !data) {
        throw error || new Error("Resposta vazia");
      }
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const today = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `atlas-meus-dados-${today}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Download iniciado", description: "Seus dados foram exportados em JSON." });
    } catch (e: any) {
      toast({ title: "Não foi possível exportar seus dados", description: e?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const { error } = await supabase.functions.invoke("delete-account");
    if (error) {
      toast({ title: "Não foi possível excluir a conta", description: (error as any)?.message || "Tente novamente.", variant: "destructive" });
      setDeleting(false);
      return;
    }
    await supabase.auth.signOut().catch(() => {});
    window.location.href = "/";
  };
  const [profile, setProfile] = useState({
    full_name: "",
    phone: "",
    age: "",
    marital_status: "",
    dependents: "0",
  });
  const [weeklyEmail, setWeeklyEmail] = useState({
    enabled: true,
    day: 0,
    hour: 20,
  });

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile({
            full_name: data.full_name || "",
            phone: data.phone || "",
            age: data.age?.toString() || "",
            marital_status: data.marital_status || "",
            dependents: data.dependents?.toString() || "0",
          });
          setWeeklyEmail({
            enabled: (data as any).weekly_email_enabled ?? true,
            day: (data as any).weekly_email_day ?? 0,
            hour: (data as any).weekly_email_hour ?? 20,
          });
        }
      });
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const updates: Record<string, any> = {
      full_name: profile.full_name,
      phone: profile.phone,
      age: profile.age ? parseInt(profile.age) : null,
      marital_status: profile.marital_status,
      dependents: parseInt(profile.dependents) || 0,
    };

    if (profile.full_name.trim()) {
      updates.nome_pessoa1 = profile.full_name.trim();
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id);

    setLoading(false);
    if (error) {
      toast({ title: t("toast.erro_salvar"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("toast.perfil_atualizado") });
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setResettingPw(true);
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResettingPw(false);
    if (error) {
      toast({ title: t("toast.erro"), description: error.message, variant: "destructive" });
    } else {
      toast({ title: t("toast.link_enviado"), description: t("toast.link_enviado_desc") });
    }
  };

  const handleLanguageChange = async (lang: string) => {
    await setLanguage(lang as SupportedLanguage);
    toast({ title: t("toast.preferencias_atualizadas") });
  };

  const handleCurrencyChange = async (cur: string) => {
    await setCurrency(cur as SupportedCurrency);
    toast({ title: t("toast.preferencias_atualizadas") });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold">{t("perfil.titulo")}</h1>
        <p className="text-muted-foreground mt-1">{t("perfil.subtitulo")}</p>
      </div>

      {/* Upsell Banner */}
      {!planLoading && !isFull && !isAdmin && (
        <Card className="shadow-soft border-primary/20 bg-gradient-to-r from-primary/5 via-background to-accent/5">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-heading font-bold text-lg">{t("upsell.titulo")}</h3>
                <p className="text-sm text-muted-foreground mt-1">{t("upsell.descricao")}</p>
                <p className="text-xs text-muted-foreground/70 mt-2">{t("upsell.nota")}</p>
              </div>
              <div className="flex flex-col gap-2 w-full sm:w-auto">
                <a href={STRIPE_ELITE_URL} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full gap-2" size="sm">
                    <Sparkles className="h-4 w-4" /> {t("upsell.ativar")}
                  </Button>
                </a>
                <a href={STRIPE_ELITE_URL} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="w-full gap-2 text-xs">
                    <ExternalLink className="h-3 w-3" /> {t("upsell.ver_mais")}
                  </Button>
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preferences Card */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="font-heading">{t("perfil.preferencias")}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{t("perfil.preferencias_desc")}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("perfil.idioma")}</Label>
              <Select value={language} onValueChange={handleLanguageChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("perfil.moeda")}</Label>
              <Select value={currency} onValueChange={handleCurrencyChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Email Settings */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="font-heading">Lembrete Semanal</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Receba um check-up financeiro por e-mail</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Receber lembrete por e-mail</Label>
            <Switch checked={weeklyEmail.enabled} onCheckedChange={async (v) => {
              setWeeklyEmail(prev => ({ ...prev, enabled: v }));
              if (user) await supabase.from("profiles").update({ weekly_email_enabled: v } as any).eq("user_id", user.id);
              toast({ title: v ? "Lembrete ativado" : "Lembrete desativado" });
            }} />
          </div>
          {weeklyEmail.enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Dia da semana</Label>
                <Select value={String(weeklyEmail.day)} onValueChange={async (v) => {
                  const day = parseInt(v);
                  setWeeklyEmail(prev => ({ ...prev, day }));
                  if (user) await supabase.from("profiles").update({ weekly_email_day: day } as any).eq("user_id", user.id);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"].map((d, i) => (
                      <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Horário</Label>
                <Select value={String(weeklyEmail.hour)} onValueChange={async (v) => {
                  const hour = parseInt(v);
                  setWeeklyEmail(prev => ({ ...prev, hour }));
                  if (user) await supabase.from("profiles").update({ weekly_email_hour: hour } as any).eq("user_id", user.id);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[8,9,10,12,14,16,18,20,21].map(h => (
                      <SelectItem key={h} value={String(h)}>{`${h}:00`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Push Notifications */}
      <Suspense fallback={<div className="h-40" />}>
        <NotificationSettings />
      </Suspense>

      {/* Personal Data Card */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="font-heading">{t("perfil.dados_pessoais")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("perfil.nome_completo")}</Label>
                <Input value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} />
                <p className="text-[10px] text-muted-foreground">{t("perfil.nome_sync")}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("perfil.telefone")}</Label>
                <Input value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="(11) 99999-9999" />
              </div>
              <div className="space-y-2">
                <Label>{t("perfil.idade")}</Label>
                <Input type="number" value={profile.age} onChange={e => setProfile(p => ({ ...p, age: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>{t("perfil.estado_civil")}</Label>
                <Select value={profile.marital_status} onValueChange={v => setProfile(p => ({ ...p, marital_status: v }))}>
                  <SelectTrigger><SelectValue placeholder={t("perfil.selecione")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solteiro">{t("perfil.solteiro")}</SelectItem>
                    <SelectItem value="casado">{t("perfil.casado")}</SelectItem>
                    <SelectItem value="divorciado">{t("perfil.divorciado")}</SelectItem>
                    <SelectItem value="viuvo">{t("perfil.viuvo")}</SelectItem>
                    <SelectItem value="uniao_estavel">{t("perfil.uniao_estavel")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("perfil.dependentes")}</Label>
                <Input type="number" min="0" value={profile.dependents} onChange={e => setProfile(p => ({ ...p, dependents: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <Button type="submit" disabled={loading} aria-busy={loading} aria-label={loading ? "Salvando perfil..." : "Salvar perfil"}>
                {loading ? t("perfil.salvando") : t("perfil.salvar")}
              </Button>
              <Button type="button" variant="outline" onClick={handleResetPassword} disabled={resettingPw} aria-busy={resettingPw} aria-label={resettingPw ? "Enviando link..." : "Trocar senha"} className="gap-2">
                <KeyRound className="h-4 w-4" />
                {resettingPw ? t("perfil.enviando") : t("perfil.trocar_senha")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Feedback Card */}
      <Card className="shadow-soft">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <MessageSquareText className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-heading font-bold text-base">Enviar feedback</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Encontrou um bug, tem uma ideia ou quer elogiar? Nossa equipe lê tudo.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setFeedbackOpen(true)}>
              Abrir formulário
            </Button>
          </div>
        </CardContent>
      </Card>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />

      {/* Legal Links Card */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="font-heading text-base">Informações Legais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:underline underline-offset-2">
            Termos de Uso
          </a>
          <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="block text-sm text-primary hover:underline underline-offset-2">
            Política de Privacidade
          </a>
        </CardContent>
      </Card>

      {/* Install as App Card */}
      <Card className="shadow-soft border-dashed">
        <CardHeader>
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="Atlas" className="w-10 h-10 rounded-xl object-contain" />
            <div>
              <CardTitle className="font-heading">{t("perfil.transforme_app")}</CardTitle>
              <p className="text-xs text-muted-foreground">Atlas</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{t("perfil.instale_app")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-muted/30 border border-border/40">
              <p className="text-sm font-heading font-bold mb-2">
                <span className="inline-flex items-center gap-1.5">
                  <Apple className="h-4 w-4 text-foreground" /> iPhone (Safari)
                </span>
              </p>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Abra no <strong>Safari</strong></li>
                <li>Toque em <strong>Compartilhar</strong> (ícone ↑)</li>
                <li>Selecione <strong>"Adicionar à Tela de Início"</strong></li>
              </ol>
            </div>
            <div className="p-4 rounded-xl bg-muted/30 border border-border/40">
              <p className="text-sm font-heading font-bold mb-2">
                <span className="inline-flex items-center gap-1.5">
                  <Smartphone className="h-4 w-4 text-foreground" /> Android (Chrome)
                </span>
              </p>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Abra no <strong>Chrome</strong></li>
                <li>Toque no menu <strong>⋮</strong> (três pontos)</li>
                <li>Selecione <strong>"Adicionar à tela inicial"</strong></li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zona de perigo — exclusão de conta (LGPD) */}
      <Card className="shadow-soft border-destructive/30">
        <CardHeader>
          <CardTitle className="font-heading text-base flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" />Zona de perigo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-xl border border-border bg-muted/30 px-3 py-3 space-y-2">
            <p className="text-sm text-muted-foreground">Você pode baixar uma cópia dos seus dados pessoais armazenados no Atlas (direito de portabilidade — LGPD).</p>
            <Button variant="outline" className="gap-2" onClick={handleExportData} disabled={exporting}>
              <Download className="h-4 w-4" /> {exporting ? "Preparando…" : "Baixar meus dados (LGPD)"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Excluir sua conta apaga permanentemente seus dados do Atlas. Esta ação não pode ser desfeita.</p>
          <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
            <span>Tem uma assinatura ativa? <strong>Cancele a assinatura antes</strong> de excluir a conta — a exclusão não cancela a cobrança automaticamente.</span>
          </div>
          <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-2" onClick={() => { setConfirmText(""); setDeleteOpen(true); }}>
            <Trash2 className="h-4 w-4" /> Excluir minha conta
          </Button>
        </CardContent>
      </Card>

      <Dialog open={deleteOpen} onOpenChange={(o) => { if (!deleting) setDeleteOpen(o); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Excluir conta</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Isso apaga sua conta e seus dados de forma permanente. Não dá para desfazer.</p>
            <p className="text-xs text-muted-foreground">Tem assinatura ativa? Cancele antes — a exclusão não interrompe a cobrança.</p>
            <div>
              <Label className="text-xs">Digite <strong>EXCLUIR</strong> para confirmar</Label>
              <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="EXCLUIR" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancelar</Button>
              <Button variant="destructive" disabled={deleting || confirmText.trim().toUpperCase() !== "EXCLUIR"} onClick={handleDeleteAccount} className="gap-2">
                {deleting ? "Excluindo…" : <><Trash2 className="h-4 w-4" />Excluir definitivamente</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Perfil;
