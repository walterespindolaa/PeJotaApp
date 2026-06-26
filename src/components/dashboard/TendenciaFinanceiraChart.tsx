import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { TrendingUp } from "lucide-react";

interface MonthData {
  mes: string;
  receitas: number;
  despesas: number;
  economias: number;
}

interface Props {
  data: MonthData[];
}

function TendenciaFinanceiraChart({ data }: Props) {
  const { fmt } = usePrivacyFmt();

  if (data.length < 2) return null;

  // Take last 6 months
  const chartData = data.slice(-6);

  return (
    <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="font-heading text-sm flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Tendência Financeira (últimos 6 meses)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => fmt(v)}
                contentStyle={{
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="receitas"
                name="Receita"
                stroke="hsl(var(--success))"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "hsl(var(--success))" }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="despesas"
                name="Despesas"
                stroke="hsl(var(--destructive))"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "hsl(var(--destructive))" }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="economias"
                name="Economias"
                stroke="hsl(var(--info))"
                strokeWidth={2}
                dot={{ r: 3, fill: "hsl(var(--info))" }}
                activeDot={{ r: 5 }}
                strokeDasharray="5 3"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export default memo(TendenciaFinanceiraChart);
