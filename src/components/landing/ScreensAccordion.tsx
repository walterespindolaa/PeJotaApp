import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";

const SCREENS = [
  { t: "scr.visao_t", img: "/images/tela-visao-mes.webp", d: "scr.visao_d" },
  { t: "scr.score_t", img: "/images/tela-atlas-score.webp", d: "scr.score_d" },
  { t: "scr.inv_t", img: "/images/tela-investimentos.webp", d: "scr.inv_d" },
  { t: "scr.sim_t", img: "/images/tela-simulador.webp", d: "scr.sim_d" },
  { t: "scr.cal_t", img: "/images/tela-calendario.webp", d: "scr.cal_d" },
];

/**
 * Accordion de telas do app (intermediária).
 * Desktop: horizontal, expande no hover e mostra a tela inteira (object-contain).
 * Mobile: vertical, começa tudo fechado; ao tocar, abre a imagem inteira.
 */
export default function ScreensAccordion() {
  const { t } = useI18n();
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<number>(-1);

  return (
    <div className="w-full">
      {/* ── Desktop: accordion horizontal ── */}
      <div className="hidden md:flex gap-2.5 h-[560px] w-full justify-end">
        {SCREENS.map((s, i) => {
          const on = active === i;
          return (
            <div
              key={s.t}
              onMouseEnter={() => setActive(i)}
              className={`relative h-full rounded-2xl overflow-hidden cursor-pointer border border-white/15 bg-[#0c1820] transition-all duration-500 ease-in-out ${on ? "w-[258px]" : "w-[54px]"}`}
            >
              <img
                src={s.img}
                alt={t(s.t)}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover object-top"
              />
              <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 to-transparent" />
              {on && (
                <span className="absolute top-3 left-3 text-[10px] font-bold px-2 py-0.5 rounded-md bg-[#f2ab0c] text-[#2a1c02]">PeJota</span>
              )}
              <div
                className={`absolute left-1/2 -translate-x-1/2 text-white transition-all duration-300 ${
                  on ? "bottom-4 rotate-0 w-[88%] text-center" : "bottom-24 rotate-90 whitespace-nowrap"
                }`}
              >
                <p className="font-bold text-[16px] leading-tight">{t(s.t)}</p>
                {on && <p className="text-white/75 text-[12.5px] mt-0.5">{t(s.d)}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Mobile: accordion vertical (tudo fechado no início) ── */}
      <div className="md:hidden flex flex-col gap-2 w-full">
        {SCREENS.map((s, i) => {
          const isOpen = open === i;
          return (
            <div key={s.t} className="rounded-2xl overflow-hidden border border-white/15 bg-black/30 backdrop-blur-sm">
              <button
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="w-full flex items-center gap-3 p-3.5 text-left"
                aria-expanded={isOpen}
              >
                <span className="flex-1 text-white font-semibold text-[15px]">{t(s.t)}</span>
                <ChevronDown className={`h-5 w-5 text-white/60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <div className={`overflow-hidden transition-all duration-[450ms] ease-in-out ${isOpen ? "max-h-[1200px]" : "max-h-0"}`}>
                <div className="px-3.5 pb-4">
                  <p className="text-white/70 text-[13px] mb-3">{t(s.d)}</p>
                  <div className="rounded-xl overflow-hidden border border-white/10">
                    <img src={s.img} alt={t(s.t)} className="w-full block" loading="lazy" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
