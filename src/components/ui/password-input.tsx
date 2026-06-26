import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Input de senha com botão de mostrar/ocultar (olhinho) alinhado à direita.
 * Mantém todos os props de um <input> normal; o `type` é controlado internamente.
 */
const PasswordInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => {
    const [show, setShow] = React.useState(false);
    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={show ? "text" : "password"}
          className={cn("pr-10", className)}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          tabIndex={-1}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
