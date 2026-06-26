import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Landmark, Building2, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Account = {
  id: string;
  name: string;
  bank_name: string;
  last_four: string | null;
};

type AccountWithLast = Account & { lastImportDaysAgo: number | null };

function formatDaysAgo(days: number | null): string {
  if (days === null) return "Nunca importado";
  if (days === 0) return "Hoje";
  if (days === 1) return "Ontem";
  if (days <= 30) return `há ${days} dias`;
  return "há mais de 30 dias";
}

export default function ExtratosBancariosCard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<AccountWithLast[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [accRes, txRes] = await Promise.all([
        supabase
          .from("bank_accounts")
          .select("id, name, bank_name, last_four")
          .eq("user_id", user.id)
          .order("name"),
        supabase
          .from("transactions")
          .select("account_id, date")
          .eq("user_id", user.id)
          .eq("source", "ofx")
          .order("date", { ascending: false }),
      ]);

      const accs = (accRes.data as Account[]) || [];
      const txs = (txRes.data as { account_id: string | null; date: string }[]) || [];

      const lastByAccount = new Map<string, string>();
      for (const t of txs) {
        if (!t.account_id) continue;
        if (!lastByAccount.has(t.account_id)) lastByAccount.set(t.account_id, t.date);
      }

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const withLast: AccountWithLast[] = accs.map(a => {
        const lastDate = lastByAccount.get(a.id);
        if (!lastDate) return { ...a, lastImportDaysAgo: null };
        const d = new Date(lastDate + "T12:00:00");
        d.setHours(0, 0, 0, 0);
        const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
        return { ...a, lastImportDaysAgo: Math.max(0, diff) };
      });

      setAccounts(withLast);
    };
    load();
  }, [user]);

  const visible = accounts.slice(0, 3);
  const remaining = accounts.length - visible.length;

  return (
    <Card
      className="shadow-soft cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all"
      onClick={() => navigate("/dashboard/extrato-bancario")}
    >
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <Landmark className="h-4 w-4 text-primary" />
          <span>Extratos Bancários</span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 ml-auto" />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="p-3 mb-3 rounded-lg bg-info/10 border border-info/20">
          <p className="text-xs text-info">
            Importe extratos OFX dos seus bancos para categorizar transações automaticamente e ter visão completa do fluxo de caixa.
          </p>
        </div>

        {accounts.length === 0 ? (
          <div className="text-center py-6">
            <Landmark className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-muted-foreground text-sm">Nenhuma conta cadastrada.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Cadastre suas contas bancárias para importar extratos.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visible.map(a => (
              <div
                key={a.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
              >
                <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {a.name} {a.bank_name ? `— ${a.bank_name}` : ""}
                  </p>
                </div>
                <p className="text-xs text-muted-foreground whitespace-nowrap">
                  {a.lastImportDaysAgo === null
                    ? "Nunca importado"
                    : `Última importação: ${formatDaysAgo(a.lastImportDaysAgo)}`}
                </p>
              </div>
            ))}
            {remaining > 0 && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{remaining} outra{remaining === 1 ? "" : "s"}
              </p>
            )}
          </div>
        )}

        <div className="flex justify-end pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate("/dashboard/extrato-bancario");
            }}
          >
            Importar extrato
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
