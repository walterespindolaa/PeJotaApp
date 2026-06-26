import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SquareArrowUp, MoreVertical, Plus, Check, Smartphone, ChevronLeft } from "lucide-react";
import { usePwaInstallNudge } from "@/hooks/usePwaInstallNudge";

type Step = "ask" | "device" | "ios" | "android";

export default function PwaInstallNudge() {
  const { open, answerAlreadyInstalled, answerSucceeded, dismiss } = usePwaInstallNudge();
  const [step, setStep] = useState<Step>("ask");

  // Reseta o passo sempre que o pop-up abre.
  useEffect(() => { if (open) setStep("ask"); }, [open]);

  const stepIcons = [SquareArrowUp, Plus, Check];
  const androidIcons = [MoreVertical, Plus, Check];

  const renderSteps = (icons: typeof stepIcons, items: string[]) => (
    <div className="space-y-2.5">
      {items.map((text, i) => {
        const Icon = icons[i] ?? Plus;
        return (
          <div key={i} className="flex items-start gap-3">
            <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-primary/10 text-primary text-xs font-heading font-bold flex-shrink-0">{i + 1}</span>
            <div className="flex items-start gap-2 pt-0.5">
              <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80 leading-relaxed">{text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );

  const confirmFooter = (
    <div className="mt-5 pt-4 border-t border-border/40">
      <p className="text-sm font-medium text-foreground mb-2">Conseguiu adicionar?</p>
      <div className="flex gap-2">
        <Button className="flex-1 rounded-xl" onClick={answerSucceeded}>
          <Check className="h-4 w-4 mr-1.5" /> Sim, consegui
        </Button>
        <Button variant="outline" className="flex-1 rounded-xl" onClick={dismiss}>Ainda não</Button>
      </div>
    </div>
  );

  const backButton = (
    <button
      type="button"
      onClick={() => setStep("device")}
      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
    >
      <ChevronLeft className="h-3.5 w-3.5" /> Voltar
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) dismiss(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        {step === "ask" && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle className="font-heading text-lg">Deixe o PeJota à mão</DialogTitle>
              <DialogDescription className="text-sm">
                Você já adicionou o PeJota à tela inicial do seu celular? Assim você abre como um app, em um toque.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2 pt-2">
              <Button className="w-full rounded-xl" onClick={answerAlreadyInstalled}>
                <Check className="h-4 w-4 mr-1.5" /> Sim, já adicionei
              </Button>
              <Button variant="outline" className="w-full rounded-xl" onClick={() => setStep("device")}>Ainda não</Button>
            </div>
          </>
        )}

        {step === "device" && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle className="font-heading text-lg">Qual é o seu aparelho?</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep("ios")}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-5 hover:border-primary/50 hover:bg-muted/40 transition-colors"
              >
                <Smartphone className="h-7 w-7 text-primary" />
                <span className="text-sm font-heading font-semibold text-foreground">iPhone</span>
              </button>
              <button
                type="button"
                onClick={() => setStep("android")}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-5 hover:border-primary/50 hover:bg-muted/40 transition-colors"
              >
                <Smartphone className="h-7 w-7 text-primary" />
                <span className="text-sm font-heading font-semibold text-foreground">Android</span>
              </button>
            </div>
          </>
        )}

        {step === "ios" && (
          <>
            {backButton}
            <DialogHeader className="text-left">
              <DialogTitle className="font-heading text-lg">Adicionar no iPhone</DialogTitle>
            </DialogHeader>
            <div className="rounded-xl bg-primary/5 border border-primary/15 px-3 py-2.5 mb-1">
              <p className="text-xs text-foreground/80">Abra o PeJota pelo Safari para conseguir adicionar.</p>
            </div>
            {renderSteps(stepIcons, [
              "Toque no botão Compartilhar (quadrado com seta para cima) na barra do Safari.",
              'Role para baixo e toque em "Adicionar à Tela de Início".',
              'Toque em "Adicionar" no canto superior direito.',
            ])}
            {confirmFooter}
          </>
        )}

        {step === "android" && (
          <>
            {backButton}
            <DialogHeader className="text-left">
              <DialogTitle className="font-heading text-lg">Adicionar no Android</DialogTitle>
            </DialogHeader>
            <div className="rounded-xl bg-primary/5 border border-primary/15 px-3 py-2.5 mb-1">
              <p className="text-xs text-foreground/80">Use o Chrome para a melhor experiência.</p>
            </div>
            {renderSteps(androidIcons, [
              "Toque no menu (três pontinhos) no canto superior direito do Chrome.",
              'Toque em "Adicionar à tela inicial" (ou "Instalar app").',
              'Confirme em "Adicionar" / "Instalar".',
            ])}
            {confirmFooter}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
