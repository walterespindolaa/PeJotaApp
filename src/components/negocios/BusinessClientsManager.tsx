import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Users, Search, Trash2, Cake } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Client {
  id: string;
  name: string;
  document: string | null;
  document_type: "cpf" | "cnpj" | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  data_nascimento: string | null;
  active: boolean;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  initialEditId?: string | null;
}

const formatDocument = (value: string, type: "cpf" | "cnpj") => {
  const digits = value.replace(/\D/g, "");
  if (type === "cpf") {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4").substring(0, 14);
  }
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5").substring(0, 18);
};

export default function BusinessClientsManager({ open, onOpenChange, companyId, initialEditId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [documentType, setDocumentType] = useState<"cpf" | "cnpj">("cpf");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    if (!user || !companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from("business_clients")
      .select("*")
      .eq("company_id", companyId)
      .order("name");
    setClients((data || []) as Client[]);
    setLoading(false);
  }, [user, companyId]);

  useEffect(() => { if (open) fetchClients(); }, [open, fetchClients]);

  const resetForm = () => {
    setEditId(null); setName(""); setDocumentType("cpf");
    setDocument(""); setEmail(""); setPhone(""); setNotes(""); setDataNascimento(""); setActive(true);
  };

  const openNew = () => { resetForm(); setFormOpen(true); };

  const openEdit = (c: Client) => {
    setEditId(c.id); setName(c.name);
    setDocumentType(c.document_type || "cpf");
    setDocument(c.document || ""); setEmail(c.email || "");
    setPhone(c.phone || ""); setNotes(c.notes || ""); setDataNascimento(c.data_nascimento || ""); setActive(c.active);
    setFormOpen(true);
  };

  // Abre direto na edição de um cliente específico (vindo da tela de detalhe).
  useEffect(() => {
    if (open && initialEditId && clients.length) {
      const c = clients.find(x => x.id === initialEditId);
      if (c && editId !== c.id) openEdit(c);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialEditId, clients]);

  const handleSave = async () => {
    if (!name.trim() || !user) return;
    setSaving(true);
    const payload = {
      user_id: user.id, company_id: companyId,
      name: name.trim(),
      document: document || null,
      document_type: documentType,
      email: email || null,
      phone: phone || null,
      notes: notes || null,
      data_nascimento: dataNascimento || null,
      active,
      updated_at: new Date().toISOString(),
    };
    if (editId) {
      await supabase.from("business_clients").update(payload as any).eq("id", editId);
      toast({ title: "Cliente atualizado" });
    } else {
      await supabase.from("business_clients").insert(payload as any);
      toast({ title: "Cliente cadastrado" });
    }
    setSaving(false);
    setFormOpen(false);
    resetForm();
    fetchClients();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from("business_clients").delete().eq("id", deleteId);
    toast({ title: "Cliente excluído" });
    setDeleteId(null);
    fetchClients();
  };

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.document || "").includes(search) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Users className="h-4 w-4" /> Base de Clientes
            </DialogTitle>
          </DialogHeader>

          <div className="flex gap-2 mb-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Buscar por nome, CPF/CNPJ ou e-mail..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
            </div>
            <Button size="sm" className="gap-1.5 h-8" onClick={openNew}>
              <Plus className="h-3.5 w-3.5" /> Novo
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}
            </p>
          ) : (
            <div className="space-y-2">
              {filtered.map(c => (
                <div key={c.id} className={`p-3 rounded-lg border flex items-center gap-3 ${c.active ? "bg-card border-border" : "bg-muted/40 border-border/50 opacity-60"}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{c.name}</span>
                      {!c.active && <Badge variant="outline" className="text-[10px]">Inativo</Badge>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {c.document && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {c.document_type?.toUpperCase()}: {c.document}
                        </span>
                      )}
                      {c.email && <span className="text-[10px] text-muted-foreground">{c.email}</span>}
                      {c.phone && <span className="text-[10px] text-muted-foreground">{c.phone}</span>}
                      {c.data_nascimento && (() => {
                        const mm = c.data_nascimento.slice(5, 7);
                        const dd = c.data_nascimento.slice(8, 10);
                        const esteMes = mm === String(new Date().getMonth() + 1).padStart(2, "0");
                        return (
                          <span className={`text-[10px] flex items-center gap-0.5 ${esteMes ? "text-primary font-medium" : "text-muted-foreground"}`}>
                            <Cake className="h-3 w-3" />{dd}/{mm}{esteMes ? " · este mês" : ""}
                          </span>
                        );
                      })()}
                    </div>
                    {c.notes && <p className="text-[10px] text-muted-foreground mt-0.5 italic truncate">{c.notes}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => openEdit(c)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-destructive hover:text-destructive" onClick={() => setDeleteId(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={v => { setFormOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">{editId ? "Editar" : "Novo"} Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Nome *</Label>
              <Input placeholder="Nome ou razão social" value={name} onChange={e => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Tipo de documento</Label>
                <Select value={documentType} onValueChange={v => { setDocumentType(v as "cpf" | "cnpj"); setDocument(""); }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">{documentType.toUpperCase()}</Label>
                <Input
                  placeholder={documentType === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                  value={document}
                  onChange={e => setDocument(formatDocument(e.target.value, documentType))}
                  inputMode="numeric"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">E-mail</Label>
                <Input placeholder="email@exemplo.com" value={email} onChange={e => setEmail(e.target.value)} type="email" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Telefone</Label>
                <Input placeholder="(00) 00000-0000" value={phone} onChange={e => setPhone(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Aniversário</Label>
              <Input type="date" value={dataNascimento} onChange={e => setDataNascimento(e.target.value)} aria-label="Data de aniversário do cliente" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Observações</Label>
              <Textarea placeholder="Notas sobre o cliente, tipo de serviço, etc." value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[60px] text-sm resize-none" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={active} onCheckedChange={setActive} />
              <Label className="text-sm">Cliente ativo</Label>
            </div>
            <Button onClick={handleSave} disabled={saving || !name.trim()} className="w-full">
              {saving ? "Salvando..." : editId ? "Salvar alterações" : "Cadastrar cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
