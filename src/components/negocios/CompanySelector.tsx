import { useState } from "react";
import { Building2, ChevronDown, Plus, Check, Briefcase, Store, ShoppingCart, ShoppingBag, Package, UserCog, Trash2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Company, MAX_COMPANIES } from "@/hooks/useCompanies";

const TYPE_ICONS: Record<string, LucideIcon> = {
  service: Briefcase, physical_store: Store, ecommerce: ShoppingCart,
  marketplace: ShoppingBag, distribution: Package, autonomous: UserCog, other: Building2,
};

interface Props {
  companies: Company[];
  selected: Company | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  canCreate: boolean;
  onDelete?: (id: string) => void;
}

export default function CompanySelector({ companies, selected, onSelect, onCreateNew, canCreate, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 h-9 text-sm font-heading max-w-[280px]">
          <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="truncate">{selected?.name || "Selecionar empresa"}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">
            {companies.length}/{MAX_COMPANIES}
          </Badge>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64" onCloseAutoFocus={(e) => e.preventDefault()}>
        {companies.map(c => {
          const Icon = TYPE_ICONS[c.business_type as string] || Building2;
          const sel = c.id === selected?.id;
          return (
            <div key={c.id} className={`flex items-center gap-1 px-1 py-0.5 rounded-sm ${sel ? "bg-accent" : ""}`}>
              <button
                onClick={() => { onSelect(c.id); setOpen(false); }}
                className={`flex items-center gap-2 min-w-0 flex-1 text-left px-2 py-1.5 rounded-sm text-sm hover:bg-muted/60 ${sel ? "font-medium" : ""}`}
              >
                <Icon className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="truncate flex-1">{c.name}</span>
                {sel && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
              </button>
              {onDelete && (
                <button
                  onClick={() => { setOpen(false); setTimeout(() => onDelete(c.id), 60); }}
                  className="text-muted-foreground hover:text-destructive flex-shrink-0 p-1.5 rounded-md hover:bg-destructive/10"
                  aria-label="Excluir empresa"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
        {canCreate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onCreateNew} className="text-primary">
              <Plus className="h-4 w-4 mr-2" />
              Nova empresa
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
