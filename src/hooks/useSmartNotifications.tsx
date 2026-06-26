import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lastDayOfMonth } from "@/lib/dateHelpers";
import { calcFVAnuidade, taxaAnualParaMensal, FINANCIAL_PREMISES } from "@/lib/financial_engine/financial_premises";

export type NotifCategory = "lembrete" | "alerta" | "insight" | "oportunidade";

export interface SmartNotification {
  id: string;
  category: NotifCategory;
  icon: string;
  title: string;
  description: string;
  cta?: { label: string; path: string };
  timestamp: Date;
  read?: boolean;
}

const STORAGE_KEY = (uid: string) => `atlas-notif-state-${uid}`;

export const useSmartNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<SmartNotification[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    if (!user) return new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY(user.id));
      if (raw) return new Set(JSON.parse(raw).dismissed || []);
    } catch {}
    return new Set();
  });
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    if (!user) return new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY(user.id));
      if (raw) return new Set(JSON.parse(raw).readIds || []);
    } catch {}
    return new Set();
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setDismissed(new Set());
      setReadIds(new Set());
      return;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY(user.id));
      if (raw) {
        const parsed = JSON.parse(raw);
        setDismissed(new Set(parsed.dismissed || []));
        setReadIds(new Set(parsed.readIds || []));
      } else {
        setDismissed(new Set());
        setReadIds(new Set());
      }
    } catch {}
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(STORAGE_KEY(user.id), JSON.stringify({
        dismissed: Array.from(dismissed),
        readIds: Array.from(readIds),
      }));
    } catch {}
  }, [user, dismissed, readIds]);

  const generate = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const now = new Date();
    const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const mesPrev = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    const [rCur, dCur, eCur, rPrev, dPrev, invRes, instRes, aposentRes, objRes] = await Promise.all([
      supabase.from("receitas").select("valor,categoria").eq("user_id", user.id).gte("data", `${mes}-01`).lte("data", lastDayOfMonth(mes)),
      supabase.from("despesas").select("valor,categoria,tipo,is_parcelada,dia_vencimento,descricao").eq("user_id", user.id).gte("data", `${mes}-01`).lte("data", lastDayOfMonth(mes)),
      supabase.from("economias").select("valor").eq("user_id", user.id).gte("data", `${mes}-01`).lte("data", lastDayOfMonth(mes)),
      supabase.from("receitas").select("valor").eq("user_id", user.id).gte("data", `${mesPrev}-01`).lte("data", lastDayOfMonth(mesPrev)),
      supabase.from("despesas").select("valor,is_parcelada").eq("user_id", user.id).gte("data", `${mesPrev}-01`).lte("data", lastDayOfMonth(mesPrev)),
      supabase.from("investimentos_financeiros").select("valor_atual,valor,is_reserva_emergencia,nome").eq("user_id", user.id).limit(500),
      supabase.from("installment_instances").select("id,due_date,status").eq("user_id", user.id).eq("status", "pending").gte("due_date", now.toISOString().split("T")[0]).lte("due_date", new Date(now.getTime() + 7 * 86400000).toISOString().split("T")[0]),
      supabase.from("aposentadoria").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("objetivos").select("nome,data_objetivo").eq("user_id", user.id).limit(500),
    ]);

    const receita = (rCur.data || []).reduce((s: number, x: any) => s + Number(x.valor), 0);
    const despesa = (dCur.data || []).reduce((s: number, x: any) => s + Number(x.valor), 0);
    const economia = (eCur.data || []).reduce((s: number, x: any) => s + Number(x.valor), 0);
    const receitaPrev = (rPrev.data || []).reduce((s: number, x: any) => s + Number(x.valor), 0);
    const despesaPrev = (dPrev.data || []).reduce((s: number, x: any) => s + Number(x.valor), 0);
    const parcelAtual = (dCur.data || []).filter((x: any) => x.is_parcelada).reduce((s: number, x: any) => s + Number(x.valor), 0);
    const parcelPrev = (dPrev.data || []).filter((x: any) => x.is_parcelada).reduce((s: number, x: any) => s + Number(x.valor), 0);

    const invData = invRes.data || [];
    const reservaTotal = invData.filter((i: any) => i.is_reserva_emergencia).reduce((s: number, i: any) => s + Number(i.valor_atual || i.valor || 0), 0);
    const patrimonioTotal = invData.reduce((s: number, i: any) => s + Number(i.valor_atual || i.valor || 0), 0);

    const notifs: SmartNotification[] = [];
    const ts = new Date();

    // ── LEMBRETES ──
    const upcomingInstallments = (instRes.data as any[]) || [];
    if (upcomingInstallments.length > 0) {
      notifs.push({
        id: "lembrete-parcela", category: "lembrete", icon: "📅",
        title: "Parcela a vencer",
        description: `Você tem ${upcomingInstallments.length} parcela(s) vencendo nos próximos 7 dias.`,
        cta: { label: "Ver calendário", path: "/dashboard/calendario" },
        timestamp: ts,
      });
    }

    // Fixed expenses upcoming
    const fixas = (dCur.data || []).filter((x: any) => x.tipo === "fixa" && x.dia_vencimento);
    const diaHoje = now.getDate();
    const fixasProximas = fixas.filter((x: any) => {
      const dv = Number(x.dia_vencimento);
      return dv >= diaHoje && dv <= diaHoje + 5;
    });
    if (fixasProximas.length > 0) {
      notifs.push({
        id: "lembrete-fixa", category: "lembrete", icon: "📅",
        title: "Despesa fixa próxima",
        description: `${fixasProximas.length} despesa(s) fixa(s) vencem nos próximos 5 dias.`,
        cta: { label: "Ver despesas", path: "/dashboard/renda-despesas" },
        timestamp: ts,
      });
    }

    // New month review
    if (diaHoje <= 3) {
      notifs.push({
        id: "lembrete-novo-mes", category: "lembrete", icon: "📅",
        title: "Planejamento mensal",
        description: "Um novo mês começou. Vale revisar seu orçamento e planejar os aportes.",
        cta: { label: "Planejar", path: "/dashboard/renda-despesas" },
        timestamp: ts,
      });
    }

    // Objectives nearing deadline
    const objs = objRes.data || [];
    const objProximos = objs.filter((o: any) => {
      if (!o.data_objetivo) return false;
      const diff = (new Date(o.data_objetivo).getTime() - now.getTime()) / 86400000;
      return diff > 0 && diff <= 90;
    });
    if (objProximos.length > 0) {
      notifs.push({
        id: "lembrete-objetivo", category: "lembrete", icon: "📅",
        title: "Objetivo próximo",
        description: `O objetivo "${objProximos[0].nome}" está a menos de 3 meses da data prevista.`,
        cta: { label: "Ver objetivos", path: "/dashboard/objetivos-de-vida" },
        timestamp: ts,
      });
    }

    // ── ALERTAS ──
    if (receita > 0 && despesa / receita > 0.7) {
      notifs.push({
        id: "alerta-compromisso", category: "alerta", icon: "⚠️",
        title: "Compromisso elevado",
        description: `Mais de ${Math.round(despesa / receita * 100)}% da sua renda está comprometida com despesas neste mês.`,
        cta: { label: "Ver análises", path: "/dashboard/analises" },
        timestamp: ts,
      });
    }

    if (receita > 0 && economia === 0) {
      notifs.push({
        id: "alerta-poupanca", category: "alerta", icon: "⚠️",
        title: "Poupança zerada",
        description: "Você ainda não registrou nenhuma economia neste mês. O ideal é poupar pelo menos 20%.",
        cta: { label: "Registrar economia", path: "/dashboard/renda-despesas" },
        timestamp: ts,
      });
    }

    if (despesa > 0 && reservaTotal < despesa * 3) {
      notifs.push({
        id: "alerta-reserva", category: "alerta", icon: "⚠️",
        title: "Reserva baixa",
        description: `Sua reserva cobre menos de ${Math.max(0, (reservaTotal / despesa)).toFixed(1)} meses de despesas. O ideal é 6 a 12 meses.`,
        cta: { label: "Ver investimentos", path: "/dashboard/investimentos" },
        timestamp: ts,
      });
    }

    if (despesaPrev > 0 && despesa > despesaPrev * 1.1 && receitaPrev > 0 && receita <= receitaPrev * 1.05) {
      notifs.push({
        id: "alerta-desp-crescendo", category: "alerta", icon: "⚠️",
        title: "Despesas crescendo",
        description: "Suas despesas aumentaram mais que sua renda em relação ao mês anterior.",
        cta: { label: "Analisar", path: "/dashboard/analises" },
        timestamp: ts,
      });
    }

    if (parcelAtual > parcelPrev && parcelPrev > 0) {
      notifs.push({
        id: "alerta-parcelas", category: "alerta", icon: "⚠️",
        title: "Parcelamentos subindo",
        description: "Seus parcelamentos aumentaram em relação ao mês anterior.",
        cta: { label: "Ver parcelas", path: "/dashboard/renda-despesas" },
        timestamp: ts,
      });
    }

    // Concentration
    if (receita > 0 && (dCur.data || []).length > 0) {
      const catMap: Record<string, number> = {};
      (dCur.data || []).forEach((x: any) => { catMap[x.categoria || "Outros"] = (catMap[x.categoria || "Outros"] || 0) + Number(x.valor); });
      const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
      if (sorted[0] && sorted[0][1] / receita > 0.35) {
        notifs.push({
          id: "alerta-concentracao", category: "alerta", icon: "⚠️",
          title: "Concentração financeira",
          description: `"${sorted[0][0]}" consome ${Math.round(sorted[0][1] / receita * 100)}% da sua renda. Alta concentração em uma única categoria.`,
          cta: { label: "Ver análises", path: "/dashboard/analises" },
          timestamp: ts,
        });
      }
    }

    // ── INSIGHTS ──
    if (receita > 0 && despesa / receita <= 0.7) {
      notifs.push({
        id: "insight-disciplina", category: "insight", icon: "💡",
        title: "Disciplina financeira",
        description: "Você está mantendo despesas abaixo de 70% da renda. Excelente controle!",
        timestamp: ts,
      });
    }

    if (receita > receitaPrev && receitaPrev > 0) {
      const recGrowth = ((receita - receitaPrev) / receitaPrev) * 100;
      if (recGrowth > 5) {
        notifs.push({
          id: "insight-renda-cresceu", category: "insight", icon: "💡",
          title: "Renda em alta",
          description: `Sua receita cresceu ${recGrowth.toFixed(0)}% em relação ao mês anterior.`,
          timestamp: ts,
        });
      }
    }

    // Patrimônio milestones
    const marcos = [50000, 100000, 250000, 500000, 1000000, 2000000, 5000000];
    for (const marco of marcos) {
      if (patrimonioTotal >= marco && patrimonioTotal < marco * 1.1) {
        notifs.push({
          id: `insight-marco-${marco}`, category: "insight", icon: "🏆",
          title: "Marco atingido",
          description: `Seu patrimônio ultrapassou R$ ${(marco / 1000).toFixed(0)} mil${marco >= 1000000 ? ` (R$ ${(marco / 1000000).toFixed(0)} milhão)` : ""}!`,
          cta: { label: "Ver patrimônio", path: "/dashboard/investimentos" },
          timestamp: ts,
        });
        break;
      }
    }

    if (economia > 0 && receita > 0 && economia / receita >= 0.2) {
      notifs.push({
        id: "insight-poupanca-boa", category: "insight", icon: "💡",
        title: "Capacidade de poupança",
        description: `Sua taxa de poupança está em ${Math.round(economia / receita * 100)}% — acima do ideal de 20%.`,
        timestamp: ts,
      });
    }

    // ── OPORTUNIDADES ──
    const saldo = receita - despesa;
    if (saldo > 0 && economia === 0) {
      notifs.push({
        id: "oport-investir", category: "oportunidade", icon: "🚀",
        title: "Oportunidade de investimento",
        description: `Você tem saldo positivo de R$ ${saldo.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} este mês, mas não registrou economias. Considere investir parte.`,
        cta: { label: "Simular", path: "/dashboard/express-aposentadoria" },
        timestamp: ts,
      });
    }

    if (receita > 0) {
      const potencial5pct = receita * 0.05;
      if (potencial5pct > 100) {
        notifs.push({
          id: "oport-reduzir", category: "oportunidade", icon: "🚀",
          title: "Redução de despesas",
          description: `Se reduzir 5% dos gastos variáveis, você pode liberar R$ ${potencial5pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/mês para investir.`,
          cta: { label: "Simular", path: "/dashboard/express-objetivo" },
          timestamp: ts,
        });
      }
    }

    if (economia > 0) {
      // Valor futuro de uma anuidade mensal por 240 meses, a 5% a.a. real (premissa PeJota).
      const acum20anos = calcFVAnuidade(economia, taxaAnualParaMensal(FINANCIAL_PREMISES.retorno_real_medio), 240);
      notifs.push({
        id: "oport-crescimento", category: "oportunidade", icon: "🚀",
        title: "Potencial de crescimento",
        description: `Se investir R$ ${economia.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/mês por 20 anos a ~5% a.a. reais, o patrimônio acumulado pode chegar a R$ ${acum20anos.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} (estimativa).`,
        cta: { label: "Simular aposentadoria", path: "/dashboard/aposentadoria" },
        timestamp: ts,
      });
    }

    setNotifications(notifs);
    setLoading(false);
  }, [user]);

  useEffect(() => { generate(); }, [generate]);

  const visible = notifications.filter(n => !dismissed.has(n.id)).map(n => ({
    ...n,
    read: readIds.has(n.id),
  }));

  const byCategory = (cat: NotifCategory) => visible.filter(n => n.category === cat);
  const unreadCount = visible.filter(n => !n.read).length;

  const markRead = (id: string) => setReadIds(prev => new Set(prev).add(id));
  const markAllRead = () => setReadIds(new Set(visible.map(n => n.id)));
  const dismissNotif = (id: string) => setDismissed(prev => new Set(prev).add(id));
  const clearCategory = (cat: NotifCategory) => {
    const ids = visible.filter(n => n.category === cat).map(n => n.id);
    setDismissed(prev => { const s = new Set(prev); ids.forEach(id => s.add(id)); return s; });
  };
  const clearAll = () => setDismissed(new Set(notifications.map(n => n.id)));

  return {
    notifications: visible,
    loading,
    byCategory,
    totalCount: visible.length,
    unreadCount,
    markRead,
    markAllRead,
    dismissNotif,
    clearCategory,
    clearAll,
    refresh: generate,
  };
};
