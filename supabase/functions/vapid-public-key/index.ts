import { getCorsHeadersWithContentType, getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(req) });
  }

  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  if (!vapidPublicKey) {
    return new Response(
      JSON.stringify({ error: "VAPID key not configured" }),
      { status: 500, headers: getCorsHeadersWithContentType(req) }
    );
  }

  return new Response(
    JSON.stringify({ vapid_public_key: vapidPublicKey }),
    { headers: getCorsHeadersWithContentType(req) }
  );
});
