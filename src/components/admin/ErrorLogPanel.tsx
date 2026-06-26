import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ErrorLog {
  id: string;
  action: string;
  payload: any;
  created_at: string;
  target_user_id: string | null;
}

const ErrorLogPanel = () => {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchErrors = async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("id, action, payload, created_at, target_user_id")
        .or("action.ilike.%error%,action.ilike.%failed%,action.ilike.%invalid%,action.ilike.%rate_limited%")
        .order("created_at", { ascending: false })
        .limit(100);
      setLogs((data as any) || []);
      setLoading(false);
    };
    fetchErrors();
  }, []);

  if (loading) return <p className="text-muted-foreground p-4">Carregando logs de erro...</p>;

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-heading font-bold">Erros e incidentes recentes</h3>
      <p className="text-sm text-muted-foreground mb-4">{logs.length} registros encontrados</p>
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {logs.map((log) => (
          <div key={log.id} className="rounded-lg border border-border/40 bg-card p-3 text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive">{log.action}</span>
              <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
            </div>
            {log.target_user_id && <p className="text-xs text-muted-foreground">User: {log.target_user_id.slice(0, 8)}...</p>}
            <pre className="text-xs mt-1 text-muted-foreground whitespace-pre-wrap break-all">{JSON.stringify(log.payload, null, 2)}</pre>
          </div>
        ))}
        {logs.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum erro registrado. Sistema saudável.</p>}
      </div>
    </div>
  );
};

export default ErrorLogPanel;
