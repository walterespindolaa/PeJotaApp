import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logError } from "@/lib/log";

export type PushStatus = "loading" | "unsupported" | "denied" | "active" | "inactive";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

let vapidKeyCache: string | null = null;

async function fetchVapidPublicKey(): Promise<string | null> {
  if (vapidKeyCache) return vapidKeyCache;
  try {
    const { data, error } = await supabase.functions.invoke("vapid-public-key");
    if (!error && data?.vapid_public_key) {
      vapidKeyCache = data.vapid_public_key;
      return vapidKeyCache;
    }
  } catch (err) {
    logError("[Push] Failed to fetch VAPID key:", err);
  }
  return null;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [status, setStatus] = useState<PushStatus>("loading");
  const [loading, setLoading] = useState(false);

  const isSupported = typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const checkStatus = useCallback(async () => {
    if (!isSupported) {
      setStatus("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    if (!user) {
      setStatus("inactive");
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        setStatus("inactive");
        return;
      }

      const { data } = await supabase
        .from("push_subscriptions")
        .select("is_active")
        .eq("user_id", user.id)
        .eq("endpoint", subscription.endpoint)
        .maybeSingle();

      setStatus(data?.is_active ? "active" : "inactive");
    } catch {
      setStatus("inactive");
    }
  }, [user, isSupported]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  const subscribe = useCallback(async () => {
    if (!isSupported || !user) return false;
    setLoading(true);

    try {
      const vapidPublicKey = await fetchVapidPublicKey();
      if (!vapidPublicKey) {
        logError("[Push] No VAPID public key available");
        setLoading(false);
        return false;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        setLoading(false);
        return false;
      }

      const registration = await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      const subJson = subscription.toJSON();
      const endpoint = subJson.endpoint!;
      const p256dh = subJson.keys!.p256dh!;
      const auth = subJson.keys!.auth!;

      const { error } = await supabase
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            endpoint,
            p256dh,
            auth,
            is_active: true,
            platform: detectPlatform(),
            user_agent: navigator.userAgent.substring(0, 255),
          },
          { onConflict: "endpoint" }
        );

      if (error) throw error;

      setStatus("active");
      setLoading(false);
      return true;
    } catch (err) {
      logError("[Push] Subscribe failed:", err);
      setLoading(false);
      return false;
    }
  }, [user, isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!user) return false;
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await supabase
          .from("push_subscriptions")
          .update({ is_active: false })
          .eq("user_id", user.id)
          .eq("endpoint", subscription.endpoint);

        await subscription.unsubscribe();
      }

      setStatus("inactive");
      setLoading(false);
      return true;
    } catch (err) {
      logError("[Push] Unsubscribe failed:", err);
      setLoading(false);
      return false;
    }
  }, [user]);

  const sendTest = useCallback(async () => {
    if (!user) return false;
    try {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: {
          mode: "self",
          title: "PeJota 🧭",
          message: "Notificações push ativadas com sucesso!",
          url: "/dashboard",
        },
      });
      return !error && data?.sent > 0;
    } catch {
      return false;
    }
  }, [user]);

  return { status, loading, subscribe, unsubscribe, sendTest, isSupported };
}

function detectPlatform(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPad|iPhone|iPod/i.test(ua)) return "ios";
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac/i.test(ua)) return "macos";
  if (/Linux/i.test(ua)) return "linux";
  return "unknown";
}
