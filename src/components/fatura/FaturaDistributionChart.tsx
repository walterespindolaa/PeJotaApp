import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Badge } from "@/components/ui/badge";
import { getCategoryEmoji, CHART_COLORS } from "@/lib/categoryEmojis";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import type { StatementLine } from "./FaturaImportTab";

interface CategoryData {
  name: string;
  emoji: string;
  value: number;
  count: number;
  pct: number;
  dominantOrigin: string;
}

interface Props {
  lines: StatementLine[];
}

function getDominantOrigin(lines: StatementLine[], category: string): string {
  const origins = { rule: 0, cache: 0, ai: 0, parser: 0 };
  for (const l of lines) {
    if ((l.category || "Sem categoria") === category && !l.isDuplicate && l.status !== "ignored") {
      origins[l.origin as keyof typeof origins] = (origins[l.origin as keyof typeof origins] || 0) + 1;
    }
  }
  const max = Math.max(...Object.values(origins));
  if (max === 0) return "—";
  const entry = Object.entries(origins).find(([, v]) => v === max);
  const map: Record<string, string> = { rule: "Auto", cache: "Cache", ai: "IA", parser: "Parser" };
  return entry ? map[entry[0]] || entry[0] : "—";
}

export default function FaturaDistributionChart({ lines }: Props) {
  const { fmt, isPrivate } = usePrivacyFmt();

  const { data, total } = useMemo(() => {
    const byCategory = new Map<string, { value: number; count: number }>();
    let total = 0;
    for (const l of lines) {
      if (l.isDuplicate || l.status === "ignored") continue;
      const cat = l.category || "Sem categoria";
      const prev = byCategory.get(cat) || { value: 0, count: 0 };
      byCategory.set(cat, { value: prev.value + l.amount, count: prev.count + 1 });
      total += l.amount;
    }
    const data: CategoryData[] = Array.from(byCategory.entries())
      .map(([name, { value, count }]) => ({
        name,
        emoji: getCategoryEmoji(name),
        value: Math.round(value * 100) / 100,
        count,
        pct: total > 0 ? (value / total) * 100 : 0,
        dominantOrigin: getDominantOrigin(lines, name),
      }))
      .sort((a, b) => b.value - a.value);
    return { data, total };
  }, [lines]);

  if (!data.length) return null;

  const centerLabel = isPrivate ? "••••" : (total >= 1000 ? `R$ ${(total / 1000).toFixed(1)}k` : `R$ ${total.toFixed(0)}`);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as CategoryData;
    return (
      <div className="bg-card border border-border rounded-lg px-3 py-2 shadow-lg text-xs">
        <div className="font-semibold mb-1">{d.emoji} {d.name}</div>
        <div className="text-muted-foreground space-y-0.5">
          <div>{fmt(d.value)}</div>
          <div>{isPrivate ? "••••" : `${d.pct.toFixed(1)}%`} do total</div>
          <div>{d.count} transações</div>
        </div>
      </div>
    );
  };

  return (
    <Card className="col-span-1 md:col-span-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Distribuição por Categoria</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row gap-4">
          {/* Donut chart */}
          <div className="h-[220px] w-full md:w-[220px] flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={95}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  strokeWidth={0}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                {/* Center label */}
                <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-foreground text-lg font-bold">
                  {centerLabel}
                </text>
                <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle" className="fill-muted-foreground text-[10px]">
                  Total
                </text>
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[220px]">
            {data.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-xs group hover:bg-muted/50 rounded px-1.5 py-1 transition-colors">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="text-base leading-none">{d.emoji}</span>
                <span className="font-medium text-foreground truncate flex-1">{d.name}</span>
                <span className="text-muted-foreground whitespace-nowrap">
                  {fmt(d.value)}
                </span>
                <span className="text-muted-foreground/60 w-10 text-right">{isPrivate ? "••••" : `${d.pct.toFixed(0)}%`}</span>
                <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 opacity-70">
                  {d.dominantOrigin}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
