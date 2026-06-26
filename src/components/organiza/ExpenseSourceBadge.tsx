import { CreditCard, Pencil, Building2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  source?: string | null;
  className?: string;
}

import { FileSpreadsheet } from "lucide-react";

const SOURCE_CONFIG: Record<string, { icon: typeof CreditCard; tooltip: string; colorClass: string }> = {
  credit_card: { icon: CreditCard, tooltip: "Importado da fatura do cartão", colorClass: "text-primary" },
  bank_import: { icon: Building2, tooltip: "Importado do extrato bancário", colorClass: "text-info" },
  spreadsheet: { icon: FileSpreadsheet, tooltip: "Importado por planilha", colorClass: "text-amber-500" },
  manual: { icon: Pencil, tooltip: "Lançamento manual", colorClass: "text-muted-foreground" },
};

export default function ExpenseSourceBadge({ source, className = "" }: Props) {
  const key = source || "manual";
  const cfg = SOURCE_CONFIG[key] || SOURCE_CONFIG.manual;
  const Icon = cfg.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={`inline-flex items-center flex-shrink-0 ${className}`}>
            <Icon className={`h-3.5 w-3.5 ${cfg.colorClass}`} />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{cfg.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
