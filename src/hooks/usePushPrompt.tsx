import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "atlas_push_prompt";

export type PromptState = "idle" | "show" | "dismissed" | "converted" | "denied";

interface PromptData {
  state: PromptState;
  dismissCount: number;
  lastDismissed: string | null;
  pageViews: number;
}

const DEFAULT: PromptData = { state: "idle", dismissCount: 0, lastDismissed: null, pageViews: 0 };

function load(): PromptData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : { ...DEFAULT };
  } catch {
    return { ...DEFAULT };
  }
}

function save(d: PromptData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
}

/**
 * Controls when to show the 2-step push pre-permission prompt.
 * Rules:
 * - Shows on first access
 * - Shows on every new session (>30 min) unless converted/denied
 * - Max 10 dismissals with 6-hour cooldown
 * - Never if Notification permission already granted or denied
 */
export function usePushPrompt() {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<PromptData>(DEFAULT);

  useEffect(() => {
    if (!user) return;
    const d = load();
    d.pageViews += 1;
    save(d);
    setData(d);

    if (d.state === "converted" || d.state === "denied") return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") {
      d.state = "converted"; save(d); return;
    }
    if (Notification.permission === "denied") {
      d.state = "denied"; save(d); return;
    }
    if (d.dismissCount >= 10) return;

    if (d.lastDismissed) {
      const diff = Date.now() - new Date(d.lastDismissed).getTime();
      const sixHours = 6 * 60 * 60 * 1000;
      if (diff < sixHours) return;
    }

    // New session detection: 30 mins since last exhibition
    const lastShown = localStorage.getItem("atlas_push_last_shown");
    if (lastShown) {
      const diff = Date.now() - parseInt(lastShown);
      const thirtyMins = 30 * 60 * 1000;
      if (diff < thirtyMins) return;
    }

    const timer = setTimeout(() => {
      setVisible(true);
      localStorage.setItem("atlas_push_last_shown", Date.now().toString());
    }, 2500);
    return () => clearTimeout(timer);
  }, [user]);

  const dismiss = useCallback(() => {
    setVisible(false);
    const d = load();
    d.state = "dismissed";
    d.dismissCount += 1;
    d.lastDismissed = new Date().toISOString();
    save(d);
    setData(d);
  }, []);

  const markConverted = useCallback(() => {
    setVisible(false);
    const d = load();
    d.state = "converted";
    save(d);
    setData(d);
  }, []);

  const markDenied = useCallback(() => {
    setVisible(false);
    const d = load();
    d.state = "denied";
    save(d);
    setData(d);
  }, []);

  return { visible, dismiss, markConverted, markDenied, data };
}
