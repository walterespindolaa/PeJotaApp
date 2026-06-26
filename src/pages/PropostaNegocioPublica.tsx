import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Building2, FileText, CheckCircle2, XCircle, Pencil, ExternalLink, CreditCard } from "lucide-react";

interface Item { label: string; descricao: string | null; valor: number; quantidade: number; }
interface ProposalData {
  titulo: string | null; terms: string | null; valid_until: string | null; desconto: number;
  status: string; client_comment: string | null; payment_method: string | null; installments: number; items: Item[];
  company: { name: string | null; logo_url: string | null; brand_color: string | null; media_kit_url: string | null } | null;
}

const brl = (n: number) => `R$ ${Number(n || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function PropostaNegocioPublica() {
  const { token } = useParams();
  const [data, setData] = useState<ProposalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [action, setAction] = useState<"none" | "reject" | "adjust">("none");
  const [comment, setComment] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const { data: res } = await supabase.rpc("get_business_proposal" as any, { _token: token });
    if (!res) { setNotFound(true); } else { setData(res as unknown as ProposalData); }
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const accent = data?.company?.brand_color || "#4F7942";

  const subtotal = (data?.items || []).reduce((s, i) => s + Number(i.valor) * Number(i.quantidade || 1), 0);
  const total = Math.max(0, subtotal - Number(data?.desconto || 0));

  const accept = async () => {
    await supabase.rpc("accept_business_proposal" as any, { _token: token });
    setDone("aceita");
  };
  const reject = async () => {
    await supabase.rpc("reject_business_proposal" as any, { _token: token, _motivo: comment.trim() || null });
    setDone("recusada");
  };
  const adjust = async () => {
    await supabase.rpc("request_business_proposal_change" as any, { _token: token, _comment: comment.trim() });
    setDone("ajuste");
  };

  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-muted/30"><div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" /></div>;
  }
  if (notFound || !data) {
    return <div className="min-h-screen grid place-items-center bg-muted/30 px-6 text-center"><p className="text-sm text-muted-foreground">Proposta não encontrada ou expirada.</p></div>;
  }

  const finalState = done || (["aceita", "recusada"].includes(data.status) ? data.status : null);

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Header com branding */}
        <div className="rounded-t-2xl p-5 text-white" style={{ backgroundColor: accent }}>
          <div className="flex items-center gap-3">
            {data.company?.logo_url
              ? <img src={data.company.logo_url} alt="" className="w-12 h-12 rounded-xl object-cover bg-white/20" />
              : <span className="w-12 h-12 rounded-xl bg-white/20 grid place-items-center"><Building2 className="h-6 w-6" /></span>}
            <div className="min-w-0">
              <p className="text-xs opacity-80">Proposta de</p>
              <p className="font-heading font-bold text-lg truncate">{data.company?.name || "Empresa"}</p>
            </div>
          </div>
          {data.titulo && <p className="mt-3 font-medium">{data.titulo}</p>}
        </div>

        <div className="bg-card rounded-b-2xl border border-border/60 p-5 space-y-4">
          {/* Itens */}
          <div className="space-y-2">
            {data.items.map((it, i) => (
              <div key={i} className="flex items-start justify-between gap-2 text-sm border-b border-border/40 pb-2 last:border-0">
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{it.label}{it.quantidade > 1 ? ` ×${it.quantidade}` : ""}</p>
                  {it.descricao && <p className="text-xs text-muted-foreground">{it.descricao}</p>}
                </div>
                <span className="font-medium flex-shrink-0">{brl(Number(it.valor) * Number(it.quantidade || 1))}</span>
              </div>
            ))}
            {data.desconto > 0 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Desconto</span><span>− {brl(data.desconto)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2">
              <span className="font-heading font-bold">Total</span>
              <span className="font-heading font-bold text-xl" style={{ color: accent }}>{brl(total)}</span>
            </div>
            {data.payment_method && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CreditCard className="h-3.5 w-3.5" style={{ color: accent }} />
                <span>
                  {data.payment_method === "pix" && "Pagamento via PIX"}
                  {data.payment_method === "cartao" && `Cartão em até ${data.installments}x de ${brl(total / Math.max(1, data.installments))}`}
                  {data.payment_method === "ambos" && `PIX ou cartão em até ${data.installments}x de ${brl(total / Math.max(1, data.installments))}`}
                </span>
              </div>
            )}
          </div>

          {data.terms && <p className="text-xs text-muted-foreground whitespace-pre-line">{data.terms}</p>}
          {data.valid_until && <p className="text-[11px] text-muted-foreground">Válida até {data.valid_until.split("-").reverse().join("/")}</p>}

          {data.company?.media_kit_url && (
            <a href={data.company.media_kit_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border/60 hover:bg-muted/50 text-sm">
              <FileText className="h-4 w-4" style={{ color: accent }} />
              <span className="flex-1">Ver portfólio / media kit</span>
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
          )}

          {/* Ações / Estado */}
          {finalState ? (
            <div className="rounded-xl bg-muted/40 p-4 text-center text-sm">
              {finalState === "aceita" && <p className="text-success font-medium flex items-center justify-center gap-1.5"><CheckCircle2 className="h-4 w-4" />Proposta aceita! 🎉</p>}
              {finalState === "recusada" && <p className="text-destructive font-medium flex items-center justify-center gap-1.5"><XCircle className="h-4 w-4" />Proposta recusada.</p>}
              {finalState === "ajuste" && <p className="text-amber-600 font-medium">Pedido de ajuste enviado. A empresa vai te retornar.</p>}
            </div>
          ) : action === "none" ? (
            <div className="space-y-2 pt-1">
              <Button onClick={accept} className="w-full" style={{ backgroundColor: accent }}>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />Aceitar proposta
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setAction("adjust")}><Pencil className="h-4 w-4 mr-1.5" />Pedir ajuste</Button>
                <Button variant="outline" className="flex-1 text-destructive" onClick={() => setAction("reject")}><XCircle className="h-4 w-4 mr-1.5" />Recusar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
                placeholder={action === "adjust" ? "O que você gostaria de ajustar?" : "Conte o motivo (opcional)"} />
              <div className="flex gap-2">
                <Button variant="ghost" className="flex-1" onClick={() => { setAction("none"); setComment(""); }}>Voltar</Button>
                <Button className="flex-1" style={{ backgroundColor: accent }}
                  onClick={action === "adjust" ? adjust : reject}
                  disabled={action === "adjust" && !comment.trim()}>
                  Enviar
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-muted-foreground mt-4">Proposta gerada via Atlas</p>
      </div>
    </div>
  );
}
