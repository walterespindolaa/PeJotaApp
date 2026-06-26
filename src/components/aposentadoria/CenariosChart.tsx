import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine } from "recharts";
import { TrendingUp, BarChart3, BookOpen } from "lucide-react";
import { FV, PMT } from "@/lib/financial";
import { usePrivacyFmt } from "@/components/PrivacyValue";

interface Props {
  idadeAtual: number;
  idadeAposentadoria: number;
  expectativaVida: number;
  patrimonioAtual: number;
  poupancaMensal: number;
  taxaRealMensal: number;
  rendaDesejada: number;
  rendaPassiva: number;
  rendaPassivaAtual: number;
  rendaPassivaBens: number;
  incluirBens: boolean;
  poupancaConsumo: number;
  poupancaViverRenda: number;
  patrimonioRealidade: number;
  montanteConsumo: number;
  montanteViverRenda: number;
}

export default function CenariosChart({
  idadeAtual, idadeAposentadoria, expectativaVida,
  patrimonioAtual, poupancaMensal, taxaRealMensal,
  rendaDesejada, rendaPassiva,
  rendaPassivaAtual, rendaPassivaBens, incluirBens,
  poupancaConsumo, poupancaViverRenda,
  patrimonioRealidade, montanteConsumo, montanteViverRenda,
}: Props) {
  const { fmt, fmtShort } = usePrivacyFmt();
  const gapMensal = Math.max(0, rendaDesejada - rendaPassiva);
  const nperAcum = (idadeAposentadoria - idadeAtual) * 12;
  const r = taxaRealMensal;

  // Projected PV at retirement (no contributions, just compound growth)
  const pvProjetadoSemAporte = nperAcum > 0 ? patrimonioAtual * Math.pow(1 + r, nperAcum) : patrimonioAtual;

  // For chart: use max(0, poupança) — if negative, person doesn't need to save
  const aporteConsumoChart = Math.max(0, poupancaConsumo);
  const aporteViverChart = Math.max(0, poupancaViverRenda);

  const chartData = useMemo(() => {
    const data: any[] = [];
    const totalAnos = expectativaVida - idadeAtual;
    if (totalAnos <= 0 || nperAcum <= 0) return [];

    // Starting balances at retirement for each scenario
    const startReal = FV(r, nperAcum, -poupancaMensal, -patrimonioAtual);
    const startCons = FV(r, nperAcum, -aporteConsumoChart, -patrimonioAtual);
    const startViver = FV(r, nperAcum, -aporteViverChart, -patrimonioAtual);

    for (let yr = 0; yr <= totalAnos; yr++) {
      const idade = idadeAtual + yr;
      const m = yr * 12;

      let real: number, cons: number, viver: number;

      if (m <= nperAcum) {
        // Phase 1: Accumulation
        real = FV(r, m, -poupancaMensal, -patrimonioAtual);
        cons = FV(r, m, -aporteConsumoChart, -patrimonioAtual);
        viver = FV(r, m, -aporteViverChart, -patrimonioAtual);
      } else {
        // Phase 2: Post-retirement — ALL scenarios withdraw gapMensal
        const t = m - nperAcum;
        real = FV(r, t, gapMensal, -startReal);
        cons = FV(r, t, gapMensal, -startCons);
        viver = FV(r, t, gapMensal, -startViver);
      }

      data.push({
        idade,
        "Realidade": Math.max(0, Math.round(real)),
        "Consumo": Math.max(0, Math.round(cons)),
        "Viver de Renda": Math.max(0, Math.round(viver)),
      });
    }
    return data;
  }, [idadeAtual, expectativaVida, idadeAposentadoria, patrimonioAtual, poupancaMensal, r, gapMensal, aporteConsumoChart, aporteViverChart, nperAcum]);

  const patAposentRealidade = chartData.find(d => d.idade === idadeAposentadoria)?.["Realidade"] ?? 0;
  const patFinalRealidade = chartData.find(d => d.idade === expectativaVida)?.["Realidade"] ?? 0;
  const patFinalConsumo = chartData.find(d => d.idade === expectativaVida)?.["Consumo"] ?? 0;
  const patFinalViverRenda = chartData.find(d => d.idade === expectativaVida)?.["Viver de Renda"] ?? 0;

  const idadeMilhao = useMemo(() => {
    const entry = chartData.find(d => d["Realidade"] >= 1_000_000);
    return entry?.idade ?? null;
  }, [chartData]);

  const chartConfig = {
    "Realidade": { label: "Realidade", color: "hsl(45 90% 55%)" },
    "Consumo": { label: "Consumo do Patrimônio", color: "hsl(0 70% 55%)" },
    "Viver de Renda": { label: "Viver de Renda", color: "hsl(145 60% 45%)" },
  };

  const rendaPassivaTotal = rendaPassiva;

  // For display: whether compound growth alone covers the target
  const crescimentoCobreViver = pvProjetadoSemAporte >= montanteViverRenda && montanteViverRenda > 0;
  const crescimentoCobreConsumo = pvProjetadoSemAporte >= montanteConsumo && montanteConsumo > 0;

  return (
    <div className="space-y-4">
      {chartData.length > 0 && (
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-5 space-y-1">
            <h4 className="font-heading font-bold text-sm mb-2 flex items-center gap-2"><BarChart3 className="h-4 w-4" />Resumo da Projeção</h4>
            <p className="text-sm text-muted-foreground">
              Na aposentadoria ({idadeAposentadoria} anos): patrimônio projetado <span className="font-bold text-foreground">{fmt(patAposentRealidade)}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Aos {expectativaVida} anos (Realidade): <span className="font-bold text-foreground">{fmt(patFinalRealidade)}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Aos {expectativaVida} anos (Consumo): <span className="font-bold text-foreground">{fmt(patFinalConsumo)}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Aos {expectativaVida} anos (Viver de Renda): <span className="font-bold text-foreground">{fmt(patFinalViverRenda)}</span>
            </p>
            {gapMensal > 0 && (
              <p className="text-sm text-muted-foreground">
                Aporte necessário (consumo): <span className="font-bold text-foreground">{fmt(aporteConsumoChart)}/mês</span> · (viver de renda): <span className="font-bold text-foreground">{fmt(aporteViverChart)}/mês</span>
              </p>
            )}
            {gapMensal > 0 && (
              <p className="text-xs text-muted-foreground italic mt-1">
                Após a aposentadoria, todos os cenários consideram saque mensal de {fmt(gapMensal)} para completar a renda desejada.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Projeção de Patrimônio — 3 Cenários
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div className="h-[350px]">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="idade" tick={{ fontSize: 11 }} label={{ value: "Idade", position: "insideBottom", offset: -5, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtShort(v)} />
                  <ChartTooltip content={<ChartTooltipContent formatter={(value) => fmt(Number(value))} />} />
                  <Legend />
                  <ReferenceLine x={idadeAposentadoria} stroke="hsl(var(--muted-foreground))" strokeDasharray="8 4" label={{ value: `Aposentadoria (${idadeAposentadoria})`, position: "top", fontSize: 10 }} />
                  <ReferenceLine x={Math.round((idadeAtual + idadeAposentadoria) / 2)} stroke="transparent" label={{ value: "Fase de Acumulação", position: "insideTop", fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <ReferenceLine x={Math.round((idadeAposentadoria + expectativaVida) / 2)} stroke="transparent" label={{ value: "Fase de Uso", position: "insideTop", fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                  <Line type="monotone" dataKey="Realidade" stroke="hsl(45 90% 55%)" strokeWidth={2.5} dot={false} />
                  <Line type="monotone" dataKey="Consumo" stroke="hsl(0 70% 55%)" strokeWidth={2} dot={false} strokeDasharray="6 3" />
                  <Line type="monotone" dataKey="Viver de Renda" stroke="hsl(145 60% 45%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ChartContainer>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Preencha os dados para visualizar a projeção.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
        {/* ═══ Realidade ═══ */}
        <Card className="shadow-soft rounded-2xl border-l-4" style={{ borderLeftColor: "hsl(45 90% 55%)" }}>
          <CardContent className="p-4 space-y-2 flex flex-col h-full">
            <h4 className="font-heading font-bold text-sm" style={{ color: "hsl(45 70% 40%)" }}>Cenário Realidade</h4>
            <div className="space-y-1 text-sm">
              {/* Linha 1 — Poupança/aporte mensal */}
              <p className="text-muted-foreground">Poupança mensal</p>
              <p className="font-bold">{fmt(poupancaMensal)}/mês</p>
              {/* Linha 2 — Montante */}
              <p className="text-muted-foreground">Patrimônio na aposentadoria</p>
              <p className="font-bold">{fmt(patAposentRealidade)}</p>
              {/* Linha 3 — Patrimônio final */}
              <p className="text-muted-foreground">Patrimônio aos {expectativaVida} anos</p>
              <p className="font-bold">{fmt(patFinalRealidade)}</p>
            </div>
            {/* Rodapé opcional */}
            <div className="mt-auto pt-2">
              {idadeMilhao && (
                <p className="text-xs text-muted-foreground italic">
                  Atinge R$ 1 milhão aos {idadeMilhao} anos.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ═══ Consumo ═══ */}
        <Card className="shadow-soft rounded-2xl border-l-4" style={{ borderLeftColor: "hsl(0 70% 55%)" }}>
          <CardContent className="p-4 space-y-2 flex flex-col h-full">
            <h4 className="font-heading font-bold text-sm" style={{ color: "hsl(0 60% 45%)" }}>Cenário Consumo</h4>
            <div className="space-y-1 text-sm">
              {/* Linha 1 — Poupança/aporte mensal */}
              <p className="text-muted-foreground">Poupança necessária</p>
              <p className="font-bold">{fmt(aporteConsumoChart)}/mês</p>
              {/* Linha 2 — Montante */}
              <p className="text-muted-foreground">Montante a acumular</p>
              <p className="font-bold">{fmt(Math.max(0, montanteConsumo))}</p>
              {/* Linha 3 — Patrimônio final */}
              <p className="text-muted-foreground">Patrimônio aos {expectativaVida} anos</p>
              <p className="font-bold">{fmt(patFinalConsumo)}</p>
            </div>
            {/* Rodapé opcional */}
            <div className="mt-auto pt-2">
              {crescimentoCobreConsumo && (
                <p className="text-xs text-muted-foreground italic">
                  Seu patrimônio de {fmt(patrimonioAtual)} cresce para {fmt(Math.round(pvProjetadoSemAporte))} em {nperAcum / 12} anos, superando o alvo de {fmt(Math.round(montanteConsumo))}.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ═══ Viver de Renda ═══ */}
        <Card className="shadow-soft rounded-2xl border-l-4" style={{ borderLeftColor: "hsl(145 60% 45%)" }}>
          <CardContent className="p-4 space-y-2 flex flex-col h-full">
            <h4 className="font-heading font-bold text-sm" style={{ color: "hsl(145 50% 35%)" }}>Cenário Viver de Renda</h4>
            <div className="space-y-1 text-sm">
              {/* Linha 1 — Poupança/aporte mensal */}
              <p className="text-muted-foreground">Poupança necessária</p>
              <p className="font-bold">{fmt(aporteViverChart)}/mês</p>
              {/* Linha 2 — Montante */}
              <p className="text-muted-foreground">Montante necessário</p>
              <p className="font-bold">{fmt(Math.max(0, montanteViverRenda))}</p>
              {/* Linha 3 — Patrimônio final */}
              <p className="text-muted-foreground">Patrimônio aos {expectativaVida} anos</p>
              <p className="font-bold">{fmt(patFinalViverRenda)}</p>
            </div>
            {/* Rodapé opcional */}
            <div className="mt-auto pt-2">
              {crescimentoCobreViver && (
                <p className="text-xs text-muted-foreground italic">
                  Seu patrimônio de {fmt(patrimonioAtual)} cresce para {fmt(Math.round(pvProjetadoSemAporte))} em {nperAcum / 12} anos (juros compostos), superando o montante necessário de {fmt(Math.round(montanteViverRenda))}. Aportes adicionais aumentam margem de segurança.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bloco educativo — Como o Atlas calcula */}
      <Card className="shadow-soft rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <h4 className="font-heading font-bold text-sm flex items-center gap-2"><BookOpen className="h-4 w-4" />Como o Atlas calcula essas projeções</h4>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              O Atlas usa quatro informações principais para projetar o futuro do seu patrimônio: o <strong>patrimônio atual</strong>, o <strong>quanto você poupa por mês</strong>, a <strong>taxa de retorno real dos seus investimentos</strong> (já descontada a inflação) e a <strong>idade em que você pretende se aposentar</strong>.
            </p>
            <p>
              <strong>Fase de acumulação</strong> — Da sua idade atual até a aposentadoria, o patrimônio cresce com dois motores: os aportes mensais que você faz e os rendimentos que o dinheiro gera sozinho (juros compostos). Quanto mais cedo e constante forem os aportes, maior o efeito dos juros compostos ao longo do tempo.
            </p>
            <p>
              <strong>Fase de uso</strong> — Após a aposentadoria, o patrimônio passa a ser consumido pelas retiradas mensais necessárias para completar a renda desejada. O saldo restante continua rendendo, mas agora compete com os saques.
            </p>
            <p className="font-medium text-foreground">Os três cenários representam estratégias diferentes:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Realidade</strong> — Projeção com a poupança que você já pratica hoje. Mostra aonde você chega mantendo o ritmo atual.</li>
              <li><strong>Consumo do Patrimônio</strong> — Calcula o valor mínimo que você precisaria acumular para gastar o patrimônio inteiro até a expectativa de vida, sem deixar saldo.</li>
              <li><strong>Viver de Renda</strong> — Calcula o patrimônio necessário para que os rendimentos mensais cubram a renda desejada sem consumir o principal, garantindo renda perpétua.</li>
            </ul>
            <p className="text-xs italic text-muted-foreground/70">
              Todos os valores são calculados em termos reais (descontada a inflação), para que a comparação reflita o poder de compra atual.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
