import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Parses a Brazilian-formatted money string to a number.
 * Accepts: 1200, 1.200, 1200,50, 1.200,50
 */
export function parseBRL(raw: string): number {
  if (!raw) return 0;
  let s = raw.replace(/[R$€£$\s]/g, "").trim();
  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else {
    const dotParts = s.split(".");
    if (dotParts.length > 1 && dotParts[dotParts.length - 1].length === 3) {
      s = s.replace(/\./g, "");
    }
  }
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/** Format a number as display-only BRL string (1200.5 → "1.200,50") */
export function formatBRLDisplay(value: number): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface MoneyInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "type"> {
  value: string;
  onChange: (raw: string) => void;
  /** Currency symbol to display. Defaults to "R$" */
  currencySymbol?: string;
}

const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, value, onChange, placeholder = "0,00", currencySymbol = "R$", onBlur, ...props }, ref) => {
    return (
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">{currencySymbol}</span>
        <input
          ref={ref}
          type="text"
          inputMode="decimal"
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
            className,
          )}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            // Formata ao vivo: milhar no inteiro + vírgula com até 2 decimais.
            const cleaned = e.target.value.replace(/[^\d,]/g, "");
            const ci = cleaned.indexOf(",");
            let out: string;
            if (ci !== -1) {
              const intPart = cleaned.slice(0, ci).replace(/\D/g, "");
              const dec = cleaned.slice(ci + 1).replace(/\D/g, "").slice(0, 2);
              const intFmt = intPart ? parseInt(intPart, 10).toLocaleString("pt-BR") : "0";
              out = intFmt + "," + dec;
            } else {
              out = cleaned ? parseInt(cleaned, 10).toLocaleString("pt-BR") : "";
            }
            onChange(out);
          }}
          onBlur={(e) => {
            // Ao sair do campo, completa para o formato R$ 50.000,00.
            const n = parseBRL(value);
            onChange(n > 0 ? formatBRLDisplay(n) : "");
            onBlur?.(e);
          }}
          {...props}
        />
      </div>
    );
  },
);
MoneyInput.displayName = "MoneyInput";

export { MoneyInput };
