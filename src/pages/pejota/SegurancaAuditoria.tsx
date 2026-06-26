import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Shield, KeyRound, Smartphone, History, Check, Minus } from "lucide-react";

/**
 * Segurança e auditoria — prioridade do PeJota (o caixa é o dado mais sensível).
 * Estrutura pronta; o wiring usa company_members (papéis), audit_logs (trilha)
 * e Supabase Auth (2FA/sessão). Por enquanto com dados de exemplo.
 */

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

const AUDITORIA = [
  { quando: "Hoje 09:41", quem: "walter@padaria", acao: "Editou lançamento de R$ 1.200 (Fornecedor Beta)", ip: "187.×.×.10" },
  { quando: "Ontem 18:03", quem: "ana@padaria", acao: "Marcou imposto DAS como pago", ip: "187.×.×.22" },
  { quando: "Ontem 14:20", quem: "walter@padaria", acao: "Convidou novo membro (visualizador)", ip: "187.×.×.10" },
  { quando: "23/06 10:12", quem: "sistema", acao: "Conciliação bancária importou 48 transações", ip: "—" },
];

function PermCell({ v }: { v: "V" | "L" | "-" }) {
  if (v === "V") return <Check className="w-4 h-4 text-emerald-600 mx-auto" />;
  if (v === "L") return <span className="text-[11px] text-amber-600 font-medium">leitura</span>;
  return <Minus className="w-4 h-4 text-muted-foreground/40 mx-auto" />;
}

export default function SegurancaAuditoria() {
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
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
          <div className="space-y-2">
            {AUDITORIA.map((a, i) => (
              <div key={i} className="flex items-start gap-3 text-sm border-b last:border-0 pb-2 last:pb-0">
                <span className="text-xs text-muted-foreground w-24 flex-shrink-0 pt-0.5">{a.quando}</span>
                <div className="flex-1">
                  <p>{a.acao}</p>
                  <p className="text-xs text-muted-foreground">{a.quem} · IP {a.ip}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Origem: tabela <code>audit_logs</code> (já existe no PeJota). Registra criação, edição e exclusão por usuário, com data e IP.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Badge variant="outline" className="text-xs gap-1"><Shield className="w-3 h-3" /> Dados isolados por empresa (RLS)</Badge>
      </div>
    </div>
  );
}
