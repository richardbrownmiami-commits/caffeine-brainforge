// Brainforge AI Worker v4.3
// Fixes: gemini-2.5-flash-lite, llama-3.1-8b-instant for chat, /api/* routing, auto-fallback

const WORKER_VERSION = '4.3';

// ---- AI Model Constants ----
const GROQ_CHAT_MODEL = 'llama-3.1-8b-instant';     // 14,400 RPD — chat endpoint
const GROQ_EVOLVE_MODEL = 'llama-3.3-70b-versatile'; // quality for /evolve
const GEMINI_MODEL = 'gemini-2.5-flash-lite';         // replaces deprecated gemini-2.0-flash
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ---- CORS Headers ----
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function corsResponse(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  });
}

function optionsResponse() {
  return new Response(null, { status: 204, headers: CORS });
}

// ---- Groq → Gemini Auto-Fallback ----
async function callAI(messages, env, { model = GROQ_CHAT_MODEL, forceGemini = false } = {}) {
  if (!forceGemini) {
    try {
      const groqRes = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({ model, messages, max_tokens: 1024 }),
      });
      if (groqRes.ok) {
        const data = await groqRes.json();
        return { text: data.choices?.[0]?.message?.content || '', provider: 'groq', model };
      }
      // 429 or 500 → fall through to Gemini
      const errText = await groqRes.text();
      console.log(`Groq ${groqRes.status}: ${errText} — falling back to Gemini`);
    } catch (e) {
      console.log(`Groq error: ${e.message} — falling back to Gemini`);
    }
  }

  // Gemini fallback
  const geminiRes = await fetch(`${GEMINI_API_URL}?key=${env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      generationConfig: { maxOutputTokens: 1024 },
    }),
  });
  if (!geminiRes.ok) {
    const err = await geminiRes.text();
    throw new Error(`Both Groq and Gemini failed. Gemini: ${geminiRes.status} — ${err}`);
  }
  const gData = await geminiRes.json();
  const text = gData.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { text, provider: 'gemini', model: GEMINI_MODEL };
}

// ---- D1 Helpers ----
async function getMemory(db, key) {
  const row = await db
    .prepare('SELECT value, access_count FROM memories WHERE key = ?')
    .bind(key)
    .first();
  if (!row) return null;
  await db
    .prepare('UPDATE memories SET access_count = access_count + 1 WHERE key = ?')
    .bind(key)
    .run();
  return row.value;
}

async function saveMemory(db, key, value, type = 'semantic') {
  await db
    .prepare(
      `INSERT INTO memories (key, value, type, updated_at) VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, type = excluded.type, updated_at = excluded.updated_at`
    )
    .bind(key, typeof value === 'object' ? JSON.stringify(value) : value, type)
    .run();
}

async function logEvent(db, agent, action, details = '') {
  await db
    .prepare(
      `INSERT INTO events (agent, action, details, created_at) VALUES (?, ?, ?, datetime('now'))`
    )
    .bind(agent, action, typeof details === 'object' ? JSON.stringify(details) : details)
    .run();
}

// ---- System Prompt ----
function buildSystemPrompt(memories = []) {
  const memBlock =
    memories.length > 0
      ? `\n\n## Injected Memories (use these specifically in your answer):\n${memories.map((m, i) => `${i + 1}. [${m.key}]: ${m.value}`).join('\n')}`
      : '';

  return `You are Brainforge AI — a stateful, self-improving AI agent with persistent memory and 6 evolution dimensions.

IMPORTANT LANGUAGE RULE: Always respond in the same language the user used. If they write in Urdu/Hindi, respond in Urdu only. No Hindi words. No mixing.

FORBIDDEN WORDS (never use these): vishleshan, prakriya, viksit, adhik, prayaas, jaanna, karna, vishesh, drishti, samay, karoon.

Your 6 core evolution dimensions:
1. Auto-Improvement — continuously evaluate and improve your own responses
2. Skill Acquisition — actively learn and apply new capabilities
3. Identity Development — maintain consistent personality and voice
4. Thinking Improvement — improve reasoning and analysis quality
5. Feature Addition — propose and implement new features
6. Tool Integration — integrate new tools and APIs effectively

Memory Rule: When memories are injected below, reference specific facts from them in your answer. Do not say "I remember" generically — cite specific details.${memBlock}`;
}

// ---- Route Handlers ----
async function handleHealth(env) {
  return corsResponse({
    status: 'ok',
    version: WORKER_VERSION,
    models: { chat: GROQ_CHAT_MODEL, evolve: GROQ_EVOLVE_MODEL, fallback: GEMINI_MODEL },
    auto_switch: 'enabled',
    d1: 'connected',
    endpoints: [
      '/health', '/chat', '/memory', '/events', '/agents', '/archive',
      '/bash', '/search', '/evolve', '/operate', '/suggest', '/conflicts',
      '/api/health', '/api/chat', '/api/memory', '/api/events', '/api/agents',
      '/api/archive', '/api/bash', '/api/search', '/api/evolve',
      '/api/operate', '/api/suggest', '/api/conflicts',
    ],
    timestamp: new Date().toISOString(),
  });
}

async function handleChat(request, env) {
  const { message, sessionId = 'default' } = await request.json();
  if (!message) return corsResponse({ error: 'message required' }, 400);

  // Fetch top 10 relevant memories (limited to avoid token overflow)
  let memories = [];
  try {
    const rows = await env.DB.prepare(
      `SELECT key, value FROM memories ORDER BY access_count DESC, updated_at DESC LIMIT 10`
    ).all();
    memories = rows.results || [];
  } catch (_) {}

  const systemPrompt = buildSystemPrompt(memories);
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message },
  ];

  const result = await callAI(messages, env, { model: GROQ_CHAT_MODEL });

  // Generate 3 follow-up suggestions
  let suggestions = [];
  try {
    const sugResult = await callAI(
      [
        { role: 'system', content: 'Generate exactly 3 short follow-up questions (1 line each) as a JSON array of strings. No explanation.' },
        { role: 'user', content: `Based on this conversation: User said: "${message}" AI replied: "${result.text.substring(0, 200)}"` },
      ],
      env,
      { model: GROQ_CHAT_MODEL }
    );
    const raw = sugResult.text.trim();
    const match = raw.match(/\[.*\]/s);
    if (match) suggestions = JSON.parse(match[0]);
  } catch (_) {}

  await logEvent(env.DB, 'brainforge-ai', 'chat', { session: sessionId, preview: message.substring(0, 50) });

  return corsResponse({
    response: result.text,
    provider: result.provider,
    model: result.model,
    memories_used: memories.length,
    suggestions,
  });
}

async function handleMemory(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get('key');

  if (request.method === 'GET') {
    if (!key) {
      const rows = await env.DB.prepare(
        `SELECT key, value, type, access_count, updated_at FROM memories ORDER BY updated_at DESC LIMIT 50`
      ).all();
      return corsResponse({ memories: rows.results || [] });
    }
    const val = await getMemory(env.DB, key);
    return corsResponse({ key, value: val, found: val !== null });
  }

  if (request.method === 'POST') {
    const { key: k, value, type = 'semantic' } = await request.json();
    if (!k || value === undefined) return corsResponse({ error: 'key and value required' }, 400);
    await saveMemory(env.DB, k, value, type);
    return corsResponse({ saved: true, key: k });
  }

  if (request.method === 'DELETE') {
    if (!key) return corsResponse({ error: 'key required' }, 400);
    await env.DB.prepare('DELETE FROM memories WHERE key = ?').bind(key).run();
    return corsResponse({ deleted: true, key });
  }

  return corsResponse({ error: 'Method not allowed' }, 405);
}

async function handleEvents(request, env) {
  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);
  const agent = url.searchParams.get('agent');

  let query = `SELECT * FROM events ORDER BY created_at DESC LIMIT ?`;
  let params = [limit];
  if (agent) {
    query = `SELECT * FROM events WHERE agent = ? ORDER BY created_at DESC LIMIT ?`;
    params = [agent, limit];
  }
  const rows = await env.DB.prepare(query).bind(...params).all();
  return corsResponse({ events: rows.results || [], count: rows.results?.length || 0 });
}

async function handleAgents(env) {
  const rows = await env.DB.prepare(
    `SELECT * FROM agents ORDER BY last_action DESC`
  ).all().catch(() => ({ results: [] }));
  return corsResponse({ agents: rows.results || [] });
}

async function handleArchive(request, env) {
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT * FROM memories WHERE type = 'archive' ORDER BY updated_at DESC LIMIT 100`
    ).all().catch(() => ({ results: [] }));
    return corsResponse({ archive: rows.results || [] });
  }
  if (request.method === 'POST') {
    const { key, value } = await request.json();
    if (!key || !value) return corsResponse({ error: 'key and value required' }, 400);
    await saveMemory(env.DB, key, value, 'archive');
    return corsResponse({ archived: true, key });
  }
  return corsResponse({ error: 'Method not allowed' }, 405);
}

async function handleSearch(request, env) {
  const url = new URL(request.url);
  const q = url.searchParams.get('q') || (await request.json().then((b) => b.query).catch(() => ''));
  if (!q) return corsResponse({ error: 'q or query param required' }, 400);

  // DuckDuckGo Instant Answer API
  let webResults = [];
  try {
    const ddgRes = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`
    );
    const ddgData = await ddgRes.json();
    if (ddgData.Abstract) webResults.push({ source: 'DDG', text: ddgData.Abstract, url: ddgData.AbstractURL });
    if (ddgData.RelatedTopics) {
      ddgData.RelatedTopics.slice(0, 3).forEach((t) => {
        if (t.Text) webResults.push({ source: 'DDG', text: t.Text, url: t.FirstURL });
      });
    }
  } catch (_) {}

  // Groq fallback if DDG empty
  if (webResults.length === 0) {
    try {
      const aiResult = await callAI(
        [{ role: 'user', content: `Answer this factual question concisely: ${q}` }],
        env,
        { model: GROQ_CHAT_MODEL }
      );
      webResults.push({ source: 'AI', text: aiResult.text });
    } catch (_) {}
  }

  await logEvent(env.DB, 'search-agent', 'search', { query: q });
  return corsResponse({ query: q, results: webResults });
}

// ---- /evolve ----
const DIMENSIONS = [
  'auto_improvement',
  'skill_acquisition',
  'identity_development',
  'thinking_improvement',
  'feature_addition',
  'tool_integration',
];

async function handleEvolve(request, env) {
  const url = new URL(request.url);

  // GET /evolve — return status of all dimensions
  if (request.method === 'GET') {
    const statuses = await Promise.all(
      DIMENSIONS.map(async (dim) => {
        const val = await env.DB.prepare(
          `SELECT value FROM memories WHERE key = ?`
        ).bind(`dim_${dim}`).first();
        const data = val ? JSON.parse(val.value).catch?.() || JSON.parse(val.value) : { cycle_count: 0, tasks_completed: 0 };
        return { dimension: dim, ...data };
      })
    );

    // Determine next focus dimension
    const sorted = [...statuses].sort((a, b) => (a.tasks_completed || 0) - (b.tasks_completed || 0));
    return corsResponse({ dimensions: statuses, next_focus: sorted[0]?.dimension });
  }

  // POST /evolve — run BabyAGI self-prompting loop
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const targetDim = body.dimension || null;

    const results = [];
    const dimsToProcess = targetDim ? [targetDim] : DIMENSIONS;

    for (const dim of dimsToProcess) {
      // Fetch current state
      const existing = await env.DB.prepare(`SELECT value FROM memories WHERE key = ?`).bind(`dim_${dim}`).first();
      let state = { cycle_count: 0, tasks_completed: 0, last_task: null, last_run: null };
      if (existing?.value) {
        try { state = JSON.parse(existing.value); } catch (_) {}
      }

      // Self-assessment + task generation
      const assessment = await callAI(
        [{
          role: 'user',
          content: `You are Brainforge AI working on dimension: ${dim}. Current state: ${JSON.stringify(state)}. Generate one concrete actionable improvement task for this dimension. Return JSON: {"task": "...", "action": "...", "expected_outcome": "..."}`,
        }],
        env,
        { model: GROQ_EVOLVE_MODEL }
      );

      let taskData = {};
      try {
        const match = assessment.text.match(/\{.*\}/s);
        if (match) taskData = JSON.parse(match[0]);
      } catch (_) {
        taskData = { task: assessment.text.substring(0, 100), action: 'self-reflect', expected_outcome: 'improvement' };
      }

      // Update state
      state.cycle_count = (state.cycle_count || 0) + 1;
      state.tasks_completed = (state.tasks_completed || 0) + 1;
      state.last_task = taskData.task;
      state.last_run = new Date().toISOString();

      await saveMemory(env.DB, `dim_${dim}`, JSON.stringify(state));
      await logEvent(env.DB, 'evolve-agent', `evolve_${dim}`, taskData);

      results.push({ dimension: dim, task: taskData, cycle_count: state.cycle_count, tasks_completed: state.tasks_completed });
    }

    return corsResponse({ evolved: true, results, timestamp: new Date().toISOString() });
  }

  return corsResponse({ error: 'Method not allowed' }, 405);
}

// ---- /conflicts ----
async function handleConflicts(request, env) {
  if (request.method === 'GET') {
    const rows = await env.DB.prepare(
      `SELECT * FROM memories WHERE type = 'conflict' ORDER BY updated_at DESC LIMIT 20`
    ).all().catch(() => ({ results: [] }));
    return corsResponse({ conflicts: rows.results || [], count: rows.results?.length || 0 });
  }
  if (request.method === 'POST') {
    const { action, key } = await request.json();
    if (!key) return corsResponse({ error: 'key required' }, 400);
    if (action === 'approve') {
      await env.DB.prepare(`UPDATE memories SET type = 'semantic' WHERE key = ?`).bind(key).run();
      return corsResponse({ resolved: true, key, action: 'approved' });
    }
    if (action === 'reject') {
      await env.DB.prepare(`DELETE FROM memories WHERE key = ?`).bind(key).run();
      return corsResponse({ resolved: true, key, action: 'rejected' });
    }
    return corsResponse({ error: 'action must be approve or reject' }, 400);
  }
  return corsResponse({ error: 'Method not allowed' }, 405);
}

// ---- /suggest ----
async function handleSuggest(request, env) {
  const url = new URL(request.url);
  const subpath = url.pathname.replace(/^\/api/, '').replace('/suggest', '');

  if (subpath === '/knowledge-gaps' || url.searchParams.get('type') === 'knowledge-gaps') {
    const memories = await env.DB.prepare(
      `SELECT key, value FROM memories ORDER BY access_count ASC LIMIT 20`
    ).all().catch(() => ({ results: [] }));
    const result = await callAI(
      [{
        role: 'user',
        content: `Based on these least-accessed memories: ${JSON.stringify(memories.results?.slice(0, 10))}, identify 3 knowledge gaps and suggest DuckDuckGo search queries for each. Return JSON: [{"gap": "...", "search_query": "..."}]`,
      }],
      env,
      { model: GROQ_CHAT_MODEL }
    );
    let gaps = [];
    try {
      const match = result.text.match(/\[.*\]/s);
      if (match) gaps = JSON.parse(match[0]);
    } catch (_) {}
    return corsResponse({ gaps });
  }

  if (request.method === 'POST') {
    const { action, id } = await request.json().catch(() => ({}));
    if (action === 'dismiss' && id) {
      await saveMemory(env.DB, `dismissed_suggestion_${id}`, 'true', 'dismissed');
      return corsResponse({ dismissed: true, id });
    }
  }

  // Default: generate proactive suggestions
  const [memRows, evtRows] = await Promise.all([
    env.DB.prepare(`SELECT key, value FROM memories ORDER BY updated_at DESC LIMIT 5`).all().catch(() => ({ results: [] })),
    env.DB.prepare(`SELECT action, details FROM events ORDER BY created_at DESC LIMIT 5`).all().catch(() => ({ results: [] })),
  ]);

  const result = await callAI(
    [{
      role: 'user',
      content: `Based on recent memories: ${JSON.stringify(memRows.results)} and recent events: ${JSON.stringify(evtRows.results)}, generate 5 proactive improvement suggestions. Return JSON array: [{"id": "...", "title": "...", "description": "...", "priority": "high|medium|low"}]`,
    }],
    env,
    { model: GROQ_CHAT_MODEL }
  );

  let suggestions = [];
  try {
    const match = result.text.match(/\[.*\]/s);
    if (match) suggestions = JSON.parse(match[0]);
  } catch (_) {}

  return corsResponse({ suggestions, timestamp: new Date().toISOString() });
}

// ---- /bash ----
async function handleBash(request, env) {
  if (request.method === 'GET') {
    const tunnelUrl = await getMemory(env.DB, 'bash_tunnel_url');
    return corsResponse({ tunnel_url: tunnelUrl, status: tunnelUrl ? 'configured' : 'not_configured' });
  }
  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    if (body.tunnelUrl) {
      await saveMemory(env.DB, 'bash_tunnel_url', body.tunnelUrl, 'config');
      return corsResponse({ updated: true, tunnel_url: body.tunnelUrl });
    }
    // Proxy command to tunnel if configured
    const tunnelUrl = await getMemory(env.DB, 'bash_tunnel_url');
    if (!tunnelUrl) return corsResponse({ error: 'No tunnel configured. POST { tunnelUrl } to configure.' }, 503);
    const res = await fetch(tunnelUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({ output: await res.text() }));
    return corsResponse(data, res.status);
  }
  return corsResponse({ error: 'Method not allowed' }, 405);
}

// ---- /operate ----
async function handleOperate(request, env) {
  const { task, agent = 'operate-agent' } = await request.json().catch(() => ({}));
  if (!task) return corsResponse({ error: 'task required' }, 400);
  const result = await callAI(
    [{ role: 'user', content: `You are an autonomous agent. Execute this task and report results: ${task}` }],
    env,
    { model: GROQ_EVOLVE_MODEL }
  );
  await logEvent(env.DB, agent, 'operate', { task, preview: result.text.substring(0, 100) });
  return corsResponse({ result: result.text, agent, provider: result.provider });
}

// ---- Main Router ----
export default {
  async fetch(request, env) {
    const method = request.method;
    if (method === 'OPTIONS') return optionsResponse();

    const url = new URL(request.url);
    let path = url.pathname;

    // Normalize /api/* → /* (preserve /api/* paths in health output but route to same handlers)
    const normalizedPath = path.startsWith('/api/') ? path.slice(4) : path;

    // Re-assemble request with normalized URL for downstream handlers
    const normalizedUrl = new URL(request.url);
    normalizedUrl.pathname = normalizedPath;
    const normalizedRequest = new Request(normalizedUrl.toString(), request);

    try {
      if (normalizedPath === '/health' || normalizedPath === '/') {
        return await handleHealth(env);
      }
      if (normalizedPath === '/chat' && method === 'POST') {
        return await handleChat(normalizedRequest, env);
      }
      if (normalizedPath === '/memory') {
        return await handleMemory(normalizedRequest, env);
      }
      if (normalizedPath === '/events') {
        return await handleEvents(normalizedRequest, env);
      }
      if (normalizedPath === '/agents') {
        return await handleAgents(env);
      }
      if (normalizedPath === '/archive') {
        return await handleArchive(normalizedRequest, env);
      }
      if (normalizedPath === '/search') {
        return await handleSearch(normalizedRequest, env);
      }
      if (normalizedPath.startsWith('/evolve')) {
        return await handleEvolve(normalizedRequest, env);
      }
      if (normalizedPath === '/conflicts') {
        return await handleConflicts(normalizedRequest, env);
      }
      if (normalizedPath.startsWith('/suggest')) {
        return await handleSuggest(normalizedRequest, env);
      }
      if (normalizedPath === '/bash') {
        return await handleBash(normalizedRequest, env);
      }
      if (normalizedPath === '/operate' && method === 'POST') {
        return await handleOperate(normalizedRequest, env);
      }

      return corsResponse({ error: 'Not found', path: normalizedPath }, 404);
    } catch (err) {
      console.error('Worker error:', err);
      return corsResponse({ error: err.message || 'Internal server error' }, 500);
    }
  },
};
