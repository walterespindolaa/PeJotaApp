import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Building2, Package, Trash2, Save, Users, UserPlus, Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { type Company, companyControlsStock, NICHOS } from "@/hooks/useCompanies";

interface Member { user_id: string; email: string | null; name: string | null; role: string; }
const MEMBER_ERR: Record<string, string> = {
  not_owner: "Só o dono pode adicionar membros.",
  user_not_found: "Essa pessoa precisa ter uma conta no Atlas primeiro.",
  self: "Você já é o dono desta empresa.",
  limit: "Limite de 10 usuários atingido.",
  no_seats: "Sem assento disponível — compre um assento pra adicionar mais usuários.",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  company: Company | null;
  onUpdate: (id: string, updates: any) => Promise<void> | void;
  onArchive: (id: string) => Promise<void> | void;
}

export default function CompanySettingsDialog({ open, onOpenChange, company, onUpdate, onArchive }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [form, setForm] = useState({ name: "", cnpj: "", telefone: "", endereco: "", logo_url: "" });
  const [deleteText, setDeleteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [restrictInvite, setRestrictInvite] = useState(true);

  const loadMembers = useCallback(async (cid: string) => {
    const { data } = await supabase.rpc("list_company_members" as any, { _company_id: cid });
    setMembers(((data as unknown) as Member[]) || []);
  }, []);

  useEffect(() => {
    if (company && open) {
      setForm({
        name: company.name || "", cnpj: company.cnpj || "", telefone: company.telefone || "",
        endereco: company.endereco || "", logo_url: company.logo_url || "",
      });
      setDeleteText(""); setInviteEmail("");
      loadMembers(company.id);
    }
  }, [company, open, loadMembers]);

  const addMember = async () => {
    if (!company || !inviteEmail.trim()) return;
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("business-member-invite", {
      body: { company_id: company.id, email: inviteEmail.trim(), name: inviteName.trim() || null, restrict: restrictInvite },
    });
    setInviting(false);
    let res = (data || {}) as any;
    if (error && (error as any).context?.json) { try { res = await (error as any).context.json(); } catch { /* ignore */ } }
    if (error || res?.error) {
      toast({ title: MEMBER_ERR[res?.error] || res?.error || "Não foi possível convidar", variant: "destructive" });
      return;
    }
    setInviteName(""); setInviteEmail("");
    await loadMembers(company.id);
    toast({
      title: res?.is_new_user ? "Convite enviado por e-mail" : "Pessoa adicionada",
      description: res?.is_new_user ? "Ela vai receber um link para criar a senha e acessar." : undefined,
    });
  };
  const removeMember = async (uid: string) => {
    if (!company) return;
    setMembers(prev => prev.filter(m => m.user_id !== uid));
    await supabase.rpc("remove_company_member" as any, { _company_id: company.id, _user_id: uid });
  };

  const [seatQty, setSeatQty] = useState("1");
  const [buyingSeats, setBuyingSeats] = useState(false);
  const comprarAssentos = async () => {
    if (!company) return;
    setBuyingSeats(true);
    const { data, error } = await supabase.functions.invoke("business-seats-checkout", {
      body: { company_id: company.id, seats: Number(seatQty) || 1 },
    });
    setBuyingSeats(false);
    const res = (data || {}) as any;
    if (error || res?.error) { toast({ title: res?.error || "Não foi possível abrir o checkout", variant: "destructive" }); return; }
    if (res?.url) window.location.href = res.url;
  };

  const [portalLoading, setPortalLoading] = useState(false);
  const gerenciarAssinatura = async () => {
    setPortalLoading(true);
    const { data, error } = await supabase.functions.invoke("create-portal-session", {
      body: { return_url: window.location.origin + "/dashboard/negocios" },
    });
    setPortalLoading(false);
    const res = (data || {}) as any;
    if (error || !res?.url) { toast({ title: "Nenhuma assinatura ativa encontrada", description: "Você ainda não tem assento contratado.", variant: "default" }); return; }
    window.location.href = res.url;
  };

  if (!company) return null;
  const controlsStock = companyControlsStock(company);

  // Upload da logo (mesmo bucket/branding da proposta — fica vinculado)
  const onLogoFile = async (file?: File) => {
    if (!file || !company || !user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Logo acima de 2MB", description: "Comprima a imagem em squoosh.app e tente de novo.", variant: "destructive" });
      return;
    }
    setUploadingLogo(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("business-assets").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { setUploadingLogo(false); toast({ title: "Falha no upload", description: error.message, variant: "destructive" }); return; }
    const url = supabase.storage.from("business-assets").getPublicUrl(path).data.publicUrl;
    setForm(f => ({ ...f, logo_url: url }));
    await onUpdate(company.id, { logo_url: url });
    setUploadingLogo(false);
    toast({ title: "Logo atualizada" });
  };

  const saveDados = async () => {
    setSaving(true);
    await onUpdate(company.id, {
      name: form.name.trim() || company.name,
      cnpj: form.cnpj || null, telefone: form.telefone || null,
      endereco: form.endereco || null, logo_url: form.logo_url || null,
    });
    setSaving(false);
    toast({ title: "Dados salvos" });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-primary/10"><Building2 className="h-4 w-4 text-primary" /></span>
            Configurações · {company.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Dados da empresa */}
          <div className="space-y-3">
            <p className="text-sm font-heading font-bold">Dados da empresa</p>
            <div><Label className="text-xs">Nome</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-9 text-sm" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">CNPJ / CPF</Label><Input value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" className="h-9 text-sm" /></div>
              <div><Label className="text-xs">Telefone</Label><Input value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" className="h-9 text-sm" /></div>
            </div>
            <div><Label className="text-xs">Endereço</Label><Textarea rows={2} value={form.endereco} onChange={e => setForm(f => ({ ...f, endereco: e.target.value }))} className="text-sm resize-none" /></div>
            <div className="space-y-1.5">
              <Label className="text-xs">Logo <span className="text-muted-foreground font-normal">(usada também na proposta)</span></Label>
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-xl border border-border bg-muted/40 grid place-items-center overflow-hidden flex-shrink-0">
                  {form.logo_url ? <img src={form.logo_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                </span>
                <div className="space-y-1">
                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs cursor-pointer hover:bg-muted/50">
                    {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {form.logo_url ? "Trocar" : "Enviar logo"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={e => onLogoFile(e.target.files?.[0])} />
                  </label>
                  {form.logo_url && <button type="button" onClick={() => { setForm(f => ({ ...f, logo_url: "" })); if (company) onUpdate(company.id, { logo_url: null }); }} className="text-[10px] text-muted-foreground hover:text-destructive ml-1">remover</button>}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">PNG/JPG até 2MB. Maior?{" "}
                <a href="https://squoosh.app/" target="_blank" rel="noopener noreferrer" className="text-primary underline">comprima aqui</a>.
              </p>
            </div>
            <Button size="sm" onClick={saveDados} disabled={saving} className="gap-1.5"><Save className="h-3.5 w-3.5" />{saving ? "Salvando..." : "Salvar dados"}</Button>
          </div>

          {/* Preferências */}
          <div className="space-y-3 pt-4 border-t border-border/50">
            <p className="text-sm font-heading font-bold">Preferências</p>
            <div className="flex items-start gap-2">
              <Package className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <Label htmlFor="cfg-estoque" className="text-sm font-medium cursor-pointer">Controla estoque/produção</Label>
                <p className="text-[11px] text-muted-foreground mt-0.5">Mostra a aba Estoque e a ficha técnica. Desligue para serviços.</p>
              </div>
              <Switch id="cfg-estoque" checked={controlsStock} onCheckedChange={(v) => onUpdate(company.id, { controla_estoque: v })} />
            </div>
            {controlsStock && (
              <div>
                <Label className="text-xs">Segmento <span className="text-muted-foreground font-normal">(direciona as categorias de insumo)</span></Label>
                <Select value={company.nicho || "none"} onValueChange={(v) => onUpdate(company.id, { nicho: v === "none" ? null : v })}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Não especificado" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não especificado</SelectItem>
                    {Object.entries(NICHOS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Equipe */}
          <div className="pt-4 border-t border-border/50 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-heading font-bold flex items-center gap-1.5"><Users className="h-4 w-4 text-primary" />Equipe</p>
              <span className="text-[11px] text-muted-foreground">{members.length + 1} de 10 lugares</span>
            </div>

            {/* Dono */}
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
                <button onClick={() => removeMember(m.user_id)} aria-label="Remover" className="text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            ))}

            <div className="space-y-2 pt-1">
              <Input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Nome da pessoa (ex: João da Silva)" className="h-9 text-sm" />
              <div className="flex gap-2">
                <Input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addMember(); }} placeholder="e-mail da pessoa" className="h-9 text-sm" type="email" />
                <Button size="sm" className="h-9 gap-1.5 flex-shrink-0" disabled={inviting || !inviteEmail.trim() || members.length >= 9} onClick={addMember}><UserPlus className="h-4 w-4" />{inviting ? "Enviando..." : "Convidar"}</Button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
              <input type="checkbox" checked={restrictInvite} onChange={e => setRestrictInvite(e.target.checked)} className="accent-primary" />
              Acesso só ao Atlas Negócios (a pessoa não vê o resto do app)
            </label>
            <p className="text-[11px] text-muted-foreground">Se a pessoa ainda não tem conta, o Atlas cria uma e envia um e-mail pra ela criar a senha e acessar.</p>

            {/* Assentos pagos */}
            <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium">Assentos pagos</span>
                <span className="text-xs text-muted-foreground">{company.paid_seats || 0} contratado(s)</span>
              </div>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} max={9} value={seatQty} onChange={e => setSeatQty(e.target.value)} className="h-8 text-sm w-16" />
                <Button size="sm" variant="outline" className="h-8 text-xs flex-1" disabled={buyingSeats} onClick={comprarAssentos}>
                  {buyingSeats ? "Abrindo..." : "Comprar assentos (mensal)"}
                </Button>
              </div>
              {(company.paid_seats || 0) > 0 && (
                <Button size="sm" variant="ghost" className="h-8 text-xs w-full text-muted-foreground gap-1.5" disabled={portalLoading} onClick={gerenciarAssinatura}>
                  {portalLoading ? "Abrindo..." : "Gerenciar / cancelar assinatura"}
                </Button>
              )}
              <p className="text-[10px] text-muted-foreground">Cada usuário extra é um assento mensal. Durante o teste, convidar está liberado mesmo sem assento — a cobrança entra quando ativarmos.</p>
            </div>
          </div>

          {/* Excluir */}
          <div className="pt-4 border-t border-destructive/20">
            <p className="text-sm font-heading font-bold text-destructive flex items-center gap-1.5"><Trash2 className="h-3.5 w-3.5" />Excluir empresa</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-1.5">Apaga a empresa e <strong>todos os dados</strong> dela (lançamentos, clientes, estoque, propostas). Não dá pra desfazer. Digite <strong>EXCLUIR</strong> para confirmar.</p>
            <div className="flex gap-2">
              <Input value={deleteText} onChange={e => setDeleteText(e.target.value)} placeholder="EXCLUIR" className="h-9 text-sm" />
              <Button variant="destructive" size="sm" className="h-9 flex-shrink-0" disabled={deleteText.trim().toUpperCase() !== "EXCLUIR"}
                onClick={async () => { await onArchive(company.id); onOpenChange(false); }}>
                Excluir
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
