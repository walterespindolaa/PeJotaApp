import { useRef, useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useHouseholdView } from "@/contexts/HouseholdViewContext";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Camera, Trash2, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { NavLink } from "react-router-dom";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const AVATAR_MAX_DIM = 512;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/** Compress & resize image client-side before upload */
const compressImage = (file: File, maxDim: number, quality = 0.85): Promise<Blob> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/webp",
        quality,
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });

/** Map view → DB column name and storage path segment */
const VIEW_PHOTO_MAP: Record<string, { field: string; pathSegment: string }> = {
  pessoa1: { field: "foto_pessoa1", pathSegment: "pessoa1" },
  pessoa2: { field: "foto_pessoa2", pathSegment: "pessoa2" },
  casal: { field: "foto_casal", pathSegment: "casal" },
  geral: { field: "foto_geral", pathSegment: "geral" },
};

const SidebarUserCard = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const { greetingName, activeAvatar, view, refreshPhotos, greetingEmoji } = useHouseholdView();
  const [uploading, setUploading] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string | null>(null);

  // Reset local override when view changes
  const [lastView, setLastView] = useState(view);
  if (view !== lastView) {
    setLocalAvatar(null);
    setLastView(view);
  }

  const displayAvatar = localAvatar ?? activeAvatar;
  const displayName = greetingName || "Pessoa 1";

  const initials = useMemo(() => {
    const parts = displayName.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : displayName.slice(0, 2).toUpperCase();
  }, [displayName]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!ACCEPTED.includes(file.type)) {
      toast({ title: "Formato inválido", description: "Use JPG, PNG ou WEBP.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_SIZE) {
      toast({ title: "Arquivo muito grande", description: "Máximo 10 MB.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const compressed = await compressImage(file, AVATAR_MAX_DIM);
      const mapping = VIEW_PHOTO_MAP[view] || VIEW_PHOTO_MAP.pessoa1;
      const path = `${user.id}/${mapping.pathSegment}.webp`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, compressed, { upsert: true, contentType: "image/webp" });

      if (upErr) {
        toast({ title: "Erro no upload", description: upErr.message, variant: "destructive" });
        setUploading(false);
        return;
      }

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;

      await supabase.from("profiles").update({ [mapping.field]: url }).eq("user_id", user.id);
      setLocalAvatar(url);
      refreshPhotos();
      setPopoverOpen(false);
      toast({ title: "Foto atualizada!" });
    } catch {
      toast({ title: "Erro ao processar imagem", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!user) return;
    const mapping = VIEW_PHOTO_MAP[view] || VIEW_PHOTO_MAP.pessoa1;
    await supabase.from("profiles").update({ [mapping.field]: "" }).eq("user_id", user.id);
    setLocalAvatar("");
    refreshPhotos();
    setPopoverOpen(false);
    toast({ title: "Foto removida" });
  };

  return (
    <div className="px-5 py-5 flex flex-col items-center gap-3">
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleUpload}
      />

      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            className="relative flex-shrink-0 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            disabled={uploading}
          >
            <Avatar className="h-[88px] w-[88px] border-2 border-sidebar-border/40">
              {displayAvatar ? (
                <AvatarImage src={displayAvatar} alt="Avatar" />
              ) : null}
              <AvatarFallback className="bg-sidebar-accent text-sidebar-foreground text-2xl font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-sidebar/60">
                <div className="h-5 w-5 border-2 border-sidebar-foreground/40 border-t-sidebar-primary rounded-full animate-spin" />
              </div>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          side="right"
          align="start"
          className="w-44 p-1.5 bg-sidebar border-sidebar-border"
        >
          <button
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-colors"
            onClick={() => { fileRef.current?.click(); setPopoverOpen(false); }}
          >
            <Camera className="h-4 w-4" /> Trocar foto
          </button>
          {displayAvatar && (
            <button
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-colors"
              onClick={handleRemove}
            >
              <Trash2 className="h-4 w-4" /> Remover foto
            </button>
          )}
          <NavLink
            to="/dashboard/perfil"
            onClick={() => { setPopoverOpen(false); onNavigate?.(); }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground transition-colors"
          >
            <User className="h-4 w-4" /> Meu perfil
          </NavLink>
        </PopoverContent>
      </Popover>

      <p className="text-[13px] font-heading font-semibold text-sidebar-foreground leading-tight text-center">
        Olá, {displayName}! {greetingEmoji}
      </p>
    </div>
  );
};

export default SidebarUserCard;
