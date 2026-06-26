import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Database, AlertCircle, Pencil } from "lucide-react";

type Indicador = { id: string; indicador: string; valor: number; data_referencia: string | null; updated_at: string };
const pct = (v: number) => `${v.toFixed(2)}%`;

const AdminIndicadores = () => {
  const { toast } = useToast();
  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString("pt-BR")}] ${msg}`, ...prev].slice(0, 50));

  const fetchIndicadores = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("indicadores_economicos").select("*");
    if (error) addLog(`Erro: ${error.message}`);
    else setIndicadores((data as Indicador[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchIndicadores(); }, [fetchIndicadores]);

  const handleSync = async () => {
    setSyncing(true);
    addLog("Sincronizando com API BCB...");
    try {
      const { data, error } = await supabase.functions.invoke("indicadores-economicos");
      if (error) { addLog(`Erro: ${error.message}`); toast({ title: "Erro", variant: "destructive" }); }
      else { addLog(`OK: ${JSON.stringify(data)}`); toast({ title: "Indicadores atualizados" }); fetchIndicadores(); }
    } catch (e: any) { addLog(`Falha: ${e.message}`); }
    setSyncing(false);
  };

  const handleManualEdit = async (id: string) => {
    const val = parseFloat(editValue);
    if (isNaN(val) || val < 0) { toast({ title: "Valor inválido", variant: "destructive" }); return; }
    const { error } = await supabase.from("indicadores_economicos").update({ valor: val, updated_at: new Date().toISOString() } as any).eq("id", id);
    if (error) { addLog(`Erro: ${error.message}`); } else { addLog(`Atualizado: ${val}`); setEditingId(null); fetchIndicadores(); }
  };

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <Button onClick={handleSync} disabled={syncing} className="rounded-xl gap-2">
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Forçar Atualização (API BCB)"}
        </Button>
      </div>

      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="font-heading text-base flex items-center gap-2"><Database className="h-4 w-4" /> Indicadores no Banco</CardTitle></CardHeader>
        <CardContent>
          {indicadores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum indicador. Clique em "Forçar Atualização".</p>
          ) : (
            <div className="space-y-3">
              {indicadores.map(ind => (
                <div key={ind.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="rounded-lg uppercase text-xs">{ind.indicador}</Badge>
                    {editingId === ind.id ? (
                      <div className="flex items-center gap-2">
                        <Input type="number" step="0.01" value={editValue} onChange={e => setEditValue(e.target.value)} className="w-24 h-8 rounded-lg text-sm" />
                        <Button size="sm" className="h-8 rounded-lg" onClick={() => handleManualEdit(ind.id)}>Salvar</Button>
                        <Button size="sm" variant="outline" className="h-8 rounded-lg" onClick={() => setEditingId(null)}>✕</Button>
                      </div>
                    ) : (
                      <span className="text-sm font-bold">{pct(ind.valor)}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-[10px] text-muted-foreground">Ref: {ind.data_referencia || "—"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        Atualizado: {new Date(ind.updated_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(ind.id); setEditValue(String(ind.valor)); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="font-heading text-base flex items-center gap-2"><AlertCircle className="h-4 w-4" /> Logs de Operações</CardTitle></CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum log ainda.</p>
          ) : (
            <div className="max-h-[300px] overflow-y-auto space-y-1 font-mono text-xs">
              {logs.map((log, i) => (
                <div key={i} className={`p-1.5 rounded ${log.includes("Erro") || log.includes("Falha") ? "bg-destructive/10 text-destructive" : "bg-muted/30 text-foreground"}`}>{log}</div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminIndicadores;
