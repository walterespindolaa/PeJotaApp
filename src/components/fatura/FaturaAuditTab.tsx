import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, ShieldCheck, Lightbulb } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const EVENT_LABELS: Record<string, string> = {
  statement_uploaded: "Fatura enviada",
  provider_detected: "Provider detectado",
  parser_completed: "Parser concluído",
  parser_error: "Erro no parser",
  parser_failed: "Parser falhou",
  rules_applied: "Regras aplicadas",
  rules_error: "Erro nas regras",
  cache_hit: "Cache utilizado",
  ai_called: "IA chamada",
  ai_categorized: "IA categorizada",
  ai_error: "Erro na IA",
  ai_extract_fallback: "Fallback IA (extração)",
  integrity_failed: "Integridade falhou",
  duplicates_detected: "Duplicatas detectadas",
  applied: "Lançamentos aplicados",
  statement_applied: "Fatura aplicada",
  apply_failed: "Falha ao aplicar",
  statement_failed: "Fatura falhou",
  statement_deleted: "Fatura excluída",
  storage_error: "Erro de armazenamento",
  cleanup_ran: "Limpeza executada",
  rate_limited: "Rate limit atingido",
  idempotency_conflict: "Conflito de idempotência",
  too_few_transactions: "Poucas transações",
  total_mismatch: "Total divergente",
  absurd_value: "Valor absurdo",
};

const EVENT_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  applied: "default",
  statement_applied: "default",
  parser_completed: "default",
  apply_failed: "destructive",
  statement_failed: "destructive",
  parser_error: "destructive",
  parser_failed: "destructive",
  ai_error: "destructive",
  rules_error: "destructive",
  storage_error: "destructive",
  statement_deleted: "destructive",
  rate_limited: "destructive",
  integrity_failed: "destructive",
  too_few_transactions: "destructive",
  total_mismatch: "destructive",
  absurd_value: "destructive",
  ai_extract_fallback: "secondary",
  cache_hit: "secondary",
};

interface Props {
  statementId: string | null;
}

export default function FaturaAuditTab({ statementId }: Props) {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    let query = supabase.from("credit_card_audit_events" as any).select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200);
    if (statementId) query = query.eq("statement_id", statementId);

    query.then(({ data }) => { setEvents((data as any) || []); setLoading(false); });
  }, [user, statementId]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (!events.length) return (
    <div className="text-center py-16 text-muted-foreground">
      <Activity className="h-10 w-10 mx-auto mb-3 opacity-30" />
      <p>Nenhum evento registrado.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="h-4 w-4 mt-0.5 flex-shrink-0 text-success" />
        <div>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger className="underline decoration-dotted cursor-help">
                Transparência de uso da IA
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Este sistema usa IA apenas para classificar transações financeiras.
                Nenhuma informação pessoal é armazenada pela IA ou usada para treinamento.
                Os dados são processados de forma efêmera e descartados após a classificação.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {" · "}Todos os eventos de processamento são registrados para auditoria e conformidade LGPD.
        </div>
      </div>

      <div className="overflow-x-auto border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evento</TableHead>
              <TableHead>Detalhes</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((e: any) => {
              const isFailure = EVENT_VARIANTS[e.event_type] === "destructive";
              return (
                <TableRow key={e.id} className={isFailure ? "bg-destructive/5" : ""}>
                  <TableCell>
                    <Badge variant={EVENT_VARIANTS[e.event_type] || "outline"} className="text-xs">
                      {EVENT_LABELS[e.event_type] || e.event_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[400px]">
                    <pre className="whitespace-pre-wrap font-mono text-[10px]">{JSON.stringify(e.detail, null, 2)}</pre>
                    {isFailure && (
                      <p className="mt-1 text-[11px] text-destructive font-medium inline-flex items-start gap-1.5">
                        <Lightbulb className="h-3 w-3 mt-0.5 flex-shrink-0" />Tente novamente · envie PDF desbloqueado · use CSV · ou contate suporte
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString("pt-BR")}
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
