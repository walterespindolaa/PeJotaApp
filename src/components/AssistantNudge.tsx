import { useState, useEffect, useCallback, useRef } from "react";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const COOLDOWN_MS = 10 * 60 * 1000;
const DISPLAY_MS = 4000;
const MAX_PER_SESSION = 3;
const DISABLE_KEY = "atlas_nudge_disabled_until";
const SESSION_KEY = "atlas_nudge_session_count";
const LAST_SHOWN_KEY = "atlas_nudge_last_shown";

interface Props {
  chatOpen: boolean;
  onOpenChat: () => void;
}

export default function AssistantNudge({ chatOpen, onOpenChat }: Props) {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState("Quer entender seus números?");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const isTyping = useCallback(() => {
    const active = document.activeElement;
    return active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
  }, []);

  const fetchContextText = useCallback(async () => {
    if (!user) return "Quer entender seus números?";
    const mesAtual = new Date().toISOString().slice(0, 7);
    const [r, d] = await Promise.all([
      supabase.from("receitas").select("valor").eq("user_id", user.id).gte("data", `${mesAtual}-01`),
      supabase.from("despesas").select("valor").eq("user_id", user.id).gte("data", `${mesAtual}-01`),
    ]);
    const totalR = (r.data || []).reduce((s: number, x: any) => s + Number(x.valor), 0);
    const totalD = (d.data || []).reduce((s: number, x: any) => s + Number(x.valor), 0);
    if (totalR === 0 && totalD === 0) return "Quer ajuda pra começar?";
    if (totalR > 0 && totalR - totalD < 0) return "Posso te ajudar a sair do vermelho.";
    return "Quer entender seus números?";
  }, [user]);

  const shouldShow = useCallback(() => {
    if (chatOpen) return false;
    if (isTyping()) return false;
    const disabledUntil = localStorage.getItem(DISABLE_KEY);
    if (disabledUntil && Date.now() < Number(disabledUntil)) return false;
    const sessionCount = Number(sessionStorage.getItem(SESSION_KEY) || "0");
    if (sessionCount >= MAX_PER_SESSION) return false;
    const lastShown = Number(localStorage.getItem(LAST_SHOWN_KEY) || "0");
    if (Date.now() - lastShown < COOLDOWN_MS) return false;
    return true;
  }, [chatOpen, isTyping]);

  const showNudge = useCallback(async () => {
    if (!shouldShow()) return;
    const contextText = await fetchContextText();
    setText(contextText);
    setVisible(true);
    const count = Number(sessionStorage.getItem(SESSION_KEY) || "0");
    sessionStorage.setItem(SESSION_KEY, String(count + 1));
    localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
    hideTimerRef.current = setTimeout(() => setVisible(false), DISPLAY_MS);
  }, [shouldShow, fetchContextText]);

  useEffect(() => {
    if (!user) return;
    const initialDelay = setTimeout(() => {
      showNudge();
      timerRef.current = setInterval(showNudge, COOLDOWN_MS);
    }, 2 * 60 * 1000);
    return () => {
      clearTimeout(initialDelay);
      if (timerRef.current) clearInterval(timerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [user, showNudge]);

  useEffect(() => {
    if (chatOpen) setVisible(false);
  }, [chatOpen]);

  const handleClick = () => {
    setVisible(false);
    localStorage.setItem(DISABLE_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    onOpenChat();
  };

  if (!visible) return null;

  return (
    <button
      onClick={handleClick}
      aria-label="Abrir Assistente PeJota"
      className="fixed z-50 left-0 right-0 mx-auto w-fit lg:left-auto lg:right-6 lg:mx-0 flex items-center gap-2 px-3 py-2 rounded-2xl bg-primary text-primary-foreground shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.4)] animate-in slide-in-from-bottom-2 fade-in duration-300 hover:scale-105 transition-transform max-w-[240px]"
      style={{
        bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <Sparkles className="h-4 w-4 flex-shrink-0" />
      <span className="text-xs font-medium leading-tight">{text}</span>
    </button>
  );
}
