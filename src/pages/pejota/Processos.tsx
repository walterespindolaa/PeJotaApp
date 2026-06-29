import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCompanies } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BookOpen, Building2, Save, Sparkles, Pencil, Eye } from "lucide-react";
import RichText from "@/components/pejota/RichText";

const db = supabase as any;

export default function Processos() {
  const { user } = useAuth();
  const { selected, loading: companiesLoading } = useCompanies();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const isAdmin = selected?.user_id === user?.id;

  const load = useCallback(async () => {
    if (!selected) return;
    const { data } = await db.from("company_playbooks").select("title, content, updated_at").eq("company_id", selected.id).eq("section_key", "geral").maybeSingle();
    setTitle(data?.title || "Processos e instruções da empresa");
    setContent(data?.content || "");
    setUpdatedAt(data?.updated_at || null);
    setEditing(false);
  }, [selected]);
  useEffect(() => { load(); }, [load]);

  const salvar = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await db.from("company_playbooks").upsert({
      company_id: selected.id, section_key: "geral", title: title.trim() || "Processos e instruções da empresa",
      content, updated_by: user?.id, updated_at: new Date().toISOString(),
    }, { onConflict: "company_id,section_key" });
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Processos salvos", description: "Sua equipe já vê as instruções atualizadas." });
    load();
  };

  // Flyer de consultoria
  const [flyerOpen, setFlyerOpen] = useState(false);
  const [lead, setLead] = useState({ nome: "", empresa: "", email: "", telefone: "", mensagem: "" });
  const [enviando, setEnviando] = useState(false);
  const enviarLead = async () => {
    if (!lead.nome.trim() || !(lead.email.trim() || lead.telefone.trim())) { toast({ title: "Informe nome e um contato (e-mail ou telefone)", variant: "destructive" }); return; }
    setEnviando(true);
    const { error } = await db.from("consultoria_leads").insert({ company_id: selected?.id || null, ...lead });
    setEnviando(false);
    if (error) { toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Recebido! 🎉", description: "Vamos entrar em contato para montar o PeJota com os processos da sua empresa." });
    setFlyerOpen(false); setLead({ nome: "", empresa: "", email: "", telefone: "", mensagem: "" });
  };

  if (!companiesLoading && !selected) return (
    <div className="max-w-5xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para ver os processos.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0"><BookOpen className="w-5 h-5" /></div>
          <div><h1 className="text-xl font-heading font-semibold">Processos e manual da equipe</h1>
          <p className="text-sm text-muted-foreground">O passo a passo do seu negócio, para a equipe seguir sem se perder {selected ? `· ${selected.name}` : ""}.</p></div>
        </div>
        {isAdmin && (editing
          ? <div className="flex gap-2"><Button variant="ghost" onClick={() => load()}>Cancelar</Button><Button onClick={salvar} disabled={saving} className="gap-2"><Save className="w-4 h-4" />{saving ? "Salvando…" : "Salvar"}</Button></div>
          : <Button variant="outline" onClick={() => setEditing(true)} className="gap-2"><Pencil className="w-4 h-4" /> Editar</Button>
        )}
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
          <Eye className="w-3.5 h-3.5" /> Você está vendo as instruções definidas pelo administrador. Em caso de dúvida, fale com o responsável.
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          {editing
            ? <Input value={title} onChange={e => setTitle(e.target.value)} className="text-base font-medium" placeholder="Título" />
            : <CardTitle className="text-base">{title}</CardTitle>}
        </CardHeader>
        <CardContent>
          <RichText value={content} onChange={setContent} readOnly={!editing} placeholder="Ex.: 1) Como cadastrar um lead. 2) Quando enviar a proposta. 3) Como dar baixa no caixa…" />
          {updatedAt && !editing && <p className="text-[11px] text-muted-foreground mt-3">Atualizado em {new Date(updatedAt).toLocaleDateString("pt-BR")}.</p>}
        </CardContent>
      </Card>

      {/* Flyer de consultoria (visível p/ admin) */}
      {isAdmin && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary grid place-items-center flex-shrink-0"><Sparkles className="w-5 h-5" /></div>
            <div className="flex-1">
              <p className="text-sm font-semibold">Quer o PeJota com os processos da sua empresa já configurados?</p>
              <p className="text-sm text-muted-foreground">Implantação personalizada: a gente mapeia o fluxo do seu negócio e deixa cada etapa pronta para a sua equipe seguir.</p>
            </div>
            <Button onClick={() => setFlyerOpen(true)} className="flex-shrink-0">Quero saber mais</Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={flyerOpen} onOpenChange={setFlyerOpen}><DialogContent>
        <DialogHeader><DialogTitle>Implantação personalizada do PeJota</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-xs text-muted-foreground">Preencha que entramos em contato para montar o sistema com os processos da sua empresa.</p>
          <div><Label className="text-xs">Seu nome</Label><Input value={lead.nome} onChange={e => setLead(s => ({ ...s, nome: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Empresa</Label><Input value={lead.empresa} onChange={e => setLead(s => ({ ...s, empresa: e.target.value }))} /></div>
            <div><Label className="text-xs">Telefone / WhatsApp</Label><Input value={lead.telefone} onChange={e => setLead(s => ({ ...s, telefone: e.target.value }))} /></div>
          </div>
          <div><Label className="text-xs">E-mail</Label><Input type="email" value={lead.email} onChange={e => setLead(s => ({ ...s, email: e.target.value }))} /></div>
          <div><Label className="text-xs">O que você precisa? (opcional)</Label><Input value={lead.mensagem} onChange={e => setLead(s => ({ ...s, mensagem: e.target.value }))} /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => setFlyerOpen(false)}>Fechar</Button><Button onClick={enviarLead} disabled={enviando}>{enviando ? "Enviando…" : "Enviar"}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
