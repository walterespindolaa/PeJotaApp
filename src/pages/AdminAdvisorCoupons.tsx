import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { logError } from "@/lib/log";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Loader2, Pencil, Trash2 } from "lucide-react";

type AdvisorCoupon = {
  id: string;
  advisor_name: string;
  code: string;
  percent_off: number;
  commission_pct: number;
  active: boolean;
};

type CommissionReportRow = {
  advisor_name: string;
  code: string;
  total_indicacoes: number;
  ativas_pagantes: number;
};

const emptyForm = {
  advisor_name: "",
  code: "",
  percent_off: "",
  commission_pct: "",
  duration_months: "",
};

const AdminAdvisorCoupons = () => {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<AdvisorCoupon[]>([]);
  const [report, setReport] = useState<CommissionReportRow[]>([]);
  const [reportAvailable, setReportAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  // Gestão: ação em andamento por linha, edição e exclusão
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdvisorCoupon | null>(null);
  const [editName, setEditName] = useState("");
  const [editCommission, setEditCommission] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState<AdvisorCoupon | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);

    const { data: couponsData } = await supabase
      .from("advisor_coupons")
      .select("id, advisor_name, code, percent_off, commission_pct, active")
      .order("created_at", { ascending: false }) as any;
    setCoupons(couponsData || []);

    // View de comissões (advisor_commission_report) agrega advisor_referrals — a mesma
    // tabela em que o webhook-stripe grava as indicações. Carrega sem quebrar a tela.
    const { data: reportData, error: reportError } = await supabase
      .from("advisor_commission_report")
      .select("advisor_name, code, total_indicacoes, ativas_pagantes") as any;
    if (reportError) {
      setReportAvailable(false);
      setReport([]);
    } else {
      setReportAvailable(true);
      setReport(reportData || []);
    }

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.advisor_name.trim() || !form.code.trim()) {
      toast({ title: "Nome do assessor e código são obrigatórios", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    // duration_months vazio = vitalício (forever) → envia null.
    const body = {
      advisor_name: form.advisor_name.trim(),
      code: form.code.trim().toUpperCase(),
      percent_off: parseFloat(form.percent_off) || 0,
      commission_pct: parseFloat(form.commission_pct) || 0,
      duration_months: form.duration_months.trim() === "" ? null : parseInt(form.duration_months, 10),
    };

    // O token do admin logado é anexado automaticamente no Authorization (verifyAdmin valida).
    const { data, error } = await supabase.functions.invoke("admin-create-advisor-coupon", { body });

    if (error || (data as any)?.error) {
      const msg = (data as any)?.error || error?.message || "Erro desconhecido";
      toast({ title: "Erro ao criar cupom", description: msg, variant: "destructive" });
      setSubmitting(false);
      return;
    }

    toast({ title: "Cupom de assessor criado" });
    setForm(emptyForm);
    setSubmitting(false);
    load();
  };

  const handleToggle = async (c: AdvisorCoupon) => {
    setBusyId(c.id);
    const { data, error } = await supabase.functions.invoke("admin-manage-advisor-coupon", {
      body: { action: "toggle", coupon_id: c.id, active: !c.active },
    });
    if (error || (data as any)?.error) {
      const msg = (data as any)?.error || error?.message || "Erro desconhecido";
      logError("advisor-coupon toggle error:", error || data);
      toast({ title: "Erro ao atualizar status", description: msg, variant: "destructive" });
    } else {
      toast({ title: (data as any)?.active ? "Cupom reativado" : "Cupom desativado" });
    }
    setBusyId(null);
    load();
  };

  const openEdit = (c: AdvisorCoupon) => {
    setEditing(c);
    setEditName(c.advisor_name);
    setEditCommission(String(c.commission_pct));
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!editName.trim()) {
      toast({ title: "Informe o nome do assessor", variant: "destructive" });
      return;
    }
    setSavingEdit(true);
    const { data, error } = await supabase.functions.invoke("admin-manage-advisor-coupon", {
      body: {
        action: "update",
        coupon_id: editing.id,
        advisor_name: editName.trim(),
        commission_pct: parseFloat(editCommission) || 0,
      },
    });
    if (error || (data as any)?.error) {
      const msg = (data as any)?.error || error?.message || "Erro desconhecido";
      logError("advisor-coupon update error:", error || data);
      toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
      setSavingEdit(false);
      return;
    }
    toast({ title: "Cupom atualizado" });
    setEditing(null);
    setSavingEdit(false);
    load();
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    const { data, error } = await supabase.functions.invoke("admin-manage-advisor-coupon", {
      body: { action: "delete", coupon_id: deleting.id },
    });
    if (error || (data as any)?.error) {
      const msg = (data as any)?.error || error?.message || "Erro desconhecido";
      logError("advisor-coupon delete error:", error || data);
      toast({ title: "Erro ao excluir", description: msg, variant: "destructive" });
    } else if ((data as any)?.softDeleted === true) {
      toast({ title: "Esse cupom já tinha indicações, então foi desativado em vez de excluído (pra preservar o histórico de comissão)." });
    } else {
      toast({ title: "Cupom excluído" });
    }
    setDeleting(null);
    setDeleteBusy(false);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-heading font-bold">Cupons de Assessor</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Crie códigos de indicação para assessores e acompanhe as comissões.
        </p>
      </div>

      {/* Formulário */}
      <Card className="shadow-soft rounded-2xl">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <Label>Nome do assessor *</Label>
              <Input
                value={form.advisor_name}
                onChange={e => setForm(f => ({ ...f, advisor_name: e.target.value }))}
                placeholder="Ex: João Silva"
              />
            </div>
            <div>
              <Label>Código *</Label>
              <Input
                value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="EX: JOAO10"
              />
            </div>
            <div>
              <Label>Desconto (%)</Label>
              <Input
                type="number"
                value={form.percent_off}
                onChange={e => setForm(f => ({ ...f, percent_off: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Comissão (%)</Label>
              <Input
                type="number"
                value={form.commission_pct}
                onChange={e => setForm(f => ({ ...f, commission_pct: e.target.value }))}
                placeholder="0"
              />
            </div>
            <div>
              <Label>Duração (meses)</Label>
              <Input
                type="number"
                value={form.duration_months}
                onChange={e => setForm(f => ({ ...f, duration_months: e.target.value }))}
                placeholder="Vazio = vitalício"
              />
            </div>
          </div>

          <Button onClick={handleCreate} disabled={submitting} className="mt-4 rounded-xl gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Criar cupom
          </Button>
        </CardContent>
      </Card>

      {/* Lista de cupons */}
      <Card className="shadow-soft rounded-2xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assessor</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Carregando…</TableCell></TableRow>
              ) : coupons.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Nenhum cupom de assessor.</TableCell></TableRow>
              ) : coupons.map(c => (
                <TableRow key={c.id}>
                  <TableCell>{c.advisor_name}</TableCell>
                  <TableCell><span className="font-mono font-bold text-sm">{c.code}</span></TableCell>
                  <TableCell>{c.percent_off}%</TableCell>
                  <TableCell>{c.commission_pct}%</TableCell>
                  <TableCell>
                    <Badge variant={c.active ? "default" : "secondary"}>{c.active ? "Ativo" : "Inativo"}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        disabled={busyId === c.id}
                        onClick={() => handleToggle(c)}
                      >
                        {busyId === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (c.active ? "Desativar" : "Reativar")}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Editar" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-600 hover:text-red-700"
                        title="Excluir"
                        onClick={() => setDeleting(c)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Relatório de comissões (só aparece se a view existir) */}
      {reportAvailable && (
        <div className="space-y-3">
          <h3 className="text-sm font-heading font-bold text-muted-foreground">Relatório de comissões</h3>
          <Card className="shadow-soft rounded-2xl">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Assessor</TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Total indicações</TableHead>
                    <TableHead>Ativas (pagantes)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem indicações ainda.</TableCell></TableRow>
                  ) : report.map(r => (
                    <TableRow key={`${r.code}-${r.advisor_name}`}>
                      <TableCell>{r.advisor_name}</TableCell>
                      <TableCell><span className="font-mono font-bold text-sm">{r.code}</span></TableCell>
                      <TableCell>{r.total_indicacoes}</TableCell>
                      <TableCell>{r.ativas_pagantes}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal de edição */}
      <Dialog open={editing !== null} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar cupom de assessor</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editing && (
              <p className="text-xs text-muted-foreground">
                Código <span className="font-mono font-bold">{editing.code}</span>
              </p>
            )}
            <div>
              <Label>Nome do assessor</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Nome do assessor" />
            </div>
            <div>
              <Label>Comissão (%)</Label>
              <Input type="number" value={editCommission} onChange={e => setEditCommission(e.target.value)} placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)} disabled={savingEdit}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit} className="gap-2">
              {savingEdit && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog open={deleting !== null} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cupom?</AlertDialogTitle>
            <AlertDialogDescription>
              Vamos tentar excluir o cupom {deleting ? <span className="font-mono font-bold">{deleting.code}</span> : null}. Se ele já tiver indicações, será apenas desativado para preservar o histórico de comissão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              disabled={deleteBusy}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminAdvisorCoupons;
