import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeAtlasScore, type AtlasScoreInputs, type AtlasScoreResult } from "@/lib/atlasScore";
import { projectRecurringInRange } from "@/lib/projectRecurring";
import { fetchAllCompaniesTransactions } from "@/lib/companies";
import { logError } from "@/lib/log";

interface UseAtlasScoreOpts {
  userId: string | undefined;
  periodStart: string;
  periodEnd: string;
  visaoPessoa?: "geral" | "casal" | "pessoa1" | "pessoa2";
  skippedKeys?: Set<string>;
}

export function useAtlasScore({ userId, periodStart, periodEnd, visaoPessoa = "casal", skippedKeys }: UseAtlasScoreOpts) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AtlasScoreResult | null>(null);
  const [scoreInputs, setScoreInputs] = useState<AtlasScoreInputs | null>(null);
  const [evolution3m, setEvolution3m] = useState<number | null>(null);

  const compute = useCallback(async (retryCount = 0) => {
    if (!userId) return;
    setLoading(true);

    try {
      setError(null);
      // Derive competencia months from period (string arithmetic to avoid timezone bugs)
      const [startYear, startMonth] = periodStart.split("-").map(Number);
      const [endYear, endMonth] = periodEnd.split("-").map(Number);
      const competencias: string[] = [];
      let cY = startYear, cM = startMonth;
      while (cY < endYear || (cY === endYear && cM <= endMonth)) {
        competencias.push(`${cY}-${String(cM).padStart(2, "0")}`);
        cM++;
        if (cM > 12) { cM = 1; cY++; }
      }

      const responsavelFilter = (visaoPessoa === "casal" || visaoPessoa === "geral") ? undefined
        : visaoPessoa === "pessoa1" ? "Pessoa 1"
        : "Pessoa 2";

      let despesasQ = supabase.from("despesas").select("id,valor,data,categoria,responsavel,is_parcelada,recorrente,tipo_parcelamento").eq("user_id", userId).gte("data", periodStart).lte("data", periodEnd).eq("is_parcelada", false);
      let receitasQ = supabase.from("receitas").select("id,valor,data,categoria,responsavel,recorrente").eq("user_id", userId).gte("data", periodStart).lte("data", periodEnd);
      let despesasRecQ = supabase.from("despesas").select("id,valor,data,categoria,responsavel,is_parcelada,recorrente,tipo_parcelamento").eq("user_id", userId).eq("recorrente", true).eq("is_parcelada", false);
      let receitasRecQ = supabase.from("receitas").select("id,valor,data,categoria,responsavel,recorrente").eq("user_id", userId).eq("recorrente", true);
      if (responsavelFilter) {
        despesasQ = despesasQ.eq("responsavel", responsavelFilter);
        receitasQ = receitasQ.eq("responsavel", responsavelFilter);
        despesasRecQ = despesasRecQ.eq("responsavel", responsavelFilter);
        receitasRecQ = receitasRecQ.eq("responsavel", responsavelFilter);
      }

      const [
        despesasRes, receitasRes, economiasRes, invRes, aposentRes,
        empRes, negRes, snapshotsRes, scoreSnapshotsRes, instRes,
        despesasRecRes, receitasRecRes,
      ] = await Promise.all([
        despesasQ,
        receitasQ,
        supabase.from("economias").select("valor,data,destino_tipo").eq("user_id", userId).gte("data", periodStart).lte("data", periodEnd),
        supabase.from("investimentos_financeiros").select("valor_atual,valor,classe,is_reserva_emergencia").eq("user_id", userId),
        supabase.from("aposentadoria").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("empresas_usuario").select("*").eq("user_id", userId).maybeSingle(),
        // Fetch ALL active companies — was .limit(1), ignored 2nd+ companies
        fetchAllCompaniesTransactions(userId, periodStart, periodEnd).then(data => ({ data })),
        supabase.from("portfolio_snapshots").select("total_value,month_ref").eq("user_id", userId).order("month_ref", { ascending: true }).limit(120),
        supabase.from("atlas_score_snapshots").select("score,snapshot_date").eq("user_id", userId).order("snapshot_date", { ascending: false }).limit(100),
        // Fetch installment instances for the period (joined with parent despesas to get tipo_parcelamento)
        supabase.from("installment_instances" as any).select("amount,status,competencia,despesas(tipo_parcelamento)").eq("user_id", userId).in("competencia", competencias),
        despesasRecQ,
        receitasRecQ,
      ]);

      const despesasFisicas = (despesasRes.data as any[]) || [];
      const receitasFisicas = (receitasRes.data as any[]) || [];
      const despesasRecorrentes = (despesasRecRes.data as any[]) || [];
      const receitasRecorrentes = (receitasRecRes.data as any[]) || [];
      const economias = economiasRes.data || [];
      const investimentos = invRes.data || [];
      const aposentData = aposentRes.data;
      const empresa = empRes.data;
      // Normalize business_transactions to legacy format for score computation
      const rawNeg = negRes.data || [];
      const negocio = rawNeg.map((t: any) => ({
        tipo: t.direction === "in" ? "entrada" : "saida",
        valor: Number(t.amount || 0),
        data: t.date,
      }));
      const snapshots = snapshotsRes.data || [];
      const scoreSnapshots = scoreSnapshotsRes.data || [];
      const installmentInstances = (instRes.data as unknown as { amount: number; status: string; competencia: string; despesas: { tipo_parcelamento: string | null } | null }[]) || [];

      // Project recurrences across the period
      const despesas = projectRecurringInRange(
        despesasFisicas, despesasRecorrentes, periodStart, periodEnd, skippedKeys
      );
      const receitas = projectRecurringInRange(
        receitasFisicas, receitasRecorrentes, periodStart, periodEnd
      );

      // Sum installment instance amounts as additional expenses — including all expenses and debts
      const installmentTotal = installmentInstances
        .reduce((s, i) => s + Number(i.amount), 0);

      // ── Compute inputs ──
      const reservaTotal = investimentos
        .filter((i: any) => i.is_reserva_emergencia)
        .reduce((s: number, i: any) => s + Number(i.valor_atual || i.valor || 0), 0);

      const now = new Date();
      // Number of months spanned by the period
      const nMonthsRange = Math.max(1, (endYear - startYear) * 12 + (endMonth - startMonth) + 1);

      // gastoMensalMedio3m: projected expenses (including all expenses and debts) + installments, divided by period months
      const totalDespProj = despesas.reduce((s: number, d: any) => s + Number(d.valor || 0), 0);
      const gastoMensalMedio = (totalDespProj + installmentTotal) / nMonthsRange;
      const mesesDespDisp = nMonthsRange;

      const totalReceitasProj = receitas.reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
      const totalReceitas = totalReceitasProj;
      const totalDespesas = totalDespProj + installmentTotal;

      const allDates = new Set([
        ...despesas.map((d: any) => d.data),
        ...receitas.map((r: any) => r.data),
        ...economias.map((e: any) => e.data),
      ]);
      const start = new Date(periodStart);
      const end = new Date(periodEnd);
      const diasPeriodo = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      const diasComLancamento = allDates.size;
      const totalLanc = despesas.length + receitas.length + economias.length;
      const lancComCat = despesas.filter((d: any) => d.categoria).length + receitas.filter((r: any) => r.categoria).length;
      const pctComCategoria = totalLanc > 0 ? lancComCat / totalLanc : 1;

      const totalInv = investimentos.reduce((s: number, i: any) => s + Number(i.valor_atual || i.valor || 0), 0);
      const alocacaoPorClasse: Record<string, number> = {};
      if (totalInv > 0) {
        investimentos.forEach((i: any) => {
          const classe = i.classe || "Outros";
          alocacaoPorClasse[classe] = (alocacaoPorClasse[classe] || 0) + Number(i.valor_atual || i.valor || 0) / totalInv;
        });
      }

      const receitaMensalMedia = totalReceitasProj / nMonthsRange;

      const aportesInv = economias
        .filter((e: any) => e.destino_tipo === "investimento" || e.destino_tipo === "reserva")
        .reduce((s: number, e: any) => s + Number(e.valor), 0);
      const mesesEcon = new Set(economias.map((e: any) => e.data.substring(0, 7))).size;
      const aporteMensalMedio = mesesEcon > 0 ? aportesInv / mesesEcon : 0;

      let rendaProjetada = 0;
      let rendaObjetivo = 0;
      if (aposentData) {
        rendaObjetivo = Number(aposentData.renda_desejada || 0);
        const patAtual = totalInv;
        const idadeAtual = Number(aposentData.idade_atual || 30);
        const idadeApos = Number(aposentData.idade_aposentadoria || 60);
        const mesesAte = Math.max(0, (idadeApos - idadeAtual) * 12);
        const taxaNom = Number(aposentData.taxa_nominal || 0.10);
        const inflacao = Number(aposentData.inflacao || 0.05);
        const taxaReal = ((1 + taxaNom) / (1 + inflacao)) - 1;
        const taxaMensal = taxaReal > 0 ? Math.pow(1 + taxaReal, 1 / 12) - 1 : 0.004;
        const poup = Number(aposentData.poupanca_mensal || 0);
        if (mesesAte > 0 && taxaMensal > 0) {
          const patFuturo = patAtual * Math.pow(1 + taxaMensal, mesesAte) +
            poup * ((Math.pow(1 + taxaMensal, mesesAte) - 1) / taxaMensal);
          rendaProjetada = patFuturo * 0.04 / 12;
        }
      }

      let plBase = 0;
      let plBaseMonths = 0;
      if (snapshots.length >= 2) {
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString().substring(0, 7);
        const threeMonthsAgoStr = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().substring(0, 7);
        const snap6 = snapshots.find((s: any) => s.month_ref <= sixMonthsAgo);
        const snap3 = snapshots.find((s: any) => s.month_ref <= threeMonthsAgoStr);
        if (snap6) { plBase = Number(snap6.total_value); plBaseMonths = 6; }
        else if (snap3) { plBase = Number(snap3.total_value); plBaseMonths = 3; }
        else { plBase = Number(snapshots[0].total_value); plBaseMonths = Math.max(1, snapshots.length); }
      }

      const hasEmpresa = !!empresa;
      const empresaReceita = negocio.filter((l: any) => l.tipo === "entrada").reduce((s: number, l: any) => s + Number(l.valor), 0);
      const empresaDespesa = negocio.filter((l: any) => l.tipo === "saida").reduce((s: number, l: any) => s + Number(l.valor), 0);
      const mesesNeg = new Set(negocio.map((l: any) => l.data.substring(0, 7)));
      const empresaDespMensalMedia = mesesNeg.size > 0 ? empresaDespesa / mesesNeg.size : 0;

      const mesesLucro: Record<string, number> = {};
      negocio.forEach((l: any) => {
        const m = l.data.substring(0, 7);
        mesesLucro[m] = (mesesLucro[m] || 0) + (l.tipo === "entrada" ? Number(l.valor) : -Number(l.valor));
      });
      const mesesComLucro = Object.values(mesesLucro).filter(v => v > 0).length;
      const empresaMesesComLucro = mesesNeg.size > 0 ? mesesComLucro / mesesNeg.size : 0;

      const inputs: AtlasScoreInputs = {
        reservaTotal, gastoMensalMedio3m: gastoMensalMedio, mesesDespesaDisp: mesesDespDisp,
        totalReceitas, totalDespesas, diasComLancamento, diasPeriodo, pctComCategoria,
        alocacaoPorClasse, aposentModuloPreenchido: !!aposentData && rendaObjetivo > 0,
        rendaProjetada, rendaObjetivo, aporteMensalMedio3m: aporteMensalMedio,
        receitaMensalMedia, plAtual: totalInv, plBase, plBaseMonths,
        hasEmpresa, empresaReceita, empresaDespesa,
        empresaCaixa: empresaReceita - empresaDespesa,
        empresaDespMensalMedia, empresaMesesComLucro,
      };

      const scoreResult = computeAtlasScore(inputs);
      setResult(scoreResult);
      setScoreInputs(inputs);

      // Evolution: compare with snapshot from ~3 months ago
      const threeMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const threeMonthsAgoStr2 = threeMonthsAgoDate.toISOString().split("T")[0];
      const oldSnapshot = scoreSnapshots.find((s: any) => s.snapshot_date <= threeMonthsAgoStr2);
      if (oldSnapshot) {
        setEvolution3m(scoreResult.score - Number(oldSnapshot.score));
      } else {
        setEvolution3m(null);
      }

      // Save snapshot
      const today = new Date().toISOString().split("T")[0];
      const breakdownJson = scoreResult.pillars.map(p => ({
        key: p.key, label: p.label, score: p.score, weight: p.weight,
        status: p.status, inputs: p.inputs, tip: p.tip,
      }));

      await supabase.from("atlas_score_snapshots" as any).upsert({
        user_id: userId, period_start: periodStart, period_end: periodEnd,
        snapshot_date: today, score: scoreResult.score,
        label: scoreResult.label.toLowerCase(), breakdown: breakdownJson,
      } as any, { onConflict: "user_id,period_start,period_end,snapshot_date" });

      setLoading(false);
    } catch (err) {
      logError("Atlas Score computation error:", err);
      if (retryCount < 2) {
        const delay = 1000 * Math.pow(2, retryCount);
        setTimeout(() => compute(retryCount + 1), delay);
        return;
      }
      setError("Erro ao calcular seu Atlas Score.");
      setResult(null);
      setScoreInputs(null);
      setLoading(false);
    }
  }, [userId, periodStart, periodEnd, visaoPessoa, skippedKeys]);

  useEffect(() => { compute(); }, [compute]);

  return { loading, error, result, scoreInputs, evolution3m, refresh: compute };
}
