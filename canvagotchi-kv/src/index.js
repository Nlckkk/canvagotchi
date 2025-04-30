// src/index.js

// CORS headers for all API responses
const CORS_HEADERS = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
  };
  
  // Your existing API handler, now with CORS built in
  async function handleApi(request, env) {
	if (request.method === 'OPTIONS') {
	  return new Response(null, { headers: CORS_HEADERS });
	}
  
	if (request.method === 'GET') {
	  const data = (await env.UI_SETTINGS.get('colors', { type: 'json' })) || {};
	  return new Response(JSON.stringify(data), {
		headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
	  });
	}
  
	if (request.method === 'PATCH') {
	  const updates = await request.json();
	  await env.UI_SETTINGS.put('colors', JSON.stringify(updates));
	  return new Response(JSON.stringify(updates), {
		headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
	  });
	}
  
	return new Response('Method Not Allowed', {
	  status: 405,
	  headers: CORS_HEADERS,
	});
  }
  
  // A simple mime-type helper for your static files
  function guessType(path) {
	if (path.endsWith('.html')) return 'text/html';
	if (path.endsWith('.js'))   return 'application/javascript';
	if (path.endsWith('.css'))  return 'text/css';
	if (path.endsWith('.png'))  return 'image/png';
	if (path.endsWith('.svg'))  return 'image/svg+xml';
	return 'application/octet-stream';
  }
  
  export default {
	async fetch(request, env) {
	  const url = new URL(request.url);
  
	  // 1) API route
	  if (url.pathname === '/api/ui-settings') {
		return handleApi(request, env);
	  }
  
	  // 2) Static assets from public/
	  let key = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  
	  // attempt direct lookup
	  let body = await env.__STATIC_CONTENT.get(key);
  
	  // **NEW**: if an HTML file isn't found, try to match its fingerprinted variant
	  if (!body && key.endsWith('.html')) {
		const base = key.replace(/\.html$/, '');               // "settings"
		const { keys } = await env.__STATIC_CONTENT.list({ prefix: '' });
		const match = keys.find(k => 
		  k.name.startsWith(base + '.') && k.name.endsWith('.html')
		);
		if (match) {
		  body = await env.__STATIC_CONTENT.get(match.name);
		  key = match.name; // update for correct MIME detection
		}
	  }
  
	  if (body) {
		return new Response(body, {
		  headers: { 'Content-Type': guessType(key) },
		});
	  }
  
	  // 3) Diagnostic: list every static file
	  let listing = [];
	  try {
		const { keys } = await env.__STATIC_CONTENT.list({ prefix: '' });
		listing = keys.map(k => k.name);
	  } catch (e) {
		listing = [`<listing error: ${e.message}>`];
	  }
  
	  return new Response(
		`404 Not Found: ${key}\n\nStatic files present:\n` +
		listing.join('\n'),
		{
		  status: 404,
		  headers: { 'Content-Type': 'text/plain' },
		}
	  );
	}
  };
  