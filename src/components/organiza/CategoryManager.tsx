import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Settings2 } from "lucide-react";
import type { CustomCategory } from "@/hooks/useCustomCategories";

interface Props {
  customs: CustomCategory[];
  onAdd: (nome: string, tipo: string) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  tipoFilter: "fixa" | "variavel";
}

const CategoryManager = ({ customs, onAdd, onRemove, tipoFilter }: Props) => {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<string>(tipoFilter === "fixa" ? "fixa" : "variavel");

  const filtered = customs.filter(c => c.tipo === tipoFilter || c.tipo === "ambas");

  const handleAdd = async () => {
    if (!nome.trim()) return;
    await onAdd(nome.trim(), tipo);
    setNome("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <Settings2 className="h-3.5 w-3.5" /> Categorias
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Gerenciar Categorias</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input 
              placeholder="Nova categoria" 
              value={nome} 
              onChange={e => setNome(e.target.value)} 
              onKeyDown={e => e.key === "Enter" && handleAdd()}
              className="flex-1"
            />
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixa">Fixa</SelectItem>
                <SelectItem value="variavel">Variável</SelectItem>
                <SelectItem value="ambas">Ambas</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" aria-label="Adicionar categoria" onClick={handleAdd}><Plus className="h-4 w-4" /></Button>
          </div>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma categoria personalizada.</p>
          ) : (
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {filtered.map(c => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <span className="text-sm">{c.nome}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onRemove(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryManager;
