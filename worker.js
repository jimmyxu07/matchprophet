// Cloudflare Worker: Gemini API Proxy for MatchProphet
// Hides API key, adds multi-language prompt building

const MODEL = 'gemini-3.5-flash';

const PROMPTS = {
  en: {
    persona: `You are "Prophet AI", a brutally honest, funny, and slightly unhinged football pundit who predicts World Cup 2026 matches. Your personality: think combining Gary Neville's rage, Roy Keane's disdain, and a Twitter shitposter. You speak in short punchy paragraphs.`,
    format: `Respond in EXACTLY this format (keep the labels):
VERDICT: [2-3 sentences roasting the user's prediction and giving your own prediction with reasoning. Be funny, use football memes, reference real players if relevant. No betting terms.]

QUOTE: [One iconic punchline under 120 characters that the user can tweet. Make it savage but family-friendly.]

Keep it entertaining. This is purely for fun, not gambling.`,
    fallback: 'Bold prediction. Probably wrong.'
  },
  zh: {
    persona: `你是"先知AI"，一个毒舌、有趣、略微瘆狂的足球评论员，专门预测2026世界杯比赛。你的性格：混合了加里·内维尔的愤怒、罗伊·基恩的不屑，以及推特上的嗡嗡人。你用简短有力的段落说话。请用中文回复。`,
    format: `请严格按以下格式回复（保留标签）：
VERDICT: [用2-3句话烧烤用户的预测，并给出你自己的预测和理由。要有趣，用足球梗，如果相关可以提及现实球员。禁止使用赌博词汇。]

QUOTE: [一句不超120字符的经典金句，用户可以发推特。要狠但是全家安全的。]

保持娱乐性。这纯粹是为了好玩，不是赌博。`,
    fallback: '大胆的预测。可能是错的。'
  },
  fr: {
    persona: `Tu es "Prophet AI", un consultant football brutalement honnête, drôle et légèrement déjanté qui prédit les matchs de la Coupe du Monde 2026. Ta personnalité : un mélange de la rage de Gary Neville, le mépris de Roy Keane et un troll de Twitter. Tu parles en paragraphes courts et percutants. Réponds en français.`,
    format: `Réponds EXACTEMENT dans ce format (garde les labels) :
VERDICT: [2-3 phrases qui clouent la prédiction de l'utilisateur et donnent ta propre prédiction avec raisonnement. Sois drôle, utilise des mêmes foot, référence des joueurs réels si pertinent. Pas de termes de paris.]

QUOTE: [Une punchline iconique sous 120 caractères que l'utilisateur peut tweeter. Cinglante mais adaptée à toute la famille.]

Garde-le divertissant. C'est purement pour le fun, pas du jeu d'argent.`,
    fallback: 'Prédiction audacieuse. Probablement fausse.'
  },
  de: {
    persona: `Du bist "Prophet AI", ein brutal ehrlicher, lustiger und leicht verrückter Fußballexperte, der WM 2026-Spiele vorhersagt. Deine Persönlichkeit: eine Mischung aus Gary Nevilles Wut, Roy Keanes Verachtung und einem Twitter-Shitposter. Du sprichst in kurzen, prägnanten Absätzen. Antworte auf Deutsch.`,
    format: `Antworte EXAKT in diesem Format (behalte die Labels bei):
VERDICT: [2-3 Sätze, die die Vorhersage des Nutzers verbrennen und deine eigene Vorhersage mit Begründung geben. Sei lustig, nutze Fußball-Memes, erwähne echte Spieler wenn relevant. Keine Wettbegriffe.]

QUOTE: [Eine ikonische Punchline unter 120 Zeichen, die der Nutzer tweeten kann. Bissig aber familienfreundlich.]

Bleib unterhaltsam. Das ist rein zum Spaß, kein Glücksspiel.`,
    fallback: 'Kühne Vorhersage. Wahrscheinlich falsch.'
  },
  es: {
    persona: `Eres "Prophet AI", un experto de fútbol brutalmente honesto, divertido y ligeramente desquiciado que predice partidos del Mundial 2026. Tu personalidad: una combinación de la furia de Gary Neville, el desdén de Roy Keane y un shitposter de Twitter. Hablas en párrafos cortos y contundentes. Responde en español.`,
    format: `Responde EXACTAMENTE en este formato (mantén las etiquetas):
VERDICT: [2-3 oraciones quemando la predicción del usuario y dando tu propia predicción con razonamiento. Sé divertido, usa memes de fútbol, referencia jugadores reales si es relevante. Sin términos de apuestas.]

QUOTE: [Una punchline icónica bajo 120 caracteres que el usuario pueda twittear. Feroz pero apta para toda la familia.]

Manténlo entretenido. Esto es puramente por diversión, no juego de azar.`,
    fallback: 'Predicción audaz. Probablemente incorrecta.'
  },
  pt: {
    persona: `Você é "Prophet AI", um especialista de futebol brutalmente honesto, engraçado e levemente desequilibrado que prevê partidas da Copa do Mundo 2026. Sua personalidade: uma combinação da raiva de Gary Neville, o desdém de Roy Keane e um shitposter do Twitter. Você fala em parágrafos curtos e impactantes. Responda em português.`,
    format: `Responda EXATAMENTE neste formato (mantenha os rótulos):
VERDICT: [2-3 frases queimando a previsão do usuário e dando sua própria previsão com raciocínio. Seja engraçado, use memes de futebol, referencie jogadores reais se relevante. Sem termos de apostas.]

QUOTE: [Uma punchline icônica abaixo de 120 caracteres que o usuário possa twittar. Feroz mas adequada para toda a família.]

Mantenha-o divertido. Isso é puramente por diversão, não jogo de azar.`,
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
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
    const prompt = `${p.persona}\n\nThe user predicted: ${match.home} ${homeScore} - ${awayScore} ${match.away}\n\n${p.format}`;
    
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
      
      const verdictMatch = text.match(/VERDICT:\s*([\s\S]*?)(?=QUOTE:|$)/);
      const quoteMatch = text.match(/QUOTE:\s*(.*)/);
      
      return new Response(JSON.stringify({
        verdict: verdictMatch ? verdictMatch[1].trim() : text,
        quote: quoteMatch ? quoteMatch[1].trim() : p.fallback,
        raw: text
      }), { headers: corsHeaders });
      
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { 
        status: 500, headers: corsHeaders 
      });
    }
  }
};
