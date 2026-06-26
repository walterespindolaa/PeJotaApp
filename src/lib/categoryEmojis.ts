/**
 * Category → Emoji mapping for premium chart & UI
 */

export const CATEGORY_EMOJI_MAP: Record<string, string> = {
  "Mercado": "🛒",
  "Supermercado": "🛒",
  "Alimentação": "🍔",
  "Transporte": "🚗",
  "Moradia": "🏠",
  "Contas": "💡",
  "Impostos": "🧾",
  "Compras": "🛍️",
  "Varejo": "🛍️",
  "Saúde": "💊",
  "Farmácia": "💊",
  "Educação": "🎓",
  "Lazer": "🎬",
  "Entretenimento": "🎬",
  "Viagem": "✈️",
  "Viagens": "✈️",
  "Hotel": "🧳",
  "Hospedagem": "🧳",
  "Beleza": "🧴",
  "Cuidados pessoais": "🧴",
  "Pets": "🐶",
  "Serviços": "🧰",
  "Assinaturas": "🧰",
  "Bancos": "💳",
  "Tarifas": "💳",
  "Juros": "💳",
  "Delivery": "📦",
  "Frete": "📦",
  "Presentes": "🎁",
  "Sem categoria": "❓",
  "Outros": "❓",
};

export function getCategoryEmoji(category: string): string {
  if (!category) return "❓";
  // Exact match
  if (CATEGORY_EMOJI_MAP[category]) return CATEGORY_EMOJI_MAP[category];
  // Partial match (case-insensitive)
  const lower = category.toLowerCase();
  for (const [key, emoji] of Object.entries(CATEGORY_EMOJI_MAP)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return emoji;
    }
  }
  return "❓";
}

export const CHART_COLORS = [
  "hsl(208, 40%, 28%)",
  "hsl(37, 50%, 58%)",
  "hsl(150, 30%, 42%)",
  "hsl(5, 50%, 58%)",
  "hsl(208, 40%, 48%)",
  "hsl(280, 35%, 55%)",
  "hsl(30, 45%, 50%)",
  "hsl(170, 35%, 45%)",
  "hsl(340, 40%, 55%)",
  "hsl(60, 35%, 45%)",
  "hsl(220, 25%, 60%)",
  "hsl(100, 30%, 50%)",
];
