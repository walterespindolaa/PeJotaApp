import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Checkbox } from "@/components/ui/checkbox";
import { CategoryIcon } from "@/lib/categoryIcons";
import { Settings2, Plus, Trash2, HelpCircle, Link2, BarChart3 } from "lucide-react";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import PrivacyValue from "@/components/PrivacyValue";
import { AllocationRule, BusinessCategory } from "@/hooks/useCompanies";

const BASE_LABELS: Record<string, string> = {
  revenue: "Faturamento",
  gross_profit: "Lucro bruto",
  net_profit: "Lucro líquido",
};

const BASE_HELP: Record<string, string> = {
  revenue: "Total de tudo que entrou no caixa.",
  gross_profit: "Faturamento menos despesas diretas.",
  net_profit: "O que sobra depois de pagar tudo.",
};

interface Props {
  companyId: string;
  revenue: number;
  expenses: number;
  categories: BusinessCategory[];
  onRulesChanged?: () => void;
}

export default function AllocationRulesCard({ companyId, revenue, expenses, categories, onRulesChanged }: Props) {
  const { user } = useAuth();
  const { fmt } = usePrivacyFmt();
  const [rules, setRules] = useState<AllocationRule[]>([]);
  const [editing, setEditing] = useState(false);

  const grossProfit = revenue - expenses;
  const netProfit = grossProfit;

  const getBase = (base: string) => {
    switch (base) {
      case "revenue": return revenue;
      case "gross_profit": return grossProfit;
      case "net_profit": return netProfit;
      default: return revenue;
    }
  };

  const fetchRules = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("allocation_rules")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at");
    // Silently filter out deleted category_ids that no longer exist
    const validCatIds = new Set(categories.map(c => c.id));
    setRules((data || []).map((r: any) => ({
      ...r,
      category_ids: (r.category_ids || []).filter((id: string) => validCatIds.has(id)),
    })) as AllocationRule[]);
  }, [user, companyId, categories]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const updateRule = async (id: string, field: string, value: any) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const toggleCategoryId = (ruleId: string, catId: string) => {
    setRules(prev => prev.map(r => {
      if (r.id !== ruleId) return r;
      const ids = r.category_ids || [];
      const next = ids.includes(catId) ? ids.filter(id => id !== catId) : [...ids, catId];
      return { ...r, category_ids: next };
    }));
  };

  const saveAll = async () => {
    for (const r of rules) {
      await supabase.from("allocation_rules").update({
        name: r.name, percentage: r.percentage, base: r.base, active: r.active,
        category_ids: r.category_ids || [],
      } as any).eq("id", r.id);
    }
    setEditing(false);
    onRulesChanged?.();
  };

  const addRule = async () => {
    if (!user) return;
    await supabase.from("allocation_rules").insert({
      company_id: companyId, user_id: user.id, name: "Nova regra", type: "expense", base: "revenue", percentage: 5,
      category_ids: [],
    } as any);
    fetchRules();
  };

  const deleteRule = async (id: string) => {
    await supabase.from("allocation_rules").delete().eq("id", id);
    fetchRules();
    onRulesChanged?.();
  };

  const outCategories = categories.filter(c => c.direction === "out");

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-heading flex items-center gap-1.5"><BarChart3 className="h-4 w-4" />Organização Estratégica</CardTitle>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Defina quanto do seu faturamento ou lucro vai para cada provisão. Vincule categorias para comparar planejado vs real.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => editing ? saveAll() : setEditing(true)}>
          {editing ? "Salvar" : "Editar"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rules.filter(r => r.active || editing).map(r => {
          const baseVal = getBase(r.base);
          const computed = Math.max(0, baseVal * (r.percentage / 100));
          const linkedCount = (r.category_ids || []).length;

          return (
            <div key={r.id} className="bg-muted/50 rounded-xl p-3">
              {editing ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input className="h-7 text-xs flex-1" value={r.name} onChange={e => updateRule(r.id, "name", e.target.value)} />
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteRule(r.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input type="number" className="h-7 text-xs w-20" value={r.percentage} onChange={e => updateRule(r.id, "percentage", parseFloat(e.target.value) || 0)} />
                    <span className="text-xs text-muted-foreground">% do</span>
                    <Select value={r.base} onValueChange={v => updateRule(r.id, "base", v)}>
                      <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="revenue">Faturamento</SelectItem>
                        <SelectItem value="gross_profit">Lucro bruto</SelectItem>
                        <SelectItem value="net_profit">Lucro líquido</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {/* Category binding */}
                  {outCategories.length > 0 && (
                    <div className="pt-1 border-t border-border/50">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">
                        <Link2 className="h-3 w-3" /> Vincular categorias (para Planejado vs Real):
                      </p>
                      <p className="text-[9px] text-muted-foreground/70 mb-1.5 italic">
                        Escolha as categorias que representam esse gasto na vida real.
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {outCategories.map(cat => {
                          const checked = (r.category_ids || []).includes(cat.id);
                          return (
                            <label
                              key={cat.id}
                              className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border cursor-pointer transition-all ${
                                checked ? "bg-primary/10 border-primary/30 text-foreground" : "border-border text-muted-foreground hover:border-primary/20"
                              }`}
                            >
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() => toggleCategoryId(r.id, cat.id)}
                                className="h-3 w-3"
                              />
                              <CategoryIcon name={cat.name} className="h-3 w-3 text-muted-foreground" /> {cat.name}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[11px] text-muted-foreground">
                        {r.name} <span className="font-medium">({r.percentage}% do {BASE_LABELS[r.base] || r.base})</span>
                      </p>
                      {linkedCount > 0 && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary">
                          <Link2 className="h-2.5 w-2.5 mr-0.5" />{linkedCount} cat.
                        </Badge>
                      )}
                    </div>
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                        <TooltipContent className="text-xs">{BASE_HELP[r.base] || ""}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <p className="text-base font-bold font-heading text-foreground">
                    <PrivacyValue>{fmt(computed)}</PrivacyValue>
                  </p>
                </div>
              )}
            </div>
          );
        })}
        {editing && (
          <Button variant="outline" size="sm" className="w-full text-xs" onClick={addRule}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar regra
          </Button>
        )}
        {!editing && rules.length === 0 && (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground mb-2">Defina provisões para organizar para onde vai seu dinheiro — ex: 15% para impostos, 10% para marketing, 40% pró-labore.</p>
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => setEditing(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Criar provisões
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
