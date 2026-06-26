import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { CreditCard, Eye, Trash2, Loader2, Bot } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { logError } from "@/lib/log";

interface Statement {
  id: string;
  statement_month: string;
  source_name: string;
  provider: string;
  total_amount: number;
  total_items: number;
  status: string;
  estimated_cost_usd: number;
  ai_calls: number;
  rule_items_count: number;
  cache_items_count: number;
  ai_items_count: number;
  created_at: string;
  file_path: string | null;
}

interface Props {
  onOpenStatement: (id: string, month: string) => void;
  refreshKey: number;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  uploading: { label: "Enviando", variant: "outline" },
  parsing: { label: "Processando", variant: "outline" },
  reviewing: { label: "Em revisão", variant: "secondary" },
  reviewing_low_confidence: { label: "Revisão (leitura parcial)", variant: "secondary" },
  applied: { label: "Aplicada", variant: "default" },
  failed: { label: "Falha", variant: "destructive" },
  failed_validation: { label: "Falha de validação", variant: "destructive" },
};

export default function FaturaHistoryTab({ onOpenStatement, refreshKey }: Props) {
  const { user } = useAuth();
  const { fmt } = usePrivacyFmt();
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProvider, setFilterProvider] = useState("all");

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase.from("credit_card_statements" as any)
      .select("id,statement_month,source_name,provider,total_amount,total_items,status,estimated_cost_usd,ai_calls,rule_items_count,cache_items_count,ai_items_count,created_at,file_path")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setStatements((data as any) || []); setLoading(false); });
  }, [user, refreshKey]);

  const deleteStatement = async (id: string) => {
    if (!user) return;
    setDeleting(id);
    try {
      // 1. Get statement info (file_path)
      const stmt = statements.find(s => s.id === id);
      const { data: stmtData } = await supabase.from("credit_card_statements" as any)
        .select("file_path").eq("id", id).single();
      const filePath = (stmtData as any)?.file_path || stmt?.file_path;

      // 2. Remove PDF from storage
      if (filePath) {
        await supabase.storage.from("faturas").remove([filePath]);
      }

      // 3. Count lines for audit record
      const { data: lines } = await supabase.from("credit_card_statement_lines" as any)
        .select("id").eq("statement_id", id);
      const lineCount = lines?.length || 0;

      // 4. Log deletion in audit BEFORE deleting anything (audit event stays with statement)
      await supabase.from("credit_card_audit_events" as any).insert({
        statement_id: id, user_id: user.id, event_type: "statement_deleted",
        detail: { deleted_at: new Date().toISOString(), items_cleaned: lineCount },
      } as any);

      // 5. Delete AI cache by statement_id (safe — won't affect other faturas)
      await (supabase.from("ai_inference_cache") as any).delete()
        .eq("user_id", user.id).eq("statement_id", id);

      // 6. Delete statement lines
      await supabase.from("credit_card_statement_lines" as any).delete().eq("statement_id", id);

      // 7. Delete audit events (including the one we just created — it served its purpose in logs)
      await supabase.from("credit_card_audit_events" as any).delete().eq("statement_id", id);

      // 8. Delete the statement itself
      await supabase.from("credit_card_statements" as any).delete().eq("id", id);

      setStatements(prev => prev.filter(s => s.id !== id));
      toast({ title: "Fatura excluída", description: "PDF, transações, cache IA e auditoria foram removidos." });
    } catch (e: any) {
      logError("Delete error:", e);
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const months = [...new Set(statements.map(s => s.statement_month))].sort().reverse();
  const providers = [...new Set(statements.map(s => s.source_name))];

  const filtered = statements.filter(s => {
    if (filterMonth !== "all" && s.statement_month !== filterMonth) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (filterProvider !== "all" && s.source_name !== filterProvider) return false;
    return true;
  });

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!statements.length) return (
    <div className="text-center py-16 text-muted-foreground">
      <CreditCard className="h-12 w-12 mx-auto mb-3 opacity-20" />
      <p className="font-medium">Nenhuma fatura importada ainda.</p>
      <p className="text-xs mt-1">Envie sua primeira fatura na aba Importação.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filterMonth} onValueChange={setFilterMonth}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Mês" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os meses</SelectItem>
            {months.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterProvider} onValueChange={setFilterProvider}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Banco" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {providers.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="reviewing">Em revisão</SelectItem>
            <SelectItem value="applied">Aplicada</SelectItem>
            <SelectItem value="failed">Falha</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Mês</TableHead>
              <TableHead>Banco</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Itens</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">IA custo</TableHead>
              <TableHead className="text-right">Regras/Cache/IA</TableHead>
              <TableHead>Importada em</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(s => {
              const st = STATUS_MAP[s.status] || { label: s.status, variant: "outline" as const };
              return (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.statement_month}</TableCell>
                  <TableCell className="text-xs">{s.source_name}</TableCell>
                  <TableCell className="text-right text-xs">{fmt(Number(s.total_amount))}</TableCell>
                  <TableCell className="text-right text-xs">{s.total_items}</TableCell>
                  <TableCell><Badge variant={st.variant} className="text-[10px]">{st.label}</Badge></TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {s.ai_calls > 0 && (
                      <span className="flex items-center justify-end gap-1">
                        <Bot className="h-3 w-3" /> US$ {Number(s.estimated_cost_usd).toFixed(4)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {s.rule_items_count || 0}/{s.cache_items_count || 0}/{s.ai_items_count || 0}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onOpenStatement(s.id, s.statement_month)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" disabled={deleting === s.id}>
                          {deleting === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir fatura?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Isso removerá completamente: PDF armazenado, transações, cache de IA relacionado e eventos de auditoria.
                            Despesas já lançadas não serão afetadas.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteStatement(s.id)}>Excluir tudo</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
