import { useEffect, useState, useCallback, useRef } from "react";
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
import { FileText, Building2, Check, ShieldCheck, Upload, Loader2 } from "lucide-react";
import { listarUFs, listarMunicipios, type UF, type Municipio } from "@/lib/pejota/ibge";

const db = supabase as any;

const REGIMES = [
  { v: "simplesNacional", label: "Simples Nacional" },
  { v: "simplesNacionalExcessoSublimite", label: "Simples Nacional - excesso sublimite" },
  { v: "lucroPresumido", label: "Lucro Presumido" },
  { v: "lucroReal", label: "Lucro Real" },
  { v: "mei", label: "MEI" },
];

export default function NotaFiscalConfig() {
  const { selected, loading: companiesLoading } = useCompanies();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [env, setEnv] = useState("sandbox");
  const [token, setToken] = useState("");
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [emitenteOk, setEmitenteOk] = useState(false);

  // dados fiscais
  const [cnpj, setCnpj] = useState("");
  const [im, setIm] = useState("");
  const [regime, setRegime] = useState("simplesNacional");
  const [item, setItem] = useState("");
  const [cnae, setCnae] = useState("");
  const [aliquota, setAliquota] = useState("");
  const [descricao, setDescricao] = useState("");
  const [uf, setUf] = useState("");
  const [municipioId, setMunicipioId] = useState("");

  const [ufs, setUfs] = useState<UF[]>([]);
  const [muns, setMuns] = useState<Municipio[]>([]);
  const [savingToken, setSavingToken] = useState(false);
  const [savingFiscal, setSavingFiscal] = useState(false);
  const [cadastrando, setCadastrando] = useState(false);
  const [certSenha, setCertSenha] = useState("");

  const load = useCallback(async () => {
    if (!selected) return;
    const { data } = await db.rpc("get_nfse_status", { p_company_id: selected.id });
    const s = data?.[0];
    if (s) {
      setTokenConfigured(!!s.plugnotas_configured);
      setEnv(s.plugnotas_env || "sandbox");
      setEmitenteOk(!!s.emitente_ok);
      const f = s.settings || {};
      setCnpj(f.cnpj || ""); setIm(f.im || ""); setRegime(f.regime || "simplesNacional");
      setItem(f.item || ""); setCnae(f.cnae || ""); setAliquota(f.aliquota != null ? String(f.aliquota) : "");
      setDescricao(f.descricao || ""); setUf(f.uf || ""); setMunicipioId(f.municipioId ? String(f.municipioId) : "");
    }
  }, [selected]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { listarUFs().then(setUfs).catch(() => {}); }, []);
  useEffect(() => { if (uf) listarMunicipios(uf).then(setMuns).catch(() => {}); }, [uf]);

  const salvarToken = async () => {
    if (!selected) return;
    setSavingToken(true);
    const { error } = await db.rpc("set_plugnotas_credentials", { p_company_id: selected.id, p_token: token.trim(), p_env: env });
    setSavingToken(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Token salvo" }); setToken(""); load();
  };

  const settingsObj = () => ({
    cnpj: cnpj.replace(/\D/g, ""), im: im.trim(), regime, item: item.trim(), cnae: cnae.replace(/\D/g, ""),
    aliquota: aliquota ? Number(aliquota.replace(",", ".")) : null, descricao: descricao.trim(),
    uf, municipioId: municipioId ? Number(municipioId) : null,
    municipioNome: muns.find(m => String(m.id) === municipioId)?.nome || null,
  });

  const salvarFiscal = async () => {
    if (!selected) return;
    setSavingFiscal(true);
    const { error } = await db.rpc("set_nfse_settings", { p_company_id: selected.id, p_settings: settingsObj() });
    setSavingFiscal(false);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Dados fiscais salvos" }); load();
  };

  const onCertFile = async (file: File) => {
    if (!selected) return;
    if (!tokenConfigured) { toast({ title: "Salve o token PlugNotas primeiro", variant: "destructive" }); return; }
    if (!certSenha) { toast({ title: "Informe a senha do certificado", variant: "destructive" }); return; }
    setCadastrando(true);
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const { data, error } = await supabase.functions.invoke("plugnotas-empresa", {
        body: { company_id: selected.id, certificado: b64, senha: certSenha, settings: settingsObj() },
      });
      if (error || data?.error) { toast({ title: "Falha no cadastro", description: data?.error || error?.message, variant: "destructive" }); }
      else { toast({ title: "Emitente cadastrado no PlugNotas", description: "Pronto para emitir NFS-e." }); setCertSenha(""); load(); }
    } catch (e: any) {
      toast({ title: "Erro ao ler certificado", description: String(e.message || e), variant: "destructive" });
    }
    setCadastrando(false);
  };

  if (!companiesLoading && !selected) return (
    <div className="max-w-3xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para configurar a nota fiscal.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0"><FileText className="w-5 h-5" /></div>
        <div><h1 className="text-xl font-heading font-semibold">Nota fiscal de serviço (NFS-e)</h1>
        <p className="text-sm text-muted-foreground">Emissão via PlugNotas. Você só paga quando começar a emitir. O certificado A1 vai direto pro PlugNotas (não fica guardado aqui).</p></div>
      </div>

      {/* 1. Conexão PlugNotas */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center justify-between">
          <span>1 · Conexão PlugNotas</span>
          {tokenConfigured ? <Badge className="bg-emerald-500/15 text-emerald-600 gap-1"><Check className="w-3 h-3" /> Token salvo ({env === "prod" ? "produção" : "sandbox"})</Badge> : <Badge variant="secondary">Sem token</Badge>}
        </CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label className="text-xs">Ambiente</Label>
            <Select value={env} onValueChange={setEnv}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="sandbox">Sandbox (testes)</SelectItem><SelectItem value="prod">Produção</SelectItem></SelectContent></Select>
          </div>
          <div><Label className="text-xs">Token da API PlugNotas (X-API-KEY)</Label>
            <Input type="password" value={token} onChange={e => setToken(e.target.value)} placeholder={tokenConfigured ? "•••••••• (já salvo — preencha p/ trocar)" : "Cole o token do PlugNotas"} />
          </div>
          <div className="flex justify-end"><Button onClick={salvarToken} disabled={savingToken}>{savingToken ? "Salvando…" : "Salvar token"}</Button></div>
        </CardContent>
      </Card>

      {/* 2. Dados fiscais */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">2 · Dados fiscais da empresa</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">CNPJ</Label><Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="Só números" inputMode="numeric" /></div>
            <div><Label className="text-xs">Inscrição municipal</Label><Input value={im} onChange={e => setIm(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Regime tributário</Label>
              <Select value={regime} onValueChange={setRegime}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{REGIMES.map(r => <SelectItem key={r.v} value={r.v}>{r.label}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label className="text-xs">Alíquota ISS (%)</Label><Input value={aliquota} onChange={e => setAliquota(e.target.value)} placeholder="Ex.: 2 ou 5" inputMode="decimal" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Item lista de serviço (LC 116)</Label><Input value={item} onChange={e => setItem(e.target.value)} placeholder="Ex.: 01.07" /></div>
            <div><Label className="text-xs">CNAE (opcional)</Label><Input value={cnae} onChange={e => setCnae(e.target.value)} placeholder="Só números" inputMode="numeric" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">UF</Label>
              <Select value={uf} onValueChange={v => { setUf(v); setMunicipioId(""); }}><SelectTrigger><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>{ufs.map(u => <SelectItem key={u.sigla} value={u.sigla}>{u.sigla} — {u.nome}</SelectItem>)}</SelectContent></Select>
            </div>
            <div><Label className="text-xs">Município</Label>
              <Select value={municipioId} onValueChange={setMunicipioId} disabled={!uf}><SelectTrigger><SelectValue placeholder={uf ? "Cidade" : "Escolha a UF"} /></SelectTrigger>
                <SelectContent className="max-h-72">{muns.map(m => <SelectItem key={m.id} value={String(m.id)}>{m.nome}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div><Label className="text-xs">Descrição padrão do serviço</Label><Input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Ex.: Serviços de consultoria" /></div>
          <div className="flex justify-end"><Button onClick={salvarFiscal} disabled={savingFiscal}>{savingFiscal ? "Salvando…" : "Salvar dados fiscais"}</Button></div>
        </CardContent>
      </Card>

      {/* 3. Certificado A1 */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center justify-between">
          <span>3 · Certificado digital A1</span>
          {emitenteOk ? <Badge className="bg-emerald-500/15 text-emerald-600 gap-1"><ShieldCheck className="w-3 h-3" /> Emitente ativo</Badge> : <Badge variant="secondary">Pendente</Badge>}
        </CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Envie o arquivo <strong>.pfx / .p12</strong> (eCNPJ A1) e a senha. Ele é enviado direto ao PlugNotas para habilitar a emissão — não fica armazenado no PeJota.</p>
          <input ref={fileRef} type="file" accept=".pfx,.p12" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onCertFile(f); e.currentTarget.value = ""; }} />
          <div><Label className="text-xs">Senha do certificado</Label><Input type="password" value={certSenha} onChange={e => setCertSenha(e.target.value)} /></div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={cadastrando || !tokenConfigured} className="gap-2">{cadastrando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}{cadastrando ? "Cadastrando…" : "Enviar A1 e ativar emitente"}</Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Token e certificado são tratados como segredo (server-side). Tudo isolado por empresa (RLS). Depois de ativo, emita notas em <strong>Financeiro → Notas fiscais</strong>.</p>
    </div>
  );
}
