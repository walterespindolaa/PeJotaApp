import { Monitor, Smartphone } from "lucide-react";
import ScrollReveal from "./ScrollReveal";

/* ═══════════════════════════════════════════════
   SECTION 2 — INSTALE O APP
   ═══════════════════════════════════════════════ */

const installCards = [
  {
    icon: <Smartphone size={20} className="text-white" />,
    title: "iPhone / iPad",
    instruction: "Abra no Safari → toque em Compartilhar → 'Adicionar à Tela de Início'",
  },
  {
    icon: <Smartphone size={20} className="text-white" />,
    title: "Android",
    instruction: "Abra no Chrome → toque nos 3 pontinhos → 'Adicionar à tela inicial'",
  },
  {
    icon: <Monitor size={20} className="text-white" />,
    title: "Windows / Mac",
    instruction: "Abra no Chrome ou Edge → clique no ícone de instalar (⊕) na barra de endereço",
  },
];

function InstallSection() {
  return (
    <section style={{ background: "#1a1a2e", padding: "80px 0" }}>
      <div className="max-w-5xl mx-auto px-5 sm:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          {/* Mockup placeholder */}
          <ScrollReveal className="order-2 md:order-1 flex justify-center">
            <div
              className="rounded-[2.5rem] flex items-center justify-center"
              style={{
                width: 220,
                height: 420,
                background: "rgba(255,255,255,0.06)",
                border: "2px solid rgba(255,255,255,0.12)",
              }}
            >
              <p className="text-xs font-heading" style={{ color: "rgba(255,255,255,0.3)" }}>
                [ mockup do app ]
              </p>
            </div>
          </ScrollReveal>

          {/* Content */}
          <ScrollReveal delay={100} className="order-1 md:order-2">
            <span
              className="inline-block px-3 py-1 rounded-full text-xs font-heading font-bold uppercase tracking-wider mb-5"
              style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}
            >
              ACESSO TOTAL
            </span>
            <h2
              className="font-heading font-[800] text-white leading-tight mb-3"
              style={{ fontSize: "clamp(1.5rem,4vw,2.25rem)" }}
            >
              Na palma da mão ou na tela grande.
            </h2>
            <p className="mb-8" style={{ fontSize: 16, color: "rgba(255,255,255,0.55)", lineHeight: 1.7 }}>
              O Atlas é um PWA — instale direto no celular sem precisar de App Store.
            </p>

            <div className="flex flex-col gap-3 mb-6">
              {installCards.map((card) => (
                <div
                  key={card.title}
                  className="flex items-start gap-3 px-4 py-3 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <div className="w-[44px] h-[44px] rounded-xl bg-neutral-800 flex items-center justify-center shrink-0">
                    {card.icon}
                  </div>
                  <div>
                    <p className="text-sm font-heading font-semibold text-white">{card.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                      {card.instruction}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
              Instala em segundos. Funciona offline. Sem App Store.
            </p>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}

export { InstallSection };
