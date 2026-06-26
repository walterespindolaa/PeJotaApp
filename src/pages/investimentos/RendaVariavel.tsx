import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";
import { useInvestimentos } from "@/contexts/InvestimentosContext";
import { TIPOS_VARIAVEIS } from "@/lib/investimentos/constants";

const SEGMENTOS = ["Ação", "FII", "ETF", "BDR", "Exterior", "Cripto"];

// Plural correto por segmento — evita pluralização ingênua ("Ação" + "s" = "Açãos").
// Siglas usam "s"; "Exterior"/"Outros" são invariáveis.
const SEGMENTO_PLURAL: Record<string, string> = {
  "Ação": "Ações",
  "FII": "FIIs",
  "ETF": "ETFs",
  "BDR": "BDRs",
  "Exterior": "Exterior",
  "Cripto": "Criptos",
  "Outros": "Outros",
};

export default function RendaVariavel() {
  const { investimentos, quotes, quotesLoading, fmt, nextExDates } = useInvestimentos();

  const ativosVariaveis = investimentos.filter(
    i => TIPOS_VARIAVEIS.includes(i.tipo) && i.ticker
  );
  if (ativosVariaveis.length === 0) return null;

  const yieldsMedios = ativosVariaveis
    .map(i => {
      const q = quotes[i.ticker!.toUpperCase()];
      return q?.dividend_yield_12m ?? q?.dy ?? null;
    })
    .filter((v): v is number => v !== null);
  const yieldMedioCarteira = yieldsMedios.length > 0
    ? yieldsMedios.reduce((s, v) => s + v, 0) / yieldsMedios.length
    : null;

  const porSegmento = SEGMENTOS.map(seg => ({
    seg,
    items: ativosVariaveis.filter(inv => inv.tipo === seg),
  })).filter(g => g.items.length > 0);
  const tiposConhecidos = new Set(SEGMENTOS);
  const outros = ativosVariaveis.filter(inv => !tiposConhecidos.has(inv.tipo));
  if (outros.length > 0) porSegmento.push({ seg: "Outros", items: outros });

  return (
    <Card className="shadow-soft rounded-2xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="font-heading text-base">Renda Variável</CardTitle>
          </div>
          {yieldMedioCarteira !== null && (
            <Badge variant="outline" className="text-xs font-medium">
              DY médio: {yieldMedioCarteira.toFixed(2)}%
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-6">
          {porSegmento.map(({ seg, items }) => (
            <div key={seg} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wide">
                  {SEGMENTO_PLURAL[seg] ?? seg}
                </h3>
                <div className="flex-1 h-px bg-border/40" />
                <span className="text-xs text-muted-foreground">
                  {items.length} ativo{items.length !== 1 ? "s" : ""}
                </span>
              </div>
              {items.map(inv => {
                const ticker = inv.ticker!.toUpperCase();
                const q = quotes[ticker];
                const isFii = inv.tipo === "FII";
                const isExterior = inv.tipo === "Exterior";
                const dy = q?.dividend_yield_12m ?? q?.dy ?? null;
                const pvp = q?.pvp ?? null;
                const pl = q?.pl ?? null;
                const roe = q?.roe ?? null;
                const precoAtual = q?.preco_atual ?? null;
                const variacaoPct = q?.variacao_pct ?? null;
                const posicaoAtualReal = precoAtual !== null
                  ? precoAtual * Number(inv.quantidade)
                  : Number(inv.valor_atual);
                const lucro = posicaoAtualReal - Number(inv.total_aportado);
                const lucroP = Number(inv.total_aportado) > 0
                  ? (lucro / Number(inv.total_aportado)) * 100
                  : 0;

                return (
                  <div key={inv.id} className="p-4 rounded-xl border border-border/40 bg-muted/10 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {q?.logo_url ? (
                          <img
                            src={q.logo_url}
                            alt={ticker}
                            className="w-8 h-8 rounded-full object-contain bg-white border"
                            onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-primary">{ticker.slice(0, 2)}</span>
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-bold text-sm">{ticker}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0">{inv.tipo}</Badge>
                            {isFii && q?.segment_name && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">
                                {q.segment_name}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {inv.nome || q?.nome || ticker}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {precoAtual !== null ? (
                          <>
                            <p className="text-sm font-heading font-bold">
                              {isExterior ? "US$" : "R$"} {Number(precoAtual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </p>
                            {variacaoPct !== null && (
                              <p className={`text-[11px] font-medium ${variacaoPct >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                                {variacaoPct >= 0 ? "▲" : "▼"} {Math.abs(Number(variacaoPct)).toFixed(2)}% hoje
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">Sem cotação</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      <div className="p-2 rounded-lg bg-background border border-border/30 text-center">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Posição</p>
                        <p className="text-xs font-bold">
                          {isExterior && precoAtual !== null
                            ? `US$ ${posicaoAtualReal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                            : fmt(posicaoAtualReal)}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-background border border-border/30 text-center">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Lucro/Prej</p>
                        <p className={`text-xs font-bold ${lucro >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {lucro >= 0 ? "+" : ""}{fmt(lucro)}
                        </p>
                      </div>
                      <div className="p-2 rounded-lg bg-background border border-border/30 text-center">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Rentab.</p>
                        <p className={`text-xs font-bold ${lucroP >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                          {lucroP >= 0 ? "+" : ""}{lucroP.toFixed(2)}%
                        </p>
                      </div>
                      {dy !== null ? (
                        <div className="p-2 rounded-lg bg-background border border-border/30 text-center">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{isFii ? "DY 12m" : "DY"}</p>
                          <p className="text-xs font-bold text-amber-600">{Number(dy).toFixed(2)}%</p>
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-background border border-border/30 text-center">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">DY</p>
                          <p className="text-xs text-muted-foreground">—</p>
                        </div>
                      )}
                      {pvp !== null ? (
                        <div className="p-2 rounded-lg bg-background border border-border/30 text-center">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">P/VP</p>
                          <p className="text-xs font-bold">{Number(pvp).toFixed(2)}x</p>
                        </div>
                      ) : pl !== null ? (
                        <div className="p-2 rounded-lg bg-background border border-border/30 text-center">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">P/L</p>
                          <p className="text-xs font-bold">{Number(pl).toFixed(1)}x</p>
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-background border border-border/30 text-center">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">P/VP</p>
                          <p className="text-xs text-muted-foreground">—</p>
                        </div>
                      )}
                      {roe !== null ? (
                        <div className="p-2 rounded-lg bg-background border border-border/30 text-center">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">ROE</p>
                          <p className="text-xs font-bold">{Number(roe).toFixed(1)}%</p>
                        </div>
                      ) : isFii && q?.total_investors ? (
                        <div className="p-2 rounded-lg bg-background border border-border/30 text-center">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Cotistas</p>
                          <p className="text-xs font-bold">{Number(q.total_investors).toLocaleString("pt-BR")}</p>
                        </div>
                      ) : (
                        <div className="p-2 rounded-lg bg-background border border-border/30 text-center">
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wide">ROE</p>
                          <p className="text-xs text-muted-foreground">—</p>
                        </div>
                      )}
                    </div>

                    {Number(inv.quantidade) > 0 && Number(inv.preco_medio) > 0 && precoAtual !== null && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{Number(inv.quantidade).toLocaleString("pt-BR")} cotas</span>
                        <span>·</span>
                        <span>PM: {isExterior ? "US$" : "R$"} {Number(inv.preco_medio).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        <span>·</span>
                        {precoAtual > Number(inv.preco_medio) ? (
                          <span className="text-emerald-600 font-medium">
                            +{(((precoAtual - Number(inv.preco_medio)) / Number(inv.preco_medio)) * 100).toFixed(2)}% acima do PM
                          </span>
                        ) : (
                          <span className="text-destructive font-medium">
                            {(((precoAtual - Number(inv.preco_medio)) / Number(inv.preco_medio)) * 100).toFixed(2)}% abaixo do PM
                          </span>
                        )}
                      </div>
                    )}

                    {isFii && nextExDates[ticker] && (() => {
                      const exDate = new Date(nextExDates[ticker] + "T12:00:00");
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const diffDays = Math.round((exDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                      const cutoffDate = new Date(exDate);
                      cutoffDate.setDate(cutoffDate.getDate() - 1);
                      const urgencyColor = diffDays <= 1 ? "text-amber-700 bg-amber-50 border-amber-200"
                        : diffDays <= 3 ? "text-amber-600 bg-amber-50/60 border-amber-200/60"
                        : "text-emerald-700 bg-emerald-50/60 border-emerald-200/60";
                      return (
                        <div className={`text-[10px] px-2 py-1.5 rounded-lg border ${urgencyColor}`}>
                          <span className="font-semibold">Próxima Data EX:</span>{" "}
                          {exDate.toLocaleDateString("pt-BR")}
                          <span className="opacity-70">
                            {" · "}Compre até {cutoffDate.toLocaleDateString("pt-BR")} para garantir
                          </span>
                        </div>
                      );
                    })()}

                    {isFii && q?.nav_per_share && (
                      <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                        <span>VP/cota: R$ {Number(q.nav_per_share).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        {q?.admin_name && <><span>·</span><span>Gestora: {q.admin_name}</span></>}
                        {q?.dividend_yield_1m && <><span>·</span><span>DY último mês: {Number(q.dividend_yield_1m).toFixed(2)}%</span></>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {quotesLoading && (
          <p className="text-xs text-muted-foreground text-center py-2">Atualizando cotações...</p>
        )}
      </CardContent>
    </Card>
  );
}
