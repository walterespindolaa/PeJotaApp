import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileInput, Undo2, Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type BankAccountJoin = { name: string; bank_name: string | null; last_four: string | null } | null;

type Import = {
  id: string;
  account_id: string | null;
  filename: string | null;
  imported_at: string;
  inserted_transactions: number;
  inserted_receitas: number;
  inserted_despesas: number;
  skipped_duplicates: number;
  first_date: string | null;
  last_date: string | null;
  bank_accounts: BankAccountJoin;
};

type Props = {
  refreshKey: number;
  onRollback: () => void;
};

const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit",
});

const dateFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit", month: "2-digit", year: "numeric",
});

function formatPeriodo(first: string | null, last: string | null): string | null {
  if (!first || !last) return null;
  const f = dateFmt.format(new Date(first + "T12:00:00"));
  const l = dateFmt.format(new Date(last + "T12:00:00"));
  return f === l ? f : `${f} a ${l}`;
}

export default function HistoricoImportacoes({ refreshKey, onRollback }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [imports, setImports] = useState<Import[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [rollingBackId, setRollingBackId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("ofx_imports" as never)
      .select("id, account_id, filename, imported_at, inserted_transactions, inserted_receitas, inserted_despesas, skipped_duplicates, first_date, last_date, bank_accounts(name, bank_name, last_four)")
      .eq("user_id", user.id)
      .order("imported_at", { ascending: false })
      .limit(50);
    setImports((data as unknown as Import[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user, refreshKey]);

  const handleRollback = async (imp: Import) => {
    setRollingBackId(imp.id);
    try {
      const { data, error } = await supabase.rpc("rollback_ofx_import" as never, { p_import_id: imp.id } as never);
      if (error) throw error;
      const result = data as { deleted_receitas?: number; deleted_despesas?: number } | null;
      const removed = (result?.deleted_receitas ?? 0) + (result?.deleted_despesas ?? 0);
      toast({ title: "Importação desfeita", description: `${removed} lançamentos removidos.` });
      onRollback();
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      toast({ title: "Erro ao desfazer", description: message, variant: "destructive" });
    } finally {
      setRollingBackId(null);
    }
  };

  const visibleImports = showAll ? imports : imports.slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-heading flex items-center justify-between">
          <span>Histórico de importações</span>
          <Badge variant="outline" className="text-xs">{imports.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && imports.length === 0 ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : imports.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma importação realizada ainda.
          </p>
        ) : (
          <div>
            {visibleImports.map(imp => {
              const accountLabel = imp.bank_accounts
                ? `${imp.bank_accounts.name}${imp.bank_accounts.last_four ? ` (****${imp.bank_accounts.last_four})` : ""}${imp.bank_accounts.bank_name ? ` — ${imp.bank_accounts.bank_name}` : ""}`
                : "Conta desconhecida";
              const periodo = formatPeriodo(imp.first_date, imp.last_date);
              return (
                <div key={imp.id} className="flex items-center gap-3 p-3 border-b last:border-b-0">
                  <FileInput className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-medium">{dateTimeFmt.format(new Date(imp.imported_at))}</p>
                      <span className="text-xs text-muted-foreground">·</span>
                      <p className="text-xs truncate">{accountLabel}</p>
                    </div>
                    {imp.filename && (
                      <p className="text-[11px] text-muted-foreground truncate">{imp.filename}</p>
                    )}
                    {periodo && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {periodo}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        +{imp.inserted_transactions} transações
                      </Badge>
                      {imp.inserted_receitas > 0 && (
                        <Badge variant="outline" className="text-[10px] text-success border-success/40">
                          +{imp.inserted_receitas} receitas
                        </Badge>
                      )}
                      {imp.inserted_despesas > 0 && (
                        <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">
                          +{imp.inserted_despesas} despesas
                        </Badge>
                      )}
                      {imp.skipped_duplicates > 0 && (
                        <Badge variant="outline" className="text-[10px] text-warning border-warning/40">
                          {imp.skipped_duplicates} duplicadas
                        </Badge>
                      )}
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs flex-shrink-0"
                        disabled={rollingBackId === imp.id}
                      >
                        {rollingBackId === imp.id
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Undo2 className="h-3.5 w-3.5" />}
                        Desfazer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Desfazer esta importação?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso irá apagar <strong>{imp.inserted_transactions} lançamentos</strong> criados por esta importação, incluindo qualquer edição manual que você tenha feito neles.
                          <br /><br />
                          As transações com FIT ID ficarão novamente disponíveis para reimportação, caso você suba este extrato novamente.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRollback(imp)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Desfazer importação
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              );
            })}
            {imports.length > 10 && (
              <div className="flex justify-center pt-2">
                <Button variant="ghost" size="sm" className="text-xs" onClick={() => setShowAll(s => !s)}>
                  {showAll ? "Mostrar menos" : `Ver todas (${imports.length})`}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
