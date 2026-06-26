import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HelpCircle, ArrowRightLeft } from "lucide-react";
import { EmojiIcon } from "@/components/EmojiIcon";
import { format, parseISO, startOfYear, startOfMonth } from "date-fns";
import PrivacyValue from "@/components/PrivacyValue";
import { usePrivacyFmt } from "@/components/PrivacyValue";

const TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  prolabore: { label: "Pró-labore", emoji: "💰" },
  lucro: { label: "Dist. de Lucros", emoji: "📈" },
  transferencia: { label: "Transferência", emoji: "🔄" },
};

interface CrossLink {
  id: string;
  type: string;
  pf_category: string;
  pf_amount: number;
  month_ref: string;
  created_at: string;
}

interface Props {
  companyId: string;
  refreshKey?: number;
}

export default function BusinessTransferHistory({ companyId, refreshKey }: Props) {
  const { user } = useAuth();
  const { fmt } = usePrivacyFmt();
  const [links, setLinks] = useState<CrossLink[]>([]);

  const fetchLinks = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("cross_ledger_links")
      .select("*")
      .eq("company_id", companyId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20) as any;
    setLinks((data || []) as CrossLink[]);
  }, [user, companyId, refreshKey]);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const now = new Date();
  const monthStart = startOfMonth(now).toISOString().substring(0, 10);
  const yearStart = startOfYear(now).toISOString().substring(0, 10);

  const totalMes = links
    .filter(l => l.month_ref >= monthStart)
    .reduce((s, l) => s + Number(l.pf_amount), 0);
  const totalAno = links
    .filter(l => l.month_ref >= yearStart)
    .reduce((s, l) => s + Number(l.pf_amount), 0);

  if (links.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-heading">Transferências para você</CardTitle>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Histórico de valores retirados da empresa para a pessoa física: pró-labore, distribuição de lucros e transferências pessoais.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground">Total no mês</p>
            <p className="text-sm font-bold font-heading text-foreground">
              <PrivacyValue>{fmt(totalMes)}</PrivacyValue>
            </p>
          </div>
          <div className="bg-muted/50 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground">Total no ano</p>
            <p className="text-sm font-bold font-heading text-foreground">
              <PrivacyValue>{fmt(totalAno)}</PrivacyValue>
            </p>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-auto max-h-48">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Data</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs text-right">Valor</TableHead>
                <TableHead className="text-xs">Destino PF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {links.slice(0, 10).map(l => {
                const info = TYPE_LABELS[l.type] || { label: l.type, emoji: "🔗" };
                return (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{format(parseISO(l.created_at), "dd/MM/yy")}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px]">
                        <EmojiIcon emoji={info.emoji} className="h-3 w-3 mr-1 inline-block align-middle" />{info.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-right font-medium text-emerald-600">
                      <PrivacyValue>{fmt(Number(l.pf_amount))}</PrivacyValue>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{l.pf_category}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
