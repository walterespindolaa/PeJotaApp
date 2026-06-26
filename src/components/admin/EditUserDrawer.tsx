import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import ResponsiveEditDialog from "@/components/ui/responsive-edit-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Copy, Check, LogOut, KeyRound, Zap, ShieldCheck, Clock, Lock, AlertTriangle, Crown } from "lucide-react";

interface EditUserDrawerProps {
  user: { id: string; email: string; full_name: string; role: string; created_at: string; last_sign_in_at: string | null } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";
const toInputDate = (d: string | null) => d ? new Date(d).toISOString().slice(0, 10) : "";

const EditUserDrawer = ({ user, open, onOpenChange, onRefresh }: EditUserDrawerProps) => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [sub, setSub] = useState<any>(null);
  const [subLoading, setSubLoading] = useState(true);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Plan fields (subscription)
  const [planTier, setPlanTier] = useState("free");
  const [accessState, setAccessState] = useState("trial");
  const [trialExpires, setTrialExpires] = useState("");
  const [graceUntil, setGraceUntil] = useState("");
  const [deletionAt, setDeletionAt] = useState("");
  const [fullExpiresAt, setFullExpiresAt] = useState("");
  const [origin, setOrigin] = useState("manual");
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Feature plan fields (new plans system)
  const [allPlans, setAllPlans] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [planExpiresAt, setPlanExpiresAt] = useState("");
  const [planLoading, setPlanLoading] = useState(true);

  const fetchSub = useCallback(async () => {
    if (!user) return;
    setSubLoading(true);
    const { data } = await supabase.functions.invoke("admin-users", {
      body: { action: "get_subscription", targetUserId: user.id },
    });
    const s = data?.subscription;
    setSub(s);
    if (s) {
      setPlanTier(s.plan_tier || "free");
      setAccessState(s.access_state || "trial");
      setTrialExpires(toInputDate(s.trial_expires_at));
      setGraceUntil(toInputDate(s.grace_finance_until));
      setDeletionAt(toInputDate(s.scheduled_deletion_at));
      setFullExpiresAt(toInputDate(s.full_expires_at));
      setOrigin(s.origin || "manual");
    }
    const { data: logsData } = await supabase.functions.invoke("admin-users", {
      body: { action: "logs", filterUser: user.id, limit: 10 },
    });
    setAuditLogs(logsData?.logs || []);
    setSubLoading(false);
  }, [user]);

  const fetchUserPlan = useCallback(async () => {
    if (!user) return;
    setPlanLoading(true);
    const { data } = await supabase.functions.invoke("admin-users", {
      body: { action: "do", targetUserId: user.id, actionType: "get_user_plan" },
    });
    setAllPlans(data?.plans || []);
    setSelectedPlanId(data?.userPlan?.plan_id || "");
    setPlanExpiresAt(toInputDate(data?.userPlan?.expires_at));
    setPlanLoading(false);
  }, [user]);

  useEffect(() => {
    if (open && user) {
      fetchSub();
      fetchUserPlan();
      setTempPassword(null);
      setIsAdmin(user.role === "admin");
    }
  }, [open, user, fetchSub, fetchUserPlan]);

  const saveSubscription = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "do",
        targetUserId: user.id,
        actionType: "update_subscription",
        payload: {
          plan_tier: planTier,
          access_state: accessState,
          trial_expires_at: trialExpires ? new Date(trialExpires).toISOString() : null,
          grace_finance_until: graceUntil ? new Date(graceUntil).toISOString() : null,
          scheduled_deletion_at: deletionAt ? new Date(deletionAt).toISOString() : null,
          full_expires_at: planTier === "full" && fullExpiresAt ? new Date(fullExpiresAt).toISOString() : null,
        },
      },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: "Erro", description: error?.message || data?.error, variant: "destructive" });
    } else {
      toast({ title: "Plano atualizado" });
      onRefresh();
      fetchSub();
    }
  };

  const saveFeaturePlan = async () => {
    if (!user || !selectedPlanId) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "do",
        targetUserId: user.id,
        actionType: "update_user_plan",
        payload: {
          plan_id: selectedPlanId,
          expires_at: planExpiresAt ? new Date(planExpiresAt).toISOString() : null,
        },
      },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: "Erro", description: error?.message || data?.error, variant: "destructive" });
    } else {
      toast({ title: "Plano de funcionalidades atualizado" });
      onRefresh();
      fetchUserPlan();
    }
  };

  const quickAction = async (actionType: string, payload?: any) => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "do", targetUserId: user.id, actionType, payload },
    });
    setLoading(false);
    if (error || data?.error) {
      toast({ title: "Erro", description: error?.message || data?.error, variant: "destructive" });
    } else {
      if (actionType === "set_temp_password" && data?.tempPassword) {
        setTempPassword(data.tempPassword);
      } else {
        toast({ title: "Ação executada" });
      }
      onRefresh();
      fetchSub();
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) return null;

  const currentPlanName = allPlans.find(p => p.id === selectedPlanId)?.name || "Nenhum";

  return (
    <ResponsiveEditDialog
      open={open}
      onOpenChange={onOpenChange}
      title={user.full_name || user.email}
      size="2xl"
      footer={
        <Button variant="outline" className="rounded-xl ml-auto" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
      }
    >
      <div className="border-b border-border pb-3">
        <p className="text-xs text-muted-foreground font-mono">{user.email}</p>
        {!planLoading && (
          <Badge variant="outline" className="mt-2 text-[10px] gap-1">
            <Crown className="h-3 w-3" /> {currentPlanName}
          </Badge>
        )}
      </div>

      <Tabs defaultValue="features" className="w-full">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="features" className="flex-1 text-xs">Plano</TabsTrigger>
          <TabsTrigger value="subscription" className="flex-1 text-xs">Assinatura</TabsTrigger>
          <TabsTrigger value="security" className="flex-1 text-xs">Segurança</TabsTrigger>
          <TabsTrigger value="audit" className="flex-1 text-xs">Audit</TabsTrigger>
        </TabsList>

        {/* ======= FEATURE PLAN TAB ======= */}
        <TabsContent value="features" className="space-y-4">
          {planLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              <div>
                <Label className="text-xs font-semibold">Plano de funcionalidades</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue placeholder="Selecionar plano" /></SelectTrigger>
                  <SelectContent>
                    {allPlans.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Expira em (opcional)</Label>
                <Input type="date" value={planExpiresAt} onChange={e => setPlanExpiresAt(e.target.value)} className="rounded-xl mt-1" />
                <p className="text-[10px] text-muted-foreground mt-1">Deixe vazio para acesso sem expiração.</p>
              </div>
              <Button onClick={saveFeaturePlan} disabled={loading || !selectedPlanId} className="w-full rounded-xl">
                Salvar plano
              </Button>
            </>
          )}
        </TabsContent>

        {/* ======= SUBSCRIPTION TAB ======= */}
        <TabsContent value="subscription" className="space-y-4">
          {subLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Plano</Label>
                  <Select value={planTier} onValueChange={setPlanTier}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free">Free</SelectItem>
                      <SelectItem value="full">Full</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Estado</Label>
                  <Select value={accessState} onValueChange={setAccessState}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="grace">Grace</SelectItem>
                      <SelectItem value="restricted">Restricted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {planTier === "full" && (
                <div>
                  <Label className="text-xs font-semibold text-primary">FULL expira em</Label>
                  <Input type="date" value={fullExpiresAt} onChange={e => setFullExpiresAt(e.target.value)} className="rounded-xl mt-1 border-primary/30" />
                </div>
              )}

              <div>
                <Label className="text-xs">Trial expira em</Label>
                <Input type="date" value={trialExpires} onChange={e => setTrialExpires(e.target.value)} className="rounded-xl mt-1" />
              </div>
              <div>
                <Label className="text-xs">Grace até</Label>
                <Input type="date" value={graceUntil} onChange={e => setGraceUntil(e.target.value)} className="rounded-xl mt-1" />
              </div>
              <div>
                <Label className="text-xs">Exclusão programada</Label>
                <Input type="date" value={deletionAt} onChange={e => setDeletionAt(e.target.value)} className="rounded-xl mt-1" />
              </div>

              <Button onClick={saveSubscription} disabled={loading} className="w-full rounded-xl">
                Salvar Alterações
              </Button>

              <div className="border-t border-border pt-3 space-y-2">
                <p className="text-xs font-heading font-semibold text-muted-foreground">Ações Rápidas</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5" disabled={loading}
                    onClick={() => quickAction("activate")}>
                    <ShieldCheck className="h-3.5 w-3.5" /> Ativar FULL 365d
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5" disabled={loading}
                    onClick={() => quickAction("quick_trial")}>
                    <Clock className="h-3.5 w-3.5" /> Trial 7d
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5" disabled={loading}
                    onClick={() => quickAction("quick_grace")}>
                    <Zap className="h-3.5 w-3.5" /> Grace 21d
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5 text-destructive" disabled={loading}
                    onClick={() => quickAction("quick_restrict")}>
                    <Lock className="h-3.5 w-3.5" /> Restringir
                  </Button>
                </div>
              </div>
            </>
          )}
        </TabsContent>

        {/* ======= SECURITY TAB ======= */}
        <TabsContent value="security" className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border p-3">
            <div>
              <Label className="text-xs font-semibold">Permissao Admin</Label>
              <p className="text-[10px] text-muted-foreground">Define se este usuario tem acesso administrativo.</p>
            </div>
            <Switch
              checked={isAdmin}
              disabled={loading || user.id === currentUser?.id}
              onCheckedChange={async (checked) => {
                setIsAdmin(checked);
                await quickAction("toggle_admin");
              }}
            />
          </div>

          <div>
            <Label className="text-xs">Origem do cadastro</Label>
            <Select value={sub?.origin || "manual"} onValueChange={async (val) => {
              setLoading(true);
              await supabase.functions.invoke("admin-users", {
                body: { action: "do", targetUserId: user.id, actionType: "update_signup_source", payload: { signup_source: val } },
              });
              setLoading(false);
              toast({ title: "Origem atualizada" });
              fetchSub();
              onRefresh();
            }}>
              <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="cakto">Cakto</SelectItem>
                <SelectItem value="kiwify">Kiwify</SelectItem>
                <SelectItem value="stripe">Stripe</SelectItem>
                <SelectItem value="import">Import</SelectItem>
                <SelectItem value="referral">Indicacao</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-t border-border pt-3 space-y-3">
            <Button variant="outline" className="w-full rounded-xl gap-2 justify-start" disabled={loading}
              onClick={() => quickAction("force_signout")}>
              <LogOut className="h-4 w-4" /> Forcar logout do usuario
            </Button>
            <Button variant="outline" className="w-full rounded-xl gap-2 justify-start" disabled={loading}
              onClick={() => quickAction("set_temp_password")}>
              <KeyRound className="h-4 w-4" /> Definir senha temporaria
            </Button>
          </div>

          {tempPassword && (
            <div className="bg-muted/30 rounded-xl p-4 border border-border space-y-2">
              <p className="text-xs font-semibold">Senha temporaria gerada:</p>
              <div className="flex items-center gap-2">
                <code className="bg-background rounded-lg px-3 py-1.5 text-sm font-mono flex-1 select-all">{tempPassword}</code>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleCopy(tempPassword)}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Copie agora. Nao sera exibida novamente.
              </p>
            </div>
          )}

          <div className="border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">
              Criado em: {fmtDate(user.created_at)}<br />
              Ultimo login: {fmtDate(user.last_sign_in_at)}<br />
              Role: <Badge variant="outline" className="text-[10px] ml-1">{user.role}</Badge>
            </p>
          </div>
        </TabsContent>

        {/* ======= AUDIT TAB ======= */}
        <TabsContent value="audit" className="space-y-2">
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum log encontrado.</p>
          ) : (
            auditLogs.map((log: any) => (
              <div key={log.id} className="bg-muted/20 rounded-xl p-3 border border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <Badge variant="outline" className="text-[10px] rounded-lg">{log.action}</Badge>
                  <span className="text-[10px] text-muted-foreground">{fmtDate(log.created_at)}</span>
                </div>
                {log.payload && Object.keys(log.payload).length > 0 && (
                  <pre className="text-[10px] text-muted-foreground mt-1 whitespace-pre-wrap break-all">
                    {JSON.stringify(log.payload, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </ResponsiveEditDialog>
  );
};

export default EditUserDrawer;
