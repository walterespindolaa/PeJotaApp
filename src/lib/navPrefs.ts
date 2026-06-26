// Preferências de navegação salvas localmente (por dispositivo).
const KEY = "atlas:show_negocios_nav";
const EVENT = "atlas:nav-pref-changed";

export const NAV_PREF_EVENT = EVENT;

export function getShowNegociosNav(): boolean {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export function setShowNegociosNav(v: boolean): void {
  try {
    localStorage.setItem(KEY, String(v));
  } catch {
    // ignore (modo privado / storage indisponível)
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EVENT));
  }
}
