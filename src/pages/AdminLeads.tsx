import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ResponsiveEditDialog from "@/components/ui/responsive-edit-dialog";
import { Users, Star, Phone, Mail, Calendar, TrendingUp, Globe, Briefcase } from "lucide-react";

type Lead = {
  id: string;
  created_at: string;
  nome: string;
  email: string;
  telefone: string;
  patrimonio: string;
  tempo_investindo: string;
  teve_assessor: string;
  objetivo: string;
  observacoes: string;
  score: number;
  status: string;
  user_id: string;
};

type UserEnrichment = {
  patrimonio_financeiro: number;
  qtd_ativos: number;
  tem_internacional: boolean;
};

const STATUS_OPTIONS = [
  { value: "novo", label: "Novo", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  { value: "em_analise", label: "Em análise", color: "bg-yellow-500/10 text-yellow-600 border-yellow-200" },
  { value: "qualificado", label: "Qualificado", color: "bg-green-500/10 text-green-600 border-green-200" },
  { value: "contato_realizado", label: "Contato realizado", color: "bg-purple-500/10 text-purple-600 border-purple-200" },
  { value: "cliente", label: "Cliente", color: "bg-primary/10 text-primary border-primary/20" },
  { value: "nao_qualificado", label: "Não qualificado", color: "bg-muted text-muted-foreground border-border" },
];

const scoreStars = (score: number) => "⭐".repeat(Math.min(score, 4));

const AdminLeads = () => {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [enrichment, setEnrichment] = useState<UserEnrichment | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("advisory_leads")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Erro ao carregar leads", variant: "destructive" });
    else setLeads((data as Lead[]) || []);
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from("advisory_leads")
      .update({ status } as any)
      .eq("id", id);
    if (error) toast({ title: "Erro ao atualizar", variant: "destructive" });
    else {
      setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l));
      if (selectedLead?.id === id) setSelectedLead(prev => prev ? { ...prev, status } : null);
    }
  };

  const openDetail = async (lead: Lead) => {
    setSelectedLead(lead);
    setEnrichment(null);
    setDrawerOpen(true);

    // Fetch user enrichment data
    const [invRes] = await Promise.all([
      supabase
        .from("investimentos_financeiros")
        .select("valor_atual, tipo")
        .eq("user_id", lead.user_id),
    ]);
    const inv = (invRes.data as any[]) || [];
    setEnrichment({
      patrimonio_financeiro: inv.reduce((s: number, i: any) => s + Number(i.valor_atual || 0), 0),
      qtd_ativos: inv.length,
      tem_internacional: inv.some((i: any) => i.tipo === "Exterior"),
    });
  };

  const getStatusInfo = (status: string) =>
    STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-heading font-bold text-base">Leads de Assessoria</h2>
          <Badge variant="secondary" className="text-xs">{leads.length}</Badge>
        </div>
      </div>

      <Card className="shadow-soft rounded-2xl">
        <CardContent className="p-0">
          {leads.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum lead de assessoria recebido ainda.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Nome</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Telefone</TableHead>
                    <TableHead className="text-xs">Patrimônio</TableHead>
                    <TableHead className="text-xs">Score</TableHead>
                    <TableHead className="text-xs">Objetivo</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map(lead => {
                    const si = getStatusInfo(lead.status);
                    return (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => openDetail(lead)}
                      >
                        <TableCell className="text-xs whitespace-nowrap">
                          {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell className="text-xs font-medium">{lead.nome}</TableCell>
                        <TableCell className="text-xs">{lead.email}</TableCell>
                        <TableCell className="text-xs">{lead.telefone || "—"}</TableCell>
                        <TableCell className="text-xs">{lead.patrimonio}</TableCell>
                        <TableCell className="text-xs">{scoreStars(lead.score)}</TableCell>
                        <TableCell className="text-xs max-w-[150px] truncate">{lead.objetivo}</TableCell>
                        <TableCell onClick={e => e.stopPropagation()}>
                          <Select value={lead.status} onValueChange={v => updateStatus(lead.id, v)}>
                            <SelectTrigger className={`h-7 text-[11px] rounded-lg border ${si.color} w-[140px]`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map(s => (
                                <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <ResponsiveEditDialog
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={selectedLead?.nome ?? ""}
        size="md"
        footer={
          <Button variant="outline" className="rounded-xl ml-auto" onClick={() => setDrawerOpen(false)}>
            Fechar
          </Button>
        }
      >
        {selectedLead && (
          <>
            {/* Contact */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Contato</p>
              <div className="flex items-center gap-2 text-sm"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> {selectedLead.email}</div>
              {selectedLead.telefone && <div className="flex items-center gap-2 text-sm"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> {selectedLead.telefone}</div>}
              <div className="flex items-center gap-2 text-sm"><Calendar className="h-3.5 w-3.5 text-muted-foreground" /> {new Date(selectedLead.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
            </div>

            {/* Form data */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Dados do formulário</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Patrimônio", value: selectedLead.patrimonio },
                  { label: "Score", value: scoreStars(selectedLead.score) },
                  { label: "Tempo investindo", value: selectedLead.tempo_investindo },
                  { label: "Assessoria anterior", value: selectedLead.teve_assessor },
                ].map((item, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-muted/30">
                    <p className="text-[10px] text-muted-foreground">{item.label}</p>
                    <p className="text-xs font-medium mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
              <div className="p-2.5 rounded-xl bg-muted/30">
                <p className="text-[10px] text-muted-foreground">Objetivo principal</p>
                <p className="text-xs font-medium mt-0.5">{selectedLead.objetivo}</p>
              </div>
              {selectedLead.observacoes && (
                <div className="p-2.5 rounded-xl bg-muted/30">
                  <p className="text-[10px] text-muted-foreground">Observações</p>
                  <p className="text-xs mt-0.5">{selectedLead.observacoes}</p>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Status</p>
              <Select value={selectedLead.status} onValueChange={v => updateStatus(selectedLead.id, v)}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Enrichment */}
            {enrichment && (
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Dados na plataforma</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 rounded-xl bg-primary/5">
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      <p className="text-[10px] text-muted-foreground">PL Financeiro</p>
                    </div>
                    <p className="text-xs font-bold mt-0.5">
                      {enrichment.patrimonio_financeiro.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-primary/5">
                    <div className="flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-primary" />
                      <p className="text-[10px] text-muted-foreground">Ativos</p>
                    </div>
                    <p className="text-xs font-bold mt-0.5">{enrichment.qtd_ativos}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{enrichment.tem_internacional ? "Possui investimentos internacionais" : "Sem investimentos internacionais"}</span>
                </div>
              </div>
            )}
          </>
        )}
      </ResponsiveEditDialog>
    </div>
  );
};

export default AdminLeads;
