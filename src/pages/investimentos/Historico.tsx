import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, FileDown, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useInvestimentos } from "@/contexts/InvestimentosContext";

function fmtMesLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1);
  const s = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function Historico() {
  const { transactions, fmt } = useInvestimentos();
  const [mesFiltro, setMesFiltro] = useState<string>("todos");

  // Meses disponíveis (YYYY-MM) a partir das movimentações, mais recente primeiro.
  const meses = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(tx => { if (tx.data) set.add(String(tx.data).slice(0, 7)); });
    return Array.from(set).sort().reverse();
  }, [transactions]);

  const filtered = useMemo(() => {
    if (mesFiltro === "todos") return transactions;
    return transactions.filter(tx => String(tx.data).slice(0, 7) === mesFiltro);
  }, [transactions, mesFiltro]);

  const totalCompra = filtered.filter(t => t.tipo === "compra").reduce((s, t) => s + Number(t.valor_total || 0), 0);
  const totalVenda = filtered.filter(t => t.tipo === "venda").reduce((s, t) => s + Number(t.valor_total || 0), 0);

  if (transactions.length === 0) return null;

  const display = filtered.slice(0, 300);
  const periodoLabel = mesFiltro === "todos" ? "Todo o período" : fmtMesLabel(mesFiltro);

  const handleExportPDF = () => {
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const margin = 14;
    const now = new Date();
    pdf.setFontSize(14); pdf.setFont("helvetica", "bold");
    pdf.text("PeJota — Histórico de Movimentações", margin, 16);
    pdf.setFontSize(9); pdf.setFont("helvetica", "normal");
    pdf.text(`Gerado em: ${now.toLocaleString("pt-BR")} · Período: ${periodoLabel}`, margin, 23);
    pdf.text(
      `Compras: R$ ${totalCompra.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}  ·  Vendas: R$ ${totalVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      margin, 29
    );
    autoTable(pdf, {
      startY: 35,
      head: [["Data", "Tipo", "Ativo", "Ticker", "Qtd", "Preço Unit.", "Total", "Obs."]],
      body: filtered.map(tx => [
        new Date(tx.data + "T12:00:00").toLocaleDateString("pt-BR"),
        tx.tipo.charAt(0).toUpperCase() + tx.tipo.slice(1),
        tx.nome || "—",
        tx.ticker || "—",
        Number(tx.quantidade).toLocaleString("pt-BR"),
        `R$ ${Number(tx.preco_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        `R$ ${Number(tx.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
        tx.observacao || "—",
      ]),
      styles: { fontSize: 8, cellPadding: 2, overflow: "ellipsize" },
      headStyles: { fillColor: [47, 74, 92], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 244, 240] },
      columnStyles: { 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" } },
      margin: { left: margin, right: margin },
    });
    pdf.save(`atlas-historico-${now.toISOString().split("T")[0]}.pdf`);
  };

  return (
    <Card className="shadow-soft rounded-2xl">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="font-heading text-base flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Histórico de Movimentações
          </CardTitle>
          <div className="flex items-center gap-2">
            <Select value={mesFiltro} onValueChange={setMesFiltro}>
              <SelectTrigger className="h-8 w-[160px] rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os meses</SelectItem>
                {meses.map(m => (
                  <SelectItem key={m} value={m}>{fmtMesLabel(m)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl gap-1.5 h-8 text-xs"
              onClick={handleExportPDF}
            >
              <FileDown className="h-3 w-3" />
              Baixar PDF
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead>Qtd</TableHead>
                <TableHead>Preço Unit.</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Obs.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {display.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-6">
                    Nenhuma movimentação em {periodoLabel.toLowerCase()}.
                  </TableCell>
                </TableRow>
              ) : display.map(tx => (
                <TableRow key={tx.id}>
                  <TableCell className="text-xs">
                    {new Date(tx.data + "T12:00:00").toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        tx.tipo === "compra" ? "border-emerald-500 text-emerald-600"
                        : tx.tipo === "venda" ? "border-destructive text-destructive"
                        : ""
                      }`}
                    >
                      {tx.tipo.charAt(0).toUpperCase() + tx.tipo.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {tx.nome}{tx.ticker ? ` (${tx.ticker})` : ""}
                  </TableCell>
                  <TableCell className="text-xs">
                    {Number(tx.quantidade).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-xs">
                    {tx.preco_unitario > 0
                      ? `R$ ${Number(tx.preco_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-semibold">
                    {fmt(Number(tx.valor_total))}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {tx.observacao || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Totais de compra/venda no período selecionado */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/40">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase">
              <ArrowDownCircle className="h-3.5 w-3.5 text-emerald-600" /> Compras — {periodoLabel}
            </div>
            <p className="text-sm font-heading font-bold text-emerald-600 mt-0.5">{fmt(totalCompra)}</p>
          </div>
          <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase">
              <ArrowUpCircle className="h-3.5 w-3.5 text-destructive" /> Vendas — {periodoLabel}
            </div>
            <p className="text-sm font-heading font-bold text-destructive mt-0.5">{fmt(totalVenda)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
