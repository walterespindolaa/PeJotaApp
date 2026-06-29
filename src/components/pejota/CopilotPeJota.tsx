import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, X, Send, Loader2, Building2 } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };
const SUGESTOES = ["Como está meu caixa?", "Quais contas vencem essa semana?", "Quanto faturei esse mês?", "Tenho contas atrasadas?"];

export default function CopilotPeJota() {
  const { selected } = useCompanies();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, loading]);

  const enviar = async (texto?: string) => {
    const q = (texto ?? input).trim();
    if (!q || loading) return;
    if (!selected) { setMsgs(m => [...m, { role: "assistant", content: "Selecione uma empresa primeiro para eu olhar os números dela." }]); return; }
    const novo: Msg[] = [...msgs, { role: "user", content: q }];
    setMsgs(novo); setInput(""); setLoading(true);
    const { data, error } = await supabase.functions.invoke("pejota-copilot", { body: { company_id: selected.id, messages: novo } });
    setLoading(false);
    if (error || data?.error) {
      const msg = data?.error === "ia_nao_configurada" ? "A IA ainda não foi configurada (falta a chave OpenAI no servidor)." : (data?.error || error?.message || "Não consegui responder agora.");
      setMsgs(m => [...m, { role: "assistant", content: msg }]); return;
    }
    setMsgs(m => [...m, { role: "assistant", content: data.reply }]);
  };

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Copiloto PeJota"
        className="fixed bottom-24 right-4 sm:bottom-6 sm:right-6 z-[70] w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-elevated grid place-items-center hover:scale-105 transition-transform"
      >
        {open ? <X className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
      </button>

      {open && (
        <div className="fixed bottom-40 right-4 sm:bottom-24 sm:right-6 z-[70] w-[calc(100vw-2rem)] sm:w-96 max-w-md h-[60vh] sm:h-[520px] bg-card border rounded-2xl shadow-elevated flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 p-3 border-b bg-primary/5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary grid place-items-center"><Sparkles className="w-4 h-4" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Copiloto PeJota</p>
              <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1"><Building2 className="w-3 h-3" />{selected ? selected.name : "Nenhuma empresa selecionada"}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {msgs.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Pergunte sobre o seu negócio — eu olho os números reais da empresa selecionada.</p>
                <div className="flex flex-wrap gap-2">
                  {SUGESTOES.map(s => <button key={s} onClick={() => enviar(s)} className="text-xs border rounded-full px-3 py-1.5 hover:bg-muted/50">{s}</button>)}
                </div>
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{m.content}</div>
              </div>
            ))}
            {loading && <div className="flex justify-start"><div className="bg-muted rounded-2xl px-3 py-2"><Loader2 className="w-4 h-4 animate-spin" /></div></div>}
            <div ref={endRef} />
          </div>

          <div className="p-3 border-t flex gap-2">
            <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") enviar(); }} placeholder="Pergunte algo…" />
            <Button size="icon" onClick={() => enviar()} disabled={loading || !input.trim()}><Send className="w-4 h-4" /></Button>
          </div>
        </div>
      )}
    </>
  );
}
