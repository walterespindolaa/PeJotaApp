import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";

const PATRIMONIO_OPTIONS = [
  { value: "300k-500k", label: "R$ 300 mil a R$ 500 mil", score: 1 },
  { value: "500k-1M", label: "R$ 500 mil a R$ 1 milhão", score: 2 },
  { value: "1M-3M", label: "R$ 1 milhão a R$ 3 milhões", score: 3 },
  { value: "3M+", label: "Acima de R$ 3 milhões", score: 4 },
];

const TEMPO_OPTIONS = [
  { value: "menos-1", label: "Menos de 1 ano" },
  { value: "1-3", label: "1 a 3 anos" },
  { value: "3-10", label: "3 a 10 anos" },
  { value: "10+", label: "Mais de 10 anos" },
];

const ASSESSOR_OPTIONS = [
  { value: "nunca", label: "Nunca tive" },
  { value: "nao-gostei", label: "Já tive mas não gostei" },
  { value: "tenho", label: "Tenho atualmente" },
];

const OBJETIVO_OPTIONS = [
  { value: "organizacao", label: "Organização da carteira" },
  { value: "diversificacao", label: "Diversificação internacional" },
  { value: "patrimonial", label: "Planejamento patrimonial" },
  { value: "aposentadoria", label: "Aposentadoria" },
  { value: "riscos", label: "Reduzir riscos" },
];

interface AdvisoryInviteCardProps {
  totalPatrimonio: number;
}

export default function AdvisoryInviteCard({ totalPatrimonio }: AdvisoryInviteCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [alreadySent, setAlreadySent] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [patrimonio, setPatrimonio] = useState("");
  const [tempo, setTempo] = useState("");
  const [assessor, setAssessor] = useState("");
  const [objetivos, setObjetivos] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase.from("advisory_leads").select("id").eq("user_id", user.id).limit(1)
      .then(({ data, error }) => {
        if (error) console.error(error);
        if (data && data.length > 0) setAlreadySent(true);
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || "");
    setNome(user.user_metadata?.full_name || "");
    supabase.from("profiles").select("full_name, phone").eq("user_id", user.id).maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error(error);
        if (data?.full_name) setNome(data.full_name);
        if (data?.phone) setTelefone(data.phone);
      });
  }, [user]);

  if (totalPatrimonio < 300000) return null;

  const scoreFromPatrimonio = PATRIMONIO_OPTIONS.find(p => p.value === patrimonio)?.score || 1;

  const handleSubmit = async () => {
    if (!user || !patrimonio || !tempo || !assessor || objetivos.length === 0) {
      toast({ title: "Preencha todos os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSending(true);
    const objetivoStr = objetivos.map(o => OBJETIVO_OPTIONS.find(opt => opt.value === o)?.label || o).join(", ");
    const payload = {
      user_id: user.id, nome, email, telefone,
      patrimonio: PATRIMONIO_OPTIONS.find(p => p.value === patrimonio)?.label || patrimonio,
      tempo_investindo: TEMPO_OPTIONS.find(t => t.value === tempo)?.label || tempo,
      teve_assessor: ASSESSOR_OPTIONS.find(a => a.value === assessor)?.label || assessor,
      objetivo: objetivoStr, observacoes, score: scoreFromPatrimonio,
    };
    const { error } = await supabase.from("advisory_leads").insert(payload as any);
    setSending(false);
    if (error) { toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" }); return; }
    setSubmitted(true);
    setAlreadySent(true);
  };

  const toggleObjetivo = (val: string) => {
    setObjetivos(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  return (
    <>
      <Card className="rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 shadow-soft">
        <CardContent className="p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 flex-shrink-0">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="font-heading font-bold text-lg">Análise Profissional da Sua Carteira</h3>
              <p className="text-sm text-muted-foreground font-body leading-relaxed">
                Se você possui mais de R$ 300 mil investidos, pode solicitar uma análise profissional da sua carteira.
                Um especialista da equipe de Walter Espíndola poderá avaliar sua estrutura atual de investimentos,
                entender seu momento financeiro e indicar possíveis melhorias estratégicas.
              </p>
            </div>
            <Button onClick={() => { setSubmitted(false); setOpen(true); }} disabled={alreadySent} className="flex-shrink-0 gap-2">
              {alreadySent
                ? <><CheckCircle2 className="h-4 w-4" /> Solicitação enviada</>
                : <>Solicitar análise da minha carteira <ArrowRight className="h-4 w-4" /></>}
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
              <DialogHeader><DialogTitle className="font-heading">Solicitar análise da carteira</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><Label className="text-xs">Nome</Label><Input value={nome} onChange={e => setNome(e.target.value)} /></div>
                  <div><Label className="text-xs">Email</Label><Input value={email} onChange={e => setEmail(e.target.value)} /></div>
                </div>
                <div><Label className="text-xs">Telefone</Label><Input value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="(00) 00000-0000" /></div>

                <div>
                  <Label className="text-xs font-semibold">Patrimônio investido *</Label>
                  <RadioGroup value={patrimonio} onValueChange={setPatrimonio} className="mt-1.5 space-y-1.5">
                    {PATRIMONIO_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <RadioGroupItem value={opt.value} id={`pat-${opt.value}`} />
                        <Label htmlFor={`pat-${opt.value}`} className="text-sm font-normal cursor-pointer">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Tempo investindo *</Label>
                  <RadioGroup value={tempo} onValueChange={setTempo} className="mt-1.5 space-y-1.5">
                    {TEMPO_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <RadioGroupItem value={opt.value} id={`tmp-${opt.value}`} />
                        <Label htmlFor={`tmp-${opt.value}`} className="text-sm font-normal cursor-pointer">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-xs font-semibold">Já teve assessoria de investimentos? *</Label>
                  <RadioGroup value={assessor} onValueChange={setAssessor} className="mt-1.5 space-y-1.5">
                    {ASSESSOR_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <RadioGroupItem value={opt.value} id={`ass-${opt.value}`} />
                        <Label htmlFor={`ass-${opt.value}`} className="text-sm font-normal cursor-pointer">{opt.label}</Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>

                <div>
                  <Label className="text-xs font-semibold">O que você busca hoje? *</Label>
                  <div className="mt-1.5 space-y-1.5">
                    {OBJETIVO_OPTIONS.map(opt => (
                      <div key={opt.value} className="flex items-center gap-2">
                        <Checkbox id={`obj-${opt.value}`} checked={objetivos.includes(opt.value)} onCheckedChange={() => toggleObjetivo(opt.value)} />
                        <Label htmlFor={`obj-${opt.value}`} className="text-sm font-normal cursor-pointer">{opt.label}</Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Observações (opcional)</Label>
                  <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Conte mais sobre seus objetivos..." rows={3} />
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
