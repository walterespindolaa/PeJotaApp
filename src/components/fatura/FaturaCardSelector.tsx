import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { CreditCard, Plus } from "lucide-react";

interface CreditCardItem {
  id: string;
  name: string;
  issuer: string;
  last_four_digits: string | null;
}

interface Props {
  value: string | null;
  onChange: (cardId: string | null) => void;
}

export default function FaturaCardSelector({ value, onChange }: Props) {
  const { user } = useAuth();
  const [cards, setCards] = useState<CreditCardItem[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIssuer, setNewIssuer] = useState("");
  const [newDigits, setNewDigits] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("credit_cards" as any)
      .select("id,name,issuer,last_four_digits")
      .eq("user_id", user.id)
      .order("name")
      .then(({ data, error }) => {
        if (error) console.error(error);
        setCards((data as any[]) || []);
      });
  }, [user]);

  const handleCreateCard = async () => {
    if (!user || !newName) return;
    const { data } = await supabase.from("credit_cards" as any).insert({
      user_id: user.id, name: newName, issuer: newIssuer, last_four_digits: newDigits || null,
    } as any).select("id,name,issuer,last_four_digits").single();
    if (data) {
      const card = data as any;
      setCards(prev => [...prev, card]);
      onChange(card.id);
    }
    setShowNew(false);
    setNewName(""); setNewIssuer(""); setNewDigits("");
  };

  return (
    <div className="flex items-center gap-2">
      <CreditCard className="h-4 w-4 text-muted-foreground shrink-0" />
      <Select value={value || "none"} onValueChange={v => onChange(v === "none" ? null : v)}>
        <SelectTrigger className="h-8 w-48 text-xs">
          <SelectValue placeholder="Selecionar cartão" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sem cartão vinculado</SelectItem>
          {cards.map(c => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}{c.last_four_digits ? ` •••• ${c.last_four_digits}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowNew(true)}>
        <Plus className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Cartão de Crédito</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Nome do cartão</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Nubank Mastercard" />
            </div>
            <div>
              <Label className="text-xs">Emissor</Label>
              <Input value={newIssuer} onChange={e => setNewIssuer(e.target.value)} placeholder="Ex: Nubank" />
            </div>
            <div>
              <Label className="text-xs">Últimos 4 dígitos (opcional)</Label>
              <Input value={newDigits} onChange={e => setNewDigits(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="1234" maxLength={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreateCard} disabled={!newName}>Criar cartão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
