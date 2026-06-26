import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Wallet, PieChart, TrendingUp, BookOpen, ShieldAlert } from "lucide-react";
import { FV } from "@/lib/financial";

/**
 * Seções "estilo XP" do relatório Estratégia de Subida:
 *  1. Fluxo Financeiro (capacidade de aporte + tabela ano a ano)
 *  2. Projeção do Planejamento (tabela ano a ano: Atual / Consumo / Preservação)
 *  3. Patrimônio detalhado (por categoria, classe e instituição)
 *  4. Termos & Conceitos + Disclaimer reforçado
 *
 * Tudo renderiza dentro do #report-content, então também sai no PDF exportado.
 * As projeções reusam FV() (motor financeiro já validado).
 */

interface RetData {
  idadeAtual: number; idadeAposentadoria: number; expectativaVida: number; inflacao: number;
  patrimonioAtual: number; poupancaMensal: number; taxaRealMensal: number;
  poupancaConsumo: number; poupancaViverRenda: number;
}

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtPct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function SectionCard({ icon: Icon, title, subtitle, children }: { icon: any; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card className="shadow-card rounded-2xl bg-card mb-6 break-inside-avoid">
      <CardContent className="p-8 sm:p-10">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-heading font-bold">{title}</h2>
        </div>
        {subtitle && <p className="text-xs text-muted-foreground mb-4">{subtitle}</p>}
        <div className="mt-3">{children}</div>
      </CardContent>
    </Card>
  );
}

function categoriaBem(tipo: string): "Imóveis" | "Veículos" | "Outros bens" {
  const t = (tipo || "").toLowerCase();
  if (t.includes("imov") || t.includes("imóv") || t.includes("casa") || t.includes("apart") || t.includes("terreno")) return "Imóveis";
  if (t.includes("veic") || t.includes("veíc") || t.includes("carro") || t.includes("moto")) return "Veículos";
  return "Outros bens";
}

export default function RelatorioSecoesAvancadas({
  investimentos, bens, retirementData, rendaMensal, despesaMensal,
}: {
  investimentos: any[];
  bens: any[];
  retirementData: RetData | null;
  rendaMensal: number;
  despesaMensal: number;
}) {
  // ── Patrimônio ──
  const patrimonio = useMemo(() => {
    const financeiro = investimentos.reduce((s, i) => s + Number(i.valor_atual || 0), 0);
    const porCatBem: Record<string, number> = {};
    for (const b of bens) {
      const liq = Number(b.valor || 0) - Number(b.divida_vinculada || 0);
      const cat = categoriaBem(b.tipo);
      porCatBem[cat] = (porCatBem[cat] || 0) + liq;
    }
    const categorias = [
      { nome: "Investimentos", valor: financeiro },
      ...Object.entries(porCatBem).map(([nome, valor]) => ({ nome, valor })),
    ].filter(c => c.valor > 0);
    const total = categorias.reduce((s, c) => s + c.valor, 0);

    const grupo = (key: string) => {
      const m: Record<string, number> = {};
      for (const i of investimentos) {
        const k = (i[key] || "Outros").toString();
        m[k] = (m[k] || 0) + Number(i.valor_atual || 0);
      }
      return Object.entries(m).map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor);
    };

    return { categorias, total, porClasse: grupo("classe"), porInstituicao: grupo("instituicao") };
  }, [investimentos, bens]);

  // ── Projeção do Planejamento (ano a ano, fase de acumulação) ──
  const projecao = useMemo(() => {
    if (!retirementData) return [];
    const { idadeAtual, idadeAposentadoria, patrimonioAtual, taxaRealMensal: r, poupancaMensal, poupancaConsumo, poupancaViverRenda } = retirementData;
    const linhas: { idade: number; atual: number; consumo: number; preservacao: number }[] = [];
    for (let idade = idadeAtual; idade <= idadeAposentadoria; idade++) {
      const meses = (idade - idadeAtual) * 12;
      const proj = (aporte: number) => meses > 0 ? FV(r, meses, -aporte, -patrimonioAtual) : patrimonioAtual;
      linhas.push({
        idade,
        atual: proj(poupancaMensal),
        consumo: proj(Math.max(poupancaMensal, poupancaConsumo)),
        preservacao: proj(Math.max(poupancaMensal, poupancaViverRenda)),
      });
    }
    return linhas;
  }, [retirementData]);

  // ── Fluxo Financeiro (capacidade de aporte) — entradas/saídas corrigidas pela inflação ──
  const fluxo = useMemo(() => {
    if (!retirementData) return null;
    const { idadeAtual, idadeAposentadoria, inflacao } = retirementData;
    const infl = Number(inflacao) || 0;
    const rendaAnual0 = rendaMensal * 12;
    const despAnual0 = despesaMensal * 12;
    const linhas: { idade: number; entradas: number; saidas: number; capacidade: number }[] = [];
    for (let idade = idadeAtual; idade <= idadeAposentadoria; idade++) {
      const t = idade - idadeAtual;
      const fator = Math.pow(1 + infl, t);
      const entradas = rendaAnual0 * fator;
      const saidas = despAnual0 * fator;
      linhas.push({ idade, entradas, saidas, capacidade: entradas - saidas });
    }
    // Card = média do período (coerente com a tabela já corrigida pela inflação).
    const capMediaAnual = linhas.length ? linhas.reduce((s, l) => s + l.capacidade, 0) / linhas.length : 0;
    return { capMensal: capMediaAnual / 12, capAnual: capMediaAnual, linhas };
  }, [retirementData, rendaMensal, despesaMensal]);

  const temDados = patrimonio.total > 0 || !!retirementData;
  if (!temDados) return null;

  return (
    <>
      {/* 1. FLUXO FINANCEIRO */}
      {fluxo && (rendaMensal > 0 || despesaMensal > 0) && (
        <SectionCard icon={Wallet} title="Fluxo Financeiro" subtitle="Capacidade de aporte: o que sobra entre renda e despesa, base para formar patrimônio.">
          <div className="grid grid-cols-2 gap-3 mb-5 max-w-md">
            <div className="p-4 rounded-xl bg-muted/30">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Aporte médio mensal</p>
              <p className={`text-xl font-heading font-bold ${fluxo.capMensal < 0 ? "text-destructive" : "text-success"}`}>{fmtBRL(fluxo.capMensal)}</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/30">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Aporte médio anual</p>
              <p className={`text-xl font-heading font-bold ${fluxo.capAnual < 0 ? "text-destructive" : "text-success"}`}>{fmtBRL(fluxo.capAnual)}</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border/60">
                  <th className="py-2 pr-3">Idade</th><th className="py-2 px-3 text-right">Entradas</th>
                  <th className="py-2 px-3 text-right">Saídas</th><th className="py-2 pl-3 text-right">Capacidade de aporte</th>
                </tr>
              </thead>
              <tbody>
                {fluxo.linhas.map((l, i) => (
                  <tr key={l.idade} className={i % 2 ? "bg-muted/20" : ""}>
                    <td className="py-1.5 pr-3">{l.idade}</td>
                    <td className="py-1.5 px-3 text-right">{fmtBRL(l.entradas)}</td>
                    <td className="py-1.5 px-3 text-right">{fmtBRL(l.saidas)}</td>
                    <td className={`py-1.5 pl-3 text-right font-medium ${l.capacidade < 0 ? "text-destructive" : ""}`}>{fmtBRL(l.capacidade)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">Projeção da fase de acumulação com renda e despesa recorrentes atuais, corrigidas pela inflação (IPCA) ano a ano. Card = média do período.</p>
        </SectionCard>
      )}

      {/* 2. PROJEÇÃO DO PLANEJAMENTO */}
      {projecao.length > 0 && (
        <SectionCard icon={TrendingUp} title="Projeção do Planejamento" subtitle="Patrimônio projetado ano a ano em cada estratégia de aporte (retorno real, descontada a inflação).">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border/60">
                  <th className="py-2 pr-3">Idade</th>
                  <th className="py-2 px-3 text-right">Projeção atual</th>
                  <th className="py-2 px-3 text-right">Consumo do patrimônio</th>
                  <th className="py-2 pl-3 text-right">Preservação do patrimônio</th>
                </tr>
              </thead>
              <tbody>
                {projecao.map((l, i) => (
                  <tr key={l.idade} className={i % 2 ? "bg-muted/20" : ""}>
                    <td className="py-1.5 pr-3">{l.idade}</td>
                    <td className="py-1.5 px-3 text-right">{fmtBRL(l.atual)}</td>
                    <td className="py-1.5 px-3 text-right">{fmtBRL(l.consumo)}</td>
                    <td className="py-1.5 pl-3 text-right">{fmtBRL(l.preservacao)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">"Consumo" gasta o patrimônio até a expectativa de vida; "Preservação" mantém o principal e vive dos juros.</p>
        </SectionCard>
      )}

      {/* 3. PATRIMÔNIO DETALHADO */}
      {patrimonio.total > 0 && (
        <SectionCard icon={PieChart} title="Patrimônio" subtitle="Composição dos seus ativos por categoria, classe e instituição.">
          <p className="text-2xl font-heading font-bold mb-4">{fmtBRL(patrimonio.total)} <span className="text-xs font-normal text-muted-foreground">patrimônio total</span></p>

          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Por categoria</p>
          <div className="space-y-1.5 mb-5">
            {patrimonio.categorias.map((c) => (
              <div key={c.nome} className="space-y-1">
                <div className="flex justify-between text-sm"><span>{c.nome}</span><span className="text-muted-foreground">{fmtBRL(c.valor)} · {fmtPct(c.valor / patrimonio.total)}</span></div>
                <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${(c.valor / patrimonio.total) * 100}%` }} /></div>
              </div>
            ))}
          </div>

          {patrimonio.porClasse.length > 1 && (
            <>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Investimentos por classe</p>
              <div className="space-y-1 mb-5 text-sm">
                {patrimonio.porClasse.map((c) => {
                  const totInv = patrimonio.porClasse.reduce((s, x) => s + x.valor, 0) || 1;
                  return <div key={c.nome} className="flex justify-between"><span className="capitalize">{c.nome.replace(/_/g, " ")}</span><span className="text-muted-foreground">{fmtBRL(c.valor)} · {fmtPct(c.valor / totInv)}</span></div>;
                })}
              </div>
            </>
          )}

          {patrimonio.porInstituicao.length > 1 && (
            <>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2">Investimentos por instituição</p>
              <div className="space-y-1 text-sm">
                {patrimonio.porInstituicao.map((c) => {
                  const totInv = patrimonio.porInstituicao.reduce((s, x) => s + x.valor, 0) || 1;
                  return <div key={c.nome} className="flex justify-between"><span>{c.nome}</span><span className="text-muted-foreground">{fmtBRL(c.valor)} · {fmtPct(c.valor / totInv)}</span></div>;
                })}
              </div>
            </>
          )}
        </SectionCard>
      )}

      {/* 4. TERMOS & CONCEITOS */}
      <SectionCard icon={BookOpen} title="Termos e Conceitos">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          {[
            ["Capacidade de aporte", "O saldo entre renda e despesa. É principalmente com ela que você atinge suas metas financeiras."],
            ["Projeção a valor presente", "Valores projetados pela rentabilidade real (retorno menos inflação/IPCA): indicam seu poder de compra real."],
            ["Projeção nominal", "Valores pela rentabilidade nominal, sem descontar a inflação: mostram o patrimônio bruto necessário."],
            ["Projeção atual", "Caminho do patrimônio mantendo seus aportes e premissas atuais, sem surpresas."],
            ["Consumo do patrimônio", "Estratégia em que o patrimônio é gasto ao longo da aposentadoria até a expectativa de vida."],
            ["Preservação do patrimônio", "Estratégia que mantém o principal e vive apenas dos juros — exige aportes maiores."],
            ["Objetivos", "Metas de curto, médio e longo prazo, como aposentadoria, comprar uma casa ou uma viagem."],
            ["Fluxo de caixa", "Controle de todas as entradas e saídas de dinheiro ao longo do tempo."],
          ].map(([t, d]) => (
            <div key={t}>
              <p className="font-semibold text-foreground">{t}</p>
              <p className="text-muted-foreground leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* 5. DISCLAIMER REFORÇADO */}
      <SectionCard icon={ShieldAlert} title="Aviso importante">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Este material tem caráter meramente informativo e educacional, não constituindo recomendação de investimento,
          oferta ou solicitação de compra ou venda de qualquer ativo, promessa de rentabilidade ou sugestão de alocação.
          As projeções são hipotéticas, baseadas nas informações fornecidas por você e nas premissas adotadas, e podem
          variar ao longo do tempo. Investir envolve risco, incluindo possível perda do principal investido. Rentabilidade
          passada não é garantia de resultados futuros, e os resultados projetados não são líquidos de impostos, taxas ou
          custos. Estratégias de alocação e diversificação não garantem lucro nem protegem contra perdas. As projeções
          assumem reinvestimento dos rendimentos e contribuições ao final de cada período. A inflação é estimada com base
          no IPCA. O PeJota não se responsabiliza por decisões tomadas com base neste material. Consulte um profissional
          habilitado antes de tomar decisões financeiras.
        </p>
      </SectionCard>
    </>
  );
}
