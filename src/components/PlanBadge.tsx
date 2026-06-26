import { useNavigate } from "react-router-dom";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { Crown, Sparkles, Zap } from "lucide-react";

const iconMap: Record<string, React.ElementType> = {
  atlas_essencial: Zap,
  atlas_pro: Sparkles,
  atlas_elite: Crown,
};

const colorMap: Record<string, string> = {
  atlas_essencial: "text-success bg-success/10 border-success/20",
  atlas_pro: "text-primary bg-primary/10 border-primary/20",
  atlas_elite: "text-amber-500 bg-amber-500/10 border-amber-500/20",
};

const PlanBadge = () => {
  const { userPlan, loading } = useFeatureAccess();
  const navigate = useNavigate();

  if (loading || !userPlan || userPlan.slug === "admin") return null;

  const Icon = iconMap[userPlan.slug] || Zap;
  const colors = colorMap[userPlan.slug] || colorMap.atlas_essencial;

  return (
    <button
      onClick={() => navigate("/dashboard/planos")}
      className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors hover:opacity-80 ${colors}`}
      title="Ver planos"
    >
      <Icon className="h-3 w-3" />
      <span>{userPlan.name}</span>
    </button>
  );
};

export default PlanBadge;
