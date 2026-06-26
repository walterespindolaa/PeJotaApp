import { useState, useEffect } from "react";
import { Heart } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface GreetingEmojiButtonProps {
  greetingEmoji?: string;
  onEmojiSelect?: (emoji: string) => void;
  /** Tamanho do glifo/ícone (classe Tailwind aplicada ao Heart). */
  iconClassName?: string;
  className?: string;
}

/**
 * Emoji editável ao lado do nome do usuário (saudação).
 * Compartilhado entre o hero mobile (DashboardHero) e o canopy desktop (DashboardLayout)
 * para manter o comportamento idêntico nas duas versões.
 * Se onEmojiSelect não for passado, renderiza apenas o emoji (somente leitura).
 */
export default function GreetingEmojiButton({
  greetingEmoji,
  onEmojiSelect,
  iconClassName = "h-6 w-6",
  className = "",
}: GreetingEmojiButtonProps) {
  const [open, setOpen] = useState(false);
  const [emojiMod, setEmojiMod] = useState<typeof import("emoji-picker-react") | null>(null);

  useEffect(() => {
    if (open && !emojiMod) {
      import("emoji-picker-react").then(setEmojiMod).catch(() => {});
    }
  }, [open, emojiMod]);

  if (!greetingEmoji && !onEmojiSelect) return null;

  // Fallback pra nunca ficar invisível quando o valor vem vazio do perfil.
  const display = greetingEmoji || "👋";
  const glyph = display === "❤️"
    ? <Heart className={`${iconClassName} text-destructive fill-destructive`} />
    : <span>{display}</span>;

  // Somente leitura
  if (!onEmojiSelect) return <span className={`flex-shrink-0 ${className}`}>{glyph}</span>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center align-middle cursor-pointer hover:scale-125 transition-transform flex-shrink-0 ${className}`}
          title="Trocar emoji"
          aria-label="Trocar emoji"
        >
          {glyph}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 border-none shadow-xl" align="start" sideOffset={8}>
        {emojiMod ? (
          <emojiMod.default
            onEmojiClick={(emojiData) => {
              onEmojiSelect(emojiData.emoji);
              setOpen(false);
            }}
            emojiStyle={emojiMod.EmojiStyle.NATIVE}
            searchPlaceHolder="Buscar emoji..."
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
  );
}
