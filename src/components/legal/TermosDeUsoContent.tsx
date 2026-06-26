/**
 * Conteúdo dos Termos de Uso, reutilizável na rota /termos-de-uso e em modais.
 * As seções são filhos diretos para herdar o espaçamento (space-y-*) do container pai.
 */
const TermosDeUsoContent = () => {
  return (
    <>
      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold">SOBRE A PLATAFORMA</h2>
        <p>O Atlas é uma plataforma tecnológica destinada à organização financeira, planejamento patrimonial e visualização de dados financeiros pessoais ou empresariais.</p>
        <p>A plataforma disponibiliza ferramentas de análise, projeção e organização financeira com base nas informações inseridas pelo próprio usuário.</p>
        <p>O Atlas não realiza gestão de recursos, consultoria financeira individualizada, administração de investimentos ou intermediação de operações financeiras.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold">NATUREZA DAS INFORMAÇÕES</h2>
        <p>As análises, projeções e relatórios disponibilizados pela plataforma possuem caráter informativo, educacional e de apoio à tomada de decisão.</p>
        <p>Essas informações não constituem:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>recomendação de investimento</li>
          <li>consultoria financeira</li>
          <li>garantia de rentabilidade</li>
          <li>promessa de resultados financeiros</li>
        </ul>
        <p>As decisões financeiras são de responsabilidade exclusiva do usuário.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold">USO DE INTELIGÊNCIA ARTIFICIAL</h2>
        <p>Algumas funcionalidades da plataforma utilizam modelos de inteligência artificial para gerar análises, diagnósticos e relatórios automatizados.</p>
        <p>Esses conteúdos são gerados automaticamente a partir dos dados fornecidos pelo usuário e podem conter simplificações, aproximações ou imprecisões.</p>
        <p>O usuário reconhece que conteúdos gerados por inteligência artificial devem ser interpretados como ferramentas de apoio e não como aconselhamento profissional.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold">RESPONSABILIDADE DO USUÁRIO</h2>
        <p>O usuário é responsável pela veracidade, precisão e atualização das informações inseridas na plataforma.</p>
        <p>O Atlas não se responsabiliza por decisões tomadas com base em dados incorretos ou incompletos fornecidos pelo usuário.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold">LIMITAÇÃO DE RESPONSABILIDADE</h2>
        <p>Em nenhuma hipótese o Atlas ou seus responsáveis poderão ser responsabilizados por:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>perdas financeiras</li>
          <li>lucros cessantes</li>
          <li>danos indiretos</li>
          <li>decisões de investimento</li>
          <li>prejuízos decorrentes do uso da plataforma</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold">DISPONIBILIDADE DA PLATAFORMA</h2>
        <p>O Atlas se esforça para manter a plataforma disponível e segura, porém não garante disponibilidade ininterrupta.</p>
        <p>Podem ocorrer interrupções temporárias para manutenção, atualização ou falhas técnicas.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold">ALTERAÇÕES DOS TERMOS</h2>
        <p>O Atlas poderá atualizar estes termos a qualquer momento.</p>
        <p>Quando isso ocorrer, os usuários poderão ser solicitados a aceitar uma nova versão para continuar utilizando a plataforma.</p>
      </section>

      <section className="space-y-3">
        <h2 className="text-xl font-heading font-semibold">LEGISLAÇÃO</h2>
        <p>Estes termos são regidos pelas leis da República Federativa do Brasil.</p>
      </section>
    </>
  );
};

export default TermosDeUsoContent;
