import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Briefcase, Store, ShoppingCart, ShoppingBag, Package, UserCog, Building2, Check, Boxes, Users2, Send, type LucideIcon } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BusinessType, BUSINESS_TYPE_LABELS, companyControlsStock, NICHOS } from "@/hooks/useCompanies";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (name: string, type: BusinessType, currency?: string, nicho?: string) => Promise<any>;
}

const TYPES: BusinessType[] = ["service", "physical_store", "ecommerce", "marketplace", "distribution", "autonomous", "other"];
const TYPE_ICONS: Record<BusinessType, LucideIcon> = {
  service: Briefcase, physical_store: Store, ecommerce: ShoppingCart, marketplace: ShoppingBag,
  distribution: Package, autonomous: UserCog, other: Building2,
};
const TYPE_DESC: Record<BusinessType, string> = {
  service: "Consultorias, agências, estúdios — cobra por serviço, sem estoque.",
  physical_store: "Ponto de venda físico com controle de produtos e estoque.",
  ecommerce: "Loja online própria, com estoque e ficha técnica.",
  marketplace: "Vende em Mercado Livre, Shopee, Amazon e similares.",
  distribution: "Compra e revende no atacado, com controle de estoque.",
  autonomous: "Profissional liberal ou freelancer — sem estoque.",
  other: "Outro modelo de negócio.",
};

const STEPS = ["Nome", "Tipo", "Tudo certo"];

export default function CompanyWizard({ open, onOpenChange, onCreate }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [type, setType] = useState<BusinessType>("service");
  const [currency, setCurrency] = useState("");
  const [nicho, setNicho] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setStep(0); setName(""); setType("service"); setCurrency(""); setNicho(""); };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onCreate(name.trim(), type, currency || undefined, nicho || undefined);
    setSaving(false);
    reset();
    onOpenChange(false);
  };

  const controlaEstoque = companyControlsStock({ business_type: type, controla_estoque: null });
  const abas = ["Financeiro", "Funil de vendas", ...(controlaEstoque ? ["Estoque + ficha técnica"] : []), "Clientes (CRM)", "Propostas"];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-primary/10"><Briefcase className="h-4 w-4 text-primary" /></span>
            Nova empresa
          </DialogTitle>
        </DialogHeader>

        {/* Progresso */}
        <div className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1">
              <div className={`flex items-center gap-1.5 ${i <= step ? "text-primary" : "text-muted-foreground"}`}>
                <span className={`grid place-items-center w-5 h-5 rounded-full text-[10px] font-bold flex-shrink-0 ${i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary/15 text-primary border border-primary" : "bg-muted text-muted-foreground"}`}>
                  {i < step ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <span className="text-[11px] font-medium hidden sm:inline">{label}</span>
              </div>
              {i < STEPS.length - 1 && <span className={`h-px flex-1 ${i < step ? "bg-primary" : "bg-border"}`} />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">Como você quer chamar essa empresa?</p>
            <div>
              <Label className="text-xs">Nome da empresa</Label>
              <Input
                autoFocus value={name} onChange={e => setName(e.target.value)}
                placeholder="Ex: Restaurante do João, Studio Design..."
                onKeyDown={e => e.key === "Enter" && name.trim() && setStep(1)}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">Qual o tipo do negócio? Isso já organiza o Atlas pro seu nicho.</p>
            <div className="grid grid-cols-1 gap-2 max-h-[46vh] overflow-y-auto pr-1">
              {TYPES.map(t => {
                const Icon = TYPE_ICONS[t];
                const sel = type === t;
                return (
                  <button
                    key={t} onClick={() => setType(t)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${sel ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
                  >
                    <span className={`grid place-items-center w-9 h-9 rounded-lg flex-shrink-0 ${sel ? "bg-primary/10" : "bg-muted"}`}>
                      <Icon className="h-5 w-5 text-primary" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm ${sel ? "font-semibold" : "font-medium"}`}>{BUSINESS_TYPE_LABELS[t]}</span>
                      <span className="block text-[11px] text-muted-foreground leading-snug">{TYPE_DESC[t]}</span>
                    </span>
                    {sel && <Check className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 pt-1">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">Sua empresa</p>
              <p className="font-heading font-bold">{name || "—"}</p>
              <p className="text-xs text-muted-foreground">{BUSINESS_TYPE_LABELS[type]}</p>
            </div>

            <div>
              <p className="text-xs font-medium mb-2">O que já vem ativado:</p>
              <div className="flex flex-wrap gap-1.5">
                {abas.map(a => (
                  <span key={a} className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-muted text-foreground">
                    {a.startsWith("Estoque") ? <Boxes className="h-3 w-3 text-primary" /> : a.startsWith("Clientes") ? <Users2 className="h-3 w-3 text-primary" /> : a === "Propostas" ? <Send className="h-3 w-3 text-primary" /> : <Check className="h-3 w-3 text-primary" />}
                    {a}
                  </span>
                ))}
              </div>
              {!controlaEstoque && (
                <p className="text-[11px] text-muted-foreground mt-2">Sem controle de estoque/ficha técnica (típico de serviço). Dá pra ligar depois na engrenagem da empresa.</p>
              )}
            </div>

            {controlaEstoque && (
              <div>
                <Label className="text-xs">Segmento <span className="text-muted-foreground font-normal">(direciona as categorias de insumo)</span></Label>
                <Select value={nicho || "none"} onValueChange={v => setNicho(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Escolha o segmento" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não especificar</SelectItem>
                    {Object.entries(NICHOS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {nicho && NICHOS[nicho] && (
                  <p className="text-[11px] text-muted-foreground mt-1">Categorias: {NICHOS[nicho].categorias.slice(0, 4).join(", ")}…</p>
                )}
              </div>
            )}

            <div>
              <Label className="text-xs">Moeda (opcional)</Label>
              <Input value={currency} onChange={e => setCurrency(e.target.value.toUpperCase())} placeholder="Vazio = usa a moeda do seu perfil" className="h-9 text-sm" />
            </div>
          </div>
        )}

        <DialogFooter className="flex gap-2">
          {step > 0 && <Button variant="outline" onClick={() => setStep(s => s - 1)}>Voltar</Button>}
          {step < 2 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={step === 0 && !name.trim()}>Próximo</Button>
          ) : (
            <Button onClick={handleCreate} disabled={saving}>{saving ? "Criando..." : "Criar empresa"}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
