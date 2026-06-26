import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanies, companyControlsStock, NICHOS } from "@/hooks/useCompanies";
import {
  Building2, Package, Trash2, Save, Users, UserPlus, Upload, Loader2, Image as ImageIcon,
  ArrowLeft, CreditCard, Copy, MessageCircle, CheckCircle2,
} from "lucide-react";

interface Member { user_id: string; email: string | null; name: string | null; role: string; }
const MEMBER_ERR: Record<string, string> = {
  not_owner: "Só o dono pode adicionar membros.",
  self: "Você já é o dono desta empresa.",
  limit: "Limite de 10 usuários atingido.",
  no_seats: "Sem assento disponível — compre um assento pra adicionar mais usuários.",
};

export default function EmpresaConfiguracoes() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { selected: company, updateCompany, deleteCompany } = useCompanies();

  const [form, setForm] = useState({ name: "", cnpj: "", telefone: "", endereco: "", logo_url: "" });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [savingDados, setSavingDados] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [restrictInvite, setRestrictInvite] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [lastInvite, setLastInvite] = useState<{ name: string; url: string } | null>(null);
  const [seatQty, setSeatQty] = useState("1");
  const [buyingSeats, setBuyingSeats] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  const loadMembers = useCallback(async (cid: string) => {
    const { data } = await supabase.rpc("list_company_members" as any, { _company_id: cid });
    setMembers(((data as unknown) as Member[]) || []);
  }, []);

  useEffect(() => {
    if (!company) return;
    setForm({ name: company.name || "", cnpj: company.cnpj || "", telefone: company.telefone || "", endereco: company.endereco || "", logo_url: company.logo_url || "" });
    loadMembers(company.id);
  }, [company, loadMembers]);

  if (!company) {
    return <div className="max-w-3xl mx-auto py-10 text-center text-sm text-muted-foreground">Selecione uma empresa no PeJota Negócios primeiro.</div>;
  }
  const isOwner = company.user_id === user?.id;
  const controlsStock = companyControlsStock(company);
  const paidSeats = company.paid_seats || 0;
  const usados = members.length;

  const onLogoFile = async (file?: File) => {
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { toast({ title: "Logo acima de 2MB", description: "Comprima em squoosh.app e tente de novo.", variant: "destructive" }); return; }
    setUploadingLogo(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("business-assets").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { setUploadingLogo(false); toast({ title: "Falha no upload", variant: "destructive" }); return; }
    const url = supabase.storage.from("business-assets").getPublicUrl(path).data.publicUrl;
    setForm(f => ({ ...f, logo_url: url }));
    await updateCompany(company.id, { logo_url: url });
    setUploadingLogo(false);
    toast({ title: "Logo atualizada" });
  };

  const saveDados = async () => {
    setSavingDados(true);
    await updateCompany(company.id, { name: form.name.trim() || company.name, cnpj: form.cnpj || null, telefone: form.telefone || null, endereco: form.endereco || null, logo_url: form.logo_url || null });
    setSavingDados(false);
    toast({ title: "Dados salvos" });
  };

  const addMember = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("business-member-invite", {
      body: { company_id: company.id, email: inviteEmail.trim(), name: inviteName.trim() || null, restrict: restrictInvite },
    });
    setInviting(false);
    let res = (data || {}) as any;
    if (error && (error as any).context?.json) { try { res = await (error as any).context.json(); } catch { /* ignore */ } }
    if (error || res?.error) { toast({ title: MEMBER_ERR[res?.error] || res?.error || "Não foi possível convidar", variant: "destructive" }); return; }
    await loadMembers(company.id);
    if (res?.is_new_user && res?.accept_url) setLastInvite({ name: inviteName.trim() || inviteEmail.trim(), url: res.accept_url });
    else toast({ title: "Pessoa adicionada", description: "Ela já tinha conta e agora acessa este negócio." });
    setInviteName(""); setInviteEmail("");
  };

  const removeMember = async (uid: string) => {
    setMembers(prev => prev.filter(m => m.user_id !== uid));
    await supabase.rpc("remove_company_member" as any, { _company_id: company.id, _user_id: uid });
  };

  const comprarAssentos = async () => {
    setBuyingSeats(true);
    const { data, error } = await supabase.functions.invoke("business-seats-checkout", { body: { company_id: company.id, seats: Number(seatQty) || 1 } });
    setBuyingSeats(false);
    const res = (data || {}) as any;
    if (error || res?.error) { toast({ title: res?.error || "Não foi possível abrir o checkout", variant: "destructive" }); return; }
    if (res?.url) window.location.href = res.url;
  };

  const gerenciarAssinatura = async () => {
    setPortalLoading(true);
    const { data, error } = await supabase.functions.invoke("create-portal-session", { body: { return_url: window.location.origin + "/dashboard/empresa" } });
    setPortalLoading(false);
    const res = (data || {}) as any;
    if (error || !res?.url) { toast({ title: "Nenhuma assinatura ativa encontrada", variant: "default" }); return; }
    window.location.href = res.url;
  };

  const waMsg = lastInvite ? `Oi ${lastInvite.name}! Você foi convidado para acessar o ${company.name} no PeJota. Crie sua senha e entre por aqui: ${lastInvite.url}` : "";

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl mx-auto">
      <div className="space-y-3">
        <button onClick={() => navigate("/dashboard/negocios")} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Voltar ao PeJota Negócios</button>
        <div className="flex items-center gap-3">
          <span className="grid place-items-center w-11 h-11 rounded-xl bg-primary/10 flex-shrink-0"><Building2 className="h-5 w-5 text-primary" /></span>
          <div>
            <h1 className="text-2xl font-heading font-bold">Configurações da empresa</h1>
            <p className="text-muted-foreground text-sm">{company.name}{!isOwner && " · você é membro"}</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="dados">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="prefs">Preferências</TabsTrigger>
          <TabsTrigger value="equipe">Equipe</TabsTrigger>
          {isOwner && <TabsTrigger value="assinatura">Assinatura</TabsTrigger>}
        </TabsList>

        {/* DADOS */}
        <TabsContent value="dados" className="mt-4">
          <Card className="shadow-soft"><CardContent className="p-5 space-y-3">
            <div><Label className="text-xs">Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} disabled={!isOwner} className="h-9 text-sm" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">CNPJ / CPF</Label><Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} disabled={!isOwner} placeholder="00.000.000/0001-00" className="h-9 text-sm" /></div>
              <div><Label className="text-xs">Telefone</Label><Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} disabled={!isOwner} placeholder="(00) 00000-0000" className="h-9 text-sm" /></div>
            </div>
            <div><Label className="text-xs">Endereço</Label><Textarea rows={2} value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} disabled={!isOwner} className="text-sm resize-none" /></div>
            <div className="space-y-1.5">
              <Label className="text-xs">Logo <span className="text-muted-foreground font-normal">(usada também na proposta)</span></Label>
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-xl border border-border bg-muted/40 grid place-items-center overflow-hidden flex-shrink-0">
                  {form.logo_url ? <img src={form.logo_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                </span>
                {isOwner && (
                  <>
                    <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs cursor-pointer hover:bg-muted/50">
                      {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}{form.logo_url ? "Trocar" : "Enviar logo"}
                      <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={e => onLogoFile(e.target.files?.[0])} />
                    </label>
                    {form.logo_url && <button type="button" onClick={() => { setForm(f => ({ ...f, logo_url: "" })); updateCompany(company.id, { logo_url: null }); }} className="text-[11px] text-muted-foreground hover:text-destructive">remover</button>}
                  </>
                )}
              </div>
            </div>
            {isOwner && <Button size="sm" onClick={saveDados} disabled={savingDados} className="gap-1.5"><Save className="h-3.5 w-3.5" />{savingDados ? "Salvando..." : "Salvar dados"}</Button>}
          </CardContent></Card>
        </TabsContent>

        {/* PREFERÊNCIAS */}
        <TabsContent value="prefs" className="mt-4">
          <Card className="shadow-soft"><CardContent className="p-5 space-y-3">
            <div className="flex items-start gap-2">
              <Package className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1"><Label className="text-sm font-medium">Controla estoque/produção</Label><p className="text-[11px] text-muted-foreground">Mostra a aba Estoque e a ficha técnica. Desligue para serviços.</p></div>
              <Switch checked={controlsStock} disabled={!isOwner} onCheckedChange={(v) => updateCompany(company.id, { controla_estoque: v })} />
            </div>
            {controlsStock && (
              <div>
                <Label className="text-xs">Segmento <span className="text-muted-foreground font-normal">(direciona as categorias de insumo)</span></Label>
                <Select value={company.nicho || "none"} disabled={!isOwner} onValueChange={(v) => updateCompany(company.id, { nicho: v === "none" ? null : v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Não especificado" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">Não especificado</SelectItem>{Object.entries(NICHOS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* EQUIPE */}
        <TabsContent value="equipe" className="mt-4">
          <Card className="shadow-soft"><CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-heading font-bold flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" />Membros</p>
              <span className="text-[11px] text-muted-foreground">{usados + 1} de 10 lugares</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="w-7 h-7 rounded-full bg-primary/10 text-primary grid place-items-center text-[11px] font-medium flex-shrink-0">{(company.name || "?").slice(0, 2).toUpperCase()}</span>
              <span className="flex-1 truncate">Você</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary">Dono</span>
            </div>
            {members.map(m => (
              <div key={m.user_id} className="flex items-center gap-2 text-sm">
                <span className="w-7 h-7 rounded-full bg-muted text-muted-foreground grid place-items-center text-[11px] font-medium flex-shrink-0">{(m.name || m.email || "?").slice(0, 2).toUpperCase()}</span>
                <div className="flex-1 min-w-0"><p className="truncate">{m.name || m.email}</p>{m.name && <p className="text-[10px] text-muted-foreground truncate">{m.email}</p>}</div>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground">Pode editar</span>
                {isOwner && <button onClick={() => removeMember(m.user_id)} aria-label="Remover" className="text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>}
              </div>
            ))}

            {isOwner && (
              <>
                <div className="rounded-xl border border-border/60 p-3 space-y-2">
                  <p className="text-xs font-medium">Convidar pessoa</p>
                  <Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Nome (ex: João da Silva)" className="h-9 text-sm" />
                  <div className="flex gap-2">
                    <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addMember(); }} placeholder="e-mail da pessoa" className="h-9 text-sm" type="email" />
                    <Button size="sm" className="h-9 gap-1.5 flex-shrink-0" disabled={inviting || !inviteEmail.trim()} onClick={addMember}><UserPlus className="h-4 w-4" />{inviting ? "Enviando..." : "Convidar"}</Button>
                  </div>
                  <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
                    <input type="checkbox" checked={restrictInvite} onChange={e => setRestrictInvite(e.target.checked)} className="accent-primary" />
                    Acesso só ao PeJota Negócios (não vê o resto do app)
                  </label>
                </div>

                {lastInvite && (
                  <div className="rounded-xl border border-success/40 bg-success/5 p-3 space-y-2">
                    <p className="text-xs font-heading font-bold flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" />Convite criado para {lastInvite.name}</p>
                    <p className="text-[11px] text-muted-foreground">Enviamos um e-mail automático. Pra garantir, copie a mensagem e mande no WhatsApp dela também:</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 gap-1.5" onClick={() => { navigator.clipboard?.writeText(waMsg); toast({ title: "Mensagem copiada", description: "Cole no WhatsApp da pessoa." }); }}><Copy className="h-4 w-4" />Copiar mensagem</Button>
                      <a href={`https://wa.me/?text=${encodeURIComponent(waMsg)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 rounded-lg border border-border text-sm hover:bg-muted/50"><MessageCircle className="h-4 w-4 text-success" />WhatsApp</a>
                    </div>
                    <p className="text-[10px] text-muted-foreground">A pessoa abre o link → cria a senha → entra direto no PeJota Negócios. O link vale por 72h.</p>
                    <button onClick={() => setLastInvite(null)} className="text-[11px] text-muted-foreground hover:text-foreground underline">ok, fechar</button>
                  </div>
                )}
              </>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* ASSINATURA (só dono) */}
        {isOwner && (
          <TabsContent value="assinatura" className="mt-4">
            <Card className="shadow-soft"><CardContent className="p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-heading font-bold flex items-center gap-1.5"><CreditCard className="h-4 w-4 text-primary" />Assentos pagos</p>
                  <span className="text-xs text-muted-foreground">{usados} de {paidSeats} usados</span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-2">Cada usuário extra é um assento mensal. Você precisa de um assento livre pra convidar.</p>
                {paidSeats === 0 ? (
                  <div className="flex items-center gap-2">
                    <Input type="number" min={1} max={9} value={seatQty} onChange={e => setSeatQty(e.target.value)} className="h-9 text-sm w-20" />
                    <Button size="sm" className="h-9 flex-1" disabled={buyingSeats} onClick={comprarAssentos}>{buyingSeats ? "Abrindo..." : "Comprar assentos (mensal)"}</Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" className="h-9 w-full gap-1.5" disabled={portalLoading} onClick={gerenciarAssinatura}><CreditCard className="h-4 w-4" />{portalLoading ? "Abrindo..." : "Alterar quantidade / cancelar"}</Button>
                )}
              </div>
              <div className="pt-3 border-t border-border/50">
                <button onClick={gerenciarAssinatura} disabled={portalLoading} className="text-sm text-primary hover:underline flex items-center gap-1.5"><CreditCard className="h-4 w-4" />Gerenciar assinatura (cartão, faturas, cancelar)</button>
              </div>
            </CardContent></Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Zona de perigo (só dono, sempre embaixo) */}
      {isOwner && (
        <Card className="shadow-soft border-destructive/30"><CardContent className="p-5 space-y-2">
          <p className="text-sm font-heading font-bold text-destructive flex items-center gap-1.5"><Trash2 className="h-4 w-4" />Excluir empresa</p>
          <p className="text-[11px] text-muted-foreground">Apaga a empresa e <strong>todos os dados</strong> (lançamentos, clientes, estoque, propostas). Não dá pra desfazer. Digite <strong>EXCLUIR</strong> para confirmar.</p>
          <div className="flex gap-2">
            <Input value={deleteText} onChange={e => setDeleteText(e.target.value)} placeholder="EXCLUIR" className="h-9 text-sm" />
            <Button variant="destructive" size="sm" className="h-9 flex-shrink-0" disabled={deleteText.trim().toUpperCase() !== "EXCLUIR"} onClick={async () => { await deleteCompany(company.id); navigate("/dashboard/negocios"); }}>Excluir</Button>
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}
