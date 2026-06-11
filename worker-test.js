export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: cors });
    
    let body;
    try { body = await request.json(); } catch(e) { body = {}; }
    
    return new Response(JSON.stringify({ 
      ok: true, 
      received: body,
      hasKey: !!env.GEMINI_API_KEY,
      keyPrefix: env.GEMINI_API_KEY ? env.GEMINI_API_KEY.substring(0, 10) : null
    }), { headers: cors });
  }
};
