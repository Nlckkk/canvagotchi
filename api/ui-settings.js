// api/ui-settings.js

import { kv } from "@vercel/kv";

const KEY = "ui-settings";

export async function GET() {
  // Try to fetch the saved settings; if none exist, fall back to defaults
  const data = await kv.hgetall(KEY) || {
    assignment_text_color:       "#92d4a7",
    assignment_border_color:     "#92d4a7",
    assignment_background_color: "#1a1a1a",
    progress_bar_color:          "#6b8cff"
  };
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" }
  });
}

export async function PATCH(request) {
  // Read the JSON body (partial updates)
  const updates = await request.json();
  // Merge updates into the Redis hash
  await kv.hmset(KEY, updates);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" }
  });
}
