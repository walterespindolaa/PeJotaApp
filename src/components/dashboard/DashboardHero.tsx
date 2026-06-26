import { useState, useEffect } from "react";
import { Target, Heart } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useI18n } from "@/contexts/I18nContext";

interface DashboardHeroProps {
  greetingName: string;
  greetingEmoji?: string;
  onEmojiSelect?: (emoji: string) => void;
  subtitle?: string;
  score?: number | null;
  scoreLabel?: string;
  showVisaoFutura?: boolean;
  visaoFutura?: boolean;
  onVisaoFuturaChange?: (v: boolean) => void;
}

export default function DashboardHero({
  greetingName,
  greetingEmoji,
  onEmojiSelect,
  subtitle,
  score = null,
  scoreLabel = "Score",
  showVisaoFutura = false,
  visaoFutura = false,
  onVisaoFuturaChange,
}: DashboardHeroProps) {
  const { t } = useI18n();
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [emojiMod, setEmojiMod] = useState<typeof import("emoji-picker-react") | null>(null);

  useEffect(() => {
    if (emojiOpen && !emojiMod) {
      import("emoji-picker-react").then(setEmojiMod).catch(() => {});
    }
  }, [emojiOpen, emojiMod]);

  const pct = Math.max(0, Math.min(100, score ?? 0));
  const R = 28;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - pct / 100);

  return (
    <div
      className="lg:hidden overflow-hidden -mt-4 -mx-4 sm:-mx-5 rounded-b-[28px]"
      style={{ background: "linear-gradient(rgba(17,19,27,0.74), rgba(17,19,27,0.74)), hsl(var(--primary))" }}
    >
      <div className="px-5 pt-5 pb-5 text-[#F5F1E8]">
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#F5F1E8]/70">{t("hero.ola")}</p>
            <h1 className="text-2xl font-heading font-bold leading-tight flex items-center gap-1 min-w-0">
              <span className="truncate">{greetingName}</span>
              {onEmojiSelect ? (
                <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center align-middle cursor-pointer hover:scale-125 transition-transform flex-shrink-0"
                      title={t("hero.trocar_emoji")}
                      aria-label={t("hero.trocar_emoji")}
                    >
                      {greetingEmoji === "❤️" ? (
                        <Heart className="h-6 w-6 text-destructive fill-destructive" />
                      ) : (
                        <span>{greetingEmoji}</span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-none shadow-xl" align="start" sideOffset={8}>
                    {emojiMod ? (
                      <emojiMod.default
                        onEmojiClick={(emojiData) => {
                          onEmojiSelect(emojiData.emoji);
                          setEmojiOpen(false);
                        }}
                        emojiStyle={emojiMod.EmojiStyle.NATIVE}
                        searchPlaceHolder={t("hero.buscar_emoji")}
                        autoFocusSearch={false}
                        skinTonesDisabled
                        previewConfig={{ showPreview: false }}
                        width={320}
                        height={400}
                      />
                    ) : (
                      <div className="flex items-center justify-center" style={{ width: 320, height: 400 }}>
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              ) : greetingEmoji ? (
                <span className="flex-shrink-0">{greetingEmoji}</span>
              ) : null}
            </h1>
          </div>

          {score != null && (
            <div className="relative h-[70px] w-[70px] flex-shrink-0">
              <svg width="70" height="70" viewBox="0 0 70 70" className="-rotate-90">
                <circle cx="35" cy="35" r={R} fill="none" stroke="hsl(0 0% 100% / 0.18)" strokeWidth="6" />
                <circle
                  cx="35" cy="35" r={R} fill="none"
                  stroke="hsl(var(--primary))" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray={C} strokeDashoffset={offset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-heading text-xl font-bold leading-none text-[#F5F1E8]">{score}</span>
                <span className="mt-0.5 text-[8px] font-heading font-semibold uppercase tracking-[0.12em] text-[#F5F1E8]/70">
                  {scoreLabel}
                </span>
              </div>
            </div>
          )}
        </div>

        <p className="mt-2 text-[12.5px] italic text-[#F5F1E8]/70">{subtitle ?? t("hero.subtitle")}</p>

        {showVisaoFutura && (
          <div className="mt-3.5 flex items-center justify-end gap-2">
            <span className="flex items-center gap-1 text-[11px] font-medium text-[#F5F1E8]/70">
              <Target className="h-3.5 w-3.5" /> {t("hero.visao_futura")}
            </span>
            <Switch checked={visaoFutura} onCheckedChange={onVisaoFuturaChange} />
          </div>
        )}
      </div>
    </div>
  );
}
