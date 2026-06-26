import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { logError } from "@/lib/log";

type ReportType = "planejamento_360" | "financeiro" | "conselheiro" | "diagnostico_atlas";

// Capa de PDF por relatório (Método Atlas). Suba os arquivos em public/images/capas/.
// Faz fallback pra capa padrão e depois pra capa pintada caso o arquivo não exista.
const DEFAULT_COVER = "/images/atlas_report_cover.webp";
const COVER_BY_TYPE: Record<ReportType, string> = {
  conselheiro: "/images/capa-guia-da-jornada.jpg",        // Guia da Jornada
  financeiro: "/images/capa-controle-da-jornada.jpg",      // Controle da Jornada
  planejamento_360: "/images/capa-estrategia-de-subida.jpg", // Estratégia de Subida
  diagnostico_atlas: "/images/capa-base-da-montanha.jpg",  // Base da Montanha
};

// Nome de exibição de cada relatório (usado no nome do arquivo do PDF).
const REPORT_TITLE: Record<ReportType, string> = {
  conselheiro: "Guia da Jornada",
  financeiro: "Controle da Jornada",
  planejamento_360: "Estratégia de Subida",
  diagnostico_atlas: "Base da Montanha",
};

export function useReportPersistence(reportType: ReportType) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [userName, setUserName] = useState("");

  // Primeiro nome do usuário (pro nome do arquivo PDF)
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, nome_pessoa1").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        const n = (((data as any)?.full_name || (data as any)?.nome_pessoa1 || "") as string).trim();
        if (n) setUserName(n.split(/\s+/)[0]);
      });
  }, [user]);

  // Load saved report
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("life_reports" as any)
        .select("content, generated_at")
        .eq("user_id", user.id)
        .eq("report_type", reportType)
        .maybeSingle();
      if ((data as any)?.content) {
        setContent((data as any).content);
        setGeneratedAt((data as any).generated_at);
      }
      setInitialLoading(false);
    })();
  }, [user, reportType]);

  const generateReport = useCallback(async (functionUrl: string, body: Record<string, unknown> = {}) => {
    if (!user) return;
    setLoading(true);
    setContent("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const doFetch = () => fetch(functionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      // 429 do gateway de IA costuma ser transitório (pico de uso) — tenta de novo
      // automaticamente antes de incomodar o usuário (até 2 tentativas: ~2,5s e ~5s).
      let resp = await doFetch();
      for (let attempt = 0; attempt < 2 && resp.status === 429; attempt++) {
        await new Promise(r => setTimeout(r, 2500 * (attempt + 1)));
        resp = await doFetch();
      }

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) toast({ title: "Tente de novo em instantes", description: "Nosso gerador de relatórios está com alta demanda agora. Já já normaliza." });
        else if (resp.status === 402) toast({ title: "Créditos insuficientes", variant: "destructive" });
        else toast({ title: "Erro ao gerar relatório", variant: "destructive" });
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let fullContent = "";

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
            const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (delta) { fullContent += delta; setContent(fullContent); }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      // Flush remaining
      for (const raw of textBuffer.split("\n")) {
        if (!raw || !raw.startsWith("data: ")) continue;
        const jsonStr = raw.replace(/\r$/, "").slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (delta) { fullContent += delta; setContent(fullContent); }
        } catch { /* ignore */ }
      }

      // Persist
      const now = new Date().toISOString();
      const { data: existing } = await supabase
        .from("life_reports" as any)
        .select("id")
        .eq("user_id", user.id)
        .eq("report_type", reportType)
        .maybeSingle();

      if ((existing as any)?.id) {
        await supabase.from("life_reports" as any)
          .update({ content: fullContent, generated_at: now, updated_at: now } as any)
          .eq("user_id", user.id)
          .eq("report_type", reportType);
      } else {
        await supabase.from("life_reports" as any)
          .insert({ user_id: user.id, content: fullContent, generated_at: now, report_type: reportType } as any);
      }
      setGeneratedAt(now);
    } catch (e: any) {
      logError("Report generation error:", e);
      toast({ title: "Erro ao gerar relatório", description: e?.message || "Tente novamente.", variant: "destructive" });
    }
    setLoading(false);
  }, [user, reportType, toast]);

  /**
   * Universal Atlas PDF export with:
   * - Cover page (atlas_report_cover.png)
   * - Section-by-section rendering with smart page breaks
   * - Slicing for oversized sections
   */
  const downloadPDF = useCallback(async (elementId: string) => {
    const el = document.getElementById(elementId);
    if (!el) return;

    toast({ title: "Gerando PDF..." });

    // Overlay cobre a tela durante a captura: o #report-content é redimensionado
    // pra 760px (a página reflui), e o overlay esconde esse "pulo" do usuário.
    const overlay = document.createElement("div");
    overlay.setAttribute("aria-hidden", "true");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(244,241,236,0.97);backdrop-filter:blur(2px);font-family:Outfit,system-ui,sans-serif;color:#4A4035;";
    overlay.innerHTML =
      '<div style="text-align:center"><div style="width:40px;height:40px;margin:0 auto 12px;border:3px solid #E0D9CC;border-top-color:#4A4035;border-radius:50%;animation:atlasspin 0.9s linear infinite"></div>' +
      '<div style="font-size:14px;font-weight:600">Gerando PDF…</div>' +
      '<div style="font-size:12px;opacity:0.7;margin-top:4px">Isso leva alguns segundos</div></div>' +
      '<style>@keyframes atlasspin{to{transform:rotate(360deg)}}</style>';
    document.body.appendChild(overlay);

    let prevWidth = "";
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { default: jsPDF } = await import("jspdf");

      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableW = pageW - margin * 2;
      const usableH = pageH - margin * 2;

      // ── Page 1: Cover image (capa por relatório, com fallback) ──
      const coverCandidates = [COVER_BY_TYPE[reportType], DEFAULT_COVER];
      let coverDrawn = false;
      for (const src of coverCandidates) {
        try {
          const coverImg = new Image();
          coverImg.crossOrigin = "anonymous";
          await new Promise<void>((resolve, reject) => {
            coverImg.onload = () => resolve();
            coverImg.onerror = () => reject();
            coverImg.src = src;
          });
          const fmt = /\.png$/i.test(src) ? "PNG" : /\.jpe?g$/i.test(src) ? "JPEG" : "WEBP";
          const imgRatio = coverImg.naturalWidth / coverImg.naturalHeight;
          const pageRatio = pageW / pageH;
          let drawW = pageW, drawH = pageH, drawX = 0, drawY = 0;
          if (imgRatio > pageRatio) { drawH = pageW / imgRatio; drawY = (pageH - drawH) / 2; }
          else { drawW = pageH * imgRatio; drawX = (pageW - drawW) / 2; }
          pdf.addImage(coverImg, fmt, drawX, drawY, drawW, drawH);
          coverDrawn = true;
          break;
        } catch {
          // tenta o próximo candidato
        }
      }
      if (!coverDrawn) {
        // Fallback cover pintado
        pdf.setFillColor(67, 76, 94);
        pdf.rect(0, 0, pageW, pageH, "F");
        pdf.setTextColor(255, 255, 255);
        pdf.setFontSize(32);
        pdf.text("ATLAS", pageW / 2, pageH / 2 - 20, { align: "center" });
        pdf.setFontSize(14);
        pdf.text("Relatório Premium", pageW / 2, pageH / 2 + 5, { align: "center" });
      }

      // ── Page 2+: Report content ──
      pdf.addPage();

      // Mark PDF-mode: show static versions, hide interactive ones
      el.classList.add("atlas-pdf-export");
      prevWidth = el.style.width;
      // Render at a fixed width below windowWidth (800) so the responsive
      // chart fits usableW; the delay lets the ResizeObserver re-measure
      // before html2canvas captures.
      el.style.width = "760px";
      await new Promise((r) => setTimeout(r, 400));

      // Blocos atômicos = cada seção/card. "Achatamos" wrappers de agrupamento
      // (prose / space-y) pra paginar SEÇÃO por SEÇÃO. Cada bloco é capturado e
      // posicionado como uma unidade — nada de uma seção é cortado.
      const isWrapper = (elm: HTMLElement) => {
        const cls = typeof elm.className === "string" ? elm.className : "";
        return /(^|\s)prose|space-y-/.test(cls);
      };
      const collectBlocks = (parent: HTMLElement, depth: number): HTMLElement[] => {
        const out: HTMLElement[] = [];
        for (const child of Array.from(parent.children) as HTMLElement[]) {
          if (child.offsetHeight === 0) continue;
          if (depth < 4 && isWrapper(child) && child.children.length > 1) {
            out.push(...collectBlocks(child, depth + 1));
          } else {
            out.push(child);
          }
        }
        return out;
      };
      const blocks = collectBlocks(el, 0);

      let currentY = margin;
      let pageHasContent = false;
      for (const block of blocks) {
        if (block.offsetHeight === 0) continue;
        const canvas = await html2canvas(block, {
          scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false, windowWidth: 800,
        });
        const imgH = (canvas.height * usableW) / canvas.width;

        if (imgH <= usableH) {
          // Cabe numa página: se não couber no resto, quebra antes (mantém inteiro).
          if (pageHasContent && currentY + imgH > pageH - margin) {
            pdf.addPage(); currentY = margin; pageHasContent = false;
          }
          pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", margin, currentY, usableW, imgH);
          currentY += imgH + 4;
          pageHasContent = true;
        } else {
          // Bloco maior que a página inteira: começa numa página limpa e fatia.
          if (pageHasContent) { pdf.addPage(); currentY = margin; }
          const pxPerMm = canvas.width / usableW;
          let srcY = 0;
          let firstChunk = true;
          while (srcY < canvas.height) {
            if (!firstChunk) { pdf.addPage(); currentY = margin; }
            const sliceMm = (pageH - margin) - currentY;
            const slicePx = Math.min(Math.floor(sliceMm * pxPerMm), canvas.height - srcY);
            const sc = document.createElement("canvas");
            sc.width = canvas.width; sc.height = slicePx;
            const sctx = sc.getContext("2d")!;
            sctx.fillStyle = "#ffffff"; sctx.fillRect(0, 0, sc.width, sc.height);
            sctx.drawImage(canvas, 0, srcY, canvas.width, slicePx, 0, 0, canvas.width, slicePx);
            pdf.addImage(sc.toDataURL("image/jpeg", 0.92), "JPEG", margin, currentY, usableW, slicePx / pxPerMm);
            currentY += slicePx / pxPerMm + 2;
            srcY += slicePx;
            firstChunk = false;
          }
          pageHasContent = true;
        }
      }

      const _d = new Date();
      const _data = `${String(_d.getDate()).padStart(2, "0")}-${String(_d.getMonth() + 1).padStart(2, "0")}`;
      const _fileName = [REPORT_TITLE[reportType], userName, _data].filter(Boolean).join(" - ");
      pdf.save(`${_fileName}.pdf`);
      toast({ title: "PDF baixado com sucesso ✓" });
    } catch (err) {
      logError("PDF error:", err);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      // Always restore the live layout, even on error
      el.classList.remove("atlas-pdf-export");
      el.style.width = prevWidth;
      overlay.remove();
    }
  }, [toast, reportType, userName]);

  return { content, setContent, loading, initialLoading, generatedAt, generateReport, downloadPDF };
}
