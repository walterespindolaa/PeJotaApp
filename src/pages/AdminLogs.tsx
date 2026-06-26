import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import ErrorLogPanel from "@/components/admin/ErrorLogPanel";

type LogEntry = {
  id: string; admin_id: string | null; action: string;
  target_user_id: string | null; payload: any; created_at: string;
};

const actionLabels: Record<string, { label: string; color: string }> = {
  admin_activate: { label: "Ativar", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  admin_block: { label: "Bloquear", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  admin_bonus: { label: "Bônus", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  admin_reset_password: { label: "Reset Senha", color: "bg-primary/10 text-primary" },
  admin_delete_user_lgpd: { label: "Exclusão LGPD", color: "bg-destructive/10 text-destructive" },
  webhook_kiwify_paid: { label: "Kiwify Pago", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  webhook_kiwify_refunded: { label: "Kiwify Reembolso", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  webhook_cakto_paid: { label: "Cakto Pago", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
};

const AdminLogs = () => {
  const { toast } = useToast();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState("all");
  const [filterUser, setFilterUser] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const body: any = { action: "logs", limit: 200 };
    if (filterAction && filterAction !== "all") body.filterAction = filterAction;
    if (filterUser) body.filterUser = filterUser;

    const { data, error } = await supabase.functions.invoke("admin-users", { body });
    if (error) toast({ title: "Erro ao carregar logs", variant: "destructive" });
    else setLogs(data?.logs || []);
    setLoading(false);
  }, [filterAction, filterUser, toast]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  return (
    <div className="space-y-6 animate-fade-in">
      <ErrorLogPanel />
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterAction} onValueChange={setFilterAction}>
          <SelectTrigger className="w-[200px] rounded-xl"><SelectValue placeholder="Filtrar por ação" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            {Object.entries(actionLabels).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input placeholder="Filtrar por user ID..." value={filterUser} onChange={e => setFilterUser(e.target.value)} className="w-[280px] rounded-xl" />
        <Button variant="outline" className="rounded-xl gap-2" onClick={fetchLogs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>

      <Card className="shadow-soft rounded-2xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Usuário Alvo</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mx-auto" /></TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum log encontrado.</TableCell></TableRow>
                ) : logs.map(log => {
                  const meta = actionLabels[log.action] || { label: log.action, color: "bg-muted text-foreground" };
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell><Badge className={`rounded-lg text-[10px] border-0 ${meta.color}`}>{meta.label}</Badge></TableCell>
                      <TableCell className="font-mono text-[10px] max-w-[120px] truncate">{log.admin_id?.slice(0, 8) || "system"}</TableCell>
                      <TableCell className="font-mono text-[10px] max-w-[120px] truncate">{log.target_user_id?.slice(0, 8) || "—"}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{log.payload ? JSON.stringify(log.payload) : "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogs;
