import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type QuoteCategory =
  | "general"
  | "diagnostico"
  | "estrategia"
  | "disciplina"
  | "patrimonio"
  | "investimentos"
  | "futuro"
  | "empresa";

export interface AtlasQuote {
  id: string;
  text: string;
  author: string;
  category: string;
}

const FALLBACK: AtlasQuote = {
  id: "fallback",
  text: "Planejamento financeiro não é prever o futuro. É construir opções para ele.",
  author: "Equipe Atlas",
  category: "general",
};

/**
 * Fetches a random active quote for the given category.
 * Falls back to 'general' if no quote found for the category.
 * Refreshes every page load (no caching).
 */
export function useAtlasQuote(category: QuoteCategory = "general"): {
  quote: AtlasQuote;
  loading: boolean;
} {
  const [quote, setQuote] = useState<AtlasQuote>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchQuote = async () => {
      setLoading(true);

      // Try specific category first
      const { data } = await supabase
        .from("atlas_quotes")
        .select("id, text, author, category")
        .eq("category", category)
        .eq("active", true)
        .limit(50);

      if (!cancelled) {
        if (data && data.length > 0) {
          const random = data[Math.floor(Math.random() * data.length)];
          setQuote(random as AtlasQuote);
        } else {
          // Fallback to general
          const { data: general } = await supabase
            .from("atlas_quotes")
            .select("id, text, author, category")
            .eq("category", "general")
            .eq("active", true)
            .limit(50);

          if (general && general.length > 0) {
            const random = general[Math.floor(Math.random() * general.length)];
            setQuote(random as AtlasQuote);
          } else {
            setQuote(FALLBACK);
          }
        }
        setLoading(false);
      }
    };

    fetchQuote();
    return () => { cancelled = true; };
  }, [category]);

  return { quote, loading };
}
