import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Copy } from "lucide-react";

type Partner = { id: string; name: string };
type Coupon = {
  id: string; partner_id: string; code: string; description: string | null; status: string;
  pricing_model: string; plan_slug: string | null;
  client_discount_type: string | null; client_discount_value: number;
  partner_commission_type: string | null; partner_commission_value: number;
  partner_pays_full: boolean; client_cost_zero: boolean;
  usage_limit: number | null; usage_count: number;
  valid_from: string | null; valid_until: string | null;
  created_at: string; partners?: { name: string };
};

const PRICING_MODELS = [
  { value: "free_for_client_partner_pays", label: "Grátis p/ cliente (parceiro paga)" },
  { value: "client_discount", label: "Desconto p/ cliente" },
  { value: "partner_commission_per_client", label: "Comissão p/ parceiro" },
  { value: "hybrid", label: "Híbrido" },
  { value: "internal_override", label: "Interno / VIP" },
];

const PLAN_OPTIONS = [
  { value: "__none", label: "Nenhum (manter padrão)" },
  { value: "atlas_essencial", label: "Atlas Essencial" },
  { value: "atlas_pro", label: "Atlas Pro" },
  { value: "atlas_elite", label: "Atlas Elite" },
];

const DISCOUNT_TYPES = [
  { value: "none", label: "Nenhum" },
  { value: "percentage", label: "Percentual (%)" },
  { value: "fixed", label: "Valor fixo (R$)" },
];

const emptyForm = {
  partner_id: "", code: "", description: "", pricing_model: "client_discount", plan_slug: "__none",
  client_discount_type: "none", client_discount_value: "0",
  partner_commission_type: "none", partner_commission_value: "0",
  partner_pays_full: false, client_cost_zero: false,
  usage_limit: "", valid_from: "", valid_until: "",
};

const AdminCoupons = () => {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("partner_coupons").select("*, partners(name)").order("created_at", { ascending: false }) as any,
      supabase.from("partners").select("id, name").eq("status", "active").order("name") as any,
    ]);
    setCoupons(c || []);
    setPartners(p || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.partner_id || !form.code.trim()) {
      toast({ title: "Parceiro e código são obrigatórios", variant: "destructive" });
      return;
    }
    const payload: any = {
      partner_id: form.partner_id,
      code: form.code.trim().toUpperCase(),
      description: form.description.trim() || null,
      pricing_model: form.pricing_model,
      plan_slug: form.plan_slug === "__none" ? null : (form.plan_slug || null),
      client_discount_type: form.client_discount_type,
      client_discount_value: parseFloat(form.client_discount_value) || 0,
      partner_commission_type: form.partner_commission_type,
      partner_commission_value: parseFloat(form.partner_commission_value) || 0,
      partner_pays_full: form.partner_pays_full,
      client_cost_zero: form.client_cost_zero,
      usage_limit: form.usage_limit ? parseInt(form.usage_limit) : null,
      valid_from: form.valid_from || null,
      valid_until: form.valid_until || null,
    };

    // Auto-set flags based on pricing model
    if (form.pricing_model === "free_for_client_partner_pays") {
      payload.client_cost_zero = true;
      payload.partner_pays_full = true;
    }

    if (editing) {
      payload.updated_at = new Date().toISOString();
      const { error } = await supabase.from("partner_coupons").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Cupom atualizado" });
    } else {
      const { error } = await supabase.from("partner_coupons").insert(payload);
      if (error) {
        if (error.message.includes("duplicate")) toast({ title: "Código já existe", variant: "destructive" });
        else toast({ title: "Erro", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Cupom criado" });
    }
    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
    load();
  };

  const toggleStatus = async (c: Coupon) => {
    const ns = c.status === "active" ? "inactive" : "active";
    await supabase.from("partner_coupons").update({ status: ns, updated_at: new Date().toISOString() } as any).eq("id", c.id);
    load();
  };

  const openEdit = (c: Coupon) => {
    setEditing(c);
    setForm({
      partner_id: c.partner_id, code: c.code, description: c.description || "",
      pricing_model: c.pricing_model, plan_slug: c.plan_slug || "__none",
      client_discount_type: c.client_discount_type || "none",
      client_discount_value: String(c.client_discount_value || 0),
      partner_commission_type: c.partner_commission_type || "none",
      partner_commission_value: String(c.partner_commission_value || 0),
      partner_pays_full: c.partner_pays_full, client_cost_zero: c.client_cost_zero,
      usage_limit: c.usage_limit ? String(c.usage_limit) : "",
      valid_from: c.valid_from ? c.valid_from.slice(0, 10) : "",
      valid_until: c.valid_until ? c.valid_until.slice(0, 10) : "",
    });
    setOpen(true);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Código copiado!" });
  };

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const pricingLabel = (m: string) => PRICING_MODELS.find(p => p.value === m)?.label || m;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-heading font-bold">Cupons Comerciais</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }} className="rounded-xl gap-2"><Plus className="h-4 w-4" /> Novo Cupom</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Editar Cupom" : "Novo Cupom"}</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div><Label>Parceiro *</Label>
                <Select value={form.partner_id} onValueChange={v => setForm(f => ({ ...f, partner_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Código *</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="EX: ASSESSOR2025" /></div>
              <div><Label>Descrição interna</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
              <div><Label>Modelo comercial</Label>
                <Select value={form.pricing_model} onValueChange={v => setForm(f => ({ ...f, pricing_model: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRICING_MODELS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Plano associado</Label>
                <Select value={form.plan_slug} onValueChange={v => setForm(f => ({ ...f, plan_slug: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLAN_OPTIONS.map(o => <SelectItem key={o.value || "__none"} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Desconto cliente</Label>
                  <Select value={form.client_discount_type} onValueChange={v => setForm(f => ({ ...f, client_discount_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DISCOUNT_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Valor</Label><Input type="number" value={form.client_discount_value} onChange={e => setForm(f => ({ ...f, client_discount_value: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Comissão parceiro</Label>
                  <Select value={form.partner_commission_type} onValueChange={v => setForm(f => ({ ...f, partner_commission_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DISCOUNT_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Valor</Label><Input type="number" value={form.partner_commission_value} onChange={e => setForm(f => ({ ...f, partner_commission_value: e.target.value }))} /></div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={form.client_cost_zero} onCheckedChange={v => setForm(f => ({ ...f, client_cost_zero: v }))} />
                  <Label className="text-sm">Cliente custo zero</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={form.partner_pays_full} onCheckedChange={v => setForm(f => ({ ...f, partner_pays_full: v }))} />
                  <Label className="text-sm">Parceiro assume custo</Label>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><Label>Limite de usos</Label><Input type="number" value={form.usage_limit} onChange={e => setForm(f => ({ ...f, usage_limit: e.target.value }))} placeholder="Ilimitado" /></div>
                <div />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Válido de</Label><Input type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} /></div>
                <div><Label>Válido até</Label><Input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} /></div>
              </div>
              <Button onClick={handleSave} className="w-full rounded-xl">{editing ? "Salvar" : "Criar Cupom"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-soft rounded-2xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Parceiro</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhum cupom.</TableCell></TableRow>
              ) : coupons.map(c => (
                <TableRow key={c.id}>
                  <TableCell>
                    <span className="font-mono font-bold text-sm">{c.code}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={() => copyCode(c.code)}><Copy className="h-3 w-3" /></Button>
                  </TableCell>
                  <TableCell>{(c as any).partners?.name || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{pricingLabel(c.pricing_model)}</Badge></TableCell>
                  <TableCell className="text-xs">{c.plan_slug || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "active" ? "default" : "secondary"} className="cursor-pointer" onClick={() => toggleStatus(c)}>
                      {c.status === "active" ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell>{c.usage_count}{c.usage_limit ? `/${c.usage_limit}` : ""}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
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

export default AdminCoupons;
