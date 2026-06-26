import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, UserPlus, Crown, Pencil, Eye } from "lucide-react";

/**
 * Equipe e acessos — membros da empresa e seus papéis.
 * Origem: company_members (role: owner | editor | viewer) + RPCs de convite
 * já existentes no PeJota. Dados de exemplo por enquanto.
 */

type Papel = "owner" | "editor" | "viewer";

const MEMBROS: { nome: string; email: string; papel: Papel }[] = [
  { nome: "Walter Espíndola", email: "walter@padaria", papel: "owner" },
  { nome: "Ana Souza", email: "ana@padaria", papel: "editor" },
  { nome: "Contador", email: "contabil@escritorio", papel: "viewer" },
];

const PAPEL_INFO: Record<Papel, { label: string; icon: React.ElementType; cls: string }> = {
  owner: { label: "Dono", icon: Crown, cls: "bg-amber-500/15 text-amber-600" },
  editor: { label: "Editor", icon: Pencil, cls: "bg-emerald-500/15 text-emerald-600" },
  viewer: { label: "Visualizador", icon: Eye, cls: "bg-muted text-muted-foreground" },
};

export default function EquipeAcessos() {
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-semibold">Equipe e acessos</h1>
            <p className="text-sm text-muted-foreground">Quem tem acesso a esta empresa e o que cada um pode fazer.</p>
          </div>
        </div>
        <Button size="sm" className="gap-2"><UserPlus className="w-4 h-4" /> Convidar</Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Membros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {MEMBROS.map((m) => {
            const info = PAPEL_INFO[m.papel];
            const Icon = info.icon;
            return (
              <div key={m.email} className="flex items-center gap-3 border-b last:border-0 py-2">
                <div className="w-9 h-9 rounded-full bg-muted grid place-items-center text-sm font-medium flex-shrink-0">
                  {m.nome.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.nome}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                <Badge variant="secondary" className={`gap-1 ${info.cls}`}>
                  <Icon className="w-3 h-3" /> {info.label}
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Papéis e detalhe de permissões por módulo ficam em <strong>Segurança e auditoria</strong>. O Dono não pode ser removido.
      </p>
    </div>
  );
}
