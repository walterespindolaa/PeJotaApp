import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sparkles, Loader2, Plus, Trash2, ArrowRight, ArrowLeft, Check, Compass, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyInput, parseBRL } from "@/components/ui/money-input";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/hooks/useAuth";
import { useQuickAddMutations } from "@/hooks/useQuickAddMutations";
import { useAtlasScore } from "@/hooks/useAtlasScore";
import { supabase } from "@/integrations/supabase/client";
import { TERMS_VERSION } from "@/lib/legal";
import { logError } from "@/lib/log";
import { useToast } from "@/hooks/use-toast";
import { useNegociosOnly } from "@/hooks/useNegociosOnly";

const todayISO = (): string => new Date().toISOString().slice(0, 10);

type Fixa = { descricao: string; valor: number };

export default function OnboardingWizard() {
  const { onboardingCompleted, completeOnboarding, t } = useI18n();
  const { user, isRecovery } = useAuth();
  const { restricted: negociosOnly } = useNegociosOnly();
  const location = useLocation();
  const navigate = useNavigate();
  const { addReceita, addDespesa } = useQuickAddMutations();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [nome, setNome] = useState("");
  const [rendaValor, setRendaValor] = useState("");
  const [fixaDesc, setFixaDesc] = useState("");
  const [fixaValor, setFixaValor] = useState("");
  const [fixas, setFixas] = useState<Fixa[]>([]);
  const [reservaValor, setReservaValor] = useState("");
  const [outrosValor, setOutrosValor] = useState("");
  const [saving, setSaving] = useState(false);
  const [goTutorial, setGoTutorial] = useState(false);

  // Período = mês atual (a renda/gastos inseridos são recorrentes e caem aqui).
  const { periodStart, periodEnd } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const pad = (n: number) => String(n).padStart(2, "0");
    const lastDay = new Date(y, m + 1, 0).getDate();
    return {
      periodStart: `${y}-${pad(m + 1)}-01`,
      periodEnd: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
    };
  }, []);

  const { result: scoreResult, loading: scoreLoading, refresh: refreshScore } = useAtlasScore({
    userId: user?.id,
    periodStart,
    periodEnd,
  });

  // Recalcula o score ao chegar na revelação (já reflete o que foi inserido).
  useEffect(() => {
    if (step === 4) refreshScore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // Pré-preenche o nome com o cadastro e pula a pergunta — não perguntar de novo.
  const nameInited = useRef(false);
  useEffect(() => {
    if (nameInited.current) return;
    const fullName = (user?.user_metadata as any)?.full_name;
    if (typeof fullName === "string" && fullName.trim()) {
      nameInited.current = true;
      setNome(fullName.trim());
      setStep((s) => (s === 0 ? 1 : s));
    }
  }, [user]);

  // Só mostra o onboarding DEPOIS que os termos forem aceitos — senão o Dialog
  // modal dos termos (focus-trap) bloqueia a digitação nos campos do wizard.
  const [termsOk, setTermsOk] = useState<boolean | null>(null);
  useEffect(() => {
    if (!user) { setTermsOk(null); return; }
    let cancelled = false;
    supabase
      .from("user_terms_acceptance")
      .select("id")
      .eq("user_id", user.id)
      .eq("terms_version", TERMS_VERSION)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setTermsOk(!!data); });
    const onAccepted = () => setTermsOk(true);
    window.addEventListener("atlas:terms-accepted", onAccepted);
    return () => { cancelled = true; window.removeEventListener("atlas:terms-accepted", onAccepted); };
  }, [user?.id]);

  // Guards — espelham o OnboardingModal.
  const isResetRoute = location.pathname.includes("/auth/reset") || location.pathname.includes("/reset-password");
  if (isRecovery || isResetRoute) return null;
  if (!user) return null;
  if (negociosOnly) return null; // convidado restrito não passa pelo onboarding de finanças pessoais
  if (onboardingCompleted !== false) return null;
  if (termsOk !== true) return null;

  const saveRenda = async (): Promise<boolean> => {
    const v = parseBRL(rendaValor);
    if (!v) return true;
    try {
      await addReceita({
        descricao: "Salário",
        valor: v,
        categoria: "Salário",
        tipo: "fixo",
        status: "pendente",
        data: todayISO(),
        responsavel: "Pessoa 1",
        recorrente: true,
      } as any, { silent: true });
      return true;
    } catch (e) {
      logError("[OnboardingWizard] saveRenda:", e);
      toast({ title: t("onb.s1_erro"), description: t("onb.erro_desc"), variant: "destructive" });
      return false;
    }
  };

  const saveFixas = async (): Promise<boolean> => {
    for (const f of fixas) {
      try {
        await addDespesa({
          descricao: f.descricao,
          valor: f.valor,
          valor_base: f.valor,
          categoria: "Moradia",
          tipo: "fixa",
          status: "a_pagar",
          vencimento: null,
          dia_vencimento: null,
          forma_pagamento: "Pix",
          data: todayISO(),
          is_parcelada: false,
          recorrente: true,
          ajuste_variacao: false,
          responsavel: "Pessoa 1",
        } as any, { silent: true });
      } catch (e) {
        logError("[OnboardingWizard] saveFixa:", e);
        toast({ title: t("onb.s2_erro"), description: t("onb.erro_desc"), variant: "destructive" });
        return false;
      }
    }
    return true;
  };

  const addFixaToList = () => {
    const v = parseBRL(fixaValor);
    if (!fixaDesc.trim() || !v) return;
    setFixas(prev => [...prev, { descricao: fixaDesc.trim(), valor: v }]);
    setFixaDesc("");
    setFixaValor("");
  };

  // Semente de investimento — espelha o payload do form de "novo investimento" (renda fixa).
  const addInvestimento = async (nome: string, valor: number, isReserva: boolean): Promise<boolean> => {
    if (!user || !valor) return true;
    try {
      const { error } = await supabase.from("investimentos_financeiros").insert({
        user_id: user.id,
        nome,
        ticker: "",
        tipo: "Renda Fixa",
        classe: "Renda Fixa",
        instituicao: "XP",
        valor,
        valor_atual: valor,
        total_aportado: valor,
        quantidade: 0,
        preco_medio: 0,
        indexador: "",
        taxa_contratada: 0,
        categoria_titulo: null,
        vencimento_data: null,
        liquidez: isReserva ? "D+0" : "D+2",
        perfil_risco: "Conservador",
        is_reserva_emergencia: isReserva,
        recebe_proventos: false,
        frequencia_proventos: "sem_proventos",
        meses_proventos: "",
        data_compra: null,
      } as any);
      if (error) throw error;
      return true;
    } catch (e) {
      logError("[OnboardingWizard] addInvestimento:", e);
      toast({ title: t("onb.s3_erro"), description: t("onb.erro_desc"), variant: "destructive" });
      return false;
    }
  };

  const savePatrimonio = async (): Promise<boolean> => {
    const r = parseBRL(reservaValor);
    const o = parseBRL(outrosValor);
    if (r && !(await addInvestimento("Reserva de emergência", r, true))) return false;
    if (o && !(await addInvestimento("Investimentos", o, false))) return false;
    return true;
  };

  const continuePatrimonio = async () => { setSaving(true); const ok = await savePatrimonio(); setSaving(false); if (ok) setStep(4); };

  const finish = async (dest: "dashboard" | "tutorial" | "tema" = "dashboard") => {
    setSaving(true);
    try {
      await completeOnboarding(nome.trim() || "Você", "pt-BR", "BRL");
    } catch (e) {
      logError("[OnboardingWizard] finish:", e);
      toast({ title: t("onb.concluir_erro"), description: t("onb.erro_desc"), variant: "destructive" });
      setSaving(false);
      return;
    }
    setSaving(false);
    if (dest === "tema") { navigate("/dashboard/configuracoes"); return; }
    if (dest === "tutorial") { navigate("/dashboard/comecar"); return; }
    // Reload pra o dashboard (montado atrás do wizard) refazer o fetch com os dados-semente.
    window.location.reload();
  };

  const goStep1 = () => setStep(1);
  const continueRenda = async () => { setSaving(true); const ok = await saveRenda(); setSaving(false); if (ok) setStep(2); };
  const continueFixas = async () => { setSaving(true); const ok = await saveFixas(); setSaving(false); if (ok) setStep(3); };

  const skipLink = (
    <button
      onClick={() => setStep(5)}
      className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      {t("onb.pular")}
    </button>
  );

  return (
    <div
      className="fixed inset-0 z-[100] bg-background overflow-y-auto overscroll-y-none flex flex-col"
      style={{
        paddingTop: "env(safe-area-inset-top, 0px)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Voltar — disponível a partir do step 1 (não altera o fluxo de avançar/pular) */}
      {step > 0 && step !== 4 && (
        <div className="px-6 pt-6">
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Voltar para o passo anterior"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
        </div>
      )}

      {/* Progresso (oculto na revelação do Score para um momento limpo) */}
      {step !== 4 && (
        <div className="flex items-center justify-center gap-1.5 pt-6">
          {[0, 1, 2, 3, 4, 5, 6].map(i => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div key={step} className="w-full max-w-md animate-in fade-in slide-in-from-bottom-2 duration-300">

          {/* Step 0 — Boas-vindas + nome */}
          {step === 0 && (
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <h1 className="text-2xl font-heading font-bold leading-tight text-foreground">
                  {t("onb.s0_titulo")}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t("onb.s0_sub")}
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t("onb.s0_nome")}</Label>
                <Input
                  autoFocus
                  placeholder={t("onb.s0_nome_ph")}
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && nome.trim()) goStep1(); }}
                />
              </div>
              <Button className="w-full" disabled={!nome.trim()} onClick={goStep1}>
                {t("onb.s0_comecar")} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Step 1 — Renda principal */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <h1 className="text-2xl font-heading font-bold leading-tight text-foreground">{t("onb.s1_titulo")}</h1>
                <p className="text-sm text-muted-foreground">{t("onb.s1_sub")}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t("onb.s1_label")}</Label>
                <MoneyInput value={rendaValor} onChange={setRendaValor} />
              </div>
              <Button className="w-full" disabled={saving} onClick={continueRenda}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("onb.salvando")}</> : <>{t("onb.continuar")} <ArrowRight className="h-4 w-4 ml-1" /></>}
              </Button>
              {skipLink}
            </div>
          )}

          {/* Step 2 — Gastos fixos */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <h1 className="text-2xl font-heading font-bold leading-tight text-foreground">{t("onb.s2_titulo")}</h1>
                <p className="text-sm text-muted-foreground">{t("onb.s2_sub")}</p>
              </div>

              <div className="space-y-2">
                <Input
                  placeholder={t("onb.s2_desc_ph")}
                  value={fixaDesc}
                  onChange={e => setFixaDesc(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFixaToList(); } }}
                />
                <div className="flex gap-2">
                  <div className="flex-1">
                    <MoneyInput value={fixaValor} onChange={setFixaValor} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFixaToList(); } }} />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    disabled={!fixaDesc.trim() || !parseBRL(fixaValor)}
                    onClick={addFixaToList}
                  >
                    <Plus className="h-4 w-4 mr-1" /> {t("onb.s2_adicionar")}
                  </Button>
                </div>
              </div>

              {fixas.length > 0 && (
                <div className="space-y-2">
                  {fixas.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground truncate">{f.descricao}</div>
                        <div className="text-xs text-muted-foreground">{f.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
                      </div>
                      <button
                        onClick={() => setFixas(prev => prev.filter((_, idx) => idx !== i))}
                        className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                        aria-label={t("onb.s2_remover")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Button className="w-full" disabled={saving} onClick={continueFixas}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("onb.salvando")}</> : <>{t("onb.continuar")} <ArrowRight className="h-4 w-4 ml-1" /></>}
              </Button>
              {skipLink}
            </div>
          )}

          {/* Step 3 — Reserva + outros investimentos (Seu retrato rápido) */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="space-y-2 text-center">
                <h1 className="text-2xl font-heading font-bold leading-tight text-foreground">{t("onb.s3_titulo")}</h1>
                <p className="text-sm text-muted-foreground">{t("onb.s3_sub")}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t("onb.s3_reserva")}</Label>
                <MoneyInput value={reservaValor} onChange={setReservaValor} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">{t("onb.s3_outros")}</Label>
                <MoneyInput value={outrosValor} onChange={setOutrosValor} />
              </div>
              <Button className="w-full" disabled={saving} onClick={continuePatrimonio}>
                {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("onb.salvando")}</> : <>{t("onb.continuar")} <ArrowRight className="h-4 w-4 ml-1" /></>}
              </Button>
              <button
                onClick={() => setStep(4)}
                className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("onb.pular")}
              </button>
            </div>
          )}

          {/* Step 4 — Revelação do PeJota Score */}
          {step === 4 && (
            <div className="space-y-6 text-center">
              <div className="flex items-center justify-center gap-2 text-primary">
                <Sparkles className="h-5 w-5" />
                <span className="text-xs font-heading font-semibold uppercase tracking-[0.15em]">PeJota Score</span>
              </div>

              {scoreLoading && !scoreResult ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">{t("onb.s4_calc")}</p>
                </div>
              ) : (
                <div className="flex justify-center animate-in fade-in zoom-in-95 duration-500">
                  <div className="relative h-40 w-40">
                    <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
                      <circle cx="80" cy="80" r="68" fill="none" stroke="hsl(0 0% 50% / 0.15)" strokeWidth="12" />
                      <circle
                        cx="80" cy="80" r="68" fill="none"
                        stroke="hsl(var(--primary))" strokeWidth="12" strokeLinecap="round"
                        strokeDasharray={2 * Math.PI * 68}
                        strokeDashoffset={2 * Math.PI * 68 * (1 - Math.max(0, Math.min(100, scoreResult?.score ?? 0)) / 100)}
                        style={{ transition: "stroke-dashoffset 0.8s ease" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-heading text-5xl font-bold leading-none text-foreground">{scoreResult?.score ?? 0}</span>
                      <span className="mt-1 text-xs font-heading font-semibold uppercase tracking-wide text-muted-foreground">{scoreResult?.label ?? ""}</span>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("onb.s4_desc")}
              </p>

              <Button className="w-full" onClick={() => setStep(5)}>
                {t("onb.continuar")} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Step 5 — Fim + ponte pro tutorial */}
          {step === 5 && (
            <div className="space-y-6 text-center">
              <div className="flex items-center justify-center">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center">
                  <Check className="h-7 w-7 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-heading font-bold leading-tight text-foreground">
                  {t("onb.s5_pronto")}, {nome.trim() || t("onb.s5_tudo_certo")}. {t("onb.s5_diag")}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t("onb.s5_sub")}
                </p>
              </div>
              <div className="space-y-2">
                <Button className="w-full" onClick={() => { setGoTutorial(false); setStep(6); }}>
                  {t("onb.s5_painel")} <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
                <Button variant="outline" className="w-full" onClick={() => { setGoTutorial(true); setStep(6); }}>
                  <Compass className="h-4 w-4 mr-1" /> {t("onb.s5_tutorial")}
                </Button>
              </div>
            </div>
          )}

          {/* Step 6 — Personalizar tema (opcional) */}
          {step === 6 && (
            <div className="space-y-6 text-center">
              <div className="flex items-center justify-center">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center">
                  <Palette className="h-7 w-7 text-primary" />
                </div>
              </div>
              <div className="space-y-2">
                <h1 className="text-2xl font-heading font-bold leading-tight text-foreground">
                  {t("onb.s6_titulo")}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {t("onb.s6_sub")}
                </p>
              </div>
              <div className="space-y-2">
                <Button className="w-full" disabled={saving} onClick={() => finish("tema")}>
                  {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("onb.salvando")}</> : <><Palette className="h-4 w-4 mr-1" /> {t("onb.s6_tema")}</>}
                </Button>
                <Button variant="outline" className="w-full" disabled={saving} onClick={() => finish(goTutorial ? "tutorial" : "dashboard")}>
                  {t("onb.s6_agora_nao")}
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
