import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Scale, AlertTriangle, Info } from "lucide-react";
import { useInvestimentos } from "@/contexts/InvestimentosContext";

const CLASSES = ["Renda Fixa", "Variável", "Internacional", "Alternativo"] as const;
type Classe = typeof CLASSES[number];

const PRESETS: Record<string, Record<Classe, number>> = {
  Conservador: { "Renda Fixa": 70, "Variável": 15, "Internacional": 10, "Alternativo": 5 },
  Moderado: { "Renda Fixa": 50, "Variável": 30, "Internacional": 15, "Alternativo": 5 },
  Arrojado: { "Renda Fixa": 25, "Variável": 45, "Internacional": 20, "Alternativo": 10 },
};

const STORAGE_KEY = "atlas-alocacao-alvo";
const num = (s: string) => Number(String(s).replace(/[^\d.,-]/g, "").replace(".", "").replace(",", ".")) || 0;

export default function Rebalanceamento() {
  const { investimentos, fmt } = useInvestimentos();

  const [perfil, setPerfil] = useState<string>("Moderado");
  const [alvo, setAlvo] = useState<Record<Classe, number>>(PRESETS.Moderado);
  const [aporte, setAporte] = useState("");

  // Carrega alvo salvo (localStorage).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved?.alvo) { setAlvo(saved.alvo); setPerfil(saved.perfil || "Personalizado"); }
      }
    } catch { /* ignore */ }
  }, []);

  const persist = (p: string, a: Record<Classe, number>) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ perfil: p, alvo: a })); } catch { /* ignore */ }
  };

  const aplicarPreset = (p: string) => {
    setPerfil(p);
    if (PRESETS[p]) { setAlvo(PRESETS[p]); persist(p, PRESETS[p]); }
  };

  const setClasseAlvo = (cl: Classe, v: string) => {
    const next = { ...alvo, [cl]: Math.max(0, Math.min(100, Number(v) || 0)) };
    setAlvo(next); setPerfil("Personalizado"); persist("Personalizado", next);
  };

  // Alocação atual por classe (mesma base do patrimônio: valor_atual).
  const { atualPorClasse, total } = useMemo(() => {
    const map = { "Renda Fixa": 0, "Variável": 0, "Internacional": 0, "Alternativo": 0 } as Record<Classe, number>;
    investimentos.forEach(i => {
      const cl = i.classe as Classe;
      if (CLASSES.includes(cl)) map[cl] += Number(i.valor_atual) || 0;
    });
    const t = CLASSES.reduce((s, cl) => s + map[cl], 0);
    return { atualPorClasse: map, total: t };
  }, [investimentos]);

  const somaAlvo = CLASSES.reduce((s, cl) => s + (alvo[cl] || 0), 0);
  const aporteNum = num(aporte);
  const novoTotal = total + aporteNum;

  // Sugestão de aporte: distribui pro que está abaixo do alvo (sem vender).
  const linhas = useMemo(() => {
    const deficits = CLASSES.map(cl => {
      const alvoR = ((alvo[cl] || 0) / 100) * novoTotal;
      const atualR = atualPorClasse[cl] || 0;
      return { cl, deficit: Math.max(0, alvoR - atualR) };
    });
    const sumDef = deficits.reduce((s, d) => s + d.deficit, 0);
    return CLASSES.map(cl => {
      const atualR = atualPorClasse[cl] || 0;
      const atualPct = total > 0 ? (atualR / total) * 100 : 0;
      const alvoPct = alvo[cl] || 0;
      const def = deficits.find(d => d.cl === cl)!.deficit;
      const aporteSugerido = aporteNum > 0
        ? (sumDef > 0 ? aporteNum * (def / sumDef) : aporteNum * (alvoPct / 100))
        : 0;
      return { cl, atualR, atualPct, alvoPct, desvio: atualPct - alvoPct, aporteSugerido };
    });
  }, [alvo, atualPorClasse, total, novoTotal, aporteNum]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-xl font-heading font-bold">Rebalanceamento</h2>
        <p className="text-sm text-muted-foreground">Mantenha sua carteira alinhada à estratégia que você escolheu.</p>
      </div>

      <Card className="shadow-soft rounded-2xl border-primary/15 bg-primary/5">
        <CardContent className="p-4">
          <p className="text-sm font-heading font-bold mb-2 flex items-center gap-1.5"><Info className="h-4 w-4 text-primary" />Como e quando rebalancear</p>
          <ul className="space-y-1.5 text-xs text-muted-foreground list-disc list-inside">
            <li><span className="font-medium text-foreground">O que é:</span> trazer cada classe de volta ao percentual-alvo da sua estratégia, controlando o risco.</li>
            <li><span className="font-medium text-foreground">Quando:</span> revise a cada 3–6 meses, ou quando uma classe sair mais de ~5% do alvo (banda de tolerância).</li>
            <li><span className="font-medium text-foreground">Como (preferido):</span> direcione os <span className="font-medium text-foreground">novos aportes</span> pras classes abaixo do alvo — rebalanceia sem vender e sem gerar IR.</li>
            <li><span className="font-medium text-foreground">Vendendo:</span> só se a diferença for grande; a venda pode gerar imposto (FII 20% sobre cotas, ações 15%).</li>
          </ul>
        </CardContent>
      </Card>

      {investimentos.length === 0 ? (
        <Card className="shadow-soft rounded-2xl border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Cadastre seus investimentos pra ver a alocação atual e a sugestão de rebalanceamento.
          </CardContent>
        </Card>
      ) : (
      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            <CardTitle className="font-heading text-base">Alocação atual vs. alvo</CardTitle>
          </div>
        </CardHeader>
      <CardContent className="space-y-4">
        {/* Perfil / alvo */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Label className="text-xs text-muted-foreground sm:w-28">Carteira-modelo</Label>
          <Select value={perfil} onValueChange={aplicarPreset}>
            <SelectTrigger className="h-9 w-full sm:w-48 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Conservador">Conservador</SelectItem>
              <SelectItem value="Moderado">Moderado</SelectItem>
              <SelectItem value="Arrojado">Arrojado</SelectItem>
              <SelectItem value="Personalizado">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          <span className={`text-[11px] ${somaAlvo === 100 ? "text-muted-foreground" : "text-destructive font-medium"}`}>
            Soma do alvo: {somaAlvo}%{somaAlvo !== 100 ? " (deve ser 100%)" : ""}
          </span>
        </div>

        {/* Tabela: atual vs alvo + aporte sugerido */}
        <div className="space-y-2">
          {linhas.map(l => (
            <div key={l.cl} className="rounded-xl border border-border/50 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">{l.cl}</span>
                <span className="text-xs text-muted-foreground">{fmt(l.atualR)}</span>
              </div>
              <div className="relative h-2 rounded-full bg-muted overflow-hidden mb-1.5">
                <div className="absolute inset-y-0 left-0 bg-primary/70" style={{ width: `${Math.min(100, l.atualPct)}%` }} />
                <div className="absolute inset-y-0 w-0.5 bg-foreground/70" style={{ left: `${Math.min(100, l.alvoPct)}%` }} title="Alvo" />
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] text-muted-foreground">
                  Atual {l.atualPct.toFixed(0)}% · Alvo
                  <input
                    type="number"
                    value={alvo[l.cl] || 0}
                    onChange={e => setClasseAlvo(l.cl, e.target.value)}
                    className="mx-1 w-12 rounded border border-border bg-background px-1 text-[11px] text-center"
                    aria-label={`Alvo de ${l.cl}`}
                  />%
                  <span className={`ml-1 ${Math.abs(l.desvio) < 5 ? "text-muted-foreground" : l.desvio > 0 ? "text-amber-600" : "text-info"}`}>
                    ({l.desvio >= 0 ? "+" : ""}{l.desvio.toFixed(0)}%)
                  </span>
                </span>
                {aporteNum > 0 && l.aporteSugerido > 0 && (
                  <span className="text-[11px] font-medium text-success">aportar {fmt(l.aporteSugerido)}</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Próximo aporte */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Label className="text-xs text-muted-foreground sm:w-28">Próximo aporte</Label>
          <Input value={aporte} onChange={e => setAporte(e.target.value)} placeholder="R$ 0,00" inputMode="decimal" className="h-9 w-full sm:w-48 text-sm" />
          <span className="text-[11px] text-muted-foreground">Distribui pro que está abaixo do alvo, sem precisar vender.</span>
        </div>

        <div className="p-3 rounded-xl bg-muted/20 border border-border/40 flex items-start gap-2">
          <Info className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            As carteiras-modelo são apenas um ponto de partida — ajuste os alvos como quiser. Conteúdo educacional, <span className="font-medium">não é recomendação de investimento</span>.
          </p>
        </div>
      </CardContent>
      </Card>
      )}
    </div>
  );
}
