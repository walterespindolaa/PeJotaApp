import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Landmark, Building2, Check, Copy, ExternalLink, ShieldCheck } from "lucide-react";

const db = supabase as any;
const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/asaas-webhook`;

export default function IntegracaoAsaas() {
  const { selected, loading: companiesLoading } = useCompanies();
  const { toast } = useToast();
  const [env, setEnv] = useState("sandbox");
  const [key, setKey] = useState("");
  const [wallet, setWallet] = useState("");
  const [configured, setConfigured] = useState(false);
  const [webhookToken, setWebhookToken] = useState<string | null>(null);
  const [savedEnv, setSavedEnv] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!selected) return;
    setLoading(true);
    const { data, error } = await db.rpc("get_asaas_status", { p_company_id: selected.id });
    if (!error && data && data[0]) {
      setConfigured(!!data[0].configured);
      setSavedEnv(data[0].asaas_env || null);
      setEnv(data[0].asaas_env || "sandbox");
      setWallet(data[0].wallet || "");
      setWebhookToken(data[0].webhook_token || null);
    } else {
      setConfigured(false); setSavedEnv(null); setWebhookToken(null);
    }
    setLoading(false);
  }, [selected]);
  useEffect(() => { load(); }, [load]);

  const salvar = async () => {
    if (!selected) return;
    if (!key.trim() && !configured) { toast({ title: "Cole a chave de API do Asaas", variant: "destructive" }); return; }
    setSaving(true);
    const { error } = await db.rpc("set_asaas_credentials", {
      p_company_id: selected.id,
      p_key: key.trim(),  // vazio = mantém a chave já salva (a RPC preserva)
      p_env: env, p_wallet: wallet.trim() || null,
    });
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Integração salva", description: "Sua conta Asaas está conectada a esta empresa." });
    setKey("");
    load();
  };

  const copiar = (txt: string, label: string) => { navigator.clipboard.writeText(txt); toast({ title: `${label} copiado` }); };

  if (!companiesLoading && !selected) return (
    <div className="max-w-5xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para configurar cobranças.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0"><Landmark className="w-5 h-5" /></div>
        <div>
          <h1 className="text-xl font-heading font-semibold">Cobranças — Asaas</h1>
          <p className="text-sm text-muted-foreground">Conecte a conta Asaas da sua empresa e gere boleto/PIX direto nas contas a receber. O dinheiro cai na sua conta.</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center justify-between">
            <span>Conexão</span>
            {configured
              ? <Badge className="bg-emerald-500/15 text-emerald-600 gap-1"><Check className="w-3 h-3" /> Conectado ({savedEnv === "prod" ? "produção" : "sandbox"})</Badge>
              : <Badge variant="secondary">Não conectado</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs">Ambiente</Label>
            <Select value={env} onValueChange={setEnv}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox (testes)</SelectItem>
                <SelectItem value="prod">Produção (cobranças reais)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Chave de API do Asaas</Label>
            <Input type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={configured ? "•••••••• (já salva — preencha para trocar)" : "Cole sua API Key do Asaas"} />
            <p className="text-[11px] text-muted-foreground mt-1">Em Asaas → Configurações → Integrações → Chave de API. A chave fica guardada com segurança e nunca é exibida de volta.</p>
          </div>
          <div>
            <Label className="text-xs">Wallet ID (opcional)</Label>
            <Input value={wallet} onChange={e => setWallet(e.target.value)} placeholder="Para split/sub-conta (opcional)" />
          </div>
          <div className="flex justify-end">
            <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : configured ? "Atualizar conexão" : "Conectar Asaas"}</Button>
          </div>
        </CardContent>
      </Card>

      {configured && webhookToken && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Confirmação automática (webhook)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">No painel Asaas (Configurações → Webhooks → Adicionar), cole a URL e o token abaixo. Assim, quando o cliente pagar, a conta é baixada e lançada no caixa sozinha.</p>
            <div>
              <Label className="text-xs">URL do webhook</Label>
              <div className="flex gap-2"><Input readOnly value={FUNCTIONS_URL} className="font-mono text-xs" /><Button size="icon" variant="outline" onClick={() => copiar(FUNCTIONS_URL, "URL")}><Copy className="w-4 h-4" /></Button></div>
            </div>
            <div>
              <Label className="text-xs">Token de autenticação</Label>
              <div className="flex gap-2"><Input readOnly value={webhookToken} className="font-mono text-xs" /><Button size="icon" variant="outline" onClick={() => copiar(webhookToken, "Token")}><Copy className="w-4 h-4" /></Button></div>
            </div>
            <a href="https://docs.asaas.com/docs/webhook-para-cobrancas" target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">Como configurar no Asaas <ExternalLink className="w-3 h-3" /></a>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Dados isolados por empresa (RLS). A chave Asaas é um segredo: só o servidor a usa para falar com o Asaas — ela nunca trafega para o navegador.
      </p>
    </div>
  );
}
