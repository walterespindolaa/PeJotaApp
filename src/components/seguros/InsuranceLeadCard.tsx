import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, ArrowRight, CheckCircle2 } from "lucide-react";

const SEGURO_OPTIONS = [
  { value: "nao-tenho", label: "Não tenho" },
  { value: "tradicional", label: "Seguro tradicional" },
  { value: "whole-life", label: "Whole life" },
];

const OBJETIVO_OPTIONS = [
  { value: "proteger-familia", label: "Proteger família" },
  { value: "sucessorio", label: "Planejamento sucessório" },
  { value: "diversificacao", label: "Diversificação patrimonial" },
  { value: "entender", label: "Entender melhor seguros" },
];

const PATRIMONIO_INVESTIDO_OPTIONS = [
  { value: "ate-300k", label: "Até R$ 300 mil" },
  { value: "300k-500k", label: "R$ 300 mil a R$ 500 mil" },
  { value: "500k-1M", label: "R$ 500 mil a R$ 1 milhão" },
  { value: "1M-3M", label: "R$ 1 milhão a R$ 3 milhões" },
  { value: "3M+", label: "Acima de R$ 3 milhões" },
];

const PATRIMONIO_IMOB_OPTIONS = [
  { value: "nenhum", label: "Nenhum" },
  { value: "ate-500k", label: "Até R$ 500 mil" },
  { value: "500k-1M", label: "R$ 500 mil a R$ 1 milhão" },
  { value: "1M+", label: "Acima de R$ 1 milhão" },
];

const RENDA_OPTIONS = [
  { value: "ate-10k", label: "Até R$ 10 mil" },
  { value: "10k-20k", label: "R$ 10 mil a R$ 20 mil" },
  { value: "20k-50k", label: "R$ 20 mil a R$ 50 mil" },
  { value: "50k+", label: "Acima de R$ 50 mil" },
];

function calcScore(dependentes: number, rendaMensal: number, totalInvestido: number, objetivo: string): number {
  let score = 0;
  if (dependentes > 0) score += 1;
  if (rendaMensal > 15000) score += 1;
  if (totalInvestido > 500000) score += 1;
  if (objetivo === "sucessorio") score += 1;
  return Math.min(score, 4);
}

interface Props {
  dependentes: number;
  rendaMensal: number;
  totalInvestido: number;
}

export default function InsuranceLeadCard({ dependentes, rendaMensal, totalInvestido }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [alreadySent, setAlreadySent] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [numDependentes, setNumDependentes] = useState(String(dependentes));
  const [patrimonioInv, setPatrimonioInv] = useState("");
  const [patrimonioImob, setPatrimonioImob] = useState("");
  const [rendaSel, setRendaSel] = useState("");
  const [heranca, setHeranca] = useState("não");
  const [seguroAtual, setSeguroAtual] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("insurance_leads").select("id").eq("user_id", user.id).limit(1)
      .then(({ data }) => { if (data && data.length > 0) setAlreadySent(true); });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || "");
    setNome(user.user_metadata?.full_name || "");
    supabase.from("profiles").select("full_name, phone").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.full_name) setNome(data.full_name);
        if (data?.phone) setTelefone(data.phone);
      });
  }, [user]);

  useEffect(() => { setNumDependentes(String(dependentes)); }, [dependentes]);

  const handleSubmit = async () => {
    if (!user || !seguroAtual || !objetivo || !patrimonioInv) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSending(true);
    const score = calcScore(dependentes, rendaMensal, totalInvestido, objetivo);
    const payload = {
      user_id: user.id,
      nome,
      email,
      telefone,
      dependentes: parseInt(numDependentes) || 0,
      patrimonio_investido: PATRIMONIO_INVESTIDO_OPTIONS.find(p => p.value === patrimonioInv)?.label || patrimonioInv,
      patrimonio_imobiliario: PATRIMONIO_IMOB_OPTIONS.find(p => p.value === patrimonioImob)?.label || patrimonioImob,
      renda_mensal: RENDA_OPTIONS.find(r => r.value === rendaSel)?.label || rendaSel,
      heranca_esperada: heranca,
      seguro_atual: SEGURO_OPTIONS.find(s => s.value === seguroAtual)?.label || seguroAtual,
      objetivo: OBJETIVO_OPTIONS.find(o => o.value === objetivo)?.label || objetivo,
      observacoes,
      score,
    };
    const { error } = await supabase.from("insurance_leads").insert(payload as any);
    setSending(false);
    if (error) { toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" }); return; }
    setSubmitted(true);
    setAlreadySent(true);
  };

  return (
    <>
      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 flex-shrink-0">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 space-y-1">
              <h4 className="font-heading font-bold text-sm">Quer entender melhor sua proteção?</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Solicite uma análise personalizada da sua situação e descubra as melhores opções de proteção para o seu momento.
              </p>
            </div>
            <Button onClick={() => { setSubmitted(false); setOpen(true); }} disabled={alreadySent} size="sm" className="flex-shrink-0 gap-2">
              {alreadySent
                ? <><CheckCircle2 className="h-4 w-4" /> Solicitação enviada</>
                : <>Quero entender minha proteção <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {submitted ? (
            <div className="text-center py-8 space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mx-auto">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h3 className="font-heading font-bold text-lg">Recebemos suas informações.</h3>
              <p className="text-sm text-muted-foreground font-body leading-relaxed max-w-sm mx-auto">
                Um especialista da equipe de Walter Espíndola entrará em contato para entender melhor seu momento e avaliar como podemos ajudar.
              </p>
              <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            </div>
          ) : (
            <>
              <DialogHeader><DialogTitle className="font-heading">Solicitar análise de proteção</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label className="text-xs">Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
                  <div><Label className="text-xs">Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label className="text-xs">Telefone</Label><Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" /></div>
                  <div><Label className="text-xs">Número de dependentes</Label><Input type="number" min={0} value={numDependentes} onChange={e => setNumDependentes(e.target.value)} /></div>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Patrimônio investido *</Label>
                  <RadioGroup value={patrimonioInv} onValueChange={setPatrimonioInv} className="mt-1.5 space-y-1">
                    {PATRIMONIO_INVESTIDO_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <RadioGroupItem value={opt.value} id={`pi-${opt.value}`} />
                        <Label htmlFor={`pi-${opt.value}`} className="text-sm font-normal cursor-pointer">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Patrimônio imobiliário</Label>
                  <RadioGroup value={patrimonioImob} onValueChange={setPatrimonioImob} className="mt-1.5 space-y-1">
                    {PATRIMONIO_IMOB_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <RadioGroupItem value={opt.value} id={`pim-${opt.value}`} />
                        <Label htmlFor={`pim-${opt.value}`} className="text-sm font-normal cursor-pointer">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Renda mensal</Label>
                  <RadioGroup value={rendaSel} onValueChange={setRendaSel} className="mt-1.5 space-y-1">
                    {RENDA_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <RadioGroupItem value={opt.value} id={`rn-${opt.value}`} />
                        <Label htmlFor={`rn-${opt.value}`} className="text-sm font-normal cursor-pointer">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Possui herança esperada?</Label>
                  <RadioGroup value={heranca} onValueChange={setHeranca} className="mt-1.5 flex gap-4">
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="sim" id="her-sim" />
                      <Label htmlFor="her-sim" className="text-sm font-normal cursor-pointer">Sim</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="não" id="her-nao" />
                      <Label htmlFor="her-nao" className="text-sm font-normal cursor-pointer">Não</Label>
                    </div>
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Seguro atual *</Label>
                  <RadioGroup value={seguroAtual} onValueChange={setSeguroAtual} className="mt-1.5 space-y-1">
                    {SEGURO_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <RadioGroupItem value={opt.value} id={`seg-${opt.value}`} />
                        <Label htmlFor={`seg-${opt.value}`} className="text-sm font-normal cursor-pointer">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Objetivo principal *</Label>
                  <RadioGroup value={objetivo} onValueChange={setObjetivo} className="mt-1.5 space-y-1">
                    {OBJETIVO_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <RadioGroupItem value={opt.value} id={`obj-${opt.value}`} />
                        <Label htmlFor={`obj-${opt.value}`} className="text-sm font-normal cursor-pointer">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-xs">Observações (opcional)</Label>
                  <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Conte mais sobre sua situação..." rows={3} />
                </div>

                <Button onClick={handleSubmit} disabled={sending} className="w-full">
                  {sending ? "Enviando..." : "Enviar solicitação"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
