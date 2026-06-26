// Centralized CORS configuration — restrict to known origins
const allowedOrigins = [
  "https://app.useatlasapp.com",
  "https://useatlasapp.com",
  "https://app.walterespindola.com.br",
  "https://goal-planner-pal.lovable.app",
];

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  // Allow Lovable preview URLs dynamically
  const isLovablePreview = /^https:\/\/[a-zA-Z0-9-]+\.lovable\.app$/.test(origin);
  const allowOrigin = allowedOrigins.includes(origin) || isLovablePreview
    ? origin
    : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

export function getCorsHeadersWithContentType(req: Request) {
  return {
    ...getCorsHeaders(req),
    "Content-Type": "application/json",
  };
}