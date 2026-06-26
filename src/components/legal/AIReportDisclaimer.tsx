import { AlertTriangle } from "lucide-react";
import { AI_REPORT_DISCLAIMER } from "@/lib/legal";

export default function AIReportDisclaimer() {
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
      <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
        <span>{AI_REPORT_DISCLAIMER}</span>
      </p>
    </div>
  );
}
