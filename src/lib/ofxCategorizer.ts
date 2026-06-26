/**
 * Keyword-based categorization for OFX transactions.
 * Uses merchant_category_learning as user history + built-in rules.
 */

export interface CategoryRule {
  keywords: string[];
  category: string;
}

const BUILT_IN_RULES: CategoryRule[] = [
  { keywords: ["supermercado", "mercado", "hortifruti", "açougue", "padaria", "restaurante", "ifood", "uber eats", "rappi", "mcdonald", "burger", "pizza", "lanchonete", "cafe"], category: "Alimentação" },
  { keywords: ["uber", "99", "cabify", "gasolina", "combustivel", "estacionamento", "pedagio", "ipva", "multa", "metro", "onibus", "bilhete unico"], category: "Transporte" },
  { keywords: ["aluguel", "condominio", "energia", "agua", "gas", "internet", "telefone", "celular", "iptu"], category: "Moradia" },
  { keywords: ["farmacia", "drogaria", "hospital", "clinica", "medico", "plano de saude", "unimed", "amil", "bradesco saude", "sulamerica", "dentista", "laboratorio"], category: "Saúde" },
  { keywords: ["escola", "faculdade", "universidade", "curso", "livro", "mensalidade", "educacao"], category: "Educação" },
  { keywords: ["netflix", "spotify", "amazon prime", "disney", "hbo", "youtube", "cinema", "teatro", "show", "ingresso", "parque", "clube"], category: "Lazer" },
  { keywords: ["assinatura", "subscription", "adobe", "microsoft", "google", "apple", "icloud"], category: "Assinaturas" },
  { keywords: ["imposto", "taxa", "irrf", "iof", "inss", "fgts", "darf"], category: "Impostos" },
  { keywords: ["seguro", "porto seguro", "bradesco seguros", "mapfre", "itau seguros"], category: "Seguros" },
  { keywords: ["transferencia", "pix", "ted", "doc", "deposito"], category: "Transferências" },
  { keywords: ["salario", "pagamento", "pro-labore", "prolabore", "rendimento", "dividendo", "juros", "resgate"], category: "Receita" },
  { keywords: ["viagem", "hotel", "airbnb", "booking", "passagem", "aereo", "latam", "gol", "azul"], category: "Viagem" },
  { keywords: ["shopping", "loja", "magazine", "americanas", "mercado livre", "aliexpress", "shein", "shopee"], category: "Compras" },
];

export interface LearnedCategory {
  merchant: string;
  categoria: string;
}

export function categorizeTransaction(
  description: string,
  learnedCategories: LearnedCategory[] = []
): string {
  const descLower = description.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // 1. Check learned categories first (user history takes priority)
  for (const learned of learnedCategories) {
    const merchantLower = learned.merchant.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (descLower.includes(merchantLower)) {
      return learned.categoria;
    }
  }

  // 2. Check built-in keyword rules
  for (const rule of BUILT_IN_RULES) {
    for (const keyword of rule.keywords) {
      const kwLower = keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (descLower.includes(kwLower)) {
        return rule.category;
      }
    }
  }

  return "Outros";
}

export function categorizeTransactions(
  transactions: { description: string }[],
  learnedCategories: LearnedCategory[] = []
): string[] {
  return transactions.map(t => categorizeTransaction(t.description, learnedCategories));
}
