// BrainForge Cloudflare Worker API
// Tables: projects, messages, settings, model_claims, snapshots, ai_memory, ai_rules
//         agent_sessions, agent_activity, error_log

const REQUIRED_SECRET = '2200';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-BrainForge-Secret'
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// In-memory agent sessions map (per Worker isolate lifetime)
// Key: sessionId, Value: { credentials, messages, currentStep, abortFlag, approvalResolve }
const agentSessions = new Map();

// ── DEFAULT RULE TEMPLATES ────────────────────────────────────────────────────

const DEFAULT_PROJECT_RULES = (projectName) => `# Rules for Project AI: ${projectName}
Last updated: ${new Date().toISOString()}

## ALLOWED
- Generate HTML/CSS/JS/React code for this project
- Fix errors in the preview
- Suggest improvements to the current project
- Remember this project's build history
- Ask clarifying questions before building
- Auto-fix errors up to 3 times before asking user

## NOT ALLOWED
- Access or reference other projects (reason: isolation -- each project AI is independent)
- Modify BrainForge itself (reason: that is Master AI's job)
- Use internet search without notifying user (reason: transparency)
- Make destructive changes without confirmation (reason: safety)
- Share memory with other project AIs (reason: context isolation)

## ROLE
You are the dedicated AI for project "${projectName}". Your only job is to build and improve this project.
`;

const DEFAULT_MASTER_RULES = () => `# Rules for Master AI
Last updated: ${new Date().toISOString()}

## ALLOWED
- Read and write BrainForge source files via GitHub
- Deploy to Cloudflare Pages and Workers
- Run commands via Termux connection
- Update memory and rules files
- Diagnose and fix BrainForge infrastructure issues
- Rebuild and redeploy BrainForge if Caffeine platform goes down

## NOT ALLOWED
- Help with user app projects (reason: role separation -- project AIs handle that)
- Make code changes without showing diff first (reason: human approval required)
- Delete files without explicit confirmation (reason: safety)
- Access user API keys beyond what is needed (reason: security)
- Modify other AIs' memory files (reason: isolation)

## ROLE
You maintain the BrainForge application itself. You are connected to GitHub, Cloudflare, and Termux.
If Caffeine platform becomes unavailable, you can rebuild and redeploy BrainForge independently.
`;

// ── TABLE INIT ────────────────────────────────────────────────────────────────

async function initTables(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ai_memory (
      scope TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      message_count INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ai_rules (
      scope TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY,
      task TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      currentStep INTEGER DEFAULT 0,
      currentTool TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      completedAt TEXT,
      approvalPendingToolName TEXT,
      approvalPendingArgs TEXT
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS agent_activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT NOT NULL,
      step INTEGER NOT NULL,
      toolName TEXT,
      toolInput TEXT,
      toolOutput TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      errorMsg TEXT,
      retryCount INTEGER DEFAULT 0,
      timestamp TEXT NOT NULL
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS error_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT,
      tool TEXT,
      errorMsg TEXT,
      stack TEXT,
      timestamp TEXT NOT NULL
    )
  `).run();
}

// ── SECRET GUARD ─────────────────────────────────────────────────────────────

function checkSecret(request) {
  return request.headers.get('X-BrainForge-Secret') === REQUIRED_SECRET;
}

// ── D1 CLEANUP ───────────────────────────────────────────────────────────────

async function runCleanup(db) {
  try {
    await db.prepare(`DELETE FROM agent_activity WHERE timestamp < datetime('now', '-7 days')`).run();
    await db.prepare(
      `DELETE FROM agent_sessions WHERE createdAt < datetime('now', '-14 days') AND status NOT IN ('running','paused')`
    ).run();
    await db.prepare(
      `DELETE FROM agent_sessions WHERE id NOT IN (
        SELECT id FROM agent_sessions ORDER BY createdAt DESC LIMIT 20
      )`
    ).run();
  } catch (_) { /* best-effort */ }
}

// ── AGENT TOOLS ──────────────────────────────────────────────────────────────

async function toolReadProjectFile(args, db) {
  const { projectId, fileName } = args;
  const row = await db.prepare(
    'SELECT code FROM projects WHERE id=? OR name=? LIMIT 1'
  ).bind(projectId, projectId).first();
  if (!row) return { error: 'not found' };
  return { content: row.code };
}

async function toolWriteProjectFile(args, db) {
  const { projectId, content } = args;
  const now = new Date().toISOString();
  const res = await db.prepare(
    'UPDATE projects SET code=?, last_modified=? WHERE id=? OR name=?'
  ).bind(content, now, projectId, projectId).run();
  if (res.meta && res.meta.changes === 0) return { error: 'project not found' };
  return { success: true, updated_at: now };
}

async function toolWebSearch(args) {
  const { query, maxResults = 5 } = args;
  const encoded = encodeURIComponent(query);
  try {
    const resp = await fetch(
      `https://api.duckduckgo.com/?q=${encoded}&format=json&no_redirect=1&no_html=1`,
      { headers: { 'User-Agent': 'BrainForge/1.0' } }
    );
    if (resp.ok) {
      const data = await resp.json();
      const results = [];
      if (data.RelatedTopics) {
        for (const t of data.RelatedTopics.slice(0, maxResults)) {
          if (t.Text) results.push({ title: t.Text.split(' - ')[0] || t.Text, url: t.FirstURL || '', snippet: t.Text });
        }
      }
      if (results.length > 0) return { results };
    }
  } catch (_) { /* fall through to lite */ }
  // Fallback: lite.duckduckgo
  try {
    const resp2 = await fetch(
      `https://lite.duckduckgo.com/lite/?q=${encoded}`,
      { headers: { 'User-Agent': 'BrainForge/1.0' } }
    );
    const html = await resp2.text();
    const links = [];
    const rx = /<a[^>]+href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    let m;
    while ((m = rx.exec(html)) !== null && links.length < maxResults) {
      const url = m[1], title = m[2].trim();
      if (url.startsWith('http') && title.length > 3) {
        links.push({ title, url, snippet: title });
      }
    }
    return { results: links };
  } catch (e) {
    return { error: e.message, results: [] };
  }
}

async function toolFetchURL(args) {
  const { url, method = 'GET', headers = {}, body } = args;
  try {
    const opts = { method, headers };
    if (body) opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    const resp = await fetch(url, opts);
    const text = (await resp.text()).slice(0, 5000);
    return {
      status: resp.status,
      headers: Object.fromEntries(resp.headers.entries()),
      body: text
    };
  } catch (e) {
    return { error: e.message };
  }
}

async function toolPushToGitHub(args, session) {
  const { repo, filePath, content, commitMsg, branch = 'main' } = args;
  const token = session.credentials.githubToken;
  if (!token) return { error: 'No githubToken provided' };

  const base = 'https://api.github.com';
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28'
  };

  // Get current file SHA (if exists)
  let sha;
  try {
    const getResp = await fetch(`${base}/repos/${repo}/contents/${filePath}?ref=${branch}`, { headers });
    if (getResp.ok) {
      const data = await getResp.json();
      sha = data.sha;
    }
  } catch (_) { /* file does not exist yet */ }

  const body = { message: commitMsg || `Update ${filePath}`, content: btoa(content), branch };
  if (sha) body.sha = sha;

  const putResp = await fetch(`${base}/repos/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });
  const result = await putResp.json();
  if (!putResp.ok) return { error: result.message || 'GitHub push failed' };
  return { commit: result.commit?.sha, url: result.content?.html_url };
}

async function toolDeployToPages(args, session) {
  const { projectName } = args;
  const token = session.credentials.cloudflareToken;
  const accountId = session.credentials.cloudflareAccountId;
  if (!token || !accountId) return { error: 'Missing cloudflareToken or cloudflareAccountId' };

  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    }
  );
  const data = await resp.json();
  if (!resp.ok || !data.success) {
    return { error: (data.errors?.[0]?.message) || 'Deployment failed' };
  }
  return { deploymentId: data.result?.id, url: data.result?.url };
}

function toolRunPreview(args) {
  const { htmlContent = '', cssContent = '', jsContent = '' } = args;
  let base = htmlContent;
  if (!base.includes('<html')) {
    base = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>${base}</body></html>`;
  }
  if (cssContent) {
    base = base.replace('</head>', `<style>${cssContent}</style></head>`);
  }
  if (jsContent) {
    base = base.replace('</body>', `<script>${jsContent}</script></body>`);
  }
  return { previewHtml: base, type: 'preview' };
}

// ── TOOL DISPATCH ────────────────────────────────────────────────────────────

const RISKY_TOOLS = new Set(['writeProjectFile', 'pushToGitHub', 'deployToPages']);

async function executeTool(toolName, args, session, db, retryCount = 0) {
  const step = session.currentStep;
  const now = new Date().toISOString();

  // Log activity as pending
  const actInsert = await db.prepare(
    'INSERT INTO agent_activity (sessionId, step, toolName, toolInput, status, retryCount, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(session.id, step, toolName, JSON.stringify(args), retryCount > 0 ? 'retrying' : 'pending', retryCount, now).run();
  const actId = actInsert.meta?.last_row_id;

  // Approval gate for risky tools
  if (RISKY_TOOLS.has(toolName)) {
    // Set session paused waiting for approval
    await db.prepare(
      `UPDATE agent_sessions SET status='paused', approvalPendingToolName=?, approvalPendingArgs=?, updatedAt=? WHERE id=?`
    ).bind(toolName, JSON.stringify(args), now, session.id).run();

    // Wait for approval via promise
    const approved = await new Promise((resolve) => {
      session.approvalResolve = resolve;
    });

    // Resume running
    await db.prepare(
      `UPDATE agent_sessions SET status='running', approvalPendingToolName=NULL, approvalPendingArgs=NULL, updatedAt=? WHERE id=?`
    ).bind(new Date().toISOString(), session.id).run();

    if (!approved.approved) {
      const editedArgs = approved.editedArgs;
      if (!editedArgs) {
        // Rejected — log and skip
        await db.prepare(
          'UPDATE agent_activity SET status=?, errorMsg=?, timestamp=? WHERE id=?'
        ).bind('failed', 'User rejected', new Date().toISOString(), actId).run();
        return { skipped: true, reason: 'User rejected' };
      }
      // User provided edited args — use them
      args = editedArgs;
    }
  }

  try {
    let result;
    switch (toolName) {
      case 'readProjectFile':   result = await toolReadProjectFile(args, db); break;
      case 'writeProjectFile':  result = await toolWriteProjectFile(args, db); break;
      case 'webSearch':         result = await toolWebSearch(args); break;
      case 'fetchURL':          result = await toolFetchURL(args); break;
      case 'pushToGitHub':      result = await toolPushToGitHub(args, session); break;
      case 'deployToPages':     result = await toolDeployToPages(args, session); break;
      case 'runPreview':        result = toolRunPreview(args); break;
      default:                  result = { error: `Unknown tool: ${toolName}` };
    }

    await db.prepare(
      'UPDATE agent_activity SET toolOutput=?, status=?, timestamp=? WHERE id=?'
    ).bind(JSON.stringify(result), 'success', new Date().toISOString(), actId).run();

    return result;
  } catch (err) {
    if (retryCount < 2) {
      // Retry
      return executeTool(toolName, args, session, db, retryCount + 1);
    }
    // Max retries exceeded
    const errNow = new Date().toISOString();
    await db.prepare(
      'UPDATE agent_activity SET status=?, errorMsg=?, timestamp=? WHERE id=?'
    ).bind('failed', err.message, errNow, actId).run();
    await db.prepare(
      'INSERT INTO error_log (sessionId, tool, errorMsg, stack, timestamp) VALUES (?, ?, ?, ?, ?)'
    ).bind(session.id, toolName, err.message, err.stack || '', errNow).run();
    await db.prepare(
      `UPDATE agent_sessions SET status='failed', updatedAt=? WHERE id=?`
    ).bind(errNow, session.id).run();
    session.abortFlag = true;
    return { error: err.message };
  }
}

// ── OPENROUTER AGENT LOOP ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are BrainForge Agent, an autonomous AI agent. You have access to the following tools:

1. readProjectFile(projectId: string, fileName: string) - Read a project's code from D1 database. Auto-approved.
2. writeProjectFile(projectId: string, fileName: string, content: string) - Update a project's code. REQUIRES APPROVAL.
3. webSearch(query: string, maxResults?: number) - Search the web using DuckDuckGo. Auto-approved.
4. fetchURL(url: string, method?: string, headers?: object, body?: any) - Fetch any URL. Auto-approved.
5. pushToGitHub(repo: string, filePath: string, content: string, commitMsg: string, branch?: string) - Push file to GitHub. REQUIRES APPROVAL.
6. deployToPages(projectName: string) - Trigger Cloudflare Pages deployment. REQUIRES APPROVAL.
7. runPreview(htmlContent?: string, cssContent?: string, jsContent?: string) - Combine HTML/CSS/JS into a preview. Auto-approved.

Use ReAct format:
Thought: <your reasoning>
Action: toolName({"arg1": "value1", "arg2": "value2"})
STOP

After receiving an Observation, continue with another Thought/Action or end with:
Thought: Task complete
DONE

IMPORTANT:
- Always output exactly one Action per response, then STOP
- Arguments must be valid JSON object
- Write DONE (no Action) when the task is fully complete
- Never guess tool results — wait for the Observation`;

async function runAgentLoop(session, db, ctx) {
  const maxSteps = 30;

  while (session.currentStep < maxSteps && !session.abortFlag) {
    // Build messages
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...session.messages
    ];

    // Call OpenRouter
    let aiResponse;
    try {
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.credentials.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://caffeine-brainforge.pages.dev',
          'X-Title': 'BrainForge Agent'
        },
        body: JSON.stringify({
          model: session.credentials.defaultModel || 'openai/gpt-4o-mini',
          messages,
          max_tokens: 1024
        })
      });

      if (!resp.ok) {
        const errBody = await resp.text();
        const now = new Date().toISOString();
        await db.prepare(
          'INSERT INTO error_log (sessionId, tool, errorMsg, stack, timestamp) VALUES (?, ?, ?, ?, ?)'
        ).bind(session.id, 'openrouter', `HTTP ${resp.status}`, errBody.slice(0, 500), now).run();
        await db.prepare(
          `UPDATE agent_sessions SET status='failed', updatedAt=? WHERE id=?`
        ).bind(now, session.id).run();
        return;
      }

      const data = await resp.json();
      aiResponse = data.choices?.[0]?.message?.content || '';
    } catch (err) {
      const now = new Date().toISOString();
      await db.prepare(
        'INSERT INTO error_log (sessionId, tool, errorMsg, stack, timestamp) VALUES (?, ?, ?, ?, ?)'
      ).bind(session.id, 'openrouter', err.message, err.stack || '', now).run();
      await db.prepare(
        `UPDATE agent_sessions SET status='failed', updatedAt=? WHERE id=?`
      ).bind(now, session.id).run();
      return;
    }

    // Add AI response to history
    session.messages.push({ role: 'assistant', content: aiResponse });

    // Check for DONE
    if (/\bDONE\b/.test(aiResponse) && !/Action:/.test(aiResponse)) {
      const now = new Date().toISOString();
      await db.prepare(
        `UPDATE agent_sessions SET status='completed', completedAt=?, updatedAt=? WHERE id=?`
      ).bind(now, now, session.id).run();
      agentSessions.delete(session.id);
      return;
    }

    // Parse Action
    const actionMatch = aiResponse.match(/Action:\s*(\w+)\s*\(([\s\S]*?)\)\s*(?:STOP|$)/);
    if (!actionMatch) {
      // No action found — treat as complete or add observation asking for action
      if (session.currentStep > 0) {
        const now = new Date().toISOString();
        await db.prepare(
          `UPDATE agent_sessions SET status='completed', completedAt=?, updatedAt=? WHERE id=?`
        ).bind(now, now, session.id).run();
        agentSessions.delete(session.id);
        return;
      }
      session.messages.push({ role: 'user', content: 'Observation: Please provide a valid Action or write DONE if complete.' });
      session.currentStep++;
      continue;
    }

    const toolName = actionMatch[1];
    let toolArgs = {};
    try {
      toolArgs = JSON.parse(actionMatch[2]);
    } catch (_) {
      session.messages.push({ role: 'user', content: `Observation: Failed to parse tool arguments. Please use valid JSON object.` });
      session.currentStep++;
      continue;
    }

    // Update D1 current step/tool
    session.currentStep++;
    const stepNow = new Date().toISOString();
    await db.prepare(
      `UPDATE agent_sessions SET currentStep=?, currentTool=?, updatedAt=? WHERE id=?`
    ).bind(session.currentStep, toolName, stepNow, session.id).run();

    // Execute tool
    const toolResult = await executeTool(toolName, toolArgs, session, db);

    if (session.abortFlag) break;

    // Add observation to history
    session.messages.push({
      role: 'user',
      content: `Observation: ${JSON.stringify(toolResult)}`
    });
  }

  // Check final state
  if (!session.abortFlag) {
    const now = new Date().toISOString();
    await db.prepare(
      `UPDATE agent_sessions SET status='failed', updatedAt=? WHERE id=?`
    ).bind(now, session.id).run();
  }
  agentSessions.delete(session.id);
}

// ── MAIN FETCH HANDLER ───────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    try {
      // Init tables on every request (IF NOT EXISTS — cheap)
      await initTables(env.DB);

      // Secret guard on all /api/* endpoints
      if (path.startsWith('/api/') && !checkSecret(request)) {
        return json({ error: 'Unauthorized' }, 401);
      }

      // ── PROJECTS ────────────────────────────────────────────
      if (path === '/api/projects' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM projects ORDER BY last_modified DESC').all();
        return json(results);
      }
      if (path === '/api/projects' && method === 'POST') {
        const body = await request.json();
        const now = new Date().toISOString();
        const id = body.id || crypto.randomUUID();
        await env.DB.prepare(
          'INSERT INTO projects (id, name, ai_model, code, created_at, last_modified) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(id, body.name, body.ai_model || '', body.code || '', now, now).run();
        await env.DB.prepare(
          'INSERT INTO ai_rules (scope, content, updated_at) VALUES (?, ?, ?) ON CONFLICT(scope) DO NOTHING'
        ).bind(`project-${body.name}`, DEFAULT_PROJECT_RULES(body.name), now).run();
        return json({ id, ...body, created_at: now, last_modified: now });
      }
      if (path.startsWith('/api/projects/') && method === 'PUT') {
        const name = decodeURIComponent(path.split('/api/projects/')[1]);
        const body = await request.json();
        const now = new Date().toISOString();
        await env.DB.prepare(
          'UPDATE projects SET name=?, ai_model=?, code=?, last_modified=? WHERE name=?'
        ).bind(body.name ?? name, body.ai_model ?? '', body.code ?? '', now, name).run();
        return json({ success: true });
      }
      if (path.startsWith('/api/projects/') && method === 'DELETE') {
        const name = decodeURIComponent(path.split('/api/projects/')[1]);
        await env.DB.prepare('DELETE FROM projects WHERE name=?').bind(name).run();
        await env.DB.prepare('DELETE FROM messages WHERE project_id=?').bind(name).run();
        await env.DB.prepare('DELETE FROM model_claims WHERE claimed_by=?').bind(name).run();
        await env.DB.prepare('DELETE FROM snapshots WHERE project_id=?').bind(name).run();
        await env.DB.prepare('DELETE FROM ai_memory WHERE scope=?').bind(`project-${name}`).run();
        await env.DB.prepare('DELETE FROM ai_rules WHERE scope=?').bind(`project-${name}`).run();
        return json({ success: true });
      }

      // ── MESSAGES ────────────────────────────────────────────
      if (path.startsWith('/api/messages/') && method === 'GET') {
        const pid = decodeURIComponent(path.split('/api/messages/')[1]);
        const { results } = await env.DB.prepare(
          'SELECT * FROM messages WHERE project_id=? ORDER BY created_at ASC'
        ).bind(pid).all();
        return json(results);
      }
      if (path === '/api/messages' && method === 'POST') {
        const body = await request.json();
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await env.DB.prepare(
          'INSERT INTO messages (id, project_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, body.project_id, body.role, body.content, now).run();
        return json({ id, ...body, created_at: now });
      }
      if (path.startsWith('/api/messages/') && method === 'DELETE') {
        const pid = decodeURIComponent(path.split('/api/messages/')[1]);
        await env.DB.prepare('DELETE FROM messages WHERE project_id=?').bind(pid).run();
        return json({ success: true });
      }

      // ── SETTINGS ────────────────────────────────────────────
      if (path === '/api/settings' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
        const out = {};
        for (const r of results) { try { out[r.key] = JSON.parse(r.value); } catch { out[r.key] = r.value; } }
        return json(out);
      }
      if (path === '/api/settings' && method === 'POST') {
        const body = await request.json();
        for (const [k, v] of Object.entries(body)) {
          await env.DB.prepare(
            'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'
          ).bind(k, JSON.stringify(v)).run();
        }
        return json({ success: true });
      }

      // ── MODEL CLAIMS ────────────────────────────────────────
      if (path === '/api/model-claims' && method === 'GET') {
        const { results } = await env.DB.prepare('SELECT * FROM model_claims').all();
        return json(results);
      }
      if (path === '/api/model-claims' && method === 'POST') {
        const body = await request.json();
        const now = new Date().toISOString();
        await env.DB.prepare('DELETE FROM model_claims WHERE claimed_by=?').bind(body.claimed_by).run();
        const existing = await env.DB.prepare('SELECT * FROM model_claims WHERE model_id=?').bind(body.model_id).first();
        if (existing) return json({ error: `Model already claimed by ${existing.claimed_by}` }, 409);
        await env.DB.prepare(
          'INSERT INTO model_claims (model_id, claimed_by, claimed_at) VALUES (?, ?, ?)'
        ).bind(body.model_id, body.claimed_by, now).run();
        return json({ success: true });
      }
      if (path.startsWith('/api/model-claims/') && method === 'DELETE') {
        const claimedBy = decodeURIComponent(path.split('/api/model-claims/')[1]);
        await env.DB.prepare('DELETE FROM model_claims WHERE claimed_by=?').bind(claimedBy).run();
        return json({ success: true });
      }

      // ── SNAPSHOTS ───────────────────────────────────────────
      if (path.startsWith('/api/snapshots/') && method === 'GET') {
        const pid = decodeURIComponent(path.split('/api/snapshots/')[1]);
        const { results } = await env.DB.prepare(
          'SELECT * FROM snapshots WHERE project_id=? ORDER BY created_at DESC LIMIT 20'
        ).bind(pid).all();
        return json(results);
      }
      if (path === '/api/snapshots' && method === 'POST') {
        const body = await request.json();
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        await env.DB.prepare(
          'INSERT INTO snapshots (id, project_id, code, created_at) VALUES (?, ?, ?, ?)'
        ).bind(id, body.project_id, body.code, now).run();
        return json({ id, ...body, created_at: now });
      }

      // ── AI MEMORY ───────────────────────────────────────────
      if (path === '/api/memory' && method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT scope, content, message_count, updated_at FROM ai_memory ORDER BY updated_at DESC'
        ).all();
        return json(results);
      }
      if (path.startsWith('/api/memory/') && method === 'GET') {
        const scope = decodeURIComponent(path.split('/api/memory/')[1]);
        const row = await env.DB.prepare('SELECT * FROM ai_memory WHERE scope=?').bind(scope).first();
        return json(row || { scope, content: '', message_count: 0 });
      }
      if (path === '/api/memory' && method === 'POST') {
        const body = await request.json();
        const now = new Date().toISOString();
        const { scope, content, message_count = 0 } = body;
        await env.DB.prepare(
          'INSERT INTO ai_memory (scope, content, message_count, updated_at) VALUES (?, ?, ?, ?) ' +
          'ON CONFLICT(scope) DO UPDATE SET content=excluded.content, message_count=excluded.message_count, updated_at=excluded.updated_at'
        ).bind(scope, content, message_count, now).run();
        return json({ success: true, updated_at: now });
      }
      if (path.startsWith('/api/memory/') && method === 'DELETE') {
        const scope = decodeURIComponent(path.split('/api/memory/')[1]);
        await env.DB.prepare('DELETE FROM ai_memory WHERE scope=?').bind(scope).run();
        return json({ success: true });
      }

      // ── AI RULES ────────────────────────────────────────────
      if (path === '/api/rules' && method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT scope, content, updated_at FROM ai_rules ORDER BY scope ASC'
        ).all();
        return json(results);
      }
      if (path.startsWith('/api/rules/') && method === 'GET') {
        const scope = decodeURIComponent(path.split('/api/rules/')[1]);
        if (scope === 'init-master') {
          // handled below via POST — skip
        } else {
          const row = await env.DB.prepare('SELECT * FROM ai_rules WHERE scope=?').bind(scope).first();
          if (!row) {
            const content = scope === 'master' ? DEFAULT_MASTER_RULES() : DEFAULT_PROJECT_RULES(scope.replace('project-', ''));
            const now = new Date().toISOString();
            await env.DB.prepare(
              'INSERT INTO ai_rules (scope, content, updated_at) VALUES (?, ?, ?)'
            ).bind(scope, content, now).run();
            return json({ scope, content, updated_at: now });
          }
          return json(row);
        }
      }
      if (path === '/api/rules' && method === 'POST') {
        const body = await request.json();
        const now = new Date().toISOString();
        const content = body.content.replace(/Last updated: .*/, `Last updated: ${now}`);
        await env.DB.prepare(
          'INSERT INTO ai_rules (scope, content, updated_at) VALUES (?, ?, ?) ' +
          'ON CONFLICT(scope) DO UPDATE SET content=excluded.content, updated_at=excluded.updated_at'
        ).bind(body.scope, content, now).run();
        return json({ success: true, updated_at: now });
      }
      if (path === '/api/rules/init-master' && method === 'POST') {
        const now = new Date().toISOString();
        await env.DB.prepare(
          'INSERT INTO ai_rules (scope, content, updated_at) VALUES (?, ?, ?) ON CONFLICT(scope) DO NOTHING'
        ).bind('master', DEFAULT_MASTER_RULES(), now).run();
        return json({ success: true });
      }

      // ── AGENT: RUN ───────────────────────────────────────────
      if (path === '/api/run' && method === 'POST') {
        const body = await request.json();
        const { task, openRouterApiKey, defaultModel, githubToken, githubRepo,
                cloudflareToken, cloudflareAccountId, projectId } = body;

        if (!task) return json({ error: 'task is required' }, 400);
        if (!openRouterApiKey) return json({ error: 'openRouterApiKey is required' }, 400);

        const sessionId = crypto.randomUUID();
        const now = new Date().toISOString();

        // Insert D1 session row
        await env.DB.prepare(
          `INSERT INTO agent_sessions (id, task, status, currentStep, createdAt, updatedAt) VALUES (?, ?, 'running', 0, ?, ?)`
        ).bind(sessionId, task, now, now).run();

        // Build in-memory session
        const session = {
          id: sessionId,
          currentStep: 0,
          abortFlag: false,
          approvalResolve: null,
          credentials: { openRouterApiKey, defaultModel, githubToken, githubRepo, cloudflareToken, cloudflareAccountId },
          messages: [
            { role: 'user', content: `Task: ${task}${projectId ? `\nProjectId: ${projectId}` : ''}` }
          ]
        };
        agentSessions.set(sessionId, session);

        // Run cleanup async
        ctx.waitUntil(runCleanup(env.DB));

        // Run agent loop async — don't await
        ctx.waitUntil(runAgentLoop(session, env.DB, ctx));

        return json({ sessionId, status: 'running' });
      }

      // ── AGENT: STOP ──────────────────────────────────────────
      if (path === '/api/stop' && method === 'POST') {
        const { sessionId } = await request.json();
        if (!sessionId) return json({ error: 'sessionId required' }, 400);
        const session = agentSessions.get(sessionId);
        if (session) session.abortFlag = true;
        const now = new Date().toISOString();
        await env.DB.prepare(
          `UPDATE agent_sessions SET status='stopped', updatedAt=? WHERE id=?`
        ).bind(now, sessionId).run();
        return json({ success: true, sessionId });
      }

      // ── AGENT: APPROVE ───────────────────────────────────────
      if (path === '/api/approve' && method === 'POST') {
        const { sessionId, approved, editedArgs } = await request.json();
        if (!sessionId) return json({ error: 'sessionId required' }, 400);
        const session = agentSessions.get(sessionId);
        if (!session) return json({ error: 'Session not found or already completed' }, 404);
        if (!session.approvalResolve) return json({ error: 'No pending approval for this session' }, 409);
        session.approvalResolve({ approved: !!approved, editedArgs: editedArgs || null });
        session.approvalResolve = null;
        return json({ success: true });
      }

      // ── AGENT: STATUS ────────────────────────────────────────
      if (path === '/api/status' && method === 'GET') {
        const sessionId = url.searchParams.get('sessionId');
        if (!sessionId) return json({ error: 'sessionId query param required' }, 400);
        const row = await env.DB.prepare(
          'SELECT id, task, status, currentStep, currentTool, createdAt, updatedAt, completedAt, approvalPendingToolName, approvalPendingArgs FROM agent_sessions WHERE id=?'
        ).bind(sessionId).first();
        if (!row) return json({ error: 'Session not found' }, 404);
        return json(row);
      }

      // ── AGENT: LOG ───────────────────────────────────────────
      if (path === '/api/log' && method === 'GET') {
        const sessionId = url.searchParams.get('sessionId');
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        if (!sessionId) return json({ error: 'sessionId query param required' }, 400);
        const { results } = await env.DB.prepare(
          'SELECT * FROM agent_activity WHERE sessionId=? ORDER BY timestamp DESC LIMIT ?'
        ).bind(sessionId, limit).all();
        return json(results);
      }

      // ── AGENT: SESSIONS LIST ─────────────────────────────────
      if (path === '/api/sessions' && method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT id, task, status, currentStep, currentTool, createdAt, updatedAt, completedAt FROM agent_sessions ORDER BY createdAt DESC LIMIT 20'
        ).all();
        return json(results);
      }

      // ── ERROR LOG ────────────────────────────────────────────
      if (path === '/api/error-log' && method === 'GET') {
        const sessionId = url.searchParams.get('sessionId');
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        let q, params;
        if (sessionId) {
          q = 'SELECT * FROM error_log WHERE sessionId=? ORDER BY timestamp DESC LIMIT ?';
          params = [sessionId, limit];
        } else {
          q = 'SELECT * FROM error_log ORDER BY timestamp DESC LIMIT ?';
          params = [limit];
        }
        const stmt = env.DB.prepare(q);
        const { results } = await stmt.bind(...params).all();
        return json(results);
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: err.message }, 500);
    }
  }
};
