import { useState } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import FeedbackDialog from "@/components/feedback/FeedbackDialog";
import { useAuth } from "@/hooks/useAuth";

/**
 * Icon button na topbar pra abrir o FeedbackDialog.
 * Renderizado em DashboardLayout ao lado do SmartNotificationsPopover (bell).
 *
 * Usa o pattern Button ghost icon size, identico aos outros icons do header
 * (privacy toggle, etc), pra consistencia visual.
 */
export default function FeedbackButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        title="Enviar feedback"
        aria-label="Enviar feedback"
        className="text-muted-foreground hover:text-foreground"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </Button>
      <FeedbackDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
