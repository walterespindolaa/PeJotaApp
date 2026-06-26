import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, AlertTriangle } from "lucide-react";
import { useInvestimentos } from "@/contexts/InvestimentosContext";
import { TIPOS_VARIAVEIS } from "@/lib/investimentos/constants";
import type { Investimento } from "@/lib/investimentos/types";

export default function ResultadoIR() {
  const { investimentos, quotes, fmt, proventos } = useInvestimentos();

  if (investimentos.length === 0) return null;

  const calcularIR = (inv: Investimento): { aliquota: number | null; ir: number; label: string } => {
    const ticker = inv.ticker?.toUpperCase();
    const q = ticker ? quotes[ticker] : null;
    const valorAtualReal = q?.preco_atual && Number(inv.quantidade) > 0
      ? q.preco_atual * Number(inv.quantidade)
      : Number(inv.valor_atual);
    const lucro = valorAtualReal - Number(inv.total_aportado);
    if (lucro <= 0) return { aliquota: null, ir: 0, label: "—" };

    // FII: ganho na venda de cotas é tributado a 20% (dividendos são isentos — vide Proventos).
    if (inv.tipo === "FII") return { aliquota: 20, ir: lucro * 0.20, label: "20%*" };

    // Ações/ETF/BDR/Exterior/Cripto: 15% (swing trade). Day trade seria 20% — vide nota.
    if (TIPOS_VARIAVEIS.includes(inv.tipo)) {
      return { aliquota: 15, ir: lucro * 0.15, label: "15%" };
    }

    return { aliquota: 15, ir: lucro * 0.15, label: "15%**" };
  };

  // Proventos recebidos por ativo (dividendos isentos — apenas acompanhamento).
  const proventosPorInv: Record<string, number> = {};
  (proventos || []).forEach(p => {
    proventosPorInv[p.investimento_id] = (proventosPorInv[p.investimento_id] || 0) + Number(p.valor || 0);
  });
  const totalProventos = Object.values(proventosPorInv).reduce((s, v) => s + v, 0);

  const resultados = investimentos.map(inv => {
    const ticker = inv.ticker?.toUpperCase();
    const q = ticker ? quotes[ticker] : null;
    const valorAtualReal = q?.preco_atual && Number(inv.quantidade) > 0
      ? q.preco_atual * Number(inv.quantidade)
      : Number(inv.valor_atual);
    return {
      inv,
      lucro: valorAtualReal - Number(inv.total_aportado),
      ...calcularIR(inv),
    };
  });

  const totalLucro = resultados.reduce((s, r) => s + Math.max(0, r.lucro), 0);
  const totalIR = resultados.reduce((s, r) => s + r.ir, 0);
  const totalPrejuizo = resultados.reduce((s, r) => s + Math.min(0, r.lucro), 0);

  return (
    <Card className="shadow-soft rounded-2xl">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <CardTitle className="font-heading text-base">Resultado & IR Estimado</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/40">
            <p className="text-[10px] text-muted-foreground uppercase">Lucro bruto</p>
            <p className="text-sm font-heading font-bold text-emerald-600">{fmt(totalLucro)}</p>
          </div>
          <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
            <p className="text-[10px] text-muted-foreground uppercase">Prejuízo</p>
            <p className="text-sm font-heading font-bold text-destructive">{fmt(totalPrejuizo)}</p>
          </div>
          <div className="p-3 rounded-xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200/40">
            <p className="text-[10px] text-muted-foreground uppercase">IR estimado</p>
            <p className="text-sm font-heading font-bold text-amber-600">{fmt(totalIR)}</p>
          </div>
          <div className="p-3 rounded-xl bg-sky-50/40 dark:bg-sky-950/20 border border-sky-200/40">
            <p className="text-[10px] text-muted-foreground uppercase">Proventos recebidos</p>
            <p className="text-sm font-heading font-bold text-sky-600">{fmt(totalProventos)}</p>
            <p className="text-[9px] text-muted-foreground">Dividendos isentos</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ativo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Aportado</TableHead>
                <TableHead>Atual</TableHead>
                <TableHead>Lucro/Prej</TableHead>
                <TableHead>Proventos</TableHead>
                <TableHead>Alíquota</TableHead>
                <TableHead>IR Estimado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultados.map(({ inv, lucro, ir, label }) => (
                <TableRow key={inv.id}>
                  <TableCell className="text-xs font-medium">
                    {inv.ticker ? <span className="font-mono font-bold">{inv.ticker}</span> : inv.nome}
                  </TableCell>
                  <TableCell className="text-xs">{inv.tipo}</TableCell>
                  <TableCell className="text-xs">{fmt(Number(inv.total_aportado))}</TableCell>
                  <TableCell className="text-xs">{(() => {
                    const t = inv.ticker?.toUpperCase();
                    const q = t ? quotes[t] : null;
                    if (q?.preco_atual && Number(inv.quantidade) > 0) {
                      const val = q.preco_atual * Number(inv.quantidade);
                      return inv.tipo === "Exterior"
                        ? `US$ ${val.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                        : fmt(val);
                    }
                    return fmt(Number(inv.valor_atual));
                  })()}</TableCell>
                  <TableCell className={`text-xs font-semibold ${lucro >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {lucro >= 0 ? "+" : ""}{fmt(lucro)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {proventosPorInv[inv.id]
                      ? <span className="text-sky-600 font-medium">{fmt(proventosPorInv[inv.id])}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-xs">{label}</TableCell>
                  <TableCell className="text-xs font-semibold">
                    {ir > 0
                      ? <span className="text-amber-600">{fmt(ir)}</span>
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-1">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              <span className="font-semibold">Estimativa educacional.</span> Ações: usamos 15% (swing trade) — <span className="font-semibold">day trade é 20%</span>. O cálculo não considera a isenção para vendas de ações até R$20.000/mês, compensação de prejuízos anteriores, IOF ou outros fatores. Consulte um contador antes de declarar.
            </p>
          </div>
          <p className="text-[10px] text-muted-foreground pl-5">* FIIs: o <span className="font-medium">ganho na venda de cotas é tributado a 20%</span>; os <span className="font-medium">dividendos distribuídos são isentos</span> para pessoa física com menos de 10% das cotas (acompanhados na coluna Proventos).</p>
          <p className="text-[10px] text-muted-foreground pl-5">** Renda Fixa: alíquota varia de 22,5% (até 180 dias) a 15% (acima de 720 dias). Usamos 15% como referência conservadora.</p>
        </div>
      </CardContent>
    </Card>
  );
}
