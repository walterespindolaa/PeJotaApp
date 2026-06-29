import { lazy, Suspense } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MetaPixelTracker from "@/components/MetaPixelTracker";
import { AuthProvider } from "@/hooks/useAuth";
import { ExpenseSkipsProvider } from "@/hooks/useExpenseSkips";
import { PrivacyModeProvider } from "@/hooks/usePrivacyMode";
import { I18nProvider } from "@/contexts/I18nContext";
import { HouseholdViewProvider } from "@/contexts/HouseholdViewContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { InvestimentosProvider } from "@/contexts/InvestimentosContext";
import DashboardLayout from "@/components/DashboardLayout";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";
import PageFeatureGate from "@/components/PageFeatureGate";
import TermsAcceptanceGate from "@/components/legal/TermsAcceptanceGate";

// Lazy-loaded pages — each becomes a separate chunk
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AuthReset = lazy(() => import("./pages/AuthReset"));
const AdminRoute = lazy(() => import("./components/AdminRoute"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const DashboardHome = lazy(() => import("./pages/DashboardHome"));
const PejotaDashboard = lazy(() => import("./pages/pejota/PejotaDashboard"));
const RendaDespesasLayout = lazy(() => import("./pages/renda-despesas/RendaDespesasLayout"));
const RendaDespesasGerais = lazy(() => import("./pages/renda-despesas/Gerais"));
const RendaDespesasOrcamento = lazy(() => import("./pages/renda-despesas/Orcamento"));
const RendaDespesasGanhos = lazy(() => import("./pages/renda-despesas/Ganhos"));
const RendaDespesasFixas = lazy(() => import("./pages/renda-despesas/Fixas"));
const RendaDespesasVariaveis = lazy(() => import("./pages/renda-despesas/Variaveis"));
const RendaDespesasParcelas = lazy(() => import("./pages/renda-despesas/Parcelas"));
const RendaDespesasDividas = lazy(() => import("./pages/renda-despesas/Dividas"));
const RendaDespesasEconomias = lazy(() => import("./pages/renda-despesas/Economias"));
const TabelaGeral = lazy(() => import("./pages/TabelaGeral"));
const RelatoriosMensais = lazy(() => import("./pages/RelatoriosMensais"));
const Analises = lazy(() => import("./pages/Analises"));
const Metas = lazy(() => import("./pages/Metas"));
const ObjetivosDeVida = lazy(() => import("./pages/ObjetivosDeVida"));
const InvestimentosLayout = lazy(() => import("./pages/investimentos/InvestimentosLayout"));
const StockGuide = lazy(() => import("./pages/investimentos/StockGuide"));
const Historico = lazy(() => import("./pages/investimentos/Historico"));
const ImportacaoB3 = lazy(() => import("./pages/investimentos/ImportacaoB3"));
const ResultadoIR = lazy(() => import("./pages/investimentos/ResultadoIR"));
const RendaVariavel = lazy(() => import("./pages/investimentos/RendaVariavel"));
const Proventos = lazy(() => import("./pages/investimentos/Proventos"));
const VisaoGeral = lazy(() => import("./pages/investimentos/VisaoGeral"));
const Rebalanceamento = lazy(() => import("./components/investimentos/Rebalanceamento"));
const PropostaNegocioPublica = lazy(() => import("./pages/PropostaNegocioPublica"));
const BensImoveis = lazy(() => import("./pages/BensImoveis"));
const Aposentadoria = lazy(() => import("./pages/Aposentadoria"));
const PlanoAcao = lazy(() => import("./pages/PlanoAcao"));
const Projecoes = lazy(() => import("./pages/Projecoes"));
const Seguros = lazy(() => import("./pages/Seguros"));
const ExpressObjetivo = lazy(() => import("./pages/ExpressObjetivo"));
const ExpressAposentadoria = lazy(() => import("./pages/ExpressAposentadoria"));
const PlanoComparacao = lazy(() => import("./pages/PlanoComparacao"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Familia = lazy(() => import("./pages/Familia"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Calendario = lazy(() => import("./pages/Calendario"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminUsers = lazy(() => import("./pages/AdminUsers"));
const AdminMetrics = lazy(() => import("./pages/AdminMetrics"));
const AdminLogs = lazy(() => import("./pages/AdminLogs"));
const AdminRevenue = lazy(() => import("./pages/AdminRevenue"));
const AdminUso = lazy(() => import("./pages/AdminUso"));
const AdminLeads = lazy(() => import("./pages/AdminLeads"));
const AdminInsuranceLeads = lazy(() => import("./pages/AdminInsuranceLeads"));
const AdminPartners = lazy(() => import("./pages/AdminPartners"));
const AdminCoupons = lazy(() => import("./pages/AdminCoupons"));
const AdminAdvisorCoupons = lazy(() => import("./pages/AdminAdvisorCoupons"));
const AdminAttributions = lazy(() => import("./pages/AdminAttributions"));
const AdminSettlement = lazy(() => import("./pages/AdminSettlement"));
const AdminFeedback = lazy(() => import("./pages/AdminFeedback"));
const AdminRecados = lazy(() => import("./pages/AdminRecados"));
const AdminIndicadores = lazy(() => import("./pages/AdminIndicadores"));
const AdminStockGuide = lazy(() => import("./pages/AdminStockGuide"));
const AtlasNegocios = lazy(() => import("./pages/AtlasNegocios"));
const EmpresaConfiguracoes = lazy(() => import("./pages/EmpresaConfiguracoes"));
const AnaliseAtlas = lazy(() => import("./pages/AnaliseAtlas"));
const Alertas = lazy(() => import("./pages/Alertas"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Comece = lazy(() => import("./pages/Comece"));
const Fatura = lazy(() => import("./pages/Fatura"));
const ImportOFX = lazy(() => import("./pages/ImportOFX"));
const ImportSpreadsheet = lazy(() => import("./pages/ImportSpreadsheet"));
const ExtratoBancario = lazy(() => import("./pages/ExtratoBancario"));
const RelatorioVida = lazy(() => import("./pages/RelatorioVida"));
const RelatorioVidaFinanceira = lazy(() => import("./pages/RelatorioVidaFinanceira"));
const PlanoLiberdade = lazy(() => import("./pages/PlanoLiberdade"));
const ManualDoDinheiro = lazy(() => import("./pages/ManualDoDinheiro"));
const DominandoVariavel = lazy(() => import("./pages/DominandoVariavel"));
const RendaPassivaFIIs = lazy(() => import("./pages/RendaPassivaFIIs"));
const FinancasCasal = lazy(() => import("./pages/FinancasCasal"));
const PlanejamentoTributario = lazy(() => import("./pages/PlanejamentoTributario"));
const NovoMapaDinheiro = lazy(() => import("./pages/NovoMapaDinheiro"));
const CursoDetalhe = lazy(() => import("./pages/CursoDetalhe"));
const CursoAula = lazy(() => import("./pages/CursoAula"));
const ComecarPorAqui = lazy(() => import("./pages/ComecarPorAqui"));
const SimuladorPJ = lazy(() => import("./pages/pejota/SimuladorPJ"));
const SimuladorFinanciamento = lazy(() => import("./pages/SimuladorFinanciamento"));
const ProjecaoPatrimonial = lazy(() => import("./pages/ProjecaoPatrimonial"));
const TermosDeUso = lazy(() => import("./pages/TermosDeUso"));
const PoliticaDePrivacidade = lazy(() => import("./pages/PoliticaDePrivacidade"));
const ForcePasswordChange = lazy(() => import("./pages/ForcePasswordChange"));
const Comprar = lazy(() => import("./pages/Comprar"));
const ComprarSucesso = lazy(() => import("./pages/ComprarSucesso"));
// PeJota — módulos PJ novos (carcaça)
const ContasReceber = lazy(() => import("./pages/pejota/ContasReceber"));
const ContasPagar = lazy(() => import("./pages/pejota/ContasPagar"));
const ImpostosPJ = lazy(() => import("./pages/pejota/Impostos"));
const ColaboradoresPJ = lazy(() => import("./pages/pejota/Colaboradores"));
const ProjecaoCaixaPJ = lazy(() => import("./pages/pejota/ProjecaoCaixa"));
const MetasVendas = lazy(() => import("./pages/pejota/MetasVendas"));
const DRE = lazy(() => import("./pages/pejota/DRE"));
const FluxoCaixa = lazy(() => import("./pages/pejota/FluxoCaixa"));
const IntegracaoAsaas = lazy(() => import("./pages/pejota/IntegracaoAsaas"));
const CategoriasGrupos = lazy(() => import("./pages/pejota/CategoriasGrupos"));
const ConciliacaoBancaria = lazy(() => import("./pages/pejota/ConciliacaoBancaria"));
const ContasRecorrentes = lazy(() => import("./pages/pejota/ContasRecorrentes"));
const NotaFiscalConfig = lazy(() => import("./pages/pejota/NotaFiscalConfig"));
const NotasFiscais = lazy(() => import("./pages/pejota/NotasFiscais"));
const FunilPage = lazy(() => import("./pages/pejota/FunilPage"));
const ClientesPage = lazy(() => import("./pages/pejota/ClientesPage"));
const PropostasPage = lazy(() => import("./pages/pejota/PropostasPage"));
const EstoquePage = lazy(() => import("./pages/pejota/EstoquePage"));
const Exportacoes = lazy(() => import("./pages/pejota/Exportacoes"));
const SegurancaAuditoria = lazy(() => import("./pages/pejota/SegurancaAuditoria"));
const EquipeAcessos = lazy(() => import("./pages/pejota/EquipeAcessos"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

const PageLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F1EC]">
    <img src="/logo.png" alt="PeJota" className="w-16 h-16 mb-4 animate-pulse" />
    <div className="h-1 w-32 bg-[#E0D9CC] rounded-full overflow-hidden">
      <div className="h-full w-1/2 bg-[#4A4035] rounded-full animate-[shimmer_1.2s_ease-in-out_infinite]" />
    </div>
  </div>
);

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <MetaPixelTracker />
        <AuthProvider>
        <ExpenseSkipsProvider>
        <PrivacyModeProvider>
        <I18nProvider>
        <HouseholdViewProvider>
          <TermsAcceptanceGate />
          <OnboardingWizard />
          <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/comece" element={<Comece />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/auth/accept-invite" element={<AcceptInvite />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth/reset" element={<AuthReset />} />
            <Route path="/force-password-change" element={<ForcePasswordChange />} />
            <Route path="/proposta/:token" element={<PropostaNegocioPublica />} />
            <Route path="/termos-de-uso" element={<TermosDeUso />} />
            <Route path="/politica-de-privacidade" element={<PoliticaDePrivacidade />} />
            <Route path="/comprar/sucesso" element={<ComprarSucesso />} />
            <Route path="/comprar/:plano" element={<Comprar />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<PejotaDashboard />} />
              <Route path="renda-despesas" element={<RendaDespesasLayout />}>
                <Route index element={<Navigate to="gerais" replace />} />
                <Route path="gerais" element={<RendaDespesasGerais />} />
                <Route path="orcamento" element={<RendaDespesasOrcamento />} />
                <Route path="ganhos" element={<RendaDespesasGanhos />} />
                <Route path="fixas" element={<RendaDespesasFixas />} />
                <Route path="variaveis" element={<RendaDespesasVariaveis />} />
                <Route path="parcelas" element={<RendaDespesasParcelas />} />
                <Route path="dividas" element={<RendaDespesasDividas />} />
                <Route path="economias" element={<RendaDespesasEconomias />} />
              </Route>
              <Route path="tabela-geral" element={<TabelaGeral />} />
              <Route path="guiadajornada" element={<PageFeatureGate configKey="relatorio_controle"><RelatoriosMensais /></PageFeatureGate>} />
              <Route path="analises" element={<Analises />} />
              <Route path="calendario" element={<Calendario />} />
              <Route path="planos" element={<PlanoComparacao />} />
              <Route path="objetivos" element={<PageFeatureGate configKey="objetivos_de_vida"><Metas /></PageFeatureGate>} />
              <Route path="objetivos-de-vida" element={<PageFeatureGate configKey="objetivos_de_vida"><ObjetivosDeVida /></PageFeatureGate>} />
              <Route path="express-objetivo" element={<ExpressObjetivo />} />
              <Route path="express-aposentadoria" element={<ExpressAposentadoria />} />
              
              {/* Investimentos — Layout + Provider with sub-page routes (Etapa B complete) */}
              <Route path="investimentos" element={
                <PageFeatureGate configKey="investimentos">
                  <InvestimentosProvider>
                    <InvestimentosLayout />
                  </InvestimentosProvider>
                </PageFeatureGate>
              }>
                <Route index element={<Navigate to="visao-geral" replace />} />
                <Route path="visao-geral" element={<VisaoGeral />} />
                <Route path="stock-guide" element={<StockGuide />} />
                <Route path="historico" element={<Historico />} />
                <Route path="importacao" element={<ImportacaoB3 />} />
                <Route path="resultado-ir" element={<ResultadoIR />} />
                <Route path="renda-variavel" element={<RendaVariavel />} />
                <Route path="proventos" element={<Proventos />} />
                <Route path="rebalanceamento" element={<Rebalanceamento />} />
              </Route>
              <Route path="bens-imoveis" element={<PageFeatureGate configKey="bens_imoveis"><BensImoveis /></PageFeatureGate>} />
              <Route path="aposentadoria" element={<PageFeatureGate configKey="aposentadoria"><Aposentadoria /></PageFeatureGate>} />
              <Route path="plano-acao" element={<PlanoAcao />} />
              <Route path="controledajornada" element={<PageFeatureGate configKey="evolucao_patrimonial"><Projecoes /></PageFeatureGate>} />
              <Route path="estrategiadesubida" element={<PageFeatureGate configKey="estrategia_subida"><RelatorioVida /></PageFeatureGate>} />
              <Route path="basedamontanha" element={<PageFeatureGate configKey="relatorio_atlas"><RelatorioVidaFinanceira /></PageFeatureGate>} />
              <Route path="seguros" element={<PageFeatureGate configKey="protecao_seguros"><Seguros /></PageFeatureGate>} />
              <Route path="negocios/*" element={<PageFeatureGate configKey="atlas_negocios"><AtlasNegocios /></PageFeatureGate>} />
              <Route path="empresa" element={<PageFeatureGate configKey="atlas_negocios"><EmpresaConfiguracoes /></PageFeatureGate>} />
              <Route path="analise-atlas" element={<AnaliseAtlas />} />
              <Route path="alertas" element={<Alertas />} />
              <Route path="fatura" element={<Fatura />} />
              <Route path="importar-ofx" element={<ImportOFX />} />
              <Route path="importar-planilha" element={<ImportSpreadsheet />} />
              <Route path="extrato-bancario" element={<ExtratoBancario />} />
              <Route path="simulador-decisao" element={<SimuladorPJ />} />
              <Route path="simulador-financiamento" element={<SimuladorFinanciamento />} />
              {/* PeJota — rotas dos módulos PJ (carcaça, preenchidas parte por parte) */}
              <Route path="contas-receber" element={<ContasReceber />} />
              <Route path="contas-pagar" element={<ContasPagar />} />
              <Route path="impostos" element={<ImpostosPJ />} />
              <Route path="colaboradores" element={<ColaboradoresPJ />} />
              <Route path="projecao-caixa" element={<ProjecaoCaixaPJ />} />
              <Route path="metas-vendas" element={<MetasVendas />} />
              <Route path="dre" element={<DRE />} />
              <Route path="fluxo-caixa" element={<FluxoCaixa />} />
              <Route path="cobrancas" element={<IntegracaoAsaas />} />
              <Route path="categorias-grupos" element={<CategoriasGrupos />} />
              <Route path="conciliacao" element={<ConciliacaoBancaria />} />
              <Route path="recorrentes" element={<ContasRecorrentes />} />
              <Route path="notas-fiscais" element={<NotasFiscais />} />
              <Route path="nota-fiscal" element={<NotaFiscalConfig />} />
              <Route path="funil" element={<FunilPage />} />
              <Route path="clientes" element={<ClientesPage />} />
              <Route path="propostas" element={<PropostasPage />} />
              <Route path="estoque" element={<EstoquePage />} />
              <Route path="exportacoes" element={<Exportacoes />} />
              <Route path="seguranca" element={<SegurancaAuditoria />} />
              <Route path="equipe" element={<EquipeAcessos />} />
              <Route path="vistadamontanha" element={<PageFeatureGate configKey="projecao_patrimonial"><ProjecaoPatrimonial /></PageFeatureGate>} />
              {/* Redirects das URLs antigas (compat: bookmarks, push notifications já enviadas, emails antigos) */}
              <Route path="relatorios" element={<Navigate to="/dashboard/guiadajornada" replace />} />
              <Route path="relatorios-mensais" element={<Navigate to="/dashboard/guiadajornada" replace />} />
              <Route path="projecoes" element={<Navigate to="/dashboard/controledajornada" replace />} />
              <Route path="relatorio-vida" element={<Navigate to="/dashboard/estrategiadesubida" replace />} />
              <Route path="relatorio-vida-financeira" element={<Navigate to="/dashboard/basedamontanha" replace />} />
              <Route path="projecao-patrimonial" element={<Navigate to="/dashboard/vistadamontanha" replace />} />
              <Route path="familia" element={<Familia />} />
              <Route path="plano-liberdade" element={<PageFeatureGate configKey="plano_liberdade"><PlanoLiberdade /></PageFeatureGate>} />
              <Route path="manual-do-dinheiro" element={<PageFeatureGate configKey="manual_do_dinheiro"><ManualDoDinheiro /></PageFeatureGate>} />
              <Route path="dominando-variavel" element={<PageFeatureGate configKey="dominando_variavel"><DominandoVariavel /></PageFeatureGate>} />
              <Route path="renda-passiva-fiis" element={<PageFeatureGate configKey="renda_passiva_fiis"><RendaPassivaFIIs /></PageFeatureGate>} />
              <Route path="financas-casal" element={<PageFeatureGate configKey="financas_casal"><FinancasCasal /></PageFeatureGate>} />
              <Route path="planejamento-tributario" element={<PageFeatureGate configKey="planejamento_tributario"><PlanejamentoTributario /></PageFeatureGate>} />
              <Route path="novo-mapa-dinheiro" element={<PageFeatureGate configKey="novo_mapa_dinheiro"><NovoMapaDinheiro /></PageFeatureGate>} />
              <Route path="cursos/:slug" element={<CursoDetalhe />} />
              <Route path="cursos/:slug/aula/:lessonId" element={<CursoAula />} />
              <Route path="comecar" element={<ComecarPorAqui />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="perfil" element={<Perfil />} />
              <Route path="admin" element={<Suspense fallback={<PageLoader />}><AdminRoute><Admin /></AdminRoute></Suspense>}>
                <Route path="indicadores" element={<AdminIndicadores />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="metrics" element={<AdminMetrics />} />
                <Route path="revenue" element={<AdminRevenue />} />
                <Route path="uso" element={<AdminUso />} />
                <Route path="leads" element={<AdminLeads />} />
                <Route path="insurance-leads" element={<AdminInsuranceLeads />} />
                <Route path="partners" element={<AdminPartners />} />
                <Route path="coupons" element={<AdminCoupons />} />
                <Route path="advisor-coupons" element={<AdminAdvisorCoupons />} />
                <Route path="attributions" element={<AdminAttributions />} />
                <Route path="settlement" element={<AdminSettlement />} />
                <Route path="feedback" element={<AdminFeedback />} />
                <Route path="recados" element={<AdminRecados />} />
                <Route path="stock-guide" element={<AdminStockGuide />} />
                <Route path="logs" element={<AdminLogs />} />
              </Route>
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
        </HouseholdViewProvider>
        </I18nProvider>
        </PrivacyModeProvider>
        </ExpenseSkipsProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
