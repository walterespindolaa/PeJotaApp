import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileText, Loader2, Trash2, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type ImportLot = {
  id: string;
  filename: string | null;
  source: string;
  imported_at: string;
  rows_count: number;
  inserted_count: number;
  updated_count: number;
  skipped_count: number;
  status: string;
};

interface Props {
  refreshKey?: number;
  onChanged?: () => void;
}

const HistoricoImportacoesInvestimentos = ({ refreshKey = 0, onChanged }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [lots, setLots] = useState<ImportLot[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLots = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("investimento_imports")
      .select("*")
      .eq("user_id", user.id)
      .order("imported_at", { ascending: false })
      .limit(20);
    setLots(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchLots(); }, [user, refreshKey]);

  const handleRollback = async (lot: ImportLot) => {
    // Apaga TODOS os investimentos com import_id = lot.id
    const { error: delErr, count } = await supabase
      .from("investimentos_financeiros")
      .delete({ count: "exact" })
      .eq("import_id", lot.id);
    if (delErr) {
      toast({ title: "Erro ao desfazer importação", description: delErr.message, variant: "destructive" });
      return;
    }
    // Marca lote como rolled_back e zera contadores (mantém histórico)
    await supabase
      .from("investimento_imports")
      .update({ status: "rolled_back" })
      .eq("id", lot.id);
    toast({ title: "Importação desfeita", description: `${count || 0} ativo(s) removido(s).` });
    fetchLots();
    onChanged?.();
  };

  const handleUnlink = async (lot: ImportLot) => {
    // Mantém os investimentos mas remove a referência
    await supabase
      .from("investimentos_financeiros")
      .update({ import_id: null })
      .eq("import_id", lot.id);
    await supabase.from("investimento_imports").delete().eq("id", lot.id);
    toast({ title: "Lote removido", description: "Os ativos foram mantidos." });
    fetchLots();
    onChanged?.();
  };

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-heading flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Histórico de importações de investimentos
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : lots.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Nenhuma importação ainda.</p>
        ) : (
          <>
            {/* Desktop: tabela */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Arquivo</TableHead>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Origem</TableHead>
                    <TableHead className="text-xs text-right">Resumo</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lots.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{l.filename || "—"}</TableCell>
                      <TableCell className="text-xs">{new Date(l.imported_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[10px]">
                          {l.source === "b3_movimentacao" ? "B3 Movimentação" : "Planilha"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right">
                        <span className="text-emerald-600">+{l.inserted_count}</span>
                        {l.updated_count > 0 && <span className="text-blue-600 ml-2">~{l.updated_count}</span>}
                        {l.skipped_count > 0 && <span className="text-muted-foreground ml-2">↷{l.skipped_count}</span>}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={l.status === "completed" ? "default" : "outline"}
                          className="text-[10px]"
                        >
                          {l.status === "rolled_back" ? "Desfeito" : l.status === "completed" ? "Concluído" : l.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {l.status === "completed" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" title="Desfazer importação">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Desfazer importação?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Todos os ativos criados nesta importação serão removidos da sua carteira. Os ativos modificados por "Substituir" ou "Mesclar" NÃO podem ser revertidos automaticamente.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleRollback(l)} className="bg-destructive text-destructive-foreground">Desfazer</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-7 w-7" title="Remover do histórico (mantém ativos)">
                                <Unlink className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remover entrada do histórico?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Os ativos serão MANTIDOS na sua carteira. Apenas o registro deste lote será removido.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleUnlink(l)}>Remover</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile: cards */}
            <div className="md:hidden space-y-2">
              {lots.map(l => (
                <div key={l.id} className="rounded-xl border border-border/40 p-3 bg-muted/5">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate">{l.filename || "—"}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(l.imported_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <Badge
                      variant={l.status === "completed" ? "default" : "outline"}
                      className="text-[10px] flex-shrink-0"
                    >
                      {l.status === "rolled_back" ? "Desfeito" : l.status === "completed" ? "Concluído" : l.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[10px]">
                      <Badge variant="outline" className="text-[10px]">
                        {l.source === "b3_movimentacao" ? "B3" : "Planilha"}
                      </Badge>
                      <span className="text-emerald-600">+{l.inserted_count}</span>
                      {l.updated_count > 0 && <span className="text-blue-600">~{l.updated_count}</span>}
                      {l.skipped_count > 0 && <span className="text-muted-foreground">↷{l.skipped_count}</span>}
                    </div>
                    <div className="flex gap-1">
                      {l.status === "completed" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Desfazer importação?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Todos os ativos criados nesta importação serão removidos. Atualizados/mesclados não revertem automaticamente.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRollback(l)} className="bg-destructive text-destructive-foreground">Desfazer</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <Unlink className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover entrada do histórico?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Os ativos serão MANTIDOS. Apenas o registro deste lote será removido.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleUnlink(l)}>Remover</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default HistoricoImportacoesInvestimentos;
