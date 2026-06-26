import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, Users } from "lucide-react";

type Partner = {
  id: string;
  name: string;
  type: string;
  status: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  created_at: string;
  client_count?: number;
};

const PARTNER_TYPES = [
  { value: "assessor", label: "Assessor" },
  { value: "contabilidade", label: "Contabilidade" },
  { value: "parceiro", label: "Parceiro" },
  { value: "interno", label: "Interno" },
];

const AdminPartners = () => {
  const { toast } = useToast();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partner | null>(null);

  const [form, setForm] = useState({ name: "", type: "parceiro", contact_email: "", contact_phone: "", notes: "" });

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data: p } = await supabase.from("partners").select("*").order("created_at", { ascending: false }) as any;
    if (p) {
      // count attributions per partner
      const { data: attr } = await supabase.from("user_partner_attributions").select("partner_id") as any;
      const counts: Record<string, number> = {};
      (attr || []).forEach((a: any) => { counts[a.partner_id] = (counts[a.partner_id] || 0) + 1; });
      setPartners(p.map((pp: any) => ({ ...pp, client_count: counts[pp.id] || 0 })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const resetForm = () => setForm({ name: "", type: "parceiro", contact_email: "", contact_phone: "", notes: "" });

  const handleSave = async () => {
    if (!form.name.trim()) { toast({ title: "Nome obrigatório", variant: "destructive" }); return; }
    const payload = {
      name: form.name.trim(),
      type: form.type,
      contact_email: form.contact_email.trim() || null,
      contact_phone: form.contact_phone.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (editing) {
      const { error } = await supabase.from("partners").update({ ...payload, updated_at: new Date().toISOString() } as any).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Parceiro atualizado" });
    } else {
      const { error } = await supabase.from("partners").insert(payload as any);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Parceiro criado" });
    }
    setOpen(false);
    setEditing(null);
    resetForm();
    fetch();
  };

  const toggleStatus = async (p: Partner) => {
    const newStatus = p.status === "active" ? "inactive" : "active";
    await supabase.from("partners").update({ status: newStatus, updated_at: new Date().toISOString() } as any).eq("id", p.id);
    fetch();
  };

  const openEdit = (p: Partner) => {
    setEditing(p);
    setForm({ name: p.name, type: p.type, contact_email: p.contact_email || "", contact_phone: p.contact_phone || "", notes: p.notes || "" });
    setOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    resetForm();
    setOpen(true);
  };

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-heading font-bold">Parceiros</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="rounded-xl gap-2"><Plus className="h-4 w-4" /> Novo Parceiro</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{editing ? "Editar Parceiro" : "Novo Parceiro"}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div><Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PARTNER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Email de contato</Label><Input value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} /></div>
              <div><Label>Telefone</Label><Input value={form.contact_phone} onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} /></div>
              <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} /></div>
              <Button onClick={handleSave} className="w-full rounded-xl">{editing ? "Salvar" : "Criar"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-soft rounded-2xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Clientes</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {partners.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum parceiro cadastrado.</TableCell></TableRow>
              ) : partners.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{p.type}</Badge></TableCell>
                  <TableCell>
                    <Badge variant={p.status === "active" ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus(p)}>
                      {p.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell><span className="flex items-center gap-1"><Users className="h-3.5 w-3.5 text-muted-foreground" />{p.client_count}</span></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.contact_email || "—"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPartners;
