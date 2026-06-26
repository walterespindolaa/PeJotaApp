import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import TermosDeUsoContent from "@/components/legal/TermosDeUsoContent";

const TermosDeUso = () => {
  return (
    <>
    <SEO
      title="Termos de Uso | PeJota"
      description="Leia os Termos de Uso da plataforma PeJota: regras, responsabilidades e condições para utilização do serviço de organização financeira."
      path="/termos-de-uso"
    />
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-heading font-bold">TERMOS DE USO – PEJOTA</h1>
          <p className="text-sm text-muted-foreground">Última atualização: 2026</p>
          <Link to="/auth" className="text-sm text-primary underline underline-offset-2">Voltar</Link>
        </header>

        <TermosDeUsoContent />
      </div>
    </main>
    </>
  );
};

export default TermosDeUso;
