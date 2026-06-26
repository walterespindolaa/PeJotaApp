import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Palette, Moon, Sun, Monitor, Check } from "lucide-react";



const SIDEBAR_THEMES = [
  { id: "default", label: "Azul Atlas", hsl: "206 64% 20%", category: "Institucionais" },
  { id: "white", label: "Off-white", hsl: "36 30% 96%", textHsl: "210 25% 15%", category: "Soft" },
  { id: "gray", label: "Cinza Quente", hsl: "30 8% 28%", category: "Institucionais" },
  { id: "olive", label: "Verde Oliva", hsl: "90 20% 26%", category: "Institucionais" },
  { id: "moss", label: "Verde Musgo", hsl: "149 45% 19%", category: "Institucionais" },
  { id: "terra", label: "Terracota", hsl: "8 46% 28%", category: "Modernas" },
  { id: "sand", label: "Areia", hsl: "38 25% 88%", textHsl: "30 15% 20%", category: "Soft" },
  { id: "slate", label: "Ardósia", hsl: "210 12% 22%", category: "Institucionais" },
  // New palettes
  { id: "rose", label: "Rosa Pastel", hsl: "340 30% 88%", textHsl: "340 20% 20%", category: "Soft" },
  { id: "petrol", label: "Azul Petróleo", hsl: "195 40% 22%", category: "Modernas" },
  { id: "sage", label: "Verde Sálvia", hsl: "130 15% 85%", textHsl: "130 15% 20%", category: "Soft" },
  { id: "lavender", label: "Lavanda", hsl: "260 25% 88%", textHsl: "260 20% 20%", category: "Soft" },
  { id: "graphite", label: "Grafite", hsl: "220 8% 18%", category: "Modernas" },
];

const ACCENT_THEMES = [
  { id: "default", label: "Azul Atlas", hsl: "206 70% 34%" },
  { id: "olive", label: "Verde Oliva", hsl: "90 30% 42%" },
  { id: "moss", label: "Verde Musgo", hsl: "149 53% 33%" },
  { id: "terra", label: "Terracota", hsl: "8 56% 47%" },
  { id: "sand", label: "Dourado Suave", hsl: "41 88% 50%" },
  { id: "slate", label: "Azul Acinzentado", hsl: "206 30% 48%" },
  { id: "warm", label: "Cinza Quente", hsl: "30 15% 45%" },
  { id: "salvia", label: "Sálvia", hsl: "147 29% 48%" },
  { id: "rose", label: "Rosa Pastel", hsl: "4 50% 62%" },
  { id: "petrol", label: "Azul Petróleo", hsl: "195 45% 35%" },
  { id: "lavender", label: "Lavanda", hsl: "260 30% 55%" },
  { id: "graphite", label: "Grafite", hsl: "220 10% 35%" },
];

// Cor de fundo da aplicação inteira (modo claro). Off-white é o padrão atual.
const BG_THEMES = [
  { id: "offwhite", label: "Off-white", swatch: "40 44% 96%", bg: "40 44% 96%", card: "30 20% 99%", muted: "40 12% 93%", secondary: "40 14% 93%", border: "40 14% 88%" },
  { id: "white", label: "Branco", swatch: "0 0% 100%", bg: "0 0% 100%", card: "0 0% 100%", muted: "210 16% 96%", secondary: "210 16% 96%", border: "214 15% 91%" },
  { id: "cool", label: "Cinza claro", swatch: "210 22% 97%", bg: "210 22% 97%", card: "0 0% 100%", muted: "210 16% 94%", secondary: "210 16% 94%", border: "214 15% 90%" },
  { id: "sand", label: "Areia", swatch: "38 42% 93%", bg: "38 42% 94%", card: "40 40% 98%", muted: "38 22% 90%", secondary: "38 24% 90%", border: "38 22% 85%" },
  { id: "rose", label: "Rosa claro", swatch: "345 50% 95%", bg: "345 45% 97%", card: "345 50% 99%", muted: "345 26% 93%", secondary: "345 28% 93%", border: "345 26% 89%" },
  { id: "sage", label: "Verde sálvia", swatch: "140 22% 93%", bg: "140 22% 96%", card: "140 25% 99%", muted: "140 15% 92%", secondary: "140 16% 92%", border: "140 15% 87%" },
  { id: "lavender", label: "Lavanda", swatch: "258 40% 95%", bg: "258 38% 97%", card: "258 40% 99%", muted: "258 22% 93%", secondary: "258 24% 93%", border: "258 22% 89%" },
  { id: "black", label: "Preto", swatch: "0 0% 9%", bg: "0 0% 7%", card: "0 0% 11%", muted: "0 0% 16%", secondary: "0 0% 16%", border: "0 0% 20%", dark: true },
];
const BG_VARS = ["--background", "--card", "--popover", "--muted", "--secondary", "--border", "--input"];
const FG_VARS = ["--foreground", "--card-foreground", "--popover-foreground", "--secondary-foreground", "--muted-foreground", "--accent", "--accent-foreground"];

const MODE_OPTIONS = [
  { id: "light", label: "Claro", icon: Sun },
  { id: "dark", label: "Escuro", icon: Moon },
  { id: "system", label: "Sistema", icon: Monitor },
];

const CATEGORIES = ["Institucionais", "Modernas", "Soft"] as const;

/** Apply theme to document root — exported so DashboardLayout can call it on mount */
export const applyTheme = (sidebarId: string, accentId: string, modeId: string, fundoId?: string) => {
  const root = document.documentElement;

  root.classList.remove("light", "dark");
  if (modeId === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.add(isDark ? "dark" : "light");
  } else {
    root.classList.add(modeId);
  }

  // Cor de fundo (só no modo claro; no escuro usa o do index.css)
  const fundo = fundoId || (typeof localStorage !== "undefined" ? localStorage.getItem("atlas-tema-fundo") : null) || "white";
  if (root.classList.contains("dark")) {
    [...BG_VARS, ...FG_VARS].forEach(v => root.style.removeProperty(v));
  } else {
    const bg = BG_THEMES.find(b => b.id === fundo) || BG_THEMES[0];
    root.style.setProperty("--background", bg.bg);
    root.style.setProperty("--card", bg.card);
    root.style.setProperty("--popover", bg.card);
    root.style.setProperty("--muted", bg.muted);
    root.style.setProperty("--secondary", bg.secondary);
    root.style.setProperty("--border", bg.border);
    root.style.setProperty("--input", bg.border);
    if ((bg as any).dark) {
      const fg = "0 0% 95%", fgMuted = "0 0% 62%";
      root.style.setProperty("--foreground", fg);
      root.style.setProperty("--card-foreground", fg);
      root.style.setProperty("--popover-foreground", fg);
      root.style.setProperty("--secondary-foreground", fg);
      root.style.setProperty("--muted-foreground", fgMuted);
      root.style.setProperty("--accent", bg.muted);
      root.style.setProperty("--accent-foreground", fg);
    } else {
      FG_VARS.forEach(v => root.style.removeProperty(v));
    }
  }

  const sidebarTheme = SIDEBAR_THEMES.find(t => t.id === sidebarId) || SIDEBAR_THEMES[0];
  const isLightSidebar = sidebarTheme.textHsl !== undefined;
  root.style.setProperty("--sidebar-background", sidebarTheme.hsl);
  root.style.setProperty("--sidebar-foreground", isLightSidebar ? "210 25% 15%" : "210 15% 92%");
  root.style.setProperty("--sidebar-accent", isLightSidebar ? "210 15% 94%" : adjustLightness(sidebarTheme.hsl, 6));
  root.style.setProperty("--sidebar-accent-foreground", isLightSidebar ? "210 25% 15%" : "210 15% 92%");
  root.style.setProperty("--sidebar-border", isLightSidebar ? "210 15% 90%" : adjustLightness(sidebarTheme.hsl, 4));

  const accentTheme = ACCENT_THEMES.find(t => t.id === accentId);
  if (accentTheme) {
    root.style.setProperty("--primary", accentTheme.hsl);
    root.style.setProperty("--ring", accentTheme.hsl);
    root.style.setProperty("--sidebar-primary", accentTheme.hsl);
  } else {
    // Fallback — should not happen since every accentId maps to a theme
    const blueHsl = root.classList.contains("dark") ? "208 45% 40%" : "208 50% 24%";
    root.style.setProperty("--primary", blueHsl);
    root.style.setProperty("--ring", blueHsl);
    root.style.setProperty("--sidebar-primary", blueHsl);
  }
};

function adjustLightness(hsl: string, delta: number): string {
  const parts = hsl.split(" ");
  if (parts.length >= 3) {
    const l = parseFloat(parts[2]);
    return `${parts[0]} ${parts[1]} ${Math.min(l + delta, 100)}%`;
  }
  return hsl;
}

const Configuracoes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sidebar, setSidebar] = useState("white");
  const [accent, setAccent] = useState("default");
  const [mode, setMode] = useState("light");
  const [fundo, setFundo] = useState(() => { try { return localStorage.getItem("atlas-tema-fundo") || "white"; } catch { return "white"; } });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("tema_sidebar,tema_destaque,tema_modo").eq("user_id", user.id).maybeSingle();
      if (data) {
        const sidebarValue = (data as any).tema_sidebar;
        const accentValue = (data as any).tema_destaque;
        const modeValue = (data as any).tema_modo;
        setSidebar(sidebarValue && sidebarValue !== "default" ? sidebarValue : "white");
        setAccent(accentValue || "default");
        setMode(modeValue && modeValue !== "system" ? modeValue : "light");
      }
    })();
  }, [user]);

  useEffect(() => {
    applyTheme(sidebar, accent, mode, fundo);
  }, [sidebar, accent, mode, fundo]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try { localStorage.setItem("atlas-tema-fundo", fundo); } catch { /* ignore */ }
    const { error } = await supabase.from("profiles").update({
      tema_sidebar: sidebar,
      tema_destaque: accent,
      tema_modo: mode,
    } as any).eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Tema salvo!", description: "Suas preferências foram atualizadas." });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Palette className="h-6 w-6 text-primary" /> Personalização de Tema
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Personalize as cores do sistema ao seu gosto.</p>
      </div>

      {/* Mode */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Modo de exibição</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {MODE_OPTIONS.map(opt => (
              <button
                key={opt.id}
                onClick={() => setMode(opt.id)}
                className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                  mode === opt.id ? "border-primary bg-primary/5" : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <opt.icon className={`h-6 w-6 ${mode === opt.id ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">{opt.label}</span>
                {mode === opt.id && <Check className="h-4 w-4 text-primary" />}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Background color — affects the whole app */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Cor de fundo</CardTitle>
          <p className="text-xs text-muted-foreground">Muda o fundo de toda a aplicação. Vale para o modo claro.</p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {BG_THEMES.map(theme => (
              <button
                key={theme.id}
                onClick={() => setFundo(theme.id)}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  fundo === theme.id ? "border-primary" : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <span className="relative w-full h-10 rounded-md border border-border/60" style={{ backgroundColor: `hsl(${theme.swatch})` }}>
                  {fundo === theme.id && <Check className="h-4 w-4 text-primary absolute top-1 right-1" />}
                </span>
                <span className="text-xs font-medium">{theme.label}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sidebar color — organized by category */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Cor da sidebar</CardTitle>
          <p className="text-xs text-muted-foreground">Altera só o menu lateral (visível no computador).</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {CATEGORIES.map(cat => {
            const themes = SIDEBAR_THEMES.filter(t => t.category === cat);
            return (
              <div key={cat}>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 font-heading font-semibold mb-2">{cat}</p>
                <div className="grid grid-cols-4 gap-3">
                  {themes.map(theme => (
                    <button
                      key={theme.id}
                      onClick={() => setSidebar(theme.id)}
                      className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                        sidebar === theme.id ? "border-primary" : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-md shadow-sm border border-border" style={{ backgroundColor: `hsl(${theme.hsl})` }} />
                      <span className="text-xs font-medium">{theme.label}</span>
                      {sidebar === theme.id && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Accent color */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Cor de destaque</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {ACCENT_THEMES.map(theme => (
              <button
                key={theme.id}
                onClick={() => setAccent(theme.id)}
                className={`relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  accent === theme.id ? "border-primary" : "border-border hover:border-muted-foreground/30"
                }`}
              >
                <div className="w-10 h-10 rounded-full shadow-sm" style={{ backgroundColor: `hsl(${theme.hsl})` }} />
                <span className="text-xs font-medium">{theme.label}</span>
                {accent === theme.id && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} aria-busy={saving} aria-label={saving ? "Salvando preferências..." : "Salvar preferências"} className="w-full">
        {saving ? "Salvando..." : "Salvar Preferências"}
      </Button>

    </div>
  );
};

export default Configuracoes;
