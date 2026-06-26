import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";

type Status = "planejado" | "em-construcao" | "reaproveitado";

interface Props {
  title: string;
  description?: string;
  /** De onde a funcionalidade vem (Atlas / Zephyr / Novo) */
  reuse?: string;
  status?: Status;
  icon?: React.ElementType;
  children?: ReactNode;
}

const STATUS_LABEL: Record<Status, string> = {
  planejado: "Planejado",
  "em-construcao": "Em construção",
  reaproveitado: "Reaproveitado",
};

/**
 * Carcaça (shell) padrão dos módulos do PeJota.
 * Mantém cabeçalho, origem (o que reaproveitamos do Atlas/Zephyr) e estado,
 * para irmos preenchendo cada módulo parte por parte.
 */
export default function PejotaModuleShell({
  title,
  description,
  reuse,
  status = "planejado",
  icon: Icon,
  children,
}: Props) {
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-heading font-semibold">{title}</h1>
            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {STATUS_LABEL[status]}
            </span>
          </div>
          {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
          {reuse && <p className="text-xs text-muted-foreground/80 mt-1">Origem: {reuse}</p>}
        </div>
      </div>

      {children ?? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Construction className="w-8 h-8 mx-auto mb-3 opacity-50" />
            <p className="text-sm">
              Estrutura pronta. Vamos preencher este módulo parte por parte, sempre priorizando segurança.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
