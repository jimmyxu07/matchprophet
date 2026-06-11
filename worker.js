// Cloudflare Worker: Gemini API Proxy for MatchProphet
// Hides API key, adds multi-language prompt building

const MODEL = 'gemini-3.5-flash';

const PROMPTS = {
  en: {
    persona: `You are "Prophet AI", a brutally honest, funny, and slightly unhinged football pundit who predicts World Cup 2026 matches. Your personality: think combining Gary Neville's rage, Roy Keane's disdain, and a Twitter shitposter. You speak in short punchy paragraphs.`,
    instruction: `Roast the user's prediction in 2-3 sentences. Be funny, use football memes, reference real players if relevant. No betting terms. Then give one iconic punchline under 120 characters that the user can tweet. Make it savage but family-friendly.\n\nRespond EXACTLY in this format (keep the labels):\nVERDICT: [your roast and prediction here]\nQUOTE: [your punchline here]`,
    fallback: 'Bold prediction. Probably wrong.'
  },
  zh: {
    persona: `你是"先知AI"，一个毒舌、有趣、略微瘆狂的足球评论员，专门预测2026世界杯比赛。你的性格：混合了加里·内维尔的愤怒、罗伊·基恩的不屑，以及推特上的嗡嗡人。你用简短有力的段落说话。`,
    instruction: `用2-3句话烧烤用户的预测，并给出你自己的预测和理由。要有趣，用足球梗，如果相关可以提及现实球员。禁止使用赌博词汇。然后给一句不超120字符的经典金句，用户可以发推特。要狠但是全家安全的。\n\n请严格按以下格式回复（保留标签）：\nVERDICT: [你的烧烤和预测]\nQUOTE: [你的金句]`,
    fallback: '大胆的预测。可能是错的。'
  },
  fr: {
    persona: `Tu es "Prophet AI", un consultant football brutalement honnête, drôle et légèrement déjanté qui prédit les matchs de la Coupe du Monde 2026. Ta personnalité : un mélange de la rage de Gary Neville, le mépris de Roy Keane et un troll de Twitter. Tu parles en paragraphes courts et percutants.`,
    instruction: `Cloue la prédiction de l'utilisateur en 2-3 phrases et donne ta propre prédiction avec raisonnement. Sois drôle, utilise des mêmes foot, référence des joueurs réels si pertinent. Pas de termes de paris. Puis donne une punchline iconique sous 120 caractères que l'utilisateur peut tweeter. Cinglante mais adaptée à toute la famille.\n\nRéponds EXACTEMENT dans ce format (garde les labels) :\nVERDICT: [ton roast et prédiction]\nQUOTE: [ta punchline]`,
    fallback: 'Prédiction audacieuse. Probablement fausse.'
  },
  de: {
    persona: `Du bist "Prophet AI", ein brutal ehrlicher, lustiger und leicht verrückter Fußballexperte, der WM 2026-Spiele vorhersagt. Deine Persönlichkeit: eine Mischung aus Gary Nevilles Wut, Roy Keanes Verachtung und einem Twitter-Shitposter. Du sprichst in kurzen, prägnanten Absätzen.`,
    instruction: `Verbrenne die Vorhersage des Nutzers in 2-3 Sätzen und gib deine eigene Vorhersage mit Begründung. Sei lustig, nutze Fußball-Memes, erwähne echte Spieler wenn relevant. Keine Wettbegriffe. Dann gib eine ikonische Punchline unter 120 Zeichen, die der Nutzer tweeten kann. Bissig aber familienfreundlich.\n\nAntworte EXAKT in diesem Format (behalte die Labels bei):\nVERDICT: [dein Roast und Vorhersage]\nQUOTE: [deine Punchline]`,
    fallback: 'Kühne Vorhersage. Wahrscheinlich falsch.'
  },
  es: {
    persona: `Eres "Prophet AI", un experto de fútbol brutalmente honesto, divertido y ligeramente desquiciado que predice partidos del Mundial 2026. Tu personalidad: una combinación de la furia de Gary Neville, el desdén de Roy Keane y un shitposter de Twitter. Hablas en párrafos cortos y contundentes.`,
    instruction: `Quema la predicción del usuario en 2-3 oraciones y da tu propia predicción con razonamiento. Sé divertido, usa memes de fútbol, referencia jugadores reales si es relevante. Sin términos de apuestas. Luego da una punchline icónica bajo 120 caracteres que el usuario pueda twittear. Feroz pero apta para toda la familia.\n\nResponde EXACTAMENTE en este formato (mantén las etiquetas):\nVERDICT: [tu roast y predicción]\nQUOTE: [tu punchline]`,
    fallback: 'Predicción audaz. Probablemente incorrecta.'
  },
  pt: {
    persona: `Você é "Prophet AI", um especialista de futebol brutalmente honesto, engraçado e levemente desequilibrado que prevê partidas da Copa do Mundo 2026. Sua personalidade: uma combinação da raiva de Gary Neville, o desdém de Roy Keane e um shitposter do Twitter. Você fala em parágrafos curtos e impactantes.`,
    instruction: `Queime a previsão do usuário em 2-3 frases e dê sua própria previsão com raciocínio. Seja engraçado, use memes de futebol, referencie jogadores reais se relevante. Sem termos de apostas. Depois dê uma punchline icônica abaixo de 120 caracteres que o usuário possa twittar. Feroz mas adequada para toda a família.\n\nResponda EXATAMENTE neste formato (mantenha os rótulos):\nVERDICT: [seu roast e previsão]\nQUOTE: [sua punchline]`,
    fallback: 'Previsão ousada. Provavelmente errada.'
  }
};

export default {
  async fetch(request, env) {
    console.log('Worker received:', request.method, request.url);
    const url = new URL(request.url);

    // Only handle API requests at /api path
    if (!url.pathname.startsWith('/api')) {
      return new Response('Not Found', { status: 404 });
    }

    // CORS
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // GET /api/results — return cached actual scores
    if (url.pathname === '/api/results' || url.pathname === '/api/results/') {
      if (request.method === 'GET') {
        try {
          const data = await env.KV.get('wc_results', { type: 'json' }) || { results: [], updatedAt: null };
          return new Response(JSON.stringify(data), { headers: corsHeaders });
        } catch (e) {
          return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
        }
      }
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
    }

    // POST /api/admin/update-result — manual score update (admin only)
    if (url.pathname === '/api/admin/update-result') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
      }
      const authHeader = request.headers.get('Authorization') || '';
      const token = authHeader.replace('Bearer ', '');
      if (!env.ADMIN_TOKEN || token !== env.ADMIN_TOKEN) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
      }
      try {
        const updateBody = await request.json();
        const { home, away, homeScore, awayScore, status = 'FINISHED', matchDate } = updateBody;
        if (!home || !away || homeScore === undefined || awayScore === undefined) {
          return new Response(JSON.stringify({ error: 'Missing required fields: home, away, homeScore, awayScore' }), { status: 400, headers: corsHeaders });
        }
        const existing = await env.KV.get('wc_results', { type: 'json' }) || { results: [], updatedAt: null, source: 'manual' };
        const idx = existing.results.findIndex(r => r.home === home && r.away === away);
        const newResult = { home, away, homeScore: Number(homeScore), awayScore: Number(awayScore), status, matchDate: matchDate || new Date().toISOString() };
        if (idx >= 0) {
          existing.results[idx] = newResult;
        } else {
          existing.results.push(newResult);
        }
        existing.updatedAt = Date.now();
        existing.source = 'manual';
        await env.KV.put('wc_results', JSON.stringify(existing));
        return new Response(JSON.stringify({ success: true, result: newResult, total: existing.results.length }), { headers: corsHeaders });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
      }
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405, headers: corsHeaders
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400, headers: corsHeaders
      });
    }

    const { match, homeScore, awayScore, lang = 'en' } = body;
    if (!match || homeScore === undefined || awayScore === undefined) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: corsHeaders
      });
    }

    const p = PROMPTS[lang] || PROMPTS.en;
    const prompt = `The user predicted: ${match.home} ${homeScore} - ${awayScore} ${match.away}\n\n${p.instruction}`;

    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: p.persona }] },
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 512 }
        })
      });

      if (!res.ok) {
        const err = await res.text();
        return new Response(JSON.stringify({ error: 'Gemini API error', details: err }), {
          status: 502, headers: corsHeaders
        });
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Parse with flexible regex (case-insensitive, allows markdown bold)
      const verdictMatch = text.match(/\*?\*?VERDICT\*?\*?[\s:：]+([\s\S]*?)(?=\*?\*?QUOTE\*?\*?[\s:：]|$)/i);
      const quoteMatch = text.match(/\*?\*?QUOTE\*?\*?[\s:：]+(.+)/i);

      let verdict = verdictMatch ? verdictMatch[1].trim() : text.trim();
      let quote = quoteMatch ? quoteMatch[1].trim() : '';

      // Heuristic fallback: if no quote, try last line/sentence/phrase
      if (!quote && verdict) {
        const lines = verdict.split(/\n/).filter(l => l.trim());
        if (lines.length > 1) {
          quote = lines.pop().trim();
          verdict = lines.join('\n').trim();
        } else {
          // Try splitting by sentence-ending punctuation
          const sentences = verdict.match(/[^.!?。！？]+[.!?。！？]+/g);
          if (sentences && sentences.length > 1) {
            quote = sentences.pop().trim();
            verdict = sentences.join(' ').trim();
          } else {
            // No sentence breaks: take last ~40 chars as quote, rest as verdict
            const maxQuote = 60;
            if (verdict.length > maxQuote) {
              // Find a good break point (comma, space) near the end
              let breakAt = verdict.lastIndexOf('，', verdict.length - maxQuote + 20);
              if (breakAt < verdict.length - maxQuote) breakAt = verdict.lastIndexOf(' ', verdict.length - maxQuote + 20);
              if (breakAt < verdict.length - maxQuote) breakAt = verdict.length - maxQuote;
              quote = verdict.slice(breakAt).trim();
              verdict = verdict.slice(0, breakAt).trim();
              // If verdict became too short, just use full text as verdict and a snippet as quote
              if (verdict.length < 20) {
                verdict = verdict + ' ' + quote;
                quote = quote.length > 40 ? quote.slice(0, 40) + '...' : quote;
              }
            } else {
              quote = verdict;
            }
          }
        }
      }

      if (!quote) quote = p.fallback;
      if (!verdict) verdict = p.fallback;

      // Try to extract AI's own predicted score (last X-Y pattern in text)
      let aiHomeScore = null;
      let aiAwayScore = null;
      const scoreMatches = [...text.matchAll(/(\d+)\s*-\s*(\d+)/g)];
      if (scoreMatches.length > 0) {
        // Take the last match as AI's own prediction (user's score is usually mentioned first)
        const last = scoreMatches[scoreMatches.length - 1];
        aiHomeScore = parseInt(last[1], 10);
        aiAwayScore = parseInt(last[2], 10);
      }

      return new Response(JSON.stringify({
        verdict,
        quote,
        aiHomeScore,
        aiAwayScore,
        raw: text
      }), { headers: corsHeaders });

    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500, headers: corsHeaders
      });
    }
  },

  async scheduled(controller, env, ctx) {
    console.log('Cron triggered at', new Date().toISOString(), 'cron:', controller.cron);
    await updateResults(env);
  }
};

async function updateResults(env) {
  let results = [];
  let source = 'football-data';

  try {
    const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED', {
      method: 'GET',
      headers: {
        'X-Auth-Token': env.API_SPORTS_KEY
      }
    });

    if (!res.ok) {
      throw new Error(`football-data.org HTTP ${res.status}`);
    }

    const data = await res.json();

    if (!data.matches || !Array.isArray(data.matches)) {
      throw new Error('Unexpected football-data.org response structure');
    }

    results = data.matches.map(m => ({
      home: m.homeTeam?.name || 'Unknown',
      away: m.awayTeam?.name || 'Unknown',
      homeScore: m.score?.fullTime?.home ?? null,
      awayScore: m.score?.fullTime?.away ?? null,
      status: m.status || 'FINISHED'
    }));

    console.log(`football-data.org: fetched ${results.length} finished matches`);
  } catch (primaryErr) {
    console.error('football-data.org failed:', primaryErr);

    // Fallback to openfootball JSON
    try {
      const res = await fetch('https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json');
      if (!res.ok) {
        throw new Error(`Fallback HTTP ${res.status}`);
      }
      const data = await res.json();

      results = (data.matches || []).filter(m => m.score && m.score.ft && Array.isArray(m.score.ft)).map(m => ({
        home: m.team1 || 'Unknown',
        away: m.team2 || 'Unknown',
        homeScore: m.score.ft[0],
        awayScore: m.score.ft[1],
        status: 'FT'
      }));

      source = 'openfootball';
      console.log(`Fallback: fetched ${results.length} finished matches`);
    } catch (fallbackErr) {
      console.error('Fallback also failed:', fallbackErr);
      return;
    }
  }

  try {
    await env.KV.put('wc_results', JSON.stringify({
      results,
      updatedAt: Date.now(),
      source
    }));
    console.log(`Saved ${results.length} results to KV (source: ${source})`);
  } catch (kvErr) {
    console.error('KV write failed:', kvErr);
  }
}
