import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Search } from "lucide-react";

interface StockGuideItem {
  id: string;
  ticker: string | null;
  nome: string | null;
  tipo: string | null;
  subtipo: string | null;
  setor: string | null;
  preco: number | null;
  variacao_dia: number | null;
  variacao_mes: number | null;
  variacao_ytd: number | null;
  variacao_12m: number | null;
  market_cap: number | null;
  pl: number | null;
  pvp: number | null;
  roe: number | null;
  dy_12m: number | null;
  updated_at: string | null;
}

const fmt = (v: number | null, prefix = "R$ ") =>
  v != null ? `${prefix}${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";
const pct = (v: number | null) => v != null ? `${Number(v).toFixed(2)}%` : "—";
const mult = (v: number | null) => v != null ? `${Number(v).toFixed(2)}x` : "—";

export default function StockGuideContent() {
  const [data, setData] = useState<StockGuideItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("acoes");
  const [periodo, setPeriodo] = useState<"mes" | "ytd" | "12m">("12m");

  const getVar = (i: StockGuideItem) =>
    periodo === "mes" ? i.variacao_mes
    : periodo === "ytd" ? i.variacao_ytd
    : i.variacao_12m;

  const periodoLabel = periodo === "mes" ? "Mês" : periodo === "ytd" ? "Ano" : "12m";

  useEffect(() => {
    supabase.from("stock_guide").select("*").order("ticker").then(({ data }) => {
      setData(data || []);
      setLoading(false);
    });
  }, []);

  const filter = (items: StockGuideItem[]) =>
    items.filter(i =>
      !search ||
      i.ticker?.toLowerCase().includes(search.toLowerCase()) ||
      i.nome?.toLowerCase().includes(search.toLowerCase())
    );

  const acoes = filter(data.filter(i => i.tipo === "Ação"));
  const fiis = filter(data.filter(i => i.tipo === "FII"));
  const etfs = filter(data.filter(i => i.tipo === "ETF"));
  const bdrs = filter(data.filter(i => i.tipo === "BDR"));

  const updatedAt = data[0]?.updated_at
    ? new Date(data[0].updated_at).toLocaleString("pt-BR")
    : null;

  const TableHeader = ({ cols }: { cols: string[] }) => (
    <thead>
      <tr className="border-b border-border/50">
        {cols.map(c => (
          <th key={c} className="py-2 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{c}</th>
        ))}
      </tr>
    </thead>
  );

  const groupBySetor = <T extends { setor?: string | null }>(items: T[]) => {
    const groups: Record<string, T[]> = {};
    for (const it of items) {
      const key = (it.setor && it.setor.trim()) || "Outros";
      (groups[key] ||= []).push(it);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, "pt-BR"));
  };

  const AcoesColgroup = () => (
    <colgroup>
      <col style={{ width: "26%" }} />
      <col style={{ width: "13%" }} />
      <col style={{ width: "11%" }} />
      <col style={{ width: "12%" }} />
      <col style={{ width: "12%" }} />
      <col style={{ width: "13%" }} />
      <col style={{ width: "13%" }} />
    </colgroup>
  );

  const FiisColgroup = () => (
    <colgroup>
      <col style={{ width: "32%" }} />
      <col style={{ width: "17%" }} />
      <col style={{ width: "16%" }} />
      <col style={{ width: "17%" }} />
      <col style={{ width: "18%" }} />
    </colgroup>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between flex-wrap gap-3">
        {updatedAt && (
          <span className="text-[10px] text-muted-foreground px-2 py-1 rounded-lg bg-muted/30 border border-border/40">
            Atualizado em: {updatedAt}
          </span>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Buscar ticker ou nome..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-8 rounded-xl text-sm"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Variação:</span>
        <div className="inline-flex gap-0.5 p-0.5 bg-muted/40 rounded-lg">
          {[
            { v: "mes" as const, l: "Mês" },
            { v: "ytd" as const, l: "Ano" },
            { v: "12m" as const, l: "12m" },
          ].map(p => (
            <button
              key={p.v}
              onClick={() => setPeriodo(p.v)}
              className={`px-3 py-1 text-xs rounded transition-colors ${periodo === p.v ? "bg-background shadow-sm font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >{p.l}</button>
          ))}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="rounded-xl">
          <TabsTrigger value="acoes" className="text-xs">Ações BR ({acoes.length})</TabsTrigger>
          <TabsTrigger value="fiis" className="text-xs">FIIs ({fiis.length})</TabsTrigger>
          <TabsTrigger value="etfs" className="text-xs">ETFs ({etfs.length})</TabsTrigger>
          <TabsTrigger value="bdrs" className="text-xs">BDRs ({bdrs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="acoes">
          <div className="space-y-4">
            {groupBySetor(acoes).map(([setor, items]) => (
              <div key={setor}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{setor}</h3>
                  <span className="text-[10px] text-muted-foreground">({items.length})</span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
                <Card className="shadow-soft rounded-2xl">
                  <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full table-fixed">
                      <AcoesColgroup />
                      <TableHeader cols={["Ativo", "Preço", periodoLabel, "P/L", "P/VP", "ROE", "DY 12m"]} />
                      <tbody>
                        {items.map(i => {
                          const v = getVar(i);
                          const cls = v == null ? "text-muted-foreground" : v >= 0 ? "text-emerald-600" : "text-destructive";
                          return (
                          <tr key={i.ticker} className="border-b border-border/30 hover:bg-muted/20">
                            <td className="py-2.5 px-3">
                              <div className="min-w-0">
                                <span className="font-mono font-bold text-sm block truncate">{i.ticker}</span>
                                <p className="text-[10px] text-muted-foreground truncate">{i.nome}</p>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-xs font-semibold">{fmt(i.preco)}</td>
                            <td className={`py-2.5 px-3 text-xs font-medium ${cls}`}>{v == null ? "—" : pct(v)}</td>
                            <td className="py-2.5 px-3 text-xs">{mult(i.pl)}</td>
                            <td className="py-2.5 px-3 text-xs">{mult(i.pvp)}</td>
                            <td className="py-2.5 px-3 text-xs">{i.roe != null ? pct(i.roe) : "—"}</td>
                            <td className="py-2.5 px-3 text-xs font-medium text-primary">{i.dy_12m != null ? pct(i.dy_12m) : "—"}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="fiis">
          <div className="space-y-4">
            {groupBySetor(fiis).map(([setor, items]) => (
              <div key={setor}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{setor}</h3>
                  <span className="text-[10px] text-muted-foreground">({items.length})</span>
                  <div className="flex-1 h-px bg-border/40" />
                </div>
                <Card className="shadow-soft rounded-2xl">
                  <CardContent className="p-0 overflow-x-auto">
                    <table className="w-full table-fixed">
                      <FiisColgroup />
                      <TableHeader cols={["Ativo", "Preço", periodoLabel, "P/VP", "DY 12m"]} />
                      <tbody>
                        {items.map(i => {
                          const v = getVar(i);
                          const cls = v == null ? "text-muted-foreground" : v >= 0 ? "text-emerald-600" : "text-destructive";
                          return (
                          <tr key={i.ticker} className="border-b border-border/30 hover:bg-muted/20">
                            <td className="py-2.5 px-3">
                              <div className="min-w-0">
                                <span className="font-mono font-bold text-sm block truncate">{i.ticker}</span>
                                <p className="text-[10px] text-muted-foreground truncate">{i.nome}</p>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-xs font-semibold">{fmt(i.preco)}</td>
                            <td className={`py-2.5 px-3 text-xs font-medium ${cls}`}>{v == null ? "—" : pct(v)}</td>
                            <td className="py-2.5 px-3 text-xs">{mult(i.pvp)}</td>
                            <td className="py-2.5 px-3 text-xs font-medium text-primary">{i.dy_12m != null ? pct(i.dy_12m) : "—"}</td>
                          </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="etfs">
          <div className="space-y-4">
            {["Renda Fixa", "Renda Variável BR", "Internacional", "Metais", "Cripto"].map(sub => {
              const items = filter(etfs.filter(i => i.subtipo === sub));
              if (!items.length) return null;
              return (
                <div key={sub}>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{sub}</h3>
                    <div className="flex-1 h-px bg-border/40" />
                  </div>
                  <Card className="shadow-soft rounded-2xl">
                    <CardContent className="p-0 overflow-x-auto">
                      <table className="w-full">
                        <TableHeader cols={["Ticker", "Nome", "Preço", periodoLabel, "DY 12m"]} />
                        <tbody>
                          {items.map(i => {
                            const v = getVar(i);
                            const cls = v == null ? "text-muted-foreground" : v >= 0 ? "text-emerald-600" : "text-destructive";
                            return (
                            <tr key={i.ticker} className="border-b border-border/30 hover:bg-muted/20">
                              <td className="py-2.5 px-3 font-mono font-bold text-sm">{i.ticker}</td>
                              <td className="py-2.5 px-3 text-xs text-muted-foreground truncate max-w-[200px]">{i.nome}</td>
                              <td className="py-2.5 px-3 text-xs font-semibold">{fmt(i.preco)}</td>
                              <td className={`py-2.5 px-3 text-xs font-medium ${cls}`}>{v == null ? "—" : pct(v)}</td>
                              <td className="py-2.5 px-3 text-xs font-medium text-primary">{i.dy_12m != null ? pct(i.dy_12m) : "—"}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="bdrs">
          <Card className="shadow-soft rounded-2xl">
            <CardContent className="p-0 overflow-x-auto">
              {loading ? <p className="text-sm text-muted-foreground p-4">Carregando...</p> : (
                <table className="w-full">
                  <TableHeader cols={["Ativo", "Preço", periodoLabel, "P/L", "P/VP", "DY 12m"]} />
                  <tbody>
                    {bdrs.map(i => {
                      const v = getVar(i);
                      const cls = v == null ? "text-muted-foreground" : v >= 0 ? "text-emerald-600" : "text-destructive";
                      return (
                      <tr key={i.ticker} className="border-b border-border/30 hover:bg-muted/20">
                        <td className="py-2.5 px-3">
                          <span className="font-mono font-bold text-sm">{i.ticker}</span>
                          <p className="text-[10px] text-muted-foreground truncate max-w-[160px]">{i.nome}</p>
                        </td>
                        <td className="py-2.5 px-3 text-xs font-semibold">{fmt(i.preco)}</td>
                        <td className={`py-2.5 px-3 text-xs font-medium ${cls}`}>{v == null ? "—" : pct(v)}</td>
                        <td className="py-2.5 px-3 text-xs text-muted-foreground" title="P/L de BDR não é comparável diretamente (preço BRL ÷ lucro USD)">—</td>
                        <td className="py-2.5 px-3 text-xs">{mult(i.pvp)}</td>
                        <td className="py-2.5 px-3 text-xs font-medium text-primary">{i.dy_12m != null ? pct(i.dy_12m) : "—"}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <p className="text-[10px] text-muted-foreground text-center pb-4">
        Dados fornecidos via BRAPI. As informações são de caráter educacional e informativo. Não constituem recomendação de compra ou venda de ativos. Consulte um assessor de investimentos antes de tomar decisões financeiras.
      </p>
    </div>
  );
}
