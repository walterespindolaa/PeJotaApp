import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Search, ShieldCheck, ShieldOff, Gift, KeyRound, Trash2, RefreshCw, UserPlus, Copy, Check, Pencil, Shield } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import EditUserDrawer from "@/components/admin/EditUserDrawer";
import { useAuth } from "@/hooks/useAuth";

type UserSubscription = {
  plan_tier: string;
  access_state: string;
  full_expires_at: string | null;
  trial_expires_at: string | null;
  grace_finance_until: string | null;
  origin: string;
} | null;

type HouseholdInheritance = {
  owner_id: string;
  owner_name: string;
  member_status: string;
} | null;

type UserRow = {
  id: string; email: string; full_name: string; role: string;
  user_subscription: UserSubscription;
  household_inheritance?: HouseholdInheritance;
  created_at: string; last_sign_in_at: string | null;
};

const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

function formatPlanLabel(u: UserRow): string {
  const sub = u.user_subscription;
  if (!sub) return "Sem assinatura";

  const { plan_tier, access_state, full_expires_at } = sub;

  if (plan_tier === "full" && access_state === "active") {
    const expLabel = full_expires_at ? ` (expira ${fmtDate(full_expires_at)})` : "";
    const inheritedLabel = u.household_inheritance ? ` • Herdado de ${u.household_inheritance.owner_name}` : "";
    return `Atlas FULL${expLabel}${inheritedLabel}`;
  }
  if (access_state === "trial") return "Trial 7 dias (Atlas)";
  if (access_state === "grace") return "Grace (acesso parcial)";
  if (access_state === "restricted") return "Restrito";
  return plan_tier || "—";
}

function getPlanBadgeClass(u: UserRow): string {
  const sub = u.user_subscription;
  if (!sub) return "bg-muted text-muted-foreground";
  if (sub.plan_tier === "full" && sub.access_state === "active") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300";
  if (sub.access_state === "trial") return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
  if (sub.access_state === "grace") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
  if (sub.access_state === "restricted") return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  return "bg-muted text-muted-foreground";
}

const AdminUsers = () => {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bonusUser, setBonusUser] = useState<UserRow | null>(null);
  const [bonusDays, setBonusDays] = useState("30");
  const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [toggleAdminUser, setToggleAdminUser] = useState<UserRow | null>(null);

  // Create user state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createType, setCreateType] = useState("full");
  const [createDuration, setCreateDuration] = useState("365");
  const [createIsAdmin, setCreateIsAdmin] = useState(false);
  const [createSignupSource, setCreateSignupSource] = useState("manual");
  const [creating, setCreating] = useState(false);
  const [createdResult, setCreatedResult] = useState<{ email: string; name: string; inviteLink: string | null; fullExpiresAt?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "list", search: debouncedSearch },
    });
    if (error) {
      toast({ title: "Erro ao carregar usuários", description: error.message, variant: "destructive" });
    } else {
      setUsers(data?.users || []);
    }
    setLoading(false);
  }, [debouncedSearch, toast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const doAction = async (targetUserId: string, actionType: string, payload?: any) => {
    setActionLoading(targetUserId + actionType);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "do", targetUserId, actionType, payload },
    });
    setActionLoading(null);
    if (error || data?.error) {
      const msg = data?.error || error?.message || "Erro desconhecido";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } else {
      toast({ title: "Ação executada com sucesso" });
      fetchUsers();
    }
  };

  const handleBonus = () => {
    if (!bonusUser) return;
    const d = parseInt(bonusDays);
    if (isNaN(d) || d <= 0) { toast({ title: "Dias inválidos", variant: "destructive" }); return; }
    doAction(bonusUser.id, "bonus", { days: d });
    setBonusUser(null);
  };

  const handleDelete = () => {
    if (!deleteUser) return;
    doAction(deleteUser.id, "delete_user");
    setDeleteUser(null);
  };

  const handleToggleAdmin = () => {
    if (!toggleAdminUser) return;
    doAction(toggleAdminUser.id, "toggle_admin");
    setToggleAdminUser(null);
  };

  const handleCreateUser = async () => {
    if (!createName.trim() || !createEmail.trim()) {
      toast({ title: "Nome e email são obrigatórios", variant: "destructive" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(createEmail)) {
      toast({ title: "Email inválido", variant: "destructive" });
      return;
    }
    setCreating(true);

    let planPayload: any = {};
    if (createType === "full") {
      const days = parseInt(createDuration) || 365;
      planPayload = { plan_type: "full", duration_days: days };
    } else {
      planPayload = { plan_type: createType };
    }

    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "do",
        targetUserId: "new",
        actionType: "create_user",
        payload: { email: createEmail.trim(), full_name: createName.trim(), phone: createPhone.trim(), is_admin: createIsAdmin, signup_source: createSignupSource, ...planPayload },
      },
    });
    setCreating(false);
    if (error || data?.error) {
      const msg = data?.error || error?.message || "Erro desconhecido ao criar usuário";
      toast({ title: "Erro ao criar usuário", description: msg, variant: "destructive" });
    } else {
      const days = parseInt(createDuration) || 365;
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + days);
      setShowCreateDialog(false);
      setCreatedResult({
        email: createEmail.trim(),
        name: createName.trim(),
        inviteLink: data?.invite_link || null,
        fullExpiresAt: createType === "full" ? expiryDate.toLocaleDateString("pt-BR") : undefined,
      });
      setCreateName(""); setCreateEmail(""); setCreatePhone(""); setCreateType("full"); setCreateDuration("365"); setCreateIsAdmin(false); setCreateSignupSource("manual");
      fetchUsers();
    }
  };

  const appUrl = window.location.origin;

  const getWelcomeMessage = () => {
    if (!createdResult) return "";
    const expiryLine = createdResult.fullExpiresAt ? `\n📅 Acesso FULL válido até: ${createdResult.fullExpiresAt}` : "";
    const linkLine = createdResult.inviteLink
      ? `\n🔗 Link de ativação (válido por 72h): ${createdResult.inviteLink}`
      : `\n🔗 Email de ativação enviado para o usuário.`;
    return `Olá, ${createdResult.name} 👋

Seu acesso ao Atlas foi criado com sucesso.

📧 Email: ${createdResult.email}${linkLine}${expiryLine}

Ao clicar no link, você será direcionado para criar sua senha.

Qualquer dúvida, fico à disposição.`;
  };

  const handleCopyMessage = async () => {
    await navigator.clipboard.writeText(getWelcomeMessage());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por email ou nome..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 rounded-xl" />
        </div>
        <Button variant="outline" className="rounded-xl gap-2" onClick={() => setShowCreateDialog(true)}>
          <UserPlus className="h-4 w-4" /> Criar Usuário
        </Button>
        <Button variant="outline" className="rounded-xl gap-2" onClick={fetchUsers} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <Card className="shadow-soft rounded-2xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Último login</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto" /></TableCell></TableRow>
                ) : users.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado.</TableCell></TableRow>
                ) : users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">{u.email}</TableCell>
                    <TableCell className="text-sm">{u.full_name}</TableCell>
                    <TableCell>
                      <button
                        onClick={() => u.id !== currentUser?.id ? setToggleAdminUser(u) : null}
                        disabled={u.id === currentUser?.id}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-medium transition-colors ${
                          u.role === "admin"
                            ? "bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                            : "bg-muted text-muted-foreground hover:bg-muted/80 cursor-pointer"
                        } ${u.id === currentUser?.id ? "opacity-50 cursor-not-allowed" : ""}`}
                        title={u.id === currentUser?.id ? "Você não pode alterar seu próprio papel" : u.role === "admin" ? "Remover admin" : "Tornar admin"}
                      >
                        <Shield className="h-3 w-3" />
                        {u.role}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge className={`rounded-lg text-[10px] border-0 ${getPlanBadgeClass(u)}`}>
                        {formatPlanLabel(u)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{u.household_inheritance ? `herdado (${u.household_inheritance.owner_name})` : (u.user_subscription?.origin || "—")}</TableCell>
                    <TableCell className="text-xs">{fmtDate(u.created_at)}</TableCell>
                    <TableCell className="text-xs">{fmtDate(u.last_sign_in_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Editar" onClick={() => setEditUser(u)}>
                          <Pencil className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        {u.user_subscription?.access_state !== "active" || u.user_subscription?.plan_tier !== "full" ? (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Ativar FULL 365d" disabled={actionLoading === u.id + "activate"} onClick={() => doAction(u.id, "activate")}>
                            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Restringir" disabled={actionLoading === u.id + "block"} onClick={() => doAction(u.id, "block")}>
                            <ShieldOff className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Dar bônus" onClick={() => { setBonusUser(u); setBonusDays("30"); }}>
                          <Gift className="h-3.5 w-3.5 text-primary" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Reset senha" disabled={actionLoading === u.id + "reset_password"} onClick={() => doAction(u.id, "reset_password")}>
                          <KeyRound className="h-3.5 w-3.5 text-accent-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Excluir (LGPD)" onClick={() => setDeleteUser(u)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit User Drawer */}
      <EditUserDrawer user={editUser} open={!!editUser} onOpenChange={(open) => { if (!open) setEditUser(null); }} onRefresh={fetchUsers} />

      {/* Create User Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle className="font-heading">Criar Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
            <Label className="text-xs">Nome completo *</Label>
              <Input value={createName} onChange={e => setCreateName(e.target.value)} className="rounded-xl mt-1" placeholder="João Silva" />
            </div>
            <div>
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} className="rounded-xl mt-1" placeholder="joao@email.com" />
            </div>
            <div>
              <Label className="text-xs">Telefone</Label>
              <Input value={createPhone} onChange={e => setCreatePhone(e.target.value)} className="rounded-xl mt-1" placeholder="(11) 99999-9999" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Tipo de acesso</Label>
                <Select value={createType} onValueChange={setCreateType}>
                  <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">FULL (padrão)</SelectItem>
                    <SelectItem value="trial">Trial 7 dias</SelectItem>
                    <SelectItem value="grace">Grace</SelectItem>
                    <SelectItem value="restricted">Restrito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {createType === "full" && (
                <div>
                  <Label className="text-xs">Prazo FULL</Label>
                  <Select value={createDuration} onValueChange={setCreateDuration}>
                    <SelectTrigger className="rounded-xl mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="365">1 ano (padrão)</SelectItem>
                      <SelectItem value="30">30 dias</SelectItem>
                      <SelectItem value="60">60 dias</SelectItem>
                      <SelectItem value="90">90 dias</SelectItem>
                      <SelectItem value="180">6 meses</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Origem do cadastro</Label>
                <Select value={createSignupSource} onValueChange={setCreateSignupSource}>
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
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={createIsAdmin} onCheckedChange={setCreateIsAdmin} id="create-admin-switch" />
                <Label htmlFor="create-admin-switch" className="text-xs cursor-pointer">Admin?</Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Uma senha provisoria aleatoria sera gerada automaticamente.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreateUser} disabled={creating}>{creating ? "Criando..." : "Criar Usuário"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Created User Success Dialog */}
      <Dialog open={!!createdResult} onOpenChange={() => { setCreatedResult(null); setCopied(false); }}>
        <DialogContent className="rounded-2xl max-w-lg">
          <DialogHeader><DialogTitle className="font-heading">Usuário Criado com Sucesso</DialogTitle></DialogHeader>
          <div className="bg-muted/30 rounded-xl p-4 font-mono text-xs whitespace-pre-wrap leading-relaxed border border-border">
            {getWelcomeMessage()}
          </div>
          <DialogFooter>
            <Button onClick={handleCopyMessage} className="gap-2 rounded-xl">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado!" : "Copiar mensagem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bonus Dialog */}
      <Dialog open={!!bonusUser} onOpenChange={() => setBonusUser(null)}>
        <DialogContent className="rounded-2xl">
          <DialogHeader><DialogTitle className="font-heading">Dar Bônus de Dias</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Usuário: <strong>{bonusUser?.email}</strong></p>
          <div className="flex items-center gap-3">
            <Input type="number" min={1} value={bonusDays} onChange={e => setBonusDays(e.target.value)} className="w-32 rounded-xl" />
            <span className="text-sm text-muted-foreground">dias</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBonusUser(null)}>Cancelar</Button>
            <Button onClick={handleBonus}>Aplicar Bônus</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão (LGPD)</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir permanentemente <strong>{deleteUser?.email}</strong> e todos os dados associados? Esta ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir Permanentemente</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toggle Admin Confirmation */}
      <AlertDialog open={!!toggleAdminUser} onOpenChange={() => setToggleAdminUser(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleAdminUser?.role === "admin" ? "Remover acesso de admin" : "Conceder acesso de admin"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleAdminUser?.role === "admin"
                ? <>Tem certeza que deseja remover o acesso de admin de <strong>{toggleAdminUser?.email}</strong>? Essa pessoa perderá acesso a recursos restritos e telas em teste.</>
                : <>Tem certeza que deseja tornar <strong>{toggleAdminUser?.email}</strong> admin? Essa pessoa terá acesso a recursos restritos e telas em teste.</>
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleAdmin}>
              {toggleAdminUser?.role === "admin" ? "Remover Admin" : "Tornar Admin"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsers;
