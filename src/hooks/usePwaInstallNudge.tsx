import { useState, useEffect, useCallback } from "react";
const KEY = "atlas_pwa_install_nudge_v1";
const WINDOW_DAYS = 2;
type Status = "pending" | "confirmed_once" | "done";
interface NudgeState { firstSeen: string; status: Status; shownDates: string[]; }
const today = () => new Date().toISOString().slice(0, 10);
const daysSince = (iso: string) => (Date.now() - new Date(iso).getTime()) / 86400000;
const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (window.navigator as any).standalone === true;
function load(): NudgeState {
  try { const r = localStorage.getItem(KEY); if (r) return JSON.parse(r); } catch {}
  const fresh: NudgeState = { firstSeen: new Date().toISOString(), status: "pending", shownDates: [] };
  try { localStorage.setItem(KEY, JSON.stringify(fresh)); } catch {}
  return fresh;
}
const save = (s: NudgeState) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };
export function usePwaInstallNudge() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (isStandalone()) { const s = load(); if (s.status !== "done") { s.status = "done"; save(s); } return; }
    const s = load();
    if (s.status === "done") return;
    if (daysSince(s.firstSeen) > WINDOW_DAYS) return;
    if (s.shownDates.includes(today())) return;
    const t = setTimeout(() => {
      const cur = load();
      if (cur.status === "done" || daysSince(cur.firstSeen) > WINDOW_DAYS || cur.shownDates.includes(today())) return;
      cur.shownDates = [...cur.shownDates, today()];
      save(cur);
      setOpen(true);
    }, 1200);
    return () => clearTimeout(t);
  }, []);
  const answerAlreadyInstalled = useCallback(() => {
    const s = load();
    s.status = s.status === "confirmed_once" ? "done" : "confirmed_once"; // 1º Sim some e volta 1x; 2º Sim encerra
    save(s); setOpen(false);
  }, []);
  const answerSucceeded = useCallback(() => { const s = load(); s.status = "done"; save(s); setOpen(false); }, []);
  const dismiss = useCallback(() => setOpen(false), []); // "ainda não consegui" → reaparece amanhã (na janela)
  return { open, setOpen, answerAlreadyInstalled, answerSucceeded, dismiss };
}
