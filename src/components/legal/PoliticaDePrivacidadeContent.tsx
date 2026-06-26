/**
 * Conteúdo da Política de Privacidade, reutilizável na rota /politica-de-privacidade e em modais.
 * As seções são filhos diretos para herdar o espaçamento (space-y-*) do container pai.
 */
const PoliticaDePrivacidadeContent = () => {
  return (
    <>
      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold">DADOS COLETADOS</h2>
        <p>Podemos coletar as seguintes informações:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>nome</li>
          <li>e-mail</li>
          <li>dados financeiros inseridos na plataforma</li>
          <li>dados de navegação</li>
          <li>dados de uso da plataforma</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold">FINALIDADE DO TRATAMENTO</h2>
        <p>Os dados coletados são utilizados para:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>funcionamento da plataforma</li>
          <li>geração de análises financeiras</li>
          <li>produção de relatórios automatizados</li>
          <li>melhoria da experiência do usuário</li>
          <li>segurança da aplicação</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold">PROCESSAMENTO AUTOMATIZADO</h2>
        <p>Alguns dados inseridos pelo usuário podem ser processados por sistemas automatizados e modelos de inteligência artificial com a finalidade de gerar análises e relatórios financeiros.</p>
        <p>Esse processamento ocorre de forma automatizada com base nas informações fornecidas pelo próprio usuário.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold">SEGURANÇA DOS DADOS</h2>
        <p>Adotamos medidas técnicas e organizacionais para proteger os dados contra acessos não autorizados, perda, alteração ou divulgação indevida.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold">COMPARTILHAMENTO DE DADOS</h2>
        <p>Os dados não são vendidos ou compartilhados com terceiros para fins comerciais.</p>
        <p>Eventualmente podem ser processados por serviços tecnológicos necessários para o funcionamento da plataforma.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold">DIREITOS DO USUÁRIO</h2>
        <p>Nos termos da LGPD, o usuário pode solicitar:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>acesso aos dados</li>
          <li>correção de dados</li>
          <li>exclusão de dados</li>
          <li>portabilidade de dados</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold">CONTATO E ENCARREGADO DE DADOS (DPO)</h2>
        {/* TODO: confirmar o e-mail real de privacidade/DPO antes de publicar. */}
        <p>
          Solicitações relacionadas à privacidade e ao tratamento de dados pessoais, bem como o exercício
          dos direitos previstos na LGPD, podem ser feitas diretamente ao nosso Encarregado de Dados (DPO)
          pelo e-mail <a href="mailto:privacidade@usepejotaapp.com" className="underline">privacidade@usepejotaapp.com</a>.
        </p>
      </section>
    </>
  );
};

export default PoliticaDePrivacidadeContent;
