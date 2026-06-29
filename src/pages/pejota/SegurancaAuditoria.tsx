import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Shield, KeyRound, Smartphone, History, Check, Minus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Segurança e auditoria — prioridade do PeJota (o caixa é o dado mais sensível).
 * Trilha = business_audit_logs (real, via triggers). 2FA/sessão/permissões
 * seguem estruturais (dependem de Supabase Auth e da matriz por papel).
 */

const db = supabase as any;
type AuditRow = { id: string; user_id: string | null; action: string; entity: string; summary: string | null; created_at: string };

const ENTITY_LABEL: Record<string, string> = {
  business_transactions: "Caixa", business_bills: "Conta", business_taxes: "Imposto",
  business_payouts: "Colaborador", business_goals: "Meta", business_planned_events: "Evento", business_cashflow_budget: "Orçamento",
};
const ACTION_LABEL: Record<string, string> = { INSERT: "Criou", UPDATE: "Editou", DELETE: "Excluiu" };

const PAPEIS = ["Dono", "Editor", "Visualizador"] as const;

// Matriz de permissões por módulo × papel (V = pode editar, L = só leitura, — = sem acesso)
const PERMISSOES: { modulo: string; valores: ("V" | "L" | "-")[] }[] = [
  { modulo: "Dashboard", valores: ["V", "V", "L"] },
  { modulo: "Vendas (funil, clientes, propostas)", valores: ["V", "V", "L"] },
  { modulo: "Financeiro / Caixa", valores: ["V", "V", "-"] },
  { modulo: "Contas a pagar / receber", valores: ["V", "V", "-"] },
  { modulo: "Impostos e colaboradores", valores: ["V", "-", "-"] },
  { modulo: "Estoque", valores: ["V", "V", "L"] },
  { modulo: "Relatórios e DRE", valores: ["V", "V", "L"] },
  { modulo: "Configuração e segurança", valores: ["V", "-", "-"] },
];

function PermCell({ v }: { v: "V" | "L" | "-" }) {
  if (v === "V") return <Check className="w-4 h-4 text-emerald-600 mx-auto" />;
  if (v === "L") return <span className="text-[11px] text-amber-600 font-medium">leitura</span>;
  return <Minus className="w-4 h-4 text-muted-foreground/40 mx-auto" />;
}

export default function SegurancaAuditoria() {
  const { selected } = useCompanies();
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const loadLogs = useCallback(async () => {
    if (!selected) { setLogs([]); return; }
    setLoadingLogs(true);
    const { data } = await db.from("business_audit_logs").select("id, user_id, action, entity, summary, created_at").eq("company_id", selected.id).order("created_at", { ascending: false }).limit(50);
    setLogs((data || []) as AuditRow[]);
    setLoadingLogs(false);
  }, [selected]);
  useEffect(() => { loadLogs(); }, [loadLogs]);

  const quando = (iso: string) => { try { return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR }); } catch { return iso; } };
  const descreve = (l: AuditRow) => {
    const ent = ENTITY_LABEL[l.entity] || l.entity;
    const act = ACTION_LABEL[l.action] || l.action;
    const extra = (l.summary || "").replace(/^(INSERT|UPDATE|DELETE)\s*·?\s*/, "").trim();
    return `${act} · ${ent}${extra ? ` · ${extra}` : ""}`;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 grid place-items-center flex-shrink-0">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-heading font-semibold">Segurança e auditoria</h1>
          <p className="text-sm text-muted-foreground">
            Controle de quem vê e edita o caixa, autenticação reforçada e trilha de tudo que acontece.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><KeyRound className="w-4 h-4" /> Autenticação</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium flex items-center gap-2"><Smartphone className="w-4 h-4" /> Verificação em 2 etapas (2FA)</p>
              <p className="text-xs text-muted-foreground">Exigir código além da senha no login. Recomendado para todos com acesso ao caixa.</p>
            </div>
            <Switch />
          </div>
          <div className="flex items-center justify-between gap-4 border-t pt-4">
            <div>
              <p className="text-sm font-medium">Expirar sessão por inatividade</p>
              <p className="text-xs text-muted-foreground">Desconecta após 30 min parado.</p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between gap-4 border-t pt-4">
            <div>
              <p className="text-sm font-medium">Exigir troca de senha a cada 90 dias</p>
              <p className="text-xs text-muted-foreground">Política para contas com permissão de edição.</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Shield className="w-4 h-4" /> Permissões por módulo</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left font-medium py-2">Módulo</th>
                  {PAPEIS.map((p) => <th key={p} className="font-medium py-2 px-2 text-center">{p}</th>)}
                </tr>
              </thead>
              <tbody>
                {PERMISSOES.map((row) => (
                  <tr key={row.modulo} className="border-b last:border-0">
                    <td className="py-2 pr-2">{row.modulo}</td>
                    {row.valores.map((v, i) => <td key={i} className="py-2 px-2 text-center"><PermCell v={v} /></td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Papéis vêm de <code>company_members</code> (Dono = criador da empresa). A matriz será editável pelo Dono.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><History className="w-4 h-4" /> Trilha de auditoria</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Carregando…</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum registro ainda. Toda criação, edição ou exclusão de dado financeiro aparece aqui.</p>
          ) : (
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="flex items-start gap-3 text-sm border-b last:border-0 pb-2 last:pb-0">
                  <span className="text-xs text-muted-foreground w-28 flex-shrink-0 pt-0.5">{quando(l.created_at)}</span>
                  <div className="flex-1">
                    <p>{descreve(l)}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{l.action}</Badge>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Origem: <code>business_audit_logs</code> (gravada automaticamente por triggers). Registra criação, edição e exclusão por usuário, com data — isolada por empresa (RLS).
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Badge variant="outline" className="text-xs gap-1"><Shield className="w-3 h-3" /> Dados isolados por empresa (RLS)</Badge>
      </div>
    </div>
  );
}
