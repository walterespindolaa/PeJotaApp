import { useState, useEffect, useCallback, useRef } from "react";
import DependentesSection from "@/components/familia/DependentesSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Users, Pencil, Check, X, User, Upload, Loader2, RefreshCw, Shield, KeyRound, LogIn, Unlink, Crown, Heart, UserCheck, Baby } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useHousehold } from "@/hooks/useHousehold";
import { useDependentes } from "@/hooks/useDependentes";
import { usePlan } from "@/hooks/usePlan";
import { useI18n } from "@/contexts/I18nContext";
import { useNavigate } from "react-router-dom";

type ProfileData = {
  nome_pessoa1: string;
  nome_pessoa2: string;
  foto_pessoa1: string;
  foto_pessoa2: string;
  vinculo_pessoa2: string;
  pessoa2_participa_geral: boolean;
};

const statusMap: Record<string, { label: string; color: string }> = {
  active: { label: "Acesso ativo", color: "bg-success/15 text-success border-success/20" },
  invited: { label: "Convite pendente", color: "bg-warning/15 text-warning border-warning/20" },
  none: { label: "Sem acesso", color: "bg-muted text-muted-foreground border-border" },
};

const roleBadgeMap: Record<string, { label: string; icon: typeof Crown; className: string }> = {
  titular: { label: "Titular", icon: Crown, className: "bg-primary/10 text-primary border-primary/20" },
  conjuge: { label: "Cônjuge", icon: Heart, className: "bg-accent/50 text-accent-foreground border-accent/30" },
  convidado: { label: "Membro convidado", icon: UserCheck, className: "bg-muted text-muted-foreground border-border" },
  dependente: { label: "Dependente", icon: Baby, className: "bg-muted text-muted-foreground border-border" },
};

function getInitials(name: string): string {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
    "bg-rose-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const PLAN_LABELS: Record<string, string> = {
  essencial: "PeJota Essencial",
  pro: "PeJota Pro",
  elite: "PeJota Elite",
  free: "Sem plano ativo",
};

const Familia = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { household, members, loading: householdLoading, isOwner, isMember, createHousehold, inviteMember, removeMember, resendInvite } = useHousehold();
  const { dependentes } = useDependentes();
  const { planTier } = usePlan();

  const [profile, setProfile] = useState<ProfileData>({
    nome_pessoa1: "Pessoa 1", nome_pessoa2: "Pessoa 2",
    foto_pessoa1: "", foto_pessoa2: "",
    vinculo_pessoa2: "Cônjuge", pessoa2_participa_geral: true,
  });
  const [ownerEmail, setOwnerEmail] = useState<string>("");
  const [editing, setEditing] = useState<"pessoa1" | "pessoa2" | null>(null);
  const [tempName, setTempName] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef1 = useRef<HTMLInputElement>(null);
  const fileRef2 = useRef<HTMLInputElement>(null);

  const [activateOpen, setActivateOpen] = useState(false);
  const [activateTarget, setActivateTarget] = useState<"pessoa1" | "pessoa2" | null>(null);
  const [activateEmail, setActivateEmail] = useState("");
  const [activateName, setActivateName] = useState("");
  const [activateMethod, setActivateMethod] = useState<"link" | "password">("link");
  const [activating, setActivating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // The profile source must be the household OWNER, not the logged-in user
  const profileOwnerId = household?.owner_id || user?.id;

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    // For members, use RPC to bypass RLS and get owner's profile
    if (isMember) {
      const { data: ownerProfile } = await supabase.rpc("get_household_owner_profile");
      if (ownerProfile) {
        const d = ownerProfile as any;
        setProfile({
          nome_pessoa1: d.nome_pessoa1 || "Pessoa 1",
          nome_pessoa2: d.nome_pessoa2 || "Pessoa 2",
          foto_pessoa1: d.foto_pessoa1 || "",
          foto_pessoa2: d.foto_pessoa2 || "",
          vinculo_pessoa2: d.vinculo_pessoa2 || "Cônjuge",
          pessoa2_participa_geral: d.pessoa2_participa_geral ?? true,
        });
        setOwnerEmail(d.owner_email || "");
        setLoading(false);
        return;
      }
    }

    // Owner or standalone: read own profile
    const { data } = await supabase
      .from("profiles")
      .select("nome_pessoa1,nome_pessoa2,foto_pessoa1,foto_pessoa2,vinculo_pessoa2,pessoa2_participa_geral")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setProfile({
        nome_pessoa1: (data as any).nome_pessoa1 || "Pessoa 1",
        nome_pessoa2: (data as any).nome_pessoa2 || "Pessoa 2",
        foto_pessoa1: (data as any).foto_pessoa1 || "",
        foto_pessoa2: (data as any).foto_pessoa2 || "",
        vinculo_pessoa2: (data as any).vinculo_pessoa2 || "Cônjuge",
        pessoa2_participa_geral: (data as any).pessoa2_participa_geral ?? true,
      });
    }
    setOwnerEmail(user?.email || "");
    setLoading(false);
  }, [user, isMember]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    if (!householdLoading && !household && user && !isMember) {
      createHousehold("Minha Família").catch(() => {});
    }
  }, [householdLoading, household, user, isMember, createHousehold]);

  const updateField = async (field: string, value: any) => {
    if (!profileOwnerId || !isOwner) return;
    const { error } = await supabase.from("profiles").update({ [field]: value } as any).eq("user_id", profileOwnerId);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setProfile(p => ({ ...p, [field]: value }));
      toast({ title: "Salvo" });
    }
  };

  const handleSaveName = async (pessoa: "pessoa1" | "pessoa2") => {
    if (!tempName.trim()) return;
    const field = pessoa === "pessoa1" ? "nome_pessoa1" : "nome_pessoa2";
    await updateField(field, tempName.trim());
    setEditing(null);
    setTempName("");
  };

  const handleUploadPhoto = async (pessoa: "pessoa1" | "pessoa2", file: File) => {
    if (!profileOwnerId || !isOwner) return;
    setUploading(pessoa);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${profileOwnerId}/${pessoa}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const field = pessoa === "pessoa1" ? "foto_pessoa1" : "foto_pessoa2";
      await updateField(field, publicUrl);
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const getMemberAccessStatus = (pessoa: "pessoa1" | "pessoa2") => {
    if (pessoa === "pessoa1") return "active";
    const linkedMember = members.find(m => m.role !== "owner" && m.status !== "removed");
    if (!linkedMember) return "none";
    return linkedMember.status === "active" ? "active" : "invited";
  };

  const getMemberForPessoa = (pessoa: "pessoa1" | "pessoa2") => {
    if (pessoa === "pessoa1") return members.find(m => m.role === "owner");
    return members.find(m => m.role !== "owner" && m.status !== "removed");
  };

  const handleActivateAccess = (pessoa: "pessoa1" | "pessoa2") => {
    const name = pessoa === "pessoa1" ? profile.nome_pessoa1 : profile.nome_pessoa2;
    setActivateTarget(pessoa);
    setActivateName(name);
    setActivateEmail("");
    setActivateMethod("link");
    setActivateOpen(true);
  };

  const handleConfirmActivate = async () => {
    if (!activateEmail.trim() || !household) return;
    setActivating(true);
    try {
      // A checagem de e-mail já cadastrado acontece server-side em household-invite
      // (não expõe user_id ao cliente). UX idêntica à anterior.
      const result = await inviteMember(activateEmail.trim(), activateName.trim());

      if (result?.status === "email_already_exists") {
        toast({
          title: "E-mail já cadastrado",
          description: "Este e-mail já possui uma conta no PeJota. Peça ao usuário para fazer login com ele.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Convite enviado", description: `Acesso ativado para ${activateName}` });
      setActivateOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao ativar acesso", description: err.message, variant: "destructive" });
    } finally {
      setActivating(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    setActionLoading(memberId);
    try {
      await removeMember(memberId);
      toast({ title: "Acesso removido" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResend = async (memberId: string) => {
    setActionLoading(memberId);
    try {
      await resendInvite(memberId);
      toast({ title: "Convite reenviado" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  };

  if (loading || householdLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const activeMembers = members.filter(m => m.status === "active");
  const depCount = dependentes?.length || 0;

  const getRoleBadge = (pessoa: "pessoa1" | "pessoa2") => {
    if (pessoa === "pessoa1") return roleBadgeMap.titular;
    const vinculo = profile.vinculo_pessoa2.toLowerCase();
    if (vinculo.includes("cônjuge") || vinculo.includes("companheiro")) return roleBadgeMap.conjuge;
    return roleBadgeMap.convidado;
  };

  const profileMembers = [
    { key: "pessoa1" as const, name: profile.nome_pessoa1, foto: profile.foto_pessoa1, fileRef: fileRef1 },
    { key: "pessoa2" as const, name: profile.nome_pessoa2, foto: profile.foto_pessoa2, fileRef: fileRef2 },
  ];

  const AvatarInitials = ({ name, foto, size = "lg" }: { name: string; foto?: string; size?: "sm" | "lg" }) => {
    const dim = size === "lg" ? "w-16 h-16" : "w-10 h-10";
    const textSize = size === "lg" ? "text-lg" : "text-sm";
    if (foto) {
      return (
        <div className={`${dim} rounded-full overflow-hidden border-2 border-border flex-shrink-0`}>
          <img src={foto} alt={name} className="w-full h-full object-cover" />
        </div>
      );
    }
    return (
      <div className={`${dim} rounded-full flex items-center justify-center ${getAvatarColor(name)} text-white font-bold ${textSize} flex-shrink-0 border-2 border-background shadow-sm`}>
        {getInitials(name)}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" /> Família
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gerencie os membros e acessos ao planejamento financeiro.
        </p>
      </div>

      {/* Member context banner */}
      {isMember && !isOwner && (
        <Card className="shadow-soft border-accent/20 bg-accent/5">
          <CardContent className="p-4 flex items-center gap-3">
            <UserCheck className="h-5 w-5 text-accent-foreground/70 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium">Você está visualizando a família como membro convidado</p>
              <p className="text-xs text-muted-foreground">O titular desta família é <strong>{profile.nome_pessoa1}</strong>. Seu acesso e plano são herdados do titular.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Family Summary Card */}
      <Card className="shadow-soft border-primary/10 bg-gradient-to-br from-card to-primary/[0.03]">
        <CardContent className="p-5">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex -space-x-3">
              {profileMembers.map(m => (
                <AvatarInitials key={m.key} name={m.name} foto={m.foto} size="sm" />
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-heading font-bold text-base truncate">{household?.name || "Minha Família"}</h2>
              <div className="flex items-center gap-3 flex-wrap mt-1">
                <span className="text-xs text-muted-foreground">{activeMembers.length} membro{activeMembers.length !== 1 ? "s" : ""} ativo{activeMembers.length !== 1 ? "s" : ""}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <span className="text-xs text-muted-foreground">{depCount} dependente{depCount !== 1 ? "s" : ""}</span>
                <span className="text-xs text-muted-foreground">•</span>
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-semibold">
                  {PLAN_LABELS[planTier] || planTier}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Composição Familiar */}
      <div>
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold mb-3 px-1">
          Composição Familiar
        </p>
        <div className="space-y-3">
          {profileMembers.map(m => {
            const accessStatus = getMemberAccessStatus(m.key);
            const statusInfo = statusMap[accessStatus];
            const member = getMemberForPessoa(m.key);
            const badge = getRoleBadge(m.key);
            const BadgeIcon = badge.icon;

            return (
              <Card key={m.key} className={`shadow-soft transition-all ${m.key === "pessoa1" ? "ring-1 ring-primary/20" : ""}`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="relative group flex-shrink-0">
                      <AvatarInitials name={m.name} foto={m.foto} />
                      {isOwner && (
                        <>
                          <button
                            onClick={() => m.fileRef.current?.click()}
                            className="absolute inset-0 rounded-full bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            disabled={uploading === m.key}
                          >
                            {uploading === m.key ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Upload className="h-5 w-5 text-white" />}
                          </button>
                          <input ref={m.fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) handleUploadPhoto(m.key, file); e.target.value = ""; }} />
                        </>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        {m.key === "pessoa2" && editing === m.key && isOwner ? (
                          <div className="flex items-center gap-2">
                            <Input className="h-8 w-48" value={tempName} onChange={e => setTempName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleSaveName(m.key)} />
                            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Confirmar nome" onClick={() => handleSaveName(m.key)}><Check className="h-4 w-4 text-success" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Cancelar edição" onClick={() => setEditing(null)}><X className="h-4 w-4" /></Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <h3 className="text-lg font-heading font-bold">{m.name}</h3>
                            {/* Nome da Pessoa 1 é definido só em Meu Perfil (fonte única); só a Pessoa 2 é editável aqui */}
                            {m.key === "pessoa2" && isOwner && (
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(m.key); setTempName(m.name); }}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      {m.key === "pessoa1" && (
                        isOwner ? (
                          <button type="button" onClick={() => navigate("/dashboard/perfil")} className="text-[11px] text-muted-foreground hover:text-primary underline underline-offset-2 transition-colors">
                            {t("familia.nome_titular_hint")}
                          </button>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">{t("familia.nome_titular_hint")}</p>
                        )
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-[10px] gap-1 ${badge.className}`}>
                          <BadgeIcon className="h-3 w-3" />
                          {badge.label}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${statusInfo.color}`}>
                          {statusInfo.label}
                        </Badge>
                      </div>
                      {member?.invited_email && (
                        <p className="text-xs text-muted-foreground">{member.invited_email}</p>
                      )}
                      {m.key === "pessoa2" && isOwner && (
                        <div className="flex gap-2 pt-1 flex-wrap">
                          {accessStatus === "none" && (
                            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => handleActivateAccess(m.key)}>
                              <KeyRound className="h-3 w-3" /> Ativar acesso
                            </Button>
                          )}
                          {accessStatus === "invited" && member && (
                            <>
                              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7" onClick={() => handleResend(member.id)} disabled={actionLoading === member.id}>
                                {actionLoading === member.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                Reenviar convite
                              </Button>
                              <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7 text-destructive" onClick={() => handleRemove(member.id)} disabled={actionLoading === member.id}>
                                <Unlink className="h-3 w-3" /> Revogar
                              </Button>
                            </>
                          )}
                          {accessStatus === "active" && member && member.role !== "owner" && (
                            <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-7 text-destructive" onClick={() => handleRemove(member.id)} disabled={actionLoading === member.id}>
                              <Unlink className="h-3 w-3" /> Remover acesso
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Pessoa 2 settings - owner only */}
      {isOwner && <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Configurações do 2º membro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Tipo de vínculo</Label>
            <Select value={profile.vinculo_pessoa2} onValueChange={v => updateField("vinculo_pessoa2", v)}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Cônjuge">Cônjuge</SelectItem>
                <SelectItem value="Companheiro(a)">Companheiro(a)</SelectItem>
                <SelectItem value="Filho(a)">Filho(a)</SelectItem>
                <SelectItem value="Familiar">Familiar</SelectItem>
                <SelectItem value="Sócio(a)">Sócio(a)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Participa da visão Geral</Label>
              <p className="text-xs text-muted-foreground">Se ativado, os dados de {profile.nome_pessoa2} são incluídos na visão "Geral".</p>
            </div>
            <Switch checked={profile.pessoa2_participa_geral} onCheckedChange={v => updateField("pessoa2_participa_geral", v)} />
          </div>
        </CardContent>
      </Card>}

      {/* Membros com acesso ao sistema */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold px-1 flex items-center gap-2">
            <Shield className="h-3.5 w-3.5" /> Membros com acesso ao sistema
          </p>
        </div>

        {(() => {
          const allActive = members.filter(m => m.status !== "removed");
          const ownerMember = allActive.find(m => m.role === "owner");
          const otherMembers = allActive.filter(m => m.role !== "owner");

          return (
            <Card className="shadow-soft">
              <CardContent className="p-4 space-y-2">
                {ownerMember && (
                  <div className="flex items-center justify-between py-3 px-3 rounded-lg bg-primary/[0.04] border border-primary/10">
                    <div className="flex items-center gap-3">
                      <AvatarInitials name={ownerMember.display_name || profile.nome_pessoa1} foto={profile.foto_pessoa1} size="sm" />
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{ownerMember.display_name || profile.nome_pessoa1 || "Titular"}</p>
                        {(ownerMember.invited_email || ownerEmail) && <p className="text-xs text-muted-foreground">{ownerMember.invited_email || ownerEmail}</p>}
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] ${statusMap.active.color}`}>Acesso ativo</Badge>
                          <Badge variant="outline" className="text-[10px] gap-1 bg-primary/10 text-primary border-primary/20">
                            <Crown className="h-3 w-3" /> Titular
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {otherMembers.map(m => {
                  const isInvited = m.status === "invited";
                  const statusInfo = statusMap[m.status] || statusMap.none;

                  return (
                    <div key={m.id} className="flex items-center justify-between py-3 px-3 rounded-lg bg-muted/30 border border-border/40">
                      <div className="flex items-center gap-3">
                        <AvatarInitials name={m.display_name || m.invited_email || "Membro"} foto={profile.foto_pessoa2} size="sm" />
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">{m.display_name || m.invited_email || "Membro"}</p>
                          {m.invited_email && <p className="text-xs text-muted-foreground">{m.invited_email}</p>}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] ${statusInfo.color}`}>
                              {isInvited ? "Convite enviado" : statusInfo.label}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] gap-1">
                              <UserCheck className="h-3 w-3" /> Membro convidado
                            </Badge>
                          </div>
                          <div className="flex gap-3 text-[10px] text-muted-foreground mt-1">
                            {m.invited_at && <span>Convidado: {new Date(m.invited_at).toLocaleDateString("pt-BR")}</span>}
                            {m.joined_at && <span>Ativado: {new Date(m.joined_at).toLocaleDateString("pt-BR")}</span>}
                          </div>
                        </div>
                      </div>
                      {isOwner && (
                        <div className="flex gap-1 flex-shrink-0">
                          {isInvited && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleResend(m.id)} disabled={actionLoading === m.id} title="Reenviar convite">
                              {actionLoading === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleRemove(m.id)} disabled={actionLoading === m.id} title="Remover acesso">
                            <Unlink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })()}
      </div>

      {/* Activate Access Dialog */}
      <Dialog open={activateOpen} onOpenChange={setActivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" /> Ativar acesso ao sistema
            </DialogTitle>
            <DialogDescription>
              Vincule um login para {activateName} acessar o sistema.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-sm">Nome</Label>
              <Input value={activateName} onChange={e => setActivateName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">E-mail de acesso</Label>
              <Input type="email" placeholder="email@exemplo.com" value={activateEmail} onChange={e => setActivateEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Método de ativação</Label>
              <Select value={activateMethod} onValueChange={v => setActivateMethod(v as "link" | "password")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">Link de ativação por e-mail (recomendado)</SelectItem>
                  <SelectItem value="password">Senha temporária por e-mail</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                {activateMethod === "link"
                  ? "O membro receberá um e-mail com link seguro para definir a própria senha."
                  : "O membro receberá uma senha temporária e deverá alterá-la no primeiro acesso."}
              </p>
            </div>
            <Button onClick={handleConfirmActivate} disabled={activating || !activateEmail.trim()} className="w-full">
              {activating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LogIn className="h-4 w-4 mr-2" />}
              Ativar acesso
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dependentes section */}
      <DependentesSection />
    </div>
  );
};

export default Familia;
