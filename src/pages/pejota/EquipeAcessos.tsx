import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanies } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Crown, Trash2, Building2, Copy, MessageCircle, CheckCircle2, Loader2 } from "lucide-react";

const MEMBER_ERR: Record<string, string> = {
  not_owner: "Só o dono pode adicionar membros.",
  self: "Você já é o dono desta empresa.",
  limit: "Limite de 10 usuários atingido.",
  no_seats: "Sem assento disponível — compre um assento em Configuração → Empresa → Assinatura.",
};

interface Member { user_id: string; email: string | null; name: string | null; role: string; }

export default function EquipeAcessos() {
  const { user } = useAuth();
  const { selected: company, loading: companiesLoading } = useCompanies();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [lastInvite, setLastInvite] = useState<{ name: string; url: string } | null>(null);

  const load = useCallback(async () => {
    if (!company) { setMembers([]); return; }
    setLoading(true);
    const { data } = await supabase.rpc("list_company_members" as any, { _company_id: company.id });
    setMembers(((data as unknown) as Member[]) || []);
    setLoading(false);
  }, [company]);
  useEffect(() => { load(); }, [load]);

  const isOwner = company?.user_id === user?.id;

  const addMember = async () => {
    if (!company || !inviteEmail.trim()) return;
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("business-member-invite", {
      body: { company_id: company.id, email: inviteEmail.trim(), name: inviteName.trim() || null, restrict: true },
    });
    setInviting(false);
    let res = (data || {}) as any;
    if (error && (error as any).context?.json) { try { res = await (error as any).context.json(); } catch { /* ignore */ } }
    if (error || res?.error) { toast({ title: MEMBER_ERR[res?.error] || res?.error || "Não foi possível convidar", variant: "destructive" }); return; }
    await load();
    if (res?.is_new_user && res?.accept_url) setLastInvite({ name: inviteName.trim() || inviteEmail.trim(), url: res.accept_url });
    else toast({ title: "Pessoa adicionada", description: "Ela já tinha conta e agora acessa este negócio." });
    setInviteName(""); setInviteEmail("");
  };

  const removeMember = async (uid: string) => {
    if (!company) return;
    setMembers(prev => prev.filter(m => m.user_id !== uid));
    await supabase.rpc("remove_company_member" as any, { _company_id: company.id, _user_id: uid });
  };

  const waMsg = lastInvite && company ? `Oi ${lastInvite.name}! Você foi convidado para acessar o ${company.name} no PeJota. Crie sua senha e entre por aqui: ${lastInvite.url}` : "";

  if (!companiesLoading && !company) return (
    <div className="max-w-5xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para gerenciar a equipe.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0"><Users className="w-5 h-5" /></div>
        <div><h1 className="text-xl font-heading font-semibold">Equipe e acessos</h1>
        <p className="text-sm text-muted-foreground">Quem pode entrar no {company?.name}. {members.length + 1} de 10 lugares.</p></div>
      </div>

      <Card><CardContent className="p-0">
        <div className="divide-y">
          <div className="flex items-center gap-3 p-3">
            <span className="w-8 h-8 rounded-full bg-primary/10 text-primary grid place-items-center text-xs font-medium flex-shrink-0">{(company?.name || "?").slice(0, 2).toUpperCase()}</span>
            <span className="flex-1 truncate text-sm">Você</span>
            <Badge className="bg-primary/15 text-primary gap-1"><Crown className="w-3 h-3" /> Dono</Badge>
          </div>
          {loading ? <div className="p-4 text-sm text-muted-foreground">Carregando…</div> : members.map(m => (
            <div key={m.user_id} className="flex items-center gap-3 p-3">
              <span className="w-8 h-8 rounded-full bg-muted text-muted-foreground grid place-items-center text-xs font-medium flex-shrink-0">{(m.name || m.email || "?").slice(0, 2).toUpperCase()}</span>
              <div className="flex-1 min-w-0"><p className="truncate text-sm">{m.name || m.email}</p>{m.name && <p className="text-[11px] text-muted-foreground truncate">{m.email}</p>}</div>
              <Badge variant="secondary">Pode editar</Badge>
              {isOwner && <button onClick={() => removeMember(m.user_id)} aria-label="Remover" className="text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="w-4 h-4" /></button>}
            </div>
          ))}
        </div>
      </CardContent></Card>

      {isOwner ? (
        <Card><CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium flex items-center gap-1.5"><UserPlus className="w-4 h-4 text-primary" /> Convidar pessoa</p>
          <Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Nome (ex: João da Silva)" />
          <div className="flex gap-2">
            <Input value={inviteEmail} type="email" onChange={e => setInviteEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addMember(); }} placeholder="e-mail da pessoa" />
            <Button className="gap-1.5 flex-shrink-0" disabled={inviting || !inviteEmail.trim()} onClick={addMember}>{inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}{inviting ? "Enviando…" : "Convidar"}</Button>
          </div>
          <p className="text-[11px] text-muted-foreground">O convidado acessa só o negócio (não vê o resto do app). Precisa de assento livre — gerencie em Configuração → Empresa.</p>

          {lastInvite && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="w-4 h-4" /> Convite criado para {lastInvite.name}</p>
              <p className="text-[11px] text-muted-foreground">Enviamos um e-mail. Pra garantir, mande também no WhatsApp:</p>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 gap-1.5" onClick={() => { navigator.clipboard?.writeText(waMsg); toast({ title: "Mensagem copiada" }); }}><Copy className="w-4 h-4" /> Copiar mensagem</Button>
                <a href={`https://wa.me/?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 rounded-lg border text-sm hover:bg-muted/50"><MessageCircle className="w-4 h-4 text-emerald-600" /> WhatsApp</a>
              </div>
              <button onClick={() => setLastInvite(null)} className="text-[11px] text-muted-foreground hover:text-foreground underline">ok, fechar</button>
            </div>
          )}
        </CardContent></Card>
      ) : (
        <p className="text-xs text-muted-foreground">Só o dono pode convidar ou remover membros.</p>
      )}
    </div>
  );
}
