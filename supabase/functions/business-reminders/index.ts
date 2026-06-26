import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Cron diário: notifica o dono sobre aniversariantes do dia e clientes sumidos.
// Aniversários → todo dia. Inativos → só às segundas (evita spam diário).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null);
  try {
    const URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(URL, SERVICE);

    const isMonday = new Date().getUTCDay() === 1;

    const callPush = async (userId: string, title: string, message: string, tag: string) => {
      try {
        await fetch(`${URL}/functions/v1/send-push`, {
          method: "POST",
          headers: { Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "user", user_id: userId, title, message, url: "/dashboard/negocios/clientes", tag }),
        });
      } catch (e) { console.error("[business-reminders] push error:", e); }
    };

    const { data: rows, error } = await admin.rpc("business_reminders_today");
    if (error) { console.error("[business-reminders] rpc error:", error); return new Response(JSON.stringify({ error: error.message }), { status: 500 }); }

    let sent = 0;
    for (const r of (rows as any[]) || []) {
      const niver: string[] = r.aniversariantes || [];
      const inativos: string[] = r.inativos || [];
      const fmt = (arr: string[]) => arr.slice(0, 3).join(", ") + (arr.length > 3 ? `… (+${arr.length - 3})` : "");

      if (niver.length > 0) {
        await callPush(r.owner_id, "Aniversário de cliente", `Hoje é aniversário de: ${fmt(niver)}. Que tal mandar um oi?`, "atlas-negocios-niver");
        sent++;
      }
      if (isMonday && inativos.length > 0) {
        await callPush(r.owner_id, "Clientes sumidos", `${inativos.length} cliente(s) sem comprar há mais de 30 dias: ${fmt(inativos)}.`, "atlas-negocios-inativos");
        sent++;
      }
    }

    return new Response(JSON.stringify({ ok: true, owners: (rows as any[])?.length || 0, sent }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[business-reminders] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
