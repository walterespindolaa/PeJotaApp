import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  ReferenceDot, Tooltip as RechartsTooltip,
} from "recharts";
import { Plus } from "lucide-react";
import type { LifeEvent, ProjectionPoint } from "@/lib/financial_engine/life_projection";

const fmt = (v: number) =>
  v >= 1_000_000
    ? `R$ ${(v / 1_000_000).toFixed(1)}M`
    : v >= 1_000
    ? `R$ ${(v / 1_000).toFixed(0)}k`
    : `R$ ${v.toFixed(0)}`;

const fmtFull = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

function ChartTooltipContent({ active, payload }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as ProjectionPoint;
  return (
    <div className="bg-popover/95 backdrop-blur-md border border-border rounded-xl p-3.5 shadow-xl text-xs space-y-1.5">
      <div className="font-heading font-bold text-sm">{d.year} — {d.age} anos</div>
      <div className="text-primary font-semibold text-sm">{fmtFull(d.patrimonio)}</div>
      {d.events.map(ev => (
        <div key={ev.id} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="text-base">{ev.emoji}</span>
          <span>{ev.name}</span>
          {ev.impactValue !== 0 && (
            <span className={ev.impactValue > 0 ? "text-destructive" : "text-emerald-500"}>
              {ev.impactValue > 0 ? "-" : "+"}{fmtFull(Math.abs(ev.impactValue))}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

interface Props {
  chartData: ProjectionPoint[];
  events: LifeEvent[];
  onAddEvent: () => void;
  onEditEvent: (ev: LifeEvent) => void;
}

export default function ProjecaoChart({ chartData, events, onAddEvent, onEditEvent }: Props) {
  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm animate-fade-in h-full flex flex-col" style={{ animationDelay: "200ms" }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-heading">Vista da Montanha</CardTitle>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-primary/30 hover:bg-primary/5" onClick={onAddEvent}>
            <Plus className="h-3 w-3" /> Evento
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <div className="flex-1 min-h-[350px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 24, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="patrimonioGradientCinematic" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="hsl(220 70% 50%)" stopOpacity={0.05} />
                <stop offset="25%" stopColor="hsl(220 70% 50%)" stopOpacity={0.15} />
                <stop offset="50%" stopColor="hsl(142 71% 45%)" stopOpacity={0.25} />
                <stop offset="75%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(45 93% 47%)" stopOpacity={0.4} />
              </linearGradient>
              <linearGradient id="lineGradientCinematic" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="hsl(220 70% 55%)" />
                <stop offset="40%" stopColor="hsl(142 71% 45%)" />
                <stop offset="100%" stopColor="hsl(45 93% 47%)" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              tickFormatter={fmt}
              width={65}
            />
            <RechartsTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="patrimonio"
              stroke="url(#lineGradientCinematic)"
              fill="url(#patrimonioGradientCinematic)"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 5, fill: "hsl(var(--primary))", stroke: "hsl(var(--background))", strokeWidth: 2 }}
              isAnimationActive={true}
              animationDuration={2000}
              animationEasing="ease-out"
            />
            {events.map(ev => {
              const point = chartData.find(p => p.year === ev.year);
              if (!point) return null;
              return (
                <ReferenceDot
                  key={ev.id}
                  x={ev.year}
                  y={point.patrimonio}
                  r={0}
                  label={{
                    value: ev.emoji,
                    position: "top",
                    offset: 16,
                    style: { fontSize: 22, cursor: "pointer", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" },
                  }}
                />
              );
            })}
          </AreaChart>
        </ResponsiveContainer>
        </div>

        {/* Events timeline */}
        {events.length > 0 && (
          <div className="mt-5 space-y-2">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-heading font-semibold">
              Eventos da Vida
            </span>
            <div className="flex flex-wrap gap-2">
              {events
                .sort((a, b) => a.year - b.year)
                .map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => onEditEvent(ev)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/50 hover:border-primary/30 transition-all text-xs group"
                  >
                    <span className="text-base group-hover:scale-110 transition-transform">{ev.emoji}</span>
                    <span className="font-medium">{ev.name}</span>
                    <span className="text-muted-foreground">({ev.year})</span>
                    {ev.impactValue > 0 && (
                      <span className="text-destructive text-[10px]">-{fmt(ev.impactValue)}</span>
                    )}
                    {ev.impactValue < 0 && (
                      <span className="text-emerald-500 text-[10px]">+{fmt(Math.abs(ev.impactValue))}</span>
                    )}
                  </button>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
