import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SkipForward, RotateCcw, Loader2 } from "lucide-react";
import { useExpenseSkips } from "@/hooks/useExpenseSkips";

interface Props {
  templateId: string;
  monthRef: string; // YYYY-MM
  variant?: "ghost" | "outline";
  size?: "sm" | "icon";
  showLabel?: boolean;
}

export default function SkipMonthButton({ templateId, monthRef, variant = "ghost", size = "sm", showLabel = true }: Props) {
  const { isSkipped, skipMonth, unskipMonth } = useExpenseSkips();
  const [loading, setLoading] = useState(false);
  const skipped = isSkipped(templateId, monthRef);

  const handleClick = async () => {
    setLoading(true);
    if (skipped) {
      await unskipMonth(templateId, monthRef);
    } else {
      await skipMonth(templateId, monthRef);
    }
    setLoading(false);
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={loading}
      className="text-xs"
      title={skipped ? "Desfazer pulo deste mês" : "Pular esta despesa apenas neste mês"}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : skipped ? (
        <RotateCcw className="h-3 w-3" />
      ) : (
        <SkipForward className="h-3 w-3" />
      )}
      {showLabel && (
        <span className="ml-1">
          {skipped ? "Desfazer pulo" : "Pular este mês"}
        </span>
      )}
    </Button>
  );
}
