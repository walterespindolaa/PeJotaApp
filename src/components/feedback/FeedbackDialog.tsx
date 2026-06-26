import { useEffect, useState } from "react";
import ResponsiveEditDialog from "@/components/ui/responsive-edit-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ImagePlus, Loader2, Send, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

async function compressImage(file: File, maxWidth = 1920, quality = 0.8): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Falha ao carregar imagem"));
      img.onload = () => {
        const scale = Math.min(1, maxWidth / img.width);
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas sem contexto"));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error("Falha ao comprimir"));
              return;
            }
            const compressed = new File([blob], file.name.replace(/\.\w+$/, ".jpg"), {
              type: "image/jpeg",
              lastModified: Date.now(),
            });
            resolve(compressed);
          },
          "image/jpeg",
          quality
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const CATEGORIES: { value: string; label: string }[] = [
  { value: "melhoria", label: "Sugestão de melhoria" },
  { value: "ideia", label: "Ideia nova" },
  { value: "bug", label: "Bug / problema técnico" },
  { value: "elogio", label: "Elogio" },
  { value: "cobrança", label: "Problema com cobrança" },
  { value: "outro", label: "Outro" },
];

const URGENCIES: { value: string; label: string }[] = [
  { value: "baixa", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "urgente", label: "Urgente" },
];

const URGENCY_CATEGORIES = new Set(["bug", "cobrança", "outro"]);

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const FeedbackDialog = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [category, setCategory] = useState("melhoria");
  const [urgency, setUrgency] = useState("normal");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ title?: string; description?: string }>({});
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [compressing, setCompressing] = useState(false);

  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setCategory("melhoria");
    setUrgency("normal");
    setTitle("");
    setDescription("");
    setErrors({});
    previews.forEach((p) => URL.revokeObjectURL(p));
    setFiles([]);
    setPreviews([]);
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    const remaining = 5 - files.length;
    const toProcess = selected.slice(0, remaining);

    if (selected.length > remaining) {
      toast({
        title: "Máximo 5 imagens",
        description: `${selected.length - remaining} imagem(ns) não foram adicionadas.`,
      });
    }

    setCompressing(true);
    try {
      const compressed: File[] = [];
      const newPreviews: string[] = [];
      for (const f of toProcess) {
        if (f.size > 10 * 1024 * 1024) {
          toast({
            title: "Imagem muito grande",
            description: `${f.name} passa de 10MB — ignorada.`,
            variant: "destructive",
          });
          continue;
        }
        const c = await compressImage(f);
        compressed.push(c);
        newPreviews.push(URL.createObjectURL(c));
      }
      setFiles((prev) => [...prev, ...compressed]);
      setPreviews((prev) => [...prev, ...newPreviews]);
    } catch (err) {
      toast({
        title: "Erro ao processar imagem",
        description: err instanceof Error ? err.message : "erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setCompressing(false);
    }
    e.target.value = "";
  };

  const removeImage = (i: number) => {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => {
      URL.revokeObjectURL(prev[i]);
      return prev.filter((_, idx) => idx !== i);
    });
  };

  const handleClose = (v: boolean) => {
    if (!v) resetForm();
    onOpenChange(v);
  };

  const handleSubmit = async () => {
    const nextErrors: typeof errors = {};
    if (!title.trim()) nextErrors.title = "Título é obrigatório.";
    if (description.trim().length < 10) nextErrors.description = "Descreva com pelo menos 10 caracteres.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (!user) return;

    setSubmitting(true);
    try {
      const attachmentPaths: string[] = [];
      for (const [i, file] of files.entries()) {
        const path = `${user.id}/${Date.now()}-${i}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("feedback-attachments")
          .upload(path, file, {
            contentType: "image/jpeg",
            cacheControl: "3600",
          });
        if (upErr) throw upErr;
        attachmentPaths.push(path);
      }

      const [profileRes, subRes] = await Promise.all([
        supabase.from("profiles").select("nome_pessoa1").eq("user_id", user.id).maybeSingle(),
        supabase.from("user_subscriptions").select("plan_tier").eq("user_id", user.id).maybeSingle(),
      ]);

      const userName = profileRes.data?.nome_pessoa1 ?? null;
      const userPlan = subRes.data?.plan_tier ?? null;

      const { data: inserted, error } = await (supabase as any)
        .from("user_feedback")
        .insert({
          user_id: user.id,
          user_email: user.email,
          user_name: userName,
          user_plan: userPlan,
          category,
          urgency: URGENCY_CATEGORIES.has(category) ? urgency : "normal",
          title: title.trim(),
          description: description.trim(),
          page_url: window.location.pathname,
          user_agent: navigator.userAgent,
          attachments: attachmentPaths,
        })
        .select()
        .single();

      if (error) throw error;

      supabase.functions
        .invoke("notify-urgent-feedback", { body: { feedback_id: (inserted as any).id } })
        .catch(() => {});

      toast({ title: "Feedback enviado!", description: "Obrigado por contribuir." });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: "Erro ao enviar",
        description: err instanceof Error ? err.message : "erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const footer = (
    <>
      <Button variant="outline" size="sm" onClick={() => handleClose(false)} disabled={submitting}>
        Cancelar
      </Button>
      <Button size="sm" onClick={handleSubmit} disabled={submitting || compressing} className="gap-1.5">
        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        Enviar
      </Button>
    </>
  );

  return (
    <ResponsiveEditDialog
      open={open}
      onOpenChange={handleClose}
      title="Enviar feedback"
      footer={footer}
    >
      <div>
        <Label className="text-xs">Categoria</Label>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {URGENCY_CATEGORIES.has(category) && (
        <div>
          <Label className="text-xs">Urgência</Label>
          <Select value={urgency} onValueChange={setUrgency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {URGENCIES.map((u) => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label className="text-xs">Título</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Resumo curto do que aconteceu"
          maxLength={120}
        />
        {errors.title && <p className="text-[11px] text-destructive mt-1">{errors.title}</p>}
      </div>

      <div>
        <Label className="text-xs">Descrição</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva com detalhes — o que aconteceu, o que você esperava, passos pra reproduzir"
          maxLength={2000}
          rows={5}
        />
        <p className="text-[11px] text-muted-foreground mt-1">{description.length}/2000</p>
        {errors.description && <p className="text-[11px] text-destructive mt-1">{errors.description}</p>}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Imagens (opcional)</Label>
        <p className="text-[11px] text-muted-foreground">
          Até 5 prints ou fotos que ajudem a explicar. Formatos: PNG, JPG, WebP. Tamanho reduzido automaticamente.
        </p>

        {previews.length > 0 && (
          <div className="grid grid-cols-5 gap-2">
            {previews.map((src, i) => (
              <div key={src} className="relative aspect-square rounded-md overflow-hidden border border-border bg-muted">
                <img src={src} alt={`Print ${i + 1}`} className="w-full h-full object-cover" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-5 w-5"
                  onClick={() => removeImage(i)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}

        {previews.length < 5 && (
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={handleFilesSelected}
              disabled={compressing}
            />
            <Button type="button" variant="outline" size="sm" asChild disabled={compressing}>
              <span>
                {compressing ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Processando...</>
                ) : (
                  <><ImagePlus className="h-3.5 w-3.5 mr-1" /> Adicionar imagem ({previews.length}/5)</>
                )}
              </span>
            </Button>
          </label>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Seu feedback é lido por nossa equipe. Respostas a dúvidas urgentes são priorizadas.
      </p>
    </ResponsiveEditDialog>
  );
};

export default FeedbackDialog;