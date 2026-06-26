import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { ArrowRight, Smartphone, Monitor, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import ScreensAccordion from "@/components/landing/ScreensAccordion";
import Footer from "@/components/Footer";
import { useI18n } from "@/contexts/I18nContext";

const Index = () => {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1a1a2e]">
        <div className="h-6 w-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <>
      <SEO
        title="Atlas | Organização Financeira Pessoal e Planejamento"
        description="Organize finanças, controle gastos, defina objetivos e planeje aposentadoria com o Atlas. Comece grátis e visualize sua vida financeira."
        path="/"
      />
    <div className="relative w-full h-screen overflow-hidden flex flex-col font-inter" style={{ fontFamily: "'Inter', 'DM Sans', sans-serif" }}>
      {/* BACKGROUND IMAGE */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: "url('/images/landing-bg.webp')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat"
        }}
      />
      
      {/* OVERLAY */}
      <div 
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background: "linear-gradient(to right, rgba(0,0,0,0.55), rgba(0,0,0,0.35))"
        }}
      />

      {/* NAVBAR */}
      <nav className="absolute top-0 left-0 w-full z-50 flex justify-between items-center px-[5vw] py-6 bg-transparent pointer-events-auto">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Atlas Logo" className="h-8 w-8 object-contain brightness-0 invert" />
        </div>
        <a href="https://app.useatlasapp.com/auth">
          <Button variant="ghost" className="text-white font-medium hover:bg-white/10 transition-colors">
            {t("comece.entrar")}
          </Button>
        </a>
      </nav>

      {/* MAIN CONTENT */}
      <main className="relative z-20 flex-1 flex flex-col md:flex-row items-center justify-center px-[5vw] gap-12 md:gap-12 overflow-y-auto md:overflow-hidden pt-20 pb-12">
        {/* COLUNA ESQUERDA */}
        <div className="w-full md:w-1/2 flex flex-col items-center text-center md:items-start md:text-left max-w-xl md:bg-black/35 md:backdrop-blur-md md:rounded-3xl md:p-9 md:border md:border-white/10">
          <div 
            className="flex items-center gap-2 px-3 py-1.5 rounded-full mb-6"
            style={{
              background: "rgba(255,255,255,0.12)",
              border: "1px solid rgba(255,255,255,0.2)",
              backdropFilter: "blur(4px)"
            }}
          >
            <img src="/logo.png" alt="Atlas Logo" className="h-4 w-4 brightness-0 invert" />
            <span className="text-[11px] font-bold text-white uppercase tracking-[1.5px]">
              {t("index.badge")}
            </span>
          </div>

          <h1 className="text-white font-black leading-[1.1] mb-4" style={{ fontSize: "clamp(36px, 5vw, 56px)" }}>
            {t("index.title")}
          </h1>

          <p className="text-[17px] text-white/75 max-w-md mb-8">
            {t("index.subtitle")}
          </p>

          <a href="https://app.useatlasapp.com/auth" className="w-full max-w-[320px] md:max-w-none">
            <Button 
              className="w-full md:w-auto h-auto py-3.5 px-7 rounded-[10px] text-[15px] font-bold transition-all hover:scale-105"
              style={{
                backgroundColor: "#f2ab0c",
                color: "#2a1c02"
              }}
            >
              {t("index.cta")} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </a>

          <button
            onClick={() => setIsModalOpen(true)}
            className="mt-4 inline-flex items-center gap-2 text-white/80 text-sm font-medium hover:text-white transition-colors"
          >
            <Download size={16} /> {t("index.instale")}
          </button>
        </div>

        {/* COLUNA DIREITA — accordion de telas do app */}
        <div className="w-full md:w-1/2 flex flex-col items-center md:items-end">
          <div className="w-full max-w-[640px]">
            <ScreensAccordion />
          </div>
        </div>
      </main>

      {/* RODAPÉ — links legais */}
      <div className="relative z-20 text-white/70 [&_p]:text-white/50 [&_a]:text-white/70 hover:[&_a]:text-white">
        <Footer />
      </div>

      {/* BOTTOM SHEET MODAL (Mobile only) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50 transition-opacity" 
            onClick={() => setIsModalOpen(false)} 
          />
          
          {/* Sheet */}
          <div 
            className="relative w-full max-w-md bg-white rounded-t-[20px] md:rounded-[20px] md:mx-6 p-6 animate-in slide-in-from-bottom duration-300 ease-out"
            style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Puxador */}
            <div className="w-9 h-1 bg-[#e2e8f0] rounded-full mx-auto mb-6" />
            
            <h2 className="text-slate-900 font-extrabold text-[18px] mb-1">{t("index.modal_titulo")}</h2>
            <p className="text-slate-500 text-[13px] mb-5">{t("index.modal_sub")}</p>
            
            <div className="space-y-[10px]">
              {/* Card 1 */}
              <div 
                className="flex items-center gap-[14px] p-[14px_16px] rounded-[14px] bg-slate-50 border border-slate-100"
              >
                <div className="w-10 h-10 rounded-[10px] bg-slate-100 flex items-center justify-center shrink-0">
                  <Smartphone size={20} className="text-slate-600" />
                </div>
                <div>
                  <h2 className="text-slate-800 font-bold text-sm">iPhone / iPad</h2>
                  <p className="text-slate-500 text-[12px] leading-[1.5]">
                    {t("index.ios_steps")} <span className="text-slate-700 font-medium">{t("index.ios_action")}</span>
                  </p>
                </div>
              </div>

              {/* Card 2 */}
              <div 
                className="flex items-center gap-[14px] p-[14px_16px] rounded-[14px] bg-slate-50 border border-slate-100"
              >
                <div className="w-10 h-10 rounded-[10px] bg-slate-100 flex items-center justify-center shrink-0">
                  <Smartphone size={20} className="text-slate-600" />
                </div>
                <div>
                  <h2 className="text-slate-800 font-bold text-sm">Android</h2>
                  <p className="text-slate-500 text-[12px] leading-[1.5]">
                    {t("index.android_steps")} <span className="text-slate-700 font-medium">{t("index.android_action")}</span>
                  </p>
                </div>
              </div>

              {/* Card 3 */}
              <div 
                className="flex items-center gap-[14px] p-[14px_16px] rounded-[14px] bg-slate-50 border border-slate-100"
              >
                <div className="w-10 h-10 rounded-[10px] bg-slate-100 flex items-center justify-center shrink-0">
                  <Monitor size={20} className="text-slate-600" />
                </div>
                <div>
                  <h2 className="text-slate-800 font-bold text-sm">Windows / Mac</h2>
                  <p className="text-slate-500 text-[12px] leading-[1.5]">
                    {t("index.desktop_steps")} <span className="text-slate-700 font-medium">{t("index.desktop_action")}</span>
                  </p>
                </div>
              </div>
            </div>
            
            <p className="mt-4 text-slate-400 text-[11px] text-center">
              {t("index.modal_footer")}
            </p>
          </div>
        </div>
      )}

      {/* MOBILE SCROLL HINT - Only if content exceeds screen */}
      <style>{`
        @media (max-width: 768px) {
          .overflow-hidden {
            overflow-y: auto !important;
          }
          main {
            height: auto !important;
            min-height: 100vh;
          }
        }
      `}</style>
    </div>
    </>
  );
};

export default Index;