import { kv } from "@vercel/kv";

const KEY = "ui-settings";
const DEFAULTS = {
  assignment_text_color:       "#92d4a7",
  assignment_border_color:     "#92d4a7",
  assignment_background_color: "#1a1a1a",
  progress_bar_color:          "#6b8cff"
};
const CORS_HEADERS = {
  "Content-Type":                "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PATCH,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

export async function GET() {
  const stored = (await kv.hgetall(KEY)) || {};
  const data   = { ...DEFAULTS, ...stored };
  return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
}

export async function PATCH(request) {
  const updates = await request.json();
  await kv.hmset(KEY, updates);
  const stored = (await kv.hgetall(KEY)) || {};
  const data   = { ...DEFAULTS, ...stored };
  return new Response(JSON.stringify(data), { headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}
