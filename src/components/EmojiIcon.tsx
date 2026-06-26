import {
  Wallet, BarChart3, Umbrella, TrendingUp, TrendingDown, Target, AlertTriangle,
  CheckCircle2, Circle, Shield, Flame, Gem, Briefcase, Dices, Trophy, Rocket,
  Calendar, Repeat, Lightbulb, PiggyBank, Link2, Download, Sparkles, Scale, Info,
  ShoppingCart, CreditCard, Store, ShoppingBag, Package, Landmark, Megaphone,
  Users, Truck, Building2, Laptop, Smartphone, Zap, Wrench, Coffee, Receipt, HelpCircle,
  type LucideIcon,
} from "lucide-react";

/**
 * Converte um emoji (vindo de estruturas de dados antigas) no ícone Lucide
 * equivalente, no momento de renderizar — sem precisar mudar o tipo do dado.
 * Emojis não mapeados caem no fallback (mostra o próprio emoji).
 */
const ICON_MAP: Record<string, LucideIcon> = {
  "💰": Wallet,
  "📊": BarChart3,
  "🏖️": Umbrella,
  "📈": TrendingUp,
  "📉": TrendingDown,
  "🎯": Target,
  "⚠️": AlertTriangle,
  "⚠": AlertTriangle,
  "✅": CheckCircle2,
  "🛡️": Shield,
  "🔥": Flame,
  "💎": Gem,
  "💼": Briefcase,
  "🎲": Dices,
  "🏆": Trophy,
  "🚀": Rocket,
  "📅": Calendar,
  "🔁": Repeat,
  "💡": Lightbulb,
  "🐷": PiggyBank,
  "🔗": Link2,
  "📥": Download,
  "🔮": Sparkles,
  "⚖️": Scale,
  "ℹ️": Info,
  // Categorias de negócio
  "🛒": ShoppingCart,
  "💳": CreditCard,
  "🏪": Store,
  "🛍": ShoppingBag,
  "🛍️": ShoppingBag,
  "📦": Package,
  "🏛": Landmark,
  "🏛️": Landmark,
  "📢": Megaphone,
  "👨‍💻": Users,
  "🚚": Truck,
  "🏢": Building2,
  "💻": Laptop,
  "📱": Smartphone,
  "⚡": Zap,
  "🔧": Wrench,
  "☕": Coffee,
  "🧾": Receipt,
  "❓": HelpCircle,
};

/** Cor (fill/text) para as bolinhas de status. */
const DOT_CLASS: Record<string, string> = {
  "🔴": "fill-destructive text-destructive",
  "🟠": "fill-warning text-warning",
  "🟡": "fill-amber-500 text-amber-500",
  "🟢": "fill-success text-success",
  "🔵": "fill-info text-info",
};

export function EmojiIcon({ emoji, className = "h-4 w-4" }: { emoji?: string | null; className?: string }) {
  if (!emoji) return null;
  const dot = DOT_CLASS[emoji];
  if (dot) return <Circle className={`${dot} ${className}`} aria-hidden="true" />;
  const Icon = ICON_MAP[emoji];
  if (Icon) return <Icon className={className} aria-hidden="true" />;
  return <span>{emoji}</span>;
}
