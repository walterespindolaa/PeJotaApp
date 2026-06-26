import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, FileText } from "lucide-react";
import { format } from "date-fns";

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  direction: "in" | "out";
  hash: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  onComplete: () => void;
}

function hashRow(date: string, amount: number, desc: string): string {
  const normalized = `${date}|${Math.abs(amount).toFixed(2)}|${desc.toLowerCase().trim().replace(/\s+/g, " ")}`;
  // Simple hash
  let h = 0;
  for (let i = 0; i < normalized.length; i++) {
    h = ((h << 5) - h + normalized.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

function parseCSV(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Detect separator
  const sep = lines[0].includes(";") ? ";" : ",";
  const header = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/"/g, ""));

  // Find columns
  const dateIdx = header.findIndex(h => /data|date/.test(h));
  const descIdx = header.findIndex(h => /descri|descr|description|hist|memo/.test(h));
  const amountIdx = header.findIndex(h => /valor|amount|value/.test(h));
  const dirIdx = header.findIndex(h => /tipo|type|direction/.test(h));

  if (dateIdx < 0 || amountIdx < 0) return [];

  const rows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ""));
    const rawDate = cols[dateIdx];
    const rawAmount = cols[amountIdx];
    const rawDesc = descIdx >= 0 ? cols[descIdx] : "";
    const rawDir = dirIdx >= 0 ? cols[dirIdx]?.toLowerCase() : "";

    if (!rawDate || !rawAmount) continue;

    // Parse date (dd/mm/yyyy or yyyy-mm-dd)
    let parsedDate: string;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
      const [d, m, y] = rawDate.split("/");
      parsedDate = `${y}-${m}-${d}`;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      parsedDate = rawDate;
    } else {
      continue;
    }

    // Parse amount
    const cleanAmount = rawAmount.replace(/[R$\s]/g, "").replace(".", "").replace(",", ".");
    const amount = parseFloat(cleanAmount);
    if (isNaN(amount) || amount === 0) continue;

    // Determine direction
    let direction: "in" | "out";
    if (rawDir.includes("entrada") || rawDir.includes("in") || rawDir.includes("credito") || rawDir.includes("crédito")) {
      direction = "in";
    } else if (rawDir.includes("saida") || rawDir.includes("saída") || rawDir.includes("out") || rawDir.includes("debito") || rawDir.includes("débito")) {
      direction = "out";
    } else {
      direction = amount > 0 ? "in" : "out";
    }

    rows.push({
      date: parsedDate,
      description: rawDesc || "Importado",
      amount: Math.abs(amount),
      direction,
      hash: hashRow(parsedDate, amount, rawDesc),
    });
  }
  return rows;
}

export default function CsvImportDialog({ open, onOpenChange, companyId, onComplete }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setRows(parseCSV(text));
    };
    reader.readAsText(file, "utf-8");
  };

  const handleImport = async () => {
    if (!user || rows.length === 0) return;
    setSaving(true);

    const inserts = rows.map(r => ({
      company_id: companyId,
      user_id: user.id,
      date: r.date,
      description: r.description,
      amount: r.amount,
      direction: r.direction,
      source: "import",
      external_hash: r.hash,
    }));

    // Insert with ON CONFLICT skip (dedup by hash)
    const { data, error } = await supabase
      .from("business_transactions")
      .upsert(inserts as any, { onConflict: "company_id,external_hash", ignoreDuplicates: true })
      .select("id");

    const imported = data?.length || 0;
    const skipped = rows.length - imported;

    // Log the import
    await supabase.from("business_imports").insert({
      company_id: companyId,
      user_id: user.id,
      filename: fileName,
      rows_imported: imported,
      rows_skipped: skipped,
    } as any);

    setResult({ imported, skipped });
    setSaving(false);
    toast({ title: `${imported} transações importadas${skipped > 0 ? `, ${skipped} duplicatas ignoradas` : ""}` });
    onComplete();
  };

  const reset = () => { setRows([]); setFileName(""); setResult(null); };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importar extrato / planilha
          </DialogTitle>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-xl p-6 text-center">
              <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                Selecione um arquivo CSV com colunas: <strong>Data, Descrição, Valor</strong>
              </p>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                Escolher arquivo
              </Button>
              {fileName && <p className="text-xs text-muted-foreground mt-2 inline-flex items-center gap-1.5"><FileText className="h-3 w-3" />{fileName}</p>}
            </div>

            {rows.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <Badge variant="secondary">{rows.length} transações encontradas</Badge>
                </div>
                <div className="max-h-60 overflow-auto border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Data</TableHead>
                        <TableHead className="text-xs">Descrição</TableHead>
                        <TableHead className="text-xs text-right">Valor</TableHead>
                        <TableHead className="text-xs">Tipo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.slice(0, 20).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{r.date}</TableCell>
                          <TableCell className="text-xs truncate max-w-[200px]">{r.description}</TableCell>
                          <TableCell className="text-xs text-right">{r.amount.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={r.direction === "in" ? "default" : "destructive"} className="text-[10px]">
                              {r.direction === "in" ? "Entrada" : "Saída"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {rows.length > 20 && <p className="text-xs text-muted-foreground text-center py-2">+{rows.length - 20} transações...</p>}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center space-y-3 py-4">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto" />
            <p className="text-lg font-heading font-bold">{result.imported} transações importadas</p>
            {result.skipped > 0 && (
              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                {result.skipped} duplicatas ignoradas
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={handleImport} disabled={rows.length === 0 || saving}>
                {saving ? "Importando..." : `Importar ${rows.length} transações`}
              </Button>
            </>
          ) : (
            <Button onClick={() => { reset(); onOpenChange(false); }}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
