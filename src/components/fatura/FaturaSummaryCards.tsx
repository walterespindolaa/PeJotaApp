import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, CheckCircle2, AlertTriangle, Layers, Zap, Bot, Database, BookOpen } from "lucide-react";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import type { StatementLine } from "./FaturaImportTab";

interface Props {
  lines: StatementLine[];
  stats: { byRules: number; byCache: number; byAI: number; bank?: string } | null;
}

export default function FaturaSummaryCards({ lines, stats }: Props) {
  const { fmt } = usePrivacyFmt();

  if (!lines.length) return null;

  const total = lines.reduce((s, l) => s + l.amount, 0);
  const categorized = lines.filter(l => l.category).length;
  const pending = lines.filter(l => l.status === "pending_review" || !l.category || !l.expense_type).length;
  const installments = lines.filter(l => l.installment_total && l.installment_total > 1).length;
  const duplicates = lines.filter(l => l.isDuplicate).length;
  const byRules = stats?.byRules ?? lines.filter(l => l.origin === "rule").length;
  const byCache = stats?.byCache ?? lines.filter(l => l.origin === "cache").length;
  const byAI = stats?.byAI ?? lines.filter(l => l.origin === "ai").length;

  const cards = [
    { icon: CreditCard, label: "Total da fatura", value: fmt(total), color: "text-primary" },
    { icon: CheckCircle2, label: "Categorizadas", value: `${categorized}/${lines.length}`, color: "text-success" },
    { icon: AlertTriangle, label: "Pendências", value: String(pending), color: pending > 0 ? "text-amber-500" : "text-success" },
    { icon: Layers, label: "Parcelas", value: String(installments), color: "text-info" },
    { icon: AlertTriangle, label: "Duplicatas evitadas", value: String(duplicates), color: "text-amber-500" },
    { icon: BookOpen, label: "Por regras", value: String(byRules), color: "text-success" },
    { icon: Database, label: "Por cache", value: String(byCache), color: "text-info" },
    { icon: Bot, label: "Por IA", value: String(byAI), color: "text-accent" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
      {cards.map((c, i) => (
        <Card key={i} className="bg-card">
          <CardContent className="p-3 flex items-center gap-2.5">
            <div className={`h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 ${c.color}`}>
              <c.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">{c.label}</p>
              <p className="text-sm font-semibold">{c.value}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
