import { useHouseholdView, type HouseholdView } from "@/contexts/HouseholdViewContext";
import { User, Heart, Users, Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

const HouseholdViewSelector = () => {
  const { view, setView, labels, fotoPessoa1, fotoPessoa2, fotoCasal, hasPessoa2, vinculo } = useHouseholdView();

  // Sem segundo membro cadastrado, não há o que alternar — esconde o seletor.
  if (!hasPessoa2) return null;

  const views: HouseholdView[] = ["pessoa1", "pessoa2", "casal"];

  const compartilhadoIcon =
    vinculo === "Cônjuge" || vinculo === "Companheiro(a)"
      ? Heart
      : vinculo === "Sócio(a)"
        ? Handshake
        : Users;

  const getIcon = (v: HouseholdView): React.ElementType =>
    v === "casal" ? compartilhadoIcon : User;

  const getPhoto = (v: HouseholdView) => {
    if (v === "pessoa1") return fotoPessoa1;
    if (v === "pessoa2") return fotoPessoa2;
    if (v === "casal") return fotoCasal;
    return "";
  };

  return (
    <div className="flex items-center gap-1 bg-muted/50 rounded-full p-0.5">
      {views.map(v => {
        const Icon = getIcon(v);
        const isActive = view === v;
        const photo = getPhoto(v);
        return (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground/70 bg-transparent"
            )}
          >
            {photo ? (
              <Avatar className="h-4 w-4">
                <AvatarImage src={photo} />
                <AvatarFallback className="text-[8px]">{labels[v]?.charAt(0)}</AvatarFallback>
              </Avatar>
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            <span className="hidden sm:inline">{labels[v]}</span>
          </button>
        );
      })}
    </div>
  );
};

export default HouseholdViewSelector;
