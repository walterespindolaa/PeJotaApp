import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import SEO from "@/components/SEO";
import ShaderBackground from "@/components/ui/shader-background";

const Index = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0c1620]">
        <div className="h-6 w-6 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <>
      <SEO
        title="PeJota | Gestão do seu negócio"
        description="ERP para PJ: fluxo de caixa, contas a pagar e receber, funil de vendas, propostas e estoque — a administração do seu negócio num só lugar."
        path="/"
      />
      <div className="relative w-full min-h-screen overflow-hidden flex flex-col">
        {/* Fundo animado (shader) na paleta PeJota */}
        <ShaderBackground className="absolute inset-0 w-full h-full" />

        {/* Overlay para contraste do texto */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background:
              "linear-gradient(to right, rgba(12,22,32,0.78), rgba(12,22,32,0.45) 60%, rgba(12,22,32,0.25))",
          }}
        />

        {/* Navbar */}
        <nav className="relative z-20 flex justify-between items-center px-[6vw] py-6">
          <img src="/logo-full-branca.png" alt="PeJota" className="h-9 w-auto" />
          <Link to="/auth">
            <Button variant="ghost" className="text-white font-medium hover:bg-white/10">
              Entrar
            </Button>
          </Link>
        </nav>

        {/* Hero */}
        <main className="relative z-20 flex-1 flex items-center px-[6vw] py-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-7 bg-white/10 border border-white/15 backdrop-blur-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              <span className="text-[11px] font-semibold text-white/90 uppercase tracking-[1.5px]">
                Gestão financeira para PJ
              </span>
            </div>

            <h1
              className="text-white font-black leading-[1.05] mb-5"
              style={{ fontSize: "clamp(38px, 6vw, 64px)" }}
            >
              O caixa da sua empresa,
              <br />
              sob controle.
            </h1>

            <p className="text-[17px] md:text-[19px] text-white/70 max-w-xl mb-9 leading-relaxed">
              Fluxo de caixa, contas a pagar e receber, funil de vendas, propostas e estoque.
              O PeJota mostra a saúde do seu negócio e qual o próximo passo.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Link to="/auth">
                <Button
                  className="h-auto py-3.5 px-7 rounded-xl text-[15px] font-bold bg-blue-500 text-[#0c1620] hover:bg-blue-400 transition-all hover:scale-[1.03]"
                >
                  Acessar plataforma <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button
                  variant="ghost"
                  className="h-auto py-3.5 px-6 rounded-xl text-[15px] font-medium text-white border border-white/20 hover:bg-white/10"
                >
                  Já tenho conta
                </Button>
              </Link>
            </div>
          </div>
        </main>

        {/* Rodapé legal */}
        <footer className="relative z-20 px-[6vw] py-5 flex flex-wrap items-center justify-between gap-2 text-white/45 text-xs">
          <span>PeJota © 2026</span>
          <div className="flex items-center gap-4">
            <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="hover:text-white/80">
              Termos
            </a>
            <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="hover:text-white/80">
              Privacidade
            </a>
          </div>
        </footer>
      </div>
    </>
  );
};

export default Index;
