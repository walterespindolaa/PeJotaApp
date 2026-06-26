import { Info, Eye, Zap } from "lucide-react";

interface ReportIntroProps {
  whatIs: string;
  whatYouSee: string;
  howItHelps: string;
}

const ReportIntro = ({ whatIs, whatYouSee, howItHelps }: ReportIntroProps) => {
  const items = [
    { icon: Info, label: "O que é", text: whatIs },
    { icon: Eye, label: "O que você vai enxergar", text: whatYouSee },
    { icon: Zap, label: "Como isso te ajuda", text: howItHelps },
  ];

  return (
    <div className="rounded-2xl border border-border/40 bg-muted/30 p-5 mb-2">
      <p className="text-[11px] font-heading font-semibold tracking-[0.12em] uppercase text-muted-foreground mb-4">
        Como usar este relatório
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {items.map(({ icon: Icon, label, text }) => (
          <div key={label} className="flex gap-3">
            <div className="shrink-0 mt-0.5 p-1.5 rounded-lg bg-primary/8">
              <Icon className="h-4 w-4 text-primary" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-xs font-heading font-semibold text-foreground mb-0.5">{label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportIntro;
