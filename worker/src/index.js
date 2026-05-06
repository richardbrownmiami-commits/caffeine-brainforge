// Brai

  // master_agent_tasks for Master Agent task queue
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS master_agent_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instruction TEXT NOT NULL,
      added_by TEXT DEFAULT 'user',
      status TEXT DEFAULT 'pending',
      priority INTEGER DEFAULT 5,
      result TEXT,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();
nForge Cloudflare Worker API
// Tables: projects, messages, settings, model_claims, snapshots, ai_memory, ai_rules
//         agent_sessions, agent_activity, error_log, agent_memory_summaries, ai_config

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
      approvalPendingArgs TEXT,
      total_prompt_tokens INTEGER DEFAULT 0,
      total_completion_tokens INTEGER DEFAULT 0,
      estimated_cost_usd REAL DEFAULT 0
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

  // Enhanced error_log: error_type, stack_trace, context_json, resolved
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS error_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT,
      tool TEXT,
      error_type TEXT DEFAULT 'tool_error',
      errorMsg TEXT,
      stack_trace TEXT,
      context_json TEXT,
      resolved INTEGER DEFAULT 0,
      timestamp TEXT NOT NULL
    )
  `).run();
  // Migrate: add new columns if upgrading from old schema
  try { await db.prepare('ALTER TABLE error_log ADD COLUMN error_type TEXT DEFAULT "tool_error"').run(); } catch (_) {}
  try { await db.prepare('ALTER TABLE error_log ADD COLUMN stack_trace TEXT').run(); } catch (_) {}
  try { await db.prepare('ALTER TABLE error_log ADD COLUMN context_json TEXT').run(); } catch (_) {}
  try { await db.prepare('ALTER TABLE error_log ADD COLUMN resolved INTEGER DEFAULT 0').run(); } catch (_) {}

  // Agent memory summaries with project_id
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS agent_memory_summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sessionId TEXT,
      project_id TEXT,
      task TEXT,
      summary TEXT,
      toolsUsed TEXT,
      stepsCompleted INTEGER,
      status TEXT,
      createdAt TEXT
    )
  `).run();
  try { await db.prepare('ALTER TABLE agent_memory_summaries ADD COLUMN project_id TEXT').run(); } catch (_) {}

  // ai_config: secure key storage in D1 (token security feature)
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ai_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
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
    // Auto-delete error_log rows older than 7 days
    await db.prepare(`DELETE FROM error_log WHERE timestamp < datetime('now', '-7 days')`).run();
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
      'INSERT INTO error_log (sessionId, tool, error_type, errorMsg, stack_trace, context_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(session.id, toolName, 'tool_error', err.message, err.stack || '', JSON.stringify(args), errNow).run();
    await db.prepare(
      `UPDATE agent_sessions SET status='failed', updatedAt=? WHERE id=?`
    ).bind(errNow, session.id).run();
    session.abortFlag = true;
    return { error: err.message };
  }
}

// ── TELEGRAM NOTIFICATION ────────────────────────────────────────────────────

// Falls back to env.TELEGRAM_BOT_TOKEN / env.TELEGRAM_CHAT_ID if not in credentials
async function sendTelegramNotification(credentials, task, status, stepCount, cost, errorMsg, env) {
  const botToken = credentials?.telegramBotToken || (env && env.TELEGRAM_BOT_TOKEN);
  const chatId = credentials?.telegramChatId || (env && env.TELEGRAM_CHAT_ID);
  if (!botToken || !chatId) return;
  try {
    const statusEmoji = status === 'completed' ? '✅' : status === 'failed' ? '❌' : '⚠️';
    let text = `${statusEmoji} [BrainForge Agent]\nTask: ${task}\nStatus: ${status}\nCost: ${(cost || 0).toFixed(6)}\nSteps: ${stepCount}\nTime: ${new Date().toISOString()}`;
    if (errorMsg) text += `\nError: ${String(errorMsg).slice(0, 200)}`;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text })
    });
  } catch (_) { /* non-blocking — Telegram failure must not affect agent */ }
}

// ── AGENT MEMORY SUMMARY ─────────────────────────────────────────────────────

async function generateAndSaveMemorySummary(session, db, task, stepCount, toolsUsed, finalResult, status) {
  const { openRouterApiKey, defaultModel } = session.credentials;
  if (!openRouterApiKey) return;
  try {
    const prompt = `Summarize this agent session in 2-3 sentences. Task: ${task}. Steps completed: ${stepCount}. Tools used: ${toolsUsed.join(', ')}. Result: ${String(finalResult).slice(0, 200)}. Status: ${status}.`;
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openRouterApiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://caffeine-brainforge.pages.dev',
        'X-Title': 'BrainForge Agent'
      },
      body: JSON.stringify({
        model: defaultModel || 'openai/gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150
      })
    });
    if (!resp.ok) return;
    const data = await resp.json();
    const summary = data.choices?.[0]?.message?.content || '';
    if (!summary) return;
    await db.prepare(
      'INSERT INTO agent_memory_summaries (sessionId, project_id, task, summary, toolsUsed, stepsCompleted, status, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(session.id, session.projectId || null, task, summary, toolsUsed.join(', '), stepCount, status, new Date().toISOString()).run();
  } catch (_) { /* best-effort — summary failure must not affect agent status */ }
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

async function runAgentLoop(session, db, ctx, env) {
  const maxSteps = 30;
  const task = session.messages[0]?.content?.replace('Task: ', '') || '';
  const toolsUsed = [];
  let totalPromptTokens = 0;
  let totalCompletionTokens = 0;
  let estimatedCostUsd = 0;
  let finalResult = '';

  // Feature 6: Prepend last 3 memory summaries to context
  try {
    const { results: prevSummaries } = await db.prepare(
      'SELECT summary FROM agent_memory_summaries ORDER BY id DESC LIMIT 3'
    ).all();
    if (prevSummaries && prevSummaries.length > 0) {
      const summaryContext = prevSummaries.map(r => r.summary).join('\n');
      session.messages.unshift({
        role: 'system',
        content: `Previous sessions context:\n${summaryContext}`
      });
    }
  } catch (_) { /* best-effort */ }

  while (session.currentStep < maxSteps && !session.abortFlag) {
    // Build messages
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...session.messages
    ];

    // Call OpenRouter
    let aiResponse;
    let goto_continue = false;
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
        const isQuotaError = resp.status === 429 || resp.status === 402 || resp.status === 4006
          || errBody.includes('quota') || errBody.includes('rate limit') || errBody.includes('insufficient');
        // Fallback to alternative model on quota exhaustion
        if (isQuotaError && session.credentials.openRouterApiKey) {
          try {
            const fallbackModel = 'google/gemini-flash-1.5';
            const fallbackBody = JSON.stringify({
              model: fallbackModel,
              messages,
              max_tokens: 1024
            });
            const fallbackResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${session.credentials.openRouterApiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://caffeine-brainforge.pages.dev',
                'X-Title': 'BrainForge Agent Fallback'
              },
              body: fallbackBody
            });
            if (fallbackResp.ok) {
              const fallbackData = await fallbackResp.json();
              aiResponse = fallbackData.choices?.[0]?.message?.content || '';
              if (aiResponse) {
                // Successfully fell back, continue processing
                // Log the fallback
                await db.prepare(
                  'INSERT INTO error_log (sessionId, tool, error_type, errorMsg, timestamp) VALUES (?, ?, ?, ?, ?)'
                ).bind(session.id, 'openrouter', 'fallback_used', `Primary model quota exceeded, fell back to ${fallbackModel}`, new Date().toISOString()).run();
                // Skip the rest of the error handling and continue
                goto_continue = true;
              }
            }
          } catch (_fallbackErr) {
            // Fallback also failed, proceed with original error handling
          }
        }
        if (!goto_continue) {
          const now = new Date().toISOString();
          await db.prepare(
            'INSERT INTO error_log (sessionId, tool, error_type, errorMsg, stack_trace, context_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(session.id, 'openrouter', 'openrouter_error', `HTTP ${resp.status}`, errBody.slice(0, 500), null, now).run();
          await db.prepare(
            `UPDATE agent_sessions SET status='failed', updatedAt=? WHERE id=?`
          ).bind(now, session.id).run();
          await sendTelegramNotification(session.credentials, task, 'failed', session.currentStep, estimatedCostUsd, `HTTP ${resp.status}`, env);
          await generateAndSaveMemorySummary(session, db, task, session.currentStep, toolsUsed, 'OpenRouter HTTP error', 'failed');
          return;
        }
      }

      const data = await resp.json();
      aiResponse = data.choices?.[0]?.message?.content || '';

      // Feature 3: Track token usage and cost
      if (data.usage) {
        const promptT = data.usage.prompt_tokens || 0;
        const completionT = data.usage.completion_tokens || 0;
        totalPromptTokens += promptT;
        totalCompletionTokens += completionT;
        estimatedCostUsd += promptT * 0.000001 + completionT * 0.000002;
        await db.prepare(
          `UPDATE agent_sessions SET total_prompt_tokens=?, total_completion_tokens=?, estimated_cost_usd=?, updatedAt=? WHERE id=?`
        ).bind(totalPromptTokens, totalCompletionTokens, estimatedCostUsd, new Date().toISOString(), session.id).run();
      }
    } catch (err) {
      const now = new Date().toISOString();
      await db.prepare(
        'INSERT INTO error_log (sessionId, tool, error_type, errorMsg, stack_trace, context_json, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(session.id, 'openrouter', 'openrouter_error', err.message, err.stack || '', null, now).run();
      await db.prepare(
        `UPDATE agent_sessions SET status='failed', updatedAt=? WHERE id=?`
      ).bind(now, session.id).run();
      await sendTelegramNotification(session.credentials, task, 'failed', session.currentStep, estimatedCostUsd, err.message, env);
      await generateAndSaveMemorySummary(session, db, task, session.currentStep, toolsUsed, err.message, 'failed');
      return;
    }

    // Add AI response to history
    session.messages.push({ role: 'assistant', content: aiResponse });

    // Check for DONE
    if (/\bDONE\b/.test(aiResponse) && !/Action:/.test(aiResponse)) {
      const now = new Date().toISOString();
      finalResult = aiResponse;
      await db.prepare(
        `UPDATE agent_sessions SET status='completed', completedAt=?, updatedAt=? WHERE id=?`
      ).bind(now, now, session.id).run();
      await sendTelegramNotification(session.credentials, task, 'completed', session.currentStep, estimatedCostUsd, null, env);
      await generateAndSaveMemorySummary(session, db, task, session.currentStep, toolsUsed, finalResult, 'completed');
      agentSessions.delete(session.id);
      return;
    }

    // Parse Action
    const actionMatch = aiResponse.match(/Action:\s*(\w+)\s*\([\s\S]*?\)\s*(?:STOP|$)/);
    // Re-extract to capture the args portion reliably
    const actionFull = aiResponse.match(/Action:\s*(\w+)\s*\(([\s\S]*?)\)\s*(?:STOP|$)/);
    if (!actionFull) {
      // No action found — treat as complete or add observation asking for action
      if (session.currentStep > 0) {
        const now = new Date().toISOString();
        await db.prepare(
          `UPDATE agent_sessions SET status='completed', completedAt=?, updatedAt=? WHERE id=?`
        ).bind(now, now, session.id).run();
        await sendTelegramNotification(session.credentials, task, 'completed', session.currentStep, estimatedCostUsd, null, env);
        await generateAndSaveMemorySummary(session, db, task, session.currentStep, toolsUsed, aiResponse, 'completed');
        agentSessions.delete(session.id);
        return;
      }
      session.messages.push({ role: 'user', content: 'Observation: Please provide a valid Action or write DONE if complete.' });
      session.currentStep++;
      continue;
    }

    const toolName = actionFull[1];
    let toolArgs = {};
    try {
      toolArgs = JSON.parse(actionFull[2]);
    } catch (_) {
      session.messages.push({ role: 'user', content: `Observation: Failed to parse tool arguments. Please use valid JSON object.` });
      session.currentStep++;
      continue;
    }

    // Track tools used
    if (!toolsUsed.includes(toolName)) toolsUsed.push(toolName);

    // Update D1 current step/tool
    session.currentStep++;
    const stepNow = new Date().toISOString();
    await db.prepare(
      `UPDATE agent_sessions SET currentStep=?, currentTool=?, updatedAt=? WHERE id=?`
    ).bind(session.currentStep, toolName, stepNow, session.id).run();

    // Execute tool
    const toolResult = await executeTool(toolName, toolArgs, session, db);
    finalResult = JSON.stringify(toolResult);

    if (session.abortFlag) break;

    // Add observation to history
    session.messages.push({
      role: 'user',
      content: `Observation: ${JSON.stringify(toolResult)}`
    });
  }

  // Determine final status
  const terminalStatus = session.abortFlag ? 'stopped' : 'failed';
  if (!session.abortFlag) {
    const now = new Date().toISOString();
    await db.prepare(
      `UPDATE agent_sessions SET status='failed', updatedAt=? WHERE id=?`
    ).bind(now, session.id).run();
  }
  await sendTelegramNotification(session.credentials, task, terminalStatus, session.currentStep, estimatedCostUsd, null, env);
  await generateAndSaveMemorySummary(session, db, task, session.currentStep, toolsUsed, finalResult, terminalStatus);
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
        const { task, openRouterApiKey: bodyOpenRouterKey, defaultModel, githubToken: bodyGitHubToken, githubRepo,
                cloudflareToken: bodyCloudflareToken, cloudflareAccountId, projectId,
                telegramBotToken: bodyTelegramToken, telegramChatId: bodyTelegramChat } = body;

        if (!task) return json({ error: 'task is required' }, 400);

        // Token security: load stored keys from ai_config, fallback to request body, then env vars
        const cfgRowsRun = await (async () => {
          try {
            const { results } = await env.DB.prepare('SELECT key, value FROM ai_config').all();
            const m = {};
            for (const r of results) m[r.key] = r.value;
            return m;
          } catch (_) { return {}; }
        })();
        const openRouterApiKey = bodyOpenRouterKey || cfgRowsRun['openrouter_api_key'] || '';
        const githubToken = bodyGitHubToken || cfgRowsRun['github_token'] || '';
        const cloudflareToken = bodyCloudflareToken || cfgRowsRun['cloudflare_token'] || '';
        const telegramBotToken = bodyTelegramToken || cfgRowsRun['telegram_bot_token'] || (env && env.TELEGRAM_BOT_TOKEN) || '';
        const telegramChatId = bodyTelegramChat || cfgRowsRun['telegram_chat_id'] || (env && env.TELEGRAM_CHAT_ID) || '';

        if (!openRouterApiKey) return json({ error: 'openRouterApiKey is required (pass in body or store via POST /api/config)' }, 400);

        const sessionId = crypto.randomUUID();
        const now = new Date().toISOString();

        // Insert D1 session row
        await env.DB.prepare(
          `INSERT INTO agent_sessions (id, task, status, currentStep, createdAt, updatedAt) VALUES (?, ?, 'running', 0, ?, ?)`
        ).bind(sessionId, task, now, now).run();

        // Build in-memory session
        const session = {
          id: sessionId,
          projectId: projectId || null,
          currentStep: 0,
          abortFlag: false,
          approvalResolve: null,
          credentials: { openRouterApiKey, defaultModel, githubToken, githubRepo, cloudflareToken, cloudflareAccountId, telegramBotToken, telegramChatId },
          messages: [
            { role: 'user', content: `Task: ${task}${projectId ? `\nProjectId: ${projectId}` : ''}` }
          ]
        };
        agentSessions.set(sessionId, session);

        // Run cleanup async
        ctx.waitUntil(runCleanup(env.DB));

        // Run agent loop async — don't await (pass env for Telegram env fallback)
        ctx.waitUntil(runAgentLoop(session, env.DB, ctx, env));

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
          'SELECT id, task, status, currentStep, currentTool, createdAt, updatedAt, completedAt, approvalPendingToolName, approvalPendingArgs, total_prompt_tokens, total_completion_tokens, estimated_cost_usd FROM agent_sessions WHERE id=?'
        ).bind(sessionId).first();
        if (!row) return json({ error: 'Session not found' }, 404);
        return json({
          ...row,
          totalPromptTokens: row.total_prompt_tokens,
          totalCompletionTokens: row.total_completion_tokens,
          estimatedCostUsd: row.estimated_cost_usd
        });
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
          'SELECT id, task, status, currentStep, currentTool, createdAt, updatedAt, completedAt, total_prompt_tokens, total_completion_tokens, estimated_cost_usd FROM agent_sessions ORDER BY createdAt DESC LIMIT 20'
        ).all();
        return json(results.map(r => ({
          ...r,
          totalPromptTokens: r.total_prompt_tokens,
          totalCompletionTokens: r.total_completion_tokens,
          estimatedCostUsd: r.estimated_cost_usd
        })));
      }

      // ── ERROR LOG ────────────────────────────────────────────
      if (path === '/api/error-log/summary' && method === 'GET') {
        const total = await env.DB.prepare('SELECT COUNT(*) as cnt FROM error_log').first();
        const { results: byTool } = await env.DB.prepare(
          'SELECT tool, COUNT(*) as count FROM error_log GROUP BY tool ORDER BY count DESC LIMIT 20'
        ).all();
        const { results: recentErrors } = await env.DB.prepare(
          'SELECT * FROM error_log ORDER BY timestamp DESC LIMIT 5'
        ).all();
        return json({
          totalErrors: total?.cnt || 0,
          errorsByTool: byTool,
          recentErrors
        });
      }

      if (path === '/api/error-log' && method === 'GET') {
        const sessionId = url.searchParams.get('sessionId');
        const search = url.searchParams.get('search');
        const tool = url.searchParams.get('tool');
        const errorType = url.searchParams.get('type');
        const from = url.searchParams.get('from');
        const to = url.searchParams.get('to');
        // Cap at 20 per spec
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 20);

        const conditions = [];
        const params = [];

        if (sessionId) { conditions.push('sessionId=?'); params.push(sessionId); }
        if (tool) { conditions.push('tool=?'); params.push(tool); }
        if (errorType) { conditions.push('error_type=?'); params.push(errorType); }
        if (search) { conditions.push('(errorMsg LIKE ? OR tool LIKE ? OR stack_trace LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
        if (from) { conditions.push('timestamp >= ?'); params.push(from); }
        if (to) { conditions.push('timestamp <= ?'); params.push(to); }

        const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
        const countQuery = `SELECT COUNT(*) as cnt FROM error_log ${where}`;
        const dataQuery = `SELECT * FROM error_log ${where} ORDER BY timestamp DESC LIMIT ?`;

        const totalCount = await env.DB.prepare(countQuery).bind(...params).first();
        const total = totalCount?.cnt || 0;
        // Fetch limit+1 to detect has_more
        const { results } = await env.DB.prepare(dataQuery).bind(...params, limit + 1).all();
        const has_more = results.length > limit;
        const errors = has_more ? results.slice(0, limit) : results;

        return json({ errors, total_count: total, has_more });
      }

      // ── MEMORY SUMMARIES ─────────────────────────────────────
      if (path === '/api/memory-summaries' && method === 'GET') {
        const sessionId = url.searchParams.get('sessionId');
        let q, params;
        if (sessionId) {
          q = 'SELECT * FROM agent_memory_summaries WHERE sessionId=? ORDER BY id DESC LIMIT 10';
          params = [sessionId];
        } else {
          q = 'SELECT * FROM agent_memory_summaries ORDER BY id DESC LIMIT 10';
          params = [];
        }
        const { results } = await env.DB.prepare(q).bind(...params).all();
        return json(results);
      }

      // ── MEMORY SUMMARY BY PROJECT ─────────────────────────────
      if (path === '/api/memory/summary' && method === 'GET') {
        const projectId = url.searchParams.get('project_id');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '5', 10), 20);
        let q, params;
        if (projectId) {
          q = 'SELECT * FROM agent_memory_summaries WHERE project_id=? ORDER BY id DESC LIMIT ?';
          params = [projectId, limit];
        } else {
          q = 'SELECT * FROM agent_memory_summaries ORDER BY id DESC LIMIT ?';
          params = [limit];
        }
        const { results } = await env.DB.prepare(q).bind(...params).all();
        return json(results);
      }

      // ── TELEGRAM TEST ────────────────────────────────────────
      if (path === '/api/telegram/test' && method === 'POST') {
        const { telegramBotToken, telegramChatId } = await request.json();
        if (!telegramBotToken || !telegramChatId) {
          return json({ error: 'telegramBotToken and telegramChatId are required' }, 400);
        }
        try {
          const resp = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: telegramChatId,
              text: '✅ BrainForge Telegram notifications are working!'
            })
          });
          const data = await resp.json();
          if (!resp.ok) return json({ error: data.description || 'Telegram API error' }, 400);
          return json({ success: true, messageId: data.result?.message_id });
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }

      // ── AI CONFIG (secure key storage) ───────────────────────
      if (path === '/api/config' && method === 'GET') {
        const { results } = await env.DB.prepare(
          'SELECT key, updated_at FROM ai_config ORDER BY key ASC'
        ).all();
        return json(results);
      }
      if (path === '/api/config' && method === 'POST') {
        const body = await request.json();
        const now = new Date().toISOString();
        for (const [k, v] of Object.entries(body)) {
          await env.DB.prepare(
            'INSERT INTO ai_config (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at'
          ).bind(k, String(v), now).run();
        }
        return json({ success: true, updated_at: now });
      }
      if (path.startsWith('/api/config/') && method === 'DELETE') {
        const key = decodeURIComponent(path.split('/api/config/')[1]);
        await env.DB.prepare('DELETE FROM ai_config WHERE key=?').bind(key).run();
        return json({ success: true });
      }

      // ── UNIFIED PROXY (D1-backed key lookup) ──────────────────
      // POST /api/proxy — { service, payload, endpoint? }
      if (path === '/api/proxy' && method === 'POST') {
        const body = await request.json();
        const { service, payload, endpoint } = body;
        if (!service) return json({ error: 'service is required' }, 400);
        const cfgRows = await (async () => {
          try {
            const { results } = await env.DB.prepare('SELECT key, value FROM ai_config').all();
            const m = {}; for (const r of results) m[r.key] = r.value; return m;
          } catch (_) { return {}; }
        })();
        if (service === 'openrouter') {
          const apiKey = cfgRows['openrouter_api_key'];
          if (!apiKey) return json({ error: 'openrouter_api_key not configured. POST /api/config first.' }, 400);
          const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://caffeine-brainforge.pages.dev', 'X-Title': 'BrainForge' },
            body: JSON.stringify(payload)
          });
          return json(await resp.json(), resp.status);
        }
        if (service === 'github') {
          const token = cfgRows['github_token'];
          if (!token) return json({ error: 'github_token not configured. POST /api/config first.' }, 400);
          const targetUrl = endpoint || 'https://api.github.com/';
          const opts = { method: payload?.method || 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' } };
          if (payload?.body) opts.body = JSON.stringify(payload.body);
          const resp = await fetch(targetUrl, opts);
          return json(await resp.json(), resp.status);
        }
        if (service === 'cloudflare') {
          const token = cfgRows['cloudflare_token'];
          if (!token) return json({ error: 'cloudflare_token not configured. POST /api/config first.' }, 400);
          const targetUrl = endpoint || 'https://api.cloudflare.com/client/v4/';
          const opts = { method: payload?.method || 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } };
          if (payload?.body) opts.body = JSON.stringify(payload.body);
          const resp = await fetch(targetUrl, opts);
          return json(await resp.json(), resp.status);
        }
        return json({ error: `Unknown service: ${service}` }, 400);
      }

      // ── STATS: Monthly cost & per-project ─────────────────────
      if (path === '/api/stats' && method === 'GET') {
        const monthStart = new Date();
        monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
        const monthStartIso = monthStart.toISOString();
        const totalThisMonth = await env.DB.prepare(
          'SELECT SUM(estimated_cost_usd) as total FROM agent_sessions WHERE createdAt >= ?'
        ).bind(monthStartIso).first();
        const totalAllTime = await env.DB.prepare(
          'SELECT SUM(estimated_cost_usd) as total FROM agent_sessions'
        ).first();
        const { results: sessionSummaries } = await env.DB.prepare(
          'SELECT id, task, status, estimated_cost_usd, total_prompt_tokens, total_completion_tokens, createdAt FROM agent_sessions ORDER BY createdAt DESC LIMIT 20'
        ).all();
        return json({
          cost_this_month_usd: totalThisMonth?.total || 0,
          cost_all_time_usd: totalAllTime?.total || 0,
          month_start: monthStartIso,
          recent_sessions: sessionSummaries
        });
      }

      // ── PROXY: OPENROUTER ────────────────────────────────────
      if (path === '/api/proxy/openrouter' && method === 'POST') {
        const body = await request.json();
        const { openRouterApiKey, ...payload } = body;
        if (!openRouterApiKey) return json({ error: 'openRouterApiKey is required' }, 400);
        const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${openRouterApiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://caffeine-brainforge.pages.dev',
            'X-Title': 'BrainForge'
          },
          body: JSON.stringify(payload)
        });
        const data = await resp.json();
        return json(data, resp.status);
      }

      // ── PROXY: GITHUB ────────────────────────────────────────
      if (path === '/api/proxy/github' && method === 'POST') {
        const body = await request.json();
        const { githubToken, githubUrl, githubMethod = 'GET', githubBody } = body;
        if (!githubToken || !githubUrl) return json({ error: 'githubToken and githubUrl are required' }, 400);
        const opts = {
          method: githubMethod,
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28'
          }
        };
        if (githubBody) opts.body = JSON.stringify(githubBody);
        const resp = await fetch(githubUrl, opts);
        const data = await resp.json();
        return json(data, resp.status);
      }

      // ── PROXY: CLOUDFLARE ────────────────────────────────────
      if (path === '/api/proxy/cloudflare' && method === 'POST') {
        const body = await request.json();
        const { cloudflareToken, cloudflareUrl, cloudflareMethod = 'GET', cloudflareBody } = body;
        if (!cloudflareToken || !cloudflareUrl) return json({ error: 'cloudflareToken and cloudflareUrl are required' }, 400);
        const opts = {
          method: cloudflareMethod,
          headers: {
            Authorization: `Bearer ${cloudflareToken}`,
            'Content-Type': 'application/json'
          }
        };
        if (cloudflareBody) opts.body = JSON.stringify(cloudflareBody);
        const resp = await fetch(cloudflareUrl, opts);
        const data = await resp.json();
        return json(data, resp.status);
      }

      // ── SSE STREAM ───────────────────────────────────────────
      if (path === '/api/stream' && method === 'GET') {
        const sessionId = url.searchParams.get('sessionId');
        if (!sessionId) return json({ error: 'sessionId query param required' }, 400);

        const db = env.DB;
        let lastSentActivityId = 0;
        let closed = false;
        const startTime = Date.now();
        const MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes

        const stream = new ReadableStream({
          async start(controller) {
            const encode = (data) => new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);

            const tick = async () => {
              if (closed) return;
              if (Date.now() - startTime > MAX_DURATION_MS) {
                controller.enqueue(encode({ type: 'done', status: 'timeout' }));
                controller.close();
                closed = true;
                return;
              }

              try {
                // Fetch session status
                const row = await db.prepare(
                  'SELECT id, task, status, currentStep, currentTool, approvalPendingToolName, approvalPendingArgs, total_prompt_tokens, total_completion_tokens, estimated_cost_usd FROM agent_sessions WHERE id=?'
                ).bind(sessionId).first();

                if (!row) {
                  controller.enqueue(encode({ type: 'done', status: 'not_found' }));
                  controller.close();
                  closed = true;
                  return;
                }

                // Emit status event
                controller.enqueue(encode({
                  type: 'status',
                  sessionId: row.id,
                  status: row.status,
                  currentStep: row.currentStep,
                  currentTool: row.currentTool,
                  approvalPendingToolName: row.approvalPendingToolName,
                  approvalPendingArgs: row.approvalPendingArgs,
                  totalPromptTokens: row.total_prompt_tokens,
                  totalCompletionTokens: row.total_completion_tokens,
                  estimatedCostUsd: row.estimated_cost_usd
                }));

                // Fetch new activity entries since last sent
                const { results: newEntries } = await db.prepare(
                  'SELECT * FROM agent_activity WHERE sessionId=? AND id > ? ORDER BY id ASC LIMIT 5'
                ).bind(sessionId, lastSentActivityId).all();

                if (newEntries && newEntries.length > 0) {
                  controller.enqueue(encode({ type: 'activity', entries: newEntries }));
                  lastSentActivityId = newEntries[newEntries.length - 1].id;
                }

                // Check terminal status
                const terminalStatuses = ['completed', 'failed', 'stopped'];
                if (terminalStatuses.includes(row.status)) {
                  controller.enqueue(encode({ type: 'done', status: row.status }));
                  controller.close();
                  closed = true;
                  return;
                }

                // Schedule next tick
                setTimeout(tick, 500);
              } catch (e) {
                controller.enqueue(encode({ type: 'error', message: e.message }));
                controller.close();
                closed = true;
              }
            };

            // Start first tick
            await tick();
          },
          cancel() {
            closed = true;
          }
        });

        return new Response(stream, {
          headers: {
            ...CORS,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
          }
        });
      }


      // ── MASTER AGENT TASK QUEUE ──────────────────────────────

      // POST /api/master/task — add new task
      if (path === '/api/master/task' && method === 'POST') {
        if (!checkSecret(request)) return json({ error: 'Unauthorized' }, 401);
        const body = await request.json();
        const { instruction, added_by = 'user', priority = 5 } = body;
        if (!instruction) return json({ error: 'instruction is required' }, 400);
        const now = new Date().toISOString();
        const result = await env.DB.prepare(
          'INSERT INTO master_agent_tasks (instruction, added_by, status, priority, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(instruction, added_by, 'pending', priority, now, now).run();
        const taskId = result.meta?.last_row_id;
        return json({ success: true, id: taskId, instruction, status: 'pending' });
      }

      // GET /api/master/tasks — list tasks with optional filter
      if (path === '/api/master/tasks' && method === 'GET') {
        if (!checkSecret(request)) return json({ error: 'Unauthorized' }, 401);
        const statusFilter = url.searchParams.get('status');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
        let q, params;
        if (statusFilter) {
          q = 'SELECT * FROM master_agent_tasks WHERE status=? ORDER BY priority DESC, created_at ASC LIMIT ?';
          params = [statusFilter, limit];
        } else {
          q = 'SELECT * FROM master_agent_tasks ORDER BY priority DESC, created_at ASC LIMIT ?';
          params = [limit];
        }
        const { results } = await env.DB.prepare(q).bind(...params).all();
        return json(results);
      }

      // PUT /api/master/task/:id — update task status/result/error
      if (path.match(/^\/api\/master\/task\/\d+$/) && method === 'PUT') {
        if (!checkSecret(request)) return json({ error: 'Unauthorized' }, 401);
        const taskId = parseInt(path.split('/').pop(), 10);
        const body = await request.json();
        const { status, result, error } = body;
        const now = new Date().toISOString();
        const fields = [];
        const vals = [];
        if (status !== undefined) { fields.push('status=?'); vals.push(status); }
        if (result !== undefined) { fields.push('result=?'); vals.push(result); }
        if (error !== undefined) { fields.push('error=?'); vals.push(error); }
        fields.push('updated_at=?'); vals.push(now);
        vals.push(taskId);
        await env.DB.prepare(`UPDATE master_agent_tasks SET ${fields.join(', ')} WHERE id=?`).bind(...vals).run();
        const updated = await env.DB.prepare('SELECT id, status, result, error, updated_at FROM master_agent_tasks WHERE id=?').bind(taskId).first();
        return json({ success: true, updated });
      }

      // DELETE /api/master/task/:id — delete a task
      if (path.match(/^\/api\/master\/task\/\d+$/) && method === 'DELETE') {
        if (!checkSecret(request)) return json({ error: 'Unauthorized' }, 401);
        const taskId = parseInt(path.split('/').pop(), 10);
        await env.DB.prepare('DELETE FROM master_agent_tasks WHERE id=?').bind(taskId).run();
        return json({ success: true });
      }

      // GET /api/master/next — get next pending task (auto sets in_progress)
      if (path === '/api/master/next' && method === 'GET') {
        if (!checkSecret(request)) return json({ error: 'Unauthorized' }, 401);
        const task = await env.DB.prepare(
          "SELECT * FROM master_agent_tasks WHERE status='pending' ORDER BY priority DESC, created_at ASC LIMIT 1"
        ).first();
        if (!task) return json({ task: null });
        const now = new Date().toISOString();
        await env.DB.prepare(
          "UPDATE master_agent_tasks SET status='in_progress', updated_at=? WHERE id=?"
        ).bind(now, task.id).run();
        return json({ task: { ...task, status: 'in_progress', updated_at: now } });
      }

      // POST /api/master/complete/:id — mark task done or failed
      if (path.match(/^\/api\/master\/complete\/\d+$/) && method === 'POST') {
        if (!checkSecret(request)) return json({ error: 'Unauthorized' }, 401);
        const taskId = parseInt(path.split('/').pop(), 10);
        const body = await request.json();
        const { result, error } = body;
        const status = error ? 'failed' : 'done';
        const now = new Date().toISOString();
        await env.DB.prepare(
          'UPDATE master_agent_tasks SET status=?, result=?, error=?, updated_at=? WHERE id=?'
        ).bind(status, result || null, error || null, now, taskId).run();
        return json({ success: true });
      }

      // ── FEEDBACK ─────────────────────────────────────────────────
      if (path === '/api/feedback' && method === 'POST') {
        try {
          const body = await request.json();
          const message = body.message || '';
          const timestamp = body.timestamp || new Date().toISOString();
          if (!message) return json({ error: 'message is required' }, 400);
          await env.DB.prepare(
            'INSERT INTO error_log (sessionId, tool, error_type, errorMsg, timestamp) VALUES (?, ?, ?, ?, ?)'
          ).bind(null, 'feedback', 'feedback', message, timestamp).run();
          return json({ success: true });
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }

      return json({ error: 'Not found' }, 404);
    } catch (err) {
      console.error(err);
      return json({ error: err.message }, 500);
    }
  }
};

