import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, ListOrdered } from "lucide-react";

/**
 * Editor de texto rico leve (contentEditable) — negrito, itálico e tópicos.
 * Atalhos: Ctrl/Cmd+B (negrito), Ctrl/Cmd+I (itálico), "- " no início vira tópico.
 * Guarda o conteúdo como HTML. readOnly mostra só leitura (para operadores).
 */
export default function RichText({
  value, onChange, readOnly = false, placeholder,
}: { value: string; onChange?: (html: string) => void; readOnly?: boolean; placeholder?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  // Seta o HTML inicial só uma vez (e quando muda externamente em modo leitura)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value || "";
  }, [value]);

  const exec = (cmd: string) => { document.execCommand(cmd, false); ref.current?.focus(); emit(); };
  const emit = () => onChange?.(ref.current?.innerHTML || "");

  const onKeyDown = (e: React.KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "b") { e.preventDefault(); exec("bold"); }
    else if (mod && e.key.toLowerCase() === "i") { e.preventDefault(); exec("italic"); }
    else if (e.key === " ") {
      // "- " no começo da linha vira lista
      const sel = window.getSelection();
      const node = sel?.anchorNode;
      const text = node?.textContent?.slice(0, sel?.anchorOffset ?? 0) ?? "";
      if (text === "-" || text === "*") {
        e.preventDefault();
        if (node && node.nodeType === Node.TEXT_NODE) node.textContent = "";
        document.execCommand("insertUnorderedList", false);
        emit();
      }
    }
  };

  if (readOnly) {
    return value
      ? <div className="prose prose-sm max-w-none text-sm leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5" dangerouslySetInnerHTML={{ __html: value }} />
      : <p className="text-sm text-muted-foreground italic">Nenhuma instrução cadastrada ainda.</p>;
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="flex items-center gap-1 border-b bg-muted/30 p-1.5">
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onMouseDown={e => { e.preventDefault(); exec("bold"); }} title="Negrito (Ctrl/Cmd+B)"><Bold className="w-3.5 h-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onMouseDown={e => { e.preventDefault(); exec("italic"); }} title="Itálico (Ctrl/Cmd+I)"><Italic className="w-3.5 h-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onMouseDown={e => { e.preventDefault(); exec("insertUnorderedList"); }} title="Lista (- )"><List className="w-3.5 h-3.5" /></Button>
        <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onMouseDown={e => { e.preventDefault(); exec("insertOrderedList"); }} title="Lista numerada"><ListOrdered className="w-3.5 h-3.5" /></Button>
        <span className="ml-2 text-[11px] text-muted-foreground">Ctrl/Cmd+B, Ctrl/Cmd+I · “- ” vira tópico</span>
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onKeyDown={onKeyDown}
        data-placeholder={placeholder || "Escreva aqui o processo / instruções…"}
        className="min-h-[200px] p-3 text-sm leading-relaxed outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/60"
      />
    </div>
  );
}
