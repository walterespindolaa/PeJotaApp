import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Loader2, Trash2, RotateCcw, BookOpen, Zap, Database, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function FaturaRulesTab() {
  const { user } = useAuth();
  const [merchantRules, setMerchantRules] = useState<any[]>([]);
  const [patternRules, setPatternRules] = useState<any[]>([]);
  const [cacheEntries, setCacheEntries] = useState<any[]>([]);
  const [orphanCount, setOrphanCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaningOrphans, setCleaningOrphans] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([
      supabase.from("merchant_rules").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
      supabase.from("pattern_rules").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }),
      supabase.from("ai_inference_cache").select("id,fingerprint,result_json,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    ]).then(([mr, pr, cache]) => {
      setMerchantRules(mr.data || []);
      setPatternRules(pr.data || []);
      setCacheEntries(cache.data || []);
      setLoading(false);
    });
  }, [user]);

  // Check for orphan cache entries (statement_id points to deleted statements)
  const checkOrphans = async () => {
    if (!user) return;
    // Get all cache entries with a statement_id
    const { data: allCache } = await (supabase.from("ai_inference_cache") as any)
      .select("id,statement_id").eq("user_id", user.id).not("statement_id", "is", null);
    if (!allCache?.length) { setOrphanCount(0); return; }

    // Get all existing statement IDs
    const { data: activeStmts } = await supabase.from("credit_card_statements" as any)
      .select("id").eq("user_id", user.id);
    const activeIds = new Set((activeStmts as any[] || []).map(s => s.id));

    const orphans = allCache.filter((c: any) => c.statement_id && !activeIds.has(c.statement_id));
    setOrphanCount(orphans.length);
  };

  const cleanOrphans = async () => {
    if (!user) return;
    setCleaningOrphans(true);
    try {
      const { data: allCache } = await (supabase.from("ai_inference_cache") as any)
        .select("id,statement_id").eq("user_id", user.id).not("statement_id", "is", null);
      if (!allCache?.length) { setOrphanCount(0); setCleaningOrphans(false); return; }

      const { data: activeStmts } = await supabase.from("credit_card_statements" as any)
        .select("id").eq("user_id", user.id);
      const activeIds = new Set((activeStmts as any[] || []).map(s => s.id));

      const orphanIds = allCache.filter((c: any) => c.statement_id && !activeIds.has(c.statement_id)).map((c: any) => c.id);
      if (orphanIds.length) {
        for (let i = 0; i < orphanIds.length; i += 50) {
          await supabase.from("ai_inference_cache").delete().in("id", orphanIds.slice(i, i + 50));
        }
        setCacheEntries(prev => prev.filter(c => !orphanIds.includes(c.id)));
      }
      setOrphanCount(0);
      toast({ title: `${orphanIds.length} entradas órfãs removidas` });
    } catch (e: any) {
      toast({ title: "Erro ao limpar", description: e.message, variant: "destructive" });
    } finally {
      setCleaningOrphans(false);
    }
  };

  const deleteMerchantRule = async (id: string) => {
    await supabase.from("merchant_rules").delete().eq("id", id);
    setMerchantRules(prev => prev.filter(r => r.id !== id));
    toast({ title: "Regra removida" });
  };

  const deletePatternRule = async (id: string) => {
    await supabase.from("pattern_rules").delete().eq("id", id);
    setPatternRules(prev => prev.filter(r => r.id !== id));
    toast({ title: "Padrão removido" });
  };

  const clearAllCache = async () => {
    if (!user) return;
    await supabase.from("ai_inference_cache").delete().eq("user_id", user.id);
    setCacheEntries([]);
    setOrphanCount(0);
    toast({ title: "Todo o cache foi limpo" });
  };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Tabs defaultValue="merchants" className="space-y-4">
      <TabsList>
        <TabsTrigger value="merchants" className="gap-1"><Zap className="h-3.5 w-3.5" /> Merchants ({merchantRules.length})</TabsTrigger>
        <TabsTrigger value="patterns" className="gap-1"><BookOpen className="h-3.5 w-3.5" /> Padrões ({patternRules.length})</TabsTrigger>
        <TabsTrigger value="cache" className="gap-1"><Database className="h-3.5 w-3.5" /> Cache IA ({cacheEntries.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="merchants">
        {!merchantRules.length ? <p className="text-center py-8 text-muted-foreground text-sm">Nenhuma regra aprendida ainda. Edite categorias na revisão para criar regras.</p> : (
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Merchant</TableHead><TableHead>Categoria</TableHead><TableHead>Tipo</TableHead>
                <TableHead>Recorrente</TableHead><TableHead>Confiança</TableHead><TableHead className="w-10"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {merchantRules.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-xs">{r.merchant_norm}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.category}</Badge></TableCell>
                    <TableCell className="text-xs">{r.type === "fixa" ? "Fixa" : "Variável"}</TableCell>
                    <TableCell className="text-xs">{r.recurring_default ? "Sim" : "Não"}</TableCell>
                    <TableCell className="text-xs">{Math.round(r.confidence * 100)}%</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteMerchantRule(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="patterns">
        {!patternRules.length ? <p className="text-center py-8 text-muted-foreground text-sm">Nenhum padrão cadastrado.</p> : (
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Padrão</TableHead><TableHead>Categoria</TableHead><TableHead>Tipo</TableHead>
                <TableHead>Confiança</TableHead><TableHead className="w-10"></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {patternRules.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.pattern}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{r.category}</Badge></TableCell>
                    <TableCell className="text-xs">{r.type === "fixa" ? "Fixa" : "Variável"}</TableCell>
                    <TableCell className="text-xs">{Math.round(r.confidence * 100)}%</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deletePatternRule(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="cache">
        <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">{cacheEntries.length} entradas em cache (últimas 50)</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="text-xs" onClick={checkOrphans}>
              <AlertTriangle className="h-3 w-3 mr-1" />
              {orphanCount !== null ? `${orphanCount} órfãos` : "Verificar órfãos"}
            </Button>
            {orphanCount !== null && orphanCount > 0 && (
              <Button variant="outline" size="sm" className="text-xs text-amber-600" onClick={cleanOrphans} disabled={cleaningOrphans}>
                {cleaningOrphans ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RotateCcw className="h-3 w-3 mr-1" />}
                Limpar órfãos ({orphanCount})
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-xs text-destructive"><RotateCcw className="h-3 w-3 mr-1" /> Limpar TODO cache</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar todo cache de IA?</AlertDialogTitle>
                  <AlertDialogDescription className="flex items-start gap-1.5">
                    <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>Isso removerá todo o aprendizado de IA. Próximas importações terão custo maior.
                    Prefira "Limpar órfãos" para remover apenas cache de faturas excluídas.</span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={clearAllCache} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Limpar tudo</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        {!cacheEntries.length ? <p className="text-center py-8 text-muted-foreground text-sm">Cache vazio.</p> : (
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Fingerprint</TableHead><TableHead>Resultado</TableHead><TableHead>Criado em</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {cacheEntries.map(e => {
                  const res = typeof e.result_json === "string" ? JSON.parse(e.result_json) : e.result_json;
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-[10px] max-w-[200px] truncate">{e.fingerprint}</TableCell>
                      <TableCell className="text-xs"><Badge variant="outline">{res?.category || "?"}</Badge> {res?.type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
