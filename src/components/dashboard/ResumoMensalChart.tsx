import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { BarChart3 } from "lucide-react";

interface Props {
  receita: number;
  despesas: number;
  parcelamentos: number;
  economias: number;
  saldo: number;
}

const ITEMS = [
  { key: "Receita", color: "hsl(var(--success))" },
  { key: "Despesas", color: "hsl(var(--destructive))" },
  { key: "Parcelamentos", color: "hsl(var(--warning))" },
  { key: "Economias", color: "hsl(var(--info))" },
  { key: "Saldo", color: "hsl(var(--primary))" },
];

function ResumoMensalChart({ receita, despesas, parcelamentos, economias, saldo }: Props) {
  const { fmt } = usePrivacyFmt();

  const data = [
    { name: "Receita", value: receita },
    { name: "Despesas", value: despesas },
    { name: "Parcelamentos", value: parcelamentos },
    { name: "Economias", value: economias },
    { name: "Saldo", value: saldo },
  ];

  return (
    <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-sm flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Resumo do Mês
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={100} />
              <Tooltip
                formatter={(v: number) => fmt(v)}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={24}>
                {data.map((entry, i) => (
                  <Cell key={i} fill={ITEMS[i].color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(ResumoMensalChart);
