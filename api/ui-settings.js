import { kv } from "@vercel/kv";

const KEY = "ui-settings";

export async function GET() {
  const data = await kv.hgetall(KEY) || {
    assignment_text_color: "#92d4a7",
    assignment_border_color: "#92d4a7",
    assignment_background_color: "#1a1a1a",
    progress_bar_color: "#6b8cff"
  };
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

export async function PATCH(request) {
  const updates = await request.json();
  await kv.hmset(KEY, updates);
  return new Response(JSON.stringify({ ok: true }), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
