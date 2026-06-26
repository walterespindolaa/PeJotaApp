import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, Sparkles, BarChart3, Wallet, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { useVisualViewportHeight } from "@/hooks/useVisualViewportHeight";
import { useAtlasChatVisibility } from "@/contexts/AtlasChatVisibilityContext";
import { logError } from "@/lib/log";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/atlas-chat`;

export default function AtlasChatFAB({ initialQuestion }: { initialQuestion?: string }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { setChatOpen } = useAtlasChatVisibility();
  const [open, setOpen] = useState(false);

  useEffect(() => { setChatOpen(open); }, [open, setChatOpen]);
  const [expanded, setExpanded] = useState(false);

  // Visual Viewport tracks the real visible area (encolhe com teclado em iOS Safari E em PWA standalone).
  // Em PWA iOS dvh/100vh não respondem ao teclado virtual — por isso atrelamos altura do painel ao visualHeight.
  const visualHeight = useVisualViewportHeight();
  const keyboardOpen = isMobile && open && typeof window !== "undefined"
    && (window.innerHeight - visualHeight) > 100;

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [hasData, setHasData] = useState(true);
  const [hasNegativeProfit, setHasNegativeProfit] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const mesAtual = new Date().toISOString().slice(0, 7);
    Promise.all([
      supabase.from("receitas").select("valor").eq("user_id", user.id).gte("data", `${mesAtual}-01`),
      supabase.from("despesas").select("valor").eq("user_id", user.id).gte("data", `${mesAtual}-01`),
    ]).then(([r, d]) => {
      const totalR = (r.data || []).reduce((s: number, x: any) => s + Number(x.valor), 0);
      const totalD = (d.data || []).reduce((s: number, x: any) => s + Number(x.valor), 0);
      setHasData(totalR > 0 || totalD > 0);
      setHasNegativeProfit(totalR > 0 && totalR - totalD < 0);
    });
  }, [user]);

  const smartSuggestions = !hasData
    ? ["Como começar a organizar meu financeiro?", "O que devo registrar primeiro?", "Como montar minha reserva de emergência?"]
    : hasNegativeProfit
    ? ["Por que estou no vermelho?", "Como reduzir minhas despesas?", "Posso me aposentar no prazo?", "Como priorizar meus objetivos?"]
    : ["Posso trocar de carro?", "Posso fazer uma viagem esse ano?", "Posso me aposentar antes?", "Posso reduzir meus investimentos?"];

  useEffect(() => {
    if (initialQuestion && !open) {
      if (initialQuestion === "__open__") {
        setOpen(true);
      } else {
        setPendingQuestion(initialQuestion);
        setOpen(true);
      }
    }
  }, [initialQuestion]);

  useEffect(() => {
    if (open && pendingQuestion) {
      setInput(pendingQuestion);
      setPendingQuestion(null);
      setTimeout(() => {
        const form = document.getElementById("atlas-chat-form") as HTMLFormElement;
        if (form) form.requestSubmit();
      }, 100);
    }
  }, [open, pendingQuestion]);

  useEffect(() => {
    if (open && !isMobile && inputRef.current) inputRef.current.focus();
  }, [open, isMobile]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const getErrorMessage = (status: number, serverMessage?: string): string => {
    if (status === 429) return "Muitas mensagens em pouco tempo. Aguarde um momento e tente novamente.";
    if (status === 403) return "Este recurso requer uma assinatura ativa. Faça upgrade para continuar.";
    if (status === 401) return "Sua sessão expirou. Faça login novamente.";
    if (status === 402) return "Limite de uso atingido. Entre em contato com o suporte.";
    return serverMessage || "Não consegui processar sua mensagem. Tente novamente.";
  };

  const send = useCallback(async () => {
    if (!input.trim() || isLoading || !user) return;
    const userMsg: Msg = { role: "user", content: input.trim() };
    setInput("");
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    let assistantSoFar = "";
    try {
      const messagesWithContext = [...messages, userMsg];
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: messagesWithContext }),
      });
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        setMessages(prev => [...prev, { role: "assistant", content: `${getErrorMessage(resp.status, err.error)}` }]);
        setIsLoading(false);
        return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsert(content);
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      logError("Chat error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: "Erro de conexão. Tente novamente." }]);
    }
    setIsLoading(false);
  }, [input, isLoading, messages, user]);

  if (!user) return null;

  // Mobile: usa px do Visual Viewport (encolhe com teclado em iOS Safari E PWA standalone).
  // Quando teclado abre, força painel ao 100% do visualHeight pra evitar gap branco entre composer e teclado.
  const mobileHeightPx = expanded || keyboardOpen
    ? visualHeight
    : Math.round(visualHeight * 0.65);

  // Mobile: partial bottom sheet (expandable). Desktop: floating card.
  const chatPanel = open && (
    <div
      className={
        isMobile
          ? "fixed inset-x-0 bottom-0 z-50 bg-card flex flex-col animate-in slide-in-from-bottom-4 duration-200 rounded-t-2xl shadow-2xl border-t border-border w-full max-w-full box-border overflow-hidden"
          : "fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100dvh-6rem)] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-200"
      }
      style={isMobile ? {
        height: `${mobileHeightPx}px`,
        maxHeight: `${visualHeight}px`,
        paddingTop: (expanded || keyboardOpen) ? "env(safe-area-inset-top, 0px)" : undefined,
        transition: keyboardOpen ? "none" : "height 0.2s ease",
      } : undefined}
    >
      {/* Mobile drag handle */}
      {isMobile && (
        <div className="flex justify-center pt-2 pb-0 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-heading font-semibold">Assistente PeJota</span>
        </div>
        <div className="flex items-center gap-1">
          {isMobile && (
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={expanded ? "Minimizar assistente" : "Expandir assistente"} onClick={() => setExpanded(prev => !prev)}>
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Fechar assistente" onClick={() => { setOpen(false); setExpanded(false); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 overscroll-contain">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-3">
            <Sparkles className="h-8 w-8 text-primary/40 mx-auto" />
            <div>
              <p className="text-sm font-medium text-foreground">Seu planejador financeiro digital</p>
              <p className="text-xs text-muted-foreground mt-1">
                Analiso seus dados reais para te ajudar a tomar decisoes melhores sobre dinheiro, patrimonio e objetivos de vida.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {smartSuggestions.map(q => (
                <button key={q} onClick={() => setInput(q)}
                  className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] text-sm px-3 py-2 rounded-2xl ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md whitespace-pre-wrap"
                  : "bg-muted text-foreground rounded-bl-md"
              }`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                        em: ({ children }) => <em className="italic">{children}</em>,
                        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-1">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-1">{children}</ol>,
                        li: ({ children }) => <li>{children}</li>,
                        code: ({ children }) => <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>,
                        h1: ({ children }) => <h2 className="text-lg font-semibold mt-3 mb-2">{children}</h2>,
                        h2: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>,
                        h3: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1">{children}</h4>,
                        a: ({ children, href }) => <a href={href} className="text-primary underline" target="_blank" rel="noopener noreferrer">{children}</a>,
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </div>
            {msg.role === "assistant" && i === messages.length - 1 && !isLoading && (
              <div className="flex flex-wrap gap-1.5 mt-1.5 ml-1">
                 <Button
                   variant="outline"
                   size="sm"
                   className="h-7 text-[11px] px-2.5 gap-1"
                   onClick={() => { setOpen(false); navigate("/dashboard/renda-despesas"); }}
                 >
                   <Wallet className="h-3 w-3" /> Ver despesas
                 </Button>
                 <Button
                   variant="outline"
                   size="sm"
                   className="h-7 text-[11px] px-2.5 gap-1"
                   onClick={() => { setOpen(false); navigate("/dashboard/simulador-decisao"); }}
                 >
                   <BarChart3 className="h-3 w-3" /> Simular decisão
                 </Button>
              </div>
            )}
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-muted text-muted-foreground text-sm px-3 py-2 rounded-2xl rounded-bl-md flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Analisando seus dados...
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="p-3 border-t border-border flex-shrink-0" style={{ paddingBottom: isMobile ? (keyboardOpen ? "0.75rem" : "calc(0.75rem + env(safe-area-inset-bottom, 0px))") : undefined }}>
        <form id="atlas-chat-form" onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Pergunte algo..."
            className="text-sm h-9"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" className="h-9 w-9 flex-shrink-0" disabled={isLoading || !input.trim()}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      {/* FAB - hidden when chat is open */}
      {!open && !isMobile && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir Assistente PeJota"
          className="fixed z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.4)] hover:shadow-[0_6px_28px_-4px_hsl(var(--primary)/0.5)] backdrop-blur-sm transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95"
          style={{
            bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
            right: "1.5rem",
          }}
        >
          <Sparkles className="h-6 w-6" />
        </button>
      )}

      {chatPanel}
    </>
  );
}
