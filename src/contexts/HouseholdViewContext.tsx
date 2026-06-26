import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type HouseholdView = "pessoa1" | "pessoa2" | "casal" | "geral";

interface HouseholdViewContextType {
  view: HouseholdView;
  setView: (v: HouseholdView) => void;
  labels: Record<string, string>;
  nomePessoa1: string;
  nomePessoa2: string;
  fotoPessoa1: string;
  fotoPessoa2: string;
  fotoCasal: string;
  fotoGeral: string;
  greetingName: string;
  activeAvatar: string;
  greetingEmoji: string;
  setGreetingEmoji: (emoji: string) => void;
  refreshPhotos: () => void;
  profileLoading: boolean;
  hasPessoa2: boolean;
  vinculo: string;
}

const HouseholdViewContext = createContext<HouseholdViewContextType>({
  view: "casal",
  setView: () => {},
  labels: {},
  nomePessoa1: "Pessoa 1",
  nomePessoa2: "Pessoa 2",
  fotoPessoa1: "",
  fotoPessoa2: "",
  fotoCasal: "",
  fotoGeral: "",
  greetingName: "Pessoa 1 e Pessoa 2",
  activeAvatar: "",
  greetingEmoji: "👋",
  setGreetingEmoji: () => {},
  refreshPhotos: () => {},
  profileLoading: true,
  hasPessoa2: false,
  vinculo: "Cônjuge",
});

const EMOJI_COL_MAP: Record<HouseholdView, string> = {
  pessoa1: "emoji_pessoa1",
  pessoa2: "emoji_pessoa2",
  casal: "emoji_casal",
  geral: "emoji_geral",
};

const EMOJI_DEFAULTS: Record<HouseholdView, string> = {
  pessoa1: "👋",
  pessoa2: "👋",
  casal: "❤️",
  geral: "📊",
};

export const HouseholdViewProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [view, setView] = useState<HouseholdView>("pessoa1");
  const [nomePessoa1, setNomePessoa1] = useState("Pessoa 1");
  const [nomePessoa2, setNomePessoa2] = useState("Pessoa 2");
  const [fotoPessoa1, setFotoPessoa1] = useState("");
  const [fotoPessoa2, setFotoPessoa2] = useState("");
  const [fotoCasal, setFotoCasal] = useState("");
  const [fotoGeral, setFotoGeral] = useState("");
  const [vinculo, setVinculo] = useState("Cônjuge");
  const [hasPessoa2, setHasPessoa2] = useState(false);
  const [emojis, setEmojis] = useState<Record<HouseholdView, string>>(EMOJI_DEFAULTS);
  const [profileLoading, setProfileLoading] = useState(true);
  const didInitView = useRef(false);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setProfileLoading(true);

    // Try to get owner's profile first (for invited members)
    const { data: ownerProfile } = await supabase.rpc("get_household_owner_profile");

    // Determine which user_id to query for profile data
    const targetUserId = (ownerProfile as any)?.owner_id || user.id;

    const { data } = await supabase
      .from("profiles")
      .select("nome_pessoa1,nome_pessoa2,foto_pessoa1,foto_pessoa2,foto_casal,foto_geral,vinculo_pessoa2,emoji_pessoa1,emoji_pessoa2,emoji_casal,emoji_geral")
      .eq("user_id", targetUserId)
      .maybeSingle();

    // If RLS blocks reading the owner's profile, fall back to RPC data
    const d = data ? (data as any) : (ownerProfile as any);
    if (d) {
      setNomePessoa1(d.nome_pessoa1 || "Pessoa 1");
      setNomePessoa2(d.nome_pessoa2 || "Pessoa 2");
      setFotoPessoa1(d.foto_pessoa1 || "");
      setFotoPessoa2(d.foto_pessoa2 || "");
      setFotoCasal(d.foto_casal || "");
      setFotoGeral(d.foto_geral || "");
      setVinculo(d.vinculo_pessoa2 || "Cônjuge");
      setHasPessoa2(!!(d.nome_pessoa2 && String(d.nome_pessoa2).trim() && String(d.nome_pessoa2).trim() !== "Pessoa 2"));
      setEmojis({
        pessoa1: d.emoji_pessoa1 || EMOJI_DEFAULTS.pessoa1,
        pessoa2: d.emoji_pessoa2 || EMOJI_DEFAULTS.pessoa2,
        casal: d.emoji_casal || EMOJI_DEFAULTS.casal,
        geral: d.emoji_geral || EMOJI_DEFAULTS.geral,
      });
    }

    const ownerId = (ownerProfile as any)?.owner_id;
    const isInvitedMember = !!ownerId && ownerId !== user.id;
    if (!didInitView.current) {
      setView(isInvitedMember ? "pessoa2" : "pessoa1");
      didInitView.current = true;
    }

    setProfileLoading(false);
  }, [user]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  useEffect(() => {
    if (!profileLoading && !hasPessoa2) setView("pessoa1");
  }, [profileLoading, hasPessoa2]);

  const greetingEmoji = emojis[view];

  const setGreetingEmoji = useCallback((emoji: string) => {
    setEmojis(prev => ({ ...prev, [view]: emoji }));
    if (!user) return;
    const col = EMOJI_COL_MAP[view];
    supabase
      .from("profiles")
      .update({ [col]: emoji } as any)
      .eq("user_id", user.id)
      .then();
  }, [user, view]);

  const greetingName = useMemo(() => {
    switch (view) {
      case "pessoa1": return nomePessoa1;
      case "pessoa2": return nomePessoa2;
      case "casal":
      case "geral":
        return `${nomePessoa1} e ${nomePessoa2}`;
      default: return nomePessoa1;
    }
  }, [view, nomePessoa1, nomePessoa2]);

  const activeAvatar = useMemo(() => {
    switch (view) {
      case "pessoa1": return fotoPessoa1;
      case "pessoa2": return fotoPessoa2;
      case "casal": return fotoCasal;
      case "geral": return fotoGeral;
      default: return "";
    }
  }, [view, fotoPessoa1, fotoPessoa2, fotoCasal, fotoGeral]);

  const labels = useMemo<Record<string, string>>(() => {
    const getCompartilhadoLabel = () => {
      switch (vinculo) {
        case "Cônjuge":
        case "Companheiro(a)":
          return "Casal";
        case "Sócio(a)":
          return "Sócios";
        case "Filho(a)":
        case "Familiar":
          return "Familiar";
        default:
          return "Consolidado";
      }
    };
    return {
      pessoa1: nomePessoa1,
      pessoa2: nomePessoa2,
      casal: getCompartilhadoLabel(),
      geral: "Geral",
    };
  }, [nomePessoa1, nomePessoa2, vinculo]);

  const value = useMemo<HouseholdViewContextType>(() => ({
    view, setView, labels, nomePessoa1, nomePessoa2, fotoPessoa1, fotoPessoa2, fotoCasal, fotoGeral,
    greetingName, activeAvatar, greetingEmoji, setGreetingEmoji, refreshPhotos: fetchProfile,
    profileLoading, hasPessoa2, vinculo,
  }), [view, setView, labels, nomePessoa1, nomePessoa2, fotoPessoa1, fotoPessoa2, fotoCasal, fotoGeral, greetingName, activeAvatar, greetingEmoji, setGreetingEmoji, fetchProfile, profileLoading, hasPessoa2, vinculo]);

  return (
    <HouseholdViewContext.Provider value={value}>
      {children}
    </HouseholdViewContext.Provider>
  );
};

export const useHouseholdView = () => useContext(HouseholdViewContext);
