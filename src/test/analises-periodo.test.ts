import { describe, it, expect } from "vitest";
import { getPeriodConfig } from "@/lib/periodConfig";

describe("getPeriodConfig", () => {
  it("returns monthly mode with correct title for 'mes'", () => {
    const cfg = getPeriodConfig("mes", "2026-03");
    expect(cfg.isMonthly).toBe(true);
    expect(cfg.title).toContain("Resumo do Mês");
    expect(cfg.title).toContain("2026");
    expect(cfg.start).toBe("2026-03-01");
    expect(cfg.end).toBe("2026-03-31");
  });

  it("returns period mode with correct title for '3m'", () => {
    const cfg = getPeriodConfig("3m", "2026-03");
    expect(cfg.isMonthly).toBe(false);
    expect(cfg.title).toBe("Resumo do Período — Últimos 3 meses");
    expect(cfg.start).not.toBeNull();
    expect(cfg.label).toBe("Últimos 3 meses");
  });

  it("returns null start for 'all'", () => {
    const cfg = getPeriodConfig("all", "2026-03");
    expect(cfg.isMonthly).toBe(false);
    expect(cfg.start).toBeNull();
    expect(cfg.title).toBe("Resumo do Período — Desde o início");
  });
});
