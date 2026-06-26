import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import PoliticaDePrivacidadeContent from "@/components/legal/PoliticaDePrivacidadeContent";

const PoliticaDePrivacidade = () => {
  return (
    <>
    <SEO
      title="Política de Privacidade | Atlas"
      description="Saiba como o Atlas coleta, usa e protege seus dados pessoais e financeiros. Transparência total sobre privacidade e LGPD."
      path="/politica-de-privacidade"
    />
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl font-heading font-bold">POLÍTICA DE PRIVACIDADE – ATLAS</h1>
          <p className="text-sm text-muted-foreground">Última atualização: 2026</p>
          <Link to="/auth" className="text-sm text-primary underline underline-offset-2">Voltar</Link>
        </header>

        <PoliticaDePrivacidadeContent />
      </div>
    </main>
    </>
  );
};

export default PoliticaDePrivacidade;
