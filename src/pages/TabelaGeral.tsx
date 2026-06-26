import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Download, ArrowUpDown, Filter, Users } from "lucide-react";
import { useOrganiza, VisaoPessoa } from "@/hooks/useOrganiza";
import { useHouseholdLabels } from "@/hooks/useHouseholdLabels";
import { usePrivacyFmt } from "@/components/PrivacyValue";

const now = new Date();
const currentMesAno = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

const months = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(now.getFullYear(), i);
  const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
});

// fmt is provided by usePrivacyFmt() which uses i18n context

type UnifiedRow = {
  id: string;
  data: string;
  tipo: "Receita" | "Despesa" | "Parcela" | "Economia";
  categoria: string;
  descricao: string;
  valor: number;
  status: string;
  responsavel: string;
  forma_pagamento: string;
  origem: string;
};

const TabelaGeral = () => {
  const { fmt } = usePrivacyFmt();
  const [mesAno, setMesAno] = useState(currentMesAno);
  const [visaoPessoa, setVisaoPessoa] = useState<VisaoPessoa>("geral");
  const org = useOrganiza(mesAno, visaoPessoa);
  const { getLabel, responsavelOptions, visaoOptions } = useHouseholdLabels(org.nomePessoa1, org.nomePessoa2, org.vinculoPessoa2);

  // Filters
  const [filterTipo, setFilterTipo] = useState<string>("todos");
  const [filterCategoria, setFilterCategoria] = useState<string>("todas");
  const [filterStatus, setFilterStatus] = useState<string>("todos");
  const [filterResponsavel, setFilterResponsavel] = useState<string>("todos");
  const [sortKey, setSortKey] = useState<"data" | "valor">("data");
  const [sortAsc, setSortAsc] = useState(true);

  // Avatar helper
  const getAvatar = (responsavel: string) => {
    if (responsavel === "Pessoa 1") return org.fotoPessoa1;
    if (responsavel === "Pessoa 2") return org.fotoPessoa2;
    return "";
  };
  const getInitial = (responsavel: string) => {
    const label = getLabel(responsavel);
    return label.charAt(0).toUpperCase();
  };

  // Compile all data into unified format
  const rows: UnifiedRow[] = useMemo(() => {
    const result: UnifiedRow[] = [];

    org.receitas.forEach((r) => {
      result.push({
        id: r.id, data: r.data, tipo: "Receita", categoria: r.categoria,
        descricao: r.descricao || r.categoria, valor: Number(r.valor),
        status: r.status === "recebido" ? "Realizado" : "Previsto",
        responsavel: r.responsavel, forma_pagamento: "—", origem: "receitas"
      });
    });

    org.despesas.filter((d) => !d.is_parcelada).forEach((d) => {
      result.push({
        id: d.id, data: d.data, tipo: "Despesa", categoria: d.categoria,
        descricao: d.descricao || d.categoria, valor: -Number(d.valor),
        status: d.status === "pago" ? "Realizado" : "Previsto",
        responsavel: d.responsavel, forma_pagamento: d.forma_pagamento || "—", origem: "despesas"
      });
    });

    org.despesas.filter((d) => d.is_parcelada).forEach((d) => {
      result.push({
        id: d.id, data: d.data, tipo: "Parcela", categoria: d.categoria,
        descricao: `${d.descricao || d.categoria} (${d.parcela_atual}/${d.total_parcelas})`,
        valor: -Number(d.valor),
        status: d.status === "pago" ? "Realizado" : "Previsto",
        responsavel: d.responsavel, forma_pagamento: d.forma_pagamento || "—", origem: "despesas"
      });
    });

    org.economias.forEach((e) => {
      result.push({
        id: e.id, data: e.data, tipo: "Economia", categoria: e.destino_tipo,
        descricao: e.descricao || (e.destino_tipo === "investimento" ? "Investimento" : "Meta"),
        valor: -Number(e.valor),
        status: "Realizado", responsavel: e.responsavel, forma_pagamento: "—", origem: "economias"
      });
    });

    return result;
  }, [org.receitas, org.despesas, org.economias]);

  // Get unique categories
  const categorias = useMemo(() => [...new Set(rows.map((r) => r.categoria))].sort(), [rows]);

  // Apply filters
  const filtered = useMemo(() => {
    let data = rows;
    if (filterTipo !== "todos") data = data.filter((r) => r.tipo === filterTipo);
    if (filterCategoria !== "todas") data = data.filter((r) => r.categoria === filterCategoria);
    if (filterStatus !== "todos") data = data.filter((r) => r.status === filterStatus);
    if (filterResponsavel !== "todos") data = data.filter((r) => r.responsavel === filterResponsavel);

    data.sort((a, b) => {
      const cmp = sortKey === "data" ?
      a.data.localeCompare(b.data) :
      Math.abs(a.valor) - Math.abs(b.valor);
      return sortAsc ? cmp : -cmp;
    });

    return data;
  }, [rows, filterTipo, filterCategoria, filterStatus, filterResponsavel, sortKey, sortAsc]);

  // Totals
  const entradas = filtered.filter((r) => r.valor > 0).reduce((s, r) => s + r.valor, 0);
  const saidas = filtered.filter((r) => r.valor < 0).reduce((s, r) => s + r.valor, 0);
  const saldo = entradas + saidas;

  // CSV export
  const exportCSV = () => {
    const header = "Data,Tipo,Categoria,Descrição,Valor,Status,Responsável,Forma Pagamento\n";
    const body = filtered.map((r) =>
    `${r.data},${r.tipo},${r.categoria},"${r.descricao}",${r.valor.toFixed(2)},${r.status},${getLabel(r.responsavel)},${r.forma_pagamento}`
    ).join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extrato-${mesAno}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (key: "data" | "valor") => {
    if (sortKey === key) setSortAsc(!sortAsc);else
    {setSortKey(key);setSortAsc(true);}
  };

  if (org.loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>);

  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Lançamentos</h1>
          <p className="text-muted-foreground text-sm mt-1">Extrato compilado de todas as movimentações.</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={mesAno} onValueChange={setMesAno}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1">
            <Download className="h-4 w-4" /> CSV
          </Button>
        </div>
      </div>

      {/* Vision selector — READ-ONLY, no edit icons */}
      <div className="flex items-center gap-2 p-2 rounded-2xl bg-muted/40 border border-border/40 flex-wrap">
        <Users className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground mr-1">Visão:</span>
        {visaoOptions.map((v) =>
        <button
          key={v.value}
          onClick={() => setVisaoPessoa(v.value)}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 ${
          visaoPessoa === v.value ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`
          }>

            {v.label}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            <SelectItem value="Receita">Receita</SelectItem>
            <SelectItem value="Despesa">Despesa</SelectItem>
            <SelectItem value="Parcela">Parcela</SelectItem>
            <SelectItem value="Economia">Economia</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCategoria} onValueChange={setFilterCategoria}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas categorias</SelectItem>
            {categorias.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="Previsto">Previsto</SelectItem>
            <SelectItem value="Realizado">Realizado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterResponsavel} onValueChange={setFilterResponsavel}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {responsavelOptions.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="shadow-soft">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => toggleSort("data")}>
                    <div className="flex items-center gap-1">Data <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="cursor-pointer text-right" onClick={() => toggleSort("valor")}>
                    <div className="flex items-center gap-1 justify-end">Valor <ArrowUpDown className="h-3 w-3" /></div>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Pagamento</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ?
                <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Nenhum lançamento encontrado.
                    </TableCell>
                  </TableRow> :

                filtered.map((r) =>
                <TableRow key={`${r.origem}-${r.id}`}>
                      <TableCell className="text-xs whitespace-nowrap">{r.data}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{r.tipo}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.categoria}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{r.descricao}</TableCell>
                      <TableCell className={`text-right font-heading font-bold text-sm ${r.valor >= 0 ? "text-success" : "text-destructive"}`}>
                        {fmt(r.valor)}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${r.status === "Realizado" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            {getAvatar(r.responsavel) ?
                        <AvatarImage src={getAvatar(r.responsavel)} /> :
                        null}
                            <AvatarFallback className="text-[9px] bg-muted">{getInitial(r.responsavel)}</AvatarFallback>
                          </Avatar>
                          <span className="text-xs">{getLabel(r.responsavel)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{r.forma_pagamento}</TableCell>
                    </TableRow>
                )
                }
              </TableBody>
              {filtered.length > 0 &&
              <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-heading font-bold text-sm">Totais</TableCell>
                    <TableCell className="text-right">
                      <div className="space-y-0.5">
                        <p className="text-xs text-success font-bold">Entradas: {fmt(entradas)}</p>
                        <p className="text-xs text-destructive font-bold">Saídas: {fmt(saidas)}</p>
                        <p className={`text-sm font-heading font-bold ${saldo >= 0 ? "text-success" : "text-destructive"}`}>
                          Saldo: {fmt(saldo)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell colSpan={3} />
                  </TableRow>
                </TableFooter>
              }
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>);

};

export default TabelaGeral;