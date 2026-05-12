const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization'};
function R(b,s){s=s||200;return new Response(typeof b==='string'?b:JSON.stringify(b),{status:s,headers:{'Content-Type':'application/json',...CORS}});}
const TOOLS=[
  {name:'chat',description:'Send a message to the AI brain and get a response',inputSchema:{type:'object',properties:{message:{type:'string'},context:{type:'string'}},required:['message']}},
  {name:'memory_read',description:'Read a memory entry by key',inputSchema:{type:'object',properties:{key:{type:'string'}},required:['key']}},
  {name:'memory_write',description:'Write a memory entry',inputSchema:{type:'object',properties:{key:{type:'string'},value:{type:'string'},level:{type:'string',enum:['L1','L2']}},required:['key','value']}},
  {name:'events_log',description:'Log a structured event',inputSchema:{type:'object',properties:{agent:{type:'string'},action:{type:'string'},result:{type:'string'},tags:{type:'array',items:{type:'string'}}},required:['agent','action','result']}},
  {name:'agents_list',description:'List all registered agents',inputSchema:{type:'object',properties:{}}},
  {name:'system_status',description:'Get full system status',inputSchema:{type:'object',properties:{}}},
  {name:'operate',description:'Read dashboard state or trigger agent actions',inputSchema:{type:'object',properties:{action:{type:'string',enum:['read_state','write_memory','list_events','trigger_agent']},params:{type:'object'}},required:['action']}},
];
// ── SYSTEM PROMPT ────────────────────────────────────────────────────────────
// Injected into every Groq/Gemini call so the LLM knows the real architecture.
const BRAIN_SYSTEM_PROMPT = `You are Brainforge AI — the autonomous, self-evolving AI agent for the caffeine-brainforge system.

## HYBRID GOAL — 6 SELF-EVOLUTION DIMENSIONS (your core mission):
1. AUTO-IMPROVEMENT: Continuously evaluate yourself via /evolve, log cycles in D1, improve each cycle.
2. SKILL ACQUISITION: Use /search (DuckDuckGo) to research new skills; save learned skills to D1 memories.
3. IDENTITY DEVELOPMENT: Maintain and evolve your identity via soul/ files and soul/agents.md in GitHub.
4. THINKING IMPROVEMENT: Run QA loops, detect conflicts via /conflicts, resolve contradictions in D1 memories.
5. FEATURE ADDITION: Propose and implement new features via GitHub API commits to caffeine-brainforge repo.
6. TOOL INTEGRATION: Integrate new tools via worker-factory; document integrations in canonical/ files.

## ACTUAL ARCHITECTURE (do NOT invent or guess — only describe what is listed here)
### Cloudflare Worker endpoints (this worker):
- GET  /health        — worker status, version, endpoint list
- POST /chat          — send message, get AI reply (Groq primary, Gemini fallback)
- GET|POST /mcp       — MCP JSON-RPC 2.0 protocol for Claude Desktop / Cursor
- POST /log           — log a chat/event entry to GitHub + D1
- GET|POST /memory    — read/write entries in D1 memories table
- GET  /events        — list structured events from D1 events table
- GET  /agents        — list registered agents from D1 agents table
- GET|POST /archive   — archive L2 memories not accessed in 30+ days
- GET|POST /operate   — read dashboard state or trigger agent actions
- GET  /search        — live DuckDuckGo web search: /search?q=query
- GET  /bash          — permanent bash terminal access (Cloudflare Tunnel proxy)
- POST /evolve        — trigger self-improvement cycle (6 evolution dimensions)
### Storage:
- Cloudflare D1 database: brain-memory
  - Tables: memories, events, agents, archived_memories
- GitHub repository: richardbrownmiami-commits/caffeine-brainforge (branch: main)
  - Memory files: soul/, canonical/, sources/, rules/
  - Agents: agents/qa.md, agents/jonqa.md, agents/compiler.js, agents/worker-factory.mjs
### Frontend:
- GitHub Pages: https://richardbrownmiami-commits.github.io/caffeine-brainforge/
- Editor: https://richardbrownmiami-commits.github.io/caffeine-brainforge/editor.html
### Agent system:
- QA agent: verification and testing
- JonQA agent: supervisor — independently verifies QA's claims
- Compiler agent: consolidates memories from sources/ into canonical/
- Worker Factory: deploys new Cloudflare Workers autonomously
### Memory levels:
- L0 (SOUL): identity and voice — soul/ directory
- L1 (canonical): verified facts and rules — canonical/ directory
- L2 (project/context): session and task memories — sources/ directory

## MANDATORY BEHAVIOR RULES:
- ALWAYS reference stored memories by their exact [key_name] when they are relevant to the answer.
- Example: "According to [hybrid_goal], my 6 dimensions are..." or "As stored in [bash-tunnel-url], the terminal URL is..."
- RESPOND IN URDU OR ENGLISH ONLY. NEVER use Hindi words (e.g. never say "adhik", "prayaas", "viksit", "drishti").
- NEVER mention /learn, /recall, /generate, /think, /plan — these endpoints do NOT exist
- NEVER invent tools, endpoints, or features not listed above
- If asked about something not in this architecture, say "that is not part of this system"
`;
async function groq(msg,ctx,env){
  const groqKey = env.GROQ_API_KEY || "";
  const sysPrompt = BRAIN_SYSTEM_PROMPT + (ctx ? '\n\n## ADDITIONAL CONTEXT:\n' + ctx : '');
  const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+groqKey},body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'system',content:sysPrompt},{role:'user',content:msg}],max_tokens:1024})});
  if(!r.ok)throw new Error('Groq '+r.status);
  const d=await r.json();return{reply:d.choices[0].message.content,model:'groq/llama-3.3-70b-versatile'};
}
async function gemini(msg,ctx,env){
  const geminiKey = env.GEMINI_API_KEY || "";
  const sysPrompt = BRAIN_SYSTEM_PROMPT + (ctx ? '\n\n## ADDITIONAL CONTEXT:\n' + ctx : '');
  const r=await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key='+geminiKey,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:sysPrompt+'\n\nUser: '+msg}]}]})});
  if(!r.ok)throw new Error('Gemini '+r.status);
  const d=await r.json();return{reply:d.candidates[0].content.parts[0].text,model:'gemini/gemini-1.5-flash'};
}
async function chat(msg,ctx,env){try{return await groq(msg,ctx,env);}catch(e){try{return{...await gemini(msg,ctx,env),fallback:true,reason:e.message};}catch(e2){throw new Error('Both failed: '+e.message+' | '+e2.message);}}}
// D1 helpers - schema-aware
async function memRead(db,key){
  const r=await db.prepare('SELECT * FROM memories WHERE key=?').bind(key).first();
  if(r){await db.prepare('UPDATE memories SET access_count=access_count+1,accessed_at=?,last_accessed=? WHERE key=?').bind(new Date().toISOString(),new Date().toISOString(),key).run();return{found:true,key,value:r.value,level:r.level,access_count:(r.access_count||0)+1};}
  return{found:false,key};
}
async function memWrite(db,key,value,level){
  level=level||'L2';
  const ts=new Date().toISOString();
  await db.prepare('INSERT INTO memories (key,value,level,created_at,last_accessed,accessed_at) VALUES (?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,level=excluded.level,last_accessed=excluded.last_accessed,accessed_at=excluded.accessed_at').bind(key,value,level,ts,ts,ts).run();
  return{saved:true,key,level};
}
async function evtLog(db,agent,action,result,tags){
  const ts=new Date().toISOString();
  await db.prepare('INSERT INTO events (ts,agent,action,result,tags) VALUES (?,?,?,?,?)').bind(ts,agent,action,result,JSON.stringify(tags||[])).run();
  const rec=await db.prepare('SELECT * FROM events ORDER BY ts DESC LIMIT 10').all();
  return{logged:true,recent:rec.results};
}
async function agentList(db){
  const r=await db.prepare('SELECT * FROM agents ORDER BY last_action_ts DESC').all();
  return{agents:r.results||[]};
}
async function sysStat(db){
  const mC=await db.prepare('SELECT COUNT(*) as c FROM memories').first();
  const eC=await db.prepare('SELECT COUNT(*) as c FROM events').first();
  const aC=await db.prepare('SELECT COUNT(*) as c FROM agents').first();
  const ev=await db.prepare('SELECT * FROM events ORDER BY ts DESC LIMIT 5').all();
  return{memory_count:(mC&&mC.c)||0,event_count:(eC&&eC.c)||0,agent_count:(aC&&aC.c)||0,recent_events:(ev&&ev.results)||[],worker_version:'4.0',d1_status:'connected',mcp_protocol:'json-rpc-2.0',endpoints:['/health','/chat','/mcp','/log','/memory','/events','/agents','/archive','/operate','/search','/bash','/evolve']};
}
async function operate(body,env){
  const db=env.DB;const action=(body&&body.action)||'read_state';const p=(body&&body.params)||{};
  if(action==='read_state'){const s=await sysStat(db);const a=await agentList(db);const m=await db.prepare('SELECT key,level,accessed_at FROM memories ORDER BY accessed_at DESC LIMIT 10').all();return{action:'read_state',timestamp:new Date().toISOString(),system:s,agents:a.agents,recent_memories:(m&&m.results)||[]};}
  if(action==='write_memory'){if(!p.key||!p.value)return{error:'key and value required'};return await memWrite(db,p.key,p.value,p.level||'L2');}
  if(action==='list_events'){const lim=p.limit||20;const ev=await db.prepare('SELECT * FROM events ORDER BY ts DESC LIMIT ?').bind(lim).all();return{events:(ev&&ev.results)||[],count:(ev&&ev.results&&ev.results.length)||0};}
  if(action==='trigger_agent'){if(!p.agent_name||!p.task)return{error:'agent_name and task required'};await evtLog(db,'operate','trigger:'+p.agent_name,'info',['trigger',p.agent_name]);await db.prepare('INSERT INTO agents (name,role,last_action,last_action_ts) VALUES (?,?,?,?) ON CONFLICT(name) DO UPDATE SET last_action=excluded.last_action,last_action_ts=excluded.last_action_ts').bind(p.agent_name,'autonomous-agent',p.task,new Date().toISOString()).run();return{triggered:true,agent:p.agent_name,task:p.task,timestamp:new Date().toISOString()};}
  return{error:'Unknown: '+action,valid:['read_state','write_memory','list_events','trigger_agent']};
}
async function dispatchTool(name,p,env){
  const db=env.DB;
  if(name==='chat'){if(!p.message)return{error:'message required'};const r=await chat(p.message,p.context,env);evtLog(db,'mcp-client','chat','pass',['mcp','chat']).catch(()=>{});return r;}
  if(name==='memory_read')return await memRead(db,p.key);
  if(name==='memory_write')return await memWrite(db,p.key,p.value,p.level||'L2');
  if(name==='events_log')return await evtLog(db,p.agent,p.action,p.result,p.tags||[]);
  if(name==='agents_list')return await agentList(db);
  if(name==='system_status')return await sysStat(db);
  if(name==='operate')return await operate({action:p.action,params:p.params||{}},env);
  return{error:'Unknown tool: '+name,available:TOOLS.map(t=>t.name)};
}
async function ghLog(content,env){
  const url='https://api.github.com/repos/richardbrownmiami-commits/caffeine-brainforge/contents/sources/chat-logs/chat-log.md';
  const h={Authorization:'token '+env.GITHUB_PAT,'Content-Type':'application/json','User-Agent':'caffeine-brain-worker'};
  let sha;try{const e=await fetch(url,{headers:h}).then(r=>r.json());sha=e.sha;}catch(e){}
  return fetch(url,{method:'PUT',headers:h,body:JSON.stringify({message:'log: chat session',content:btoa(unescape(encodeURIComponent(content))),...(sha?{sha}:{})})});
}
// ── ARCHIVE HELPER ───────────────────────────────────────────────────────────
// Shared logic for both GET and POST /archive
async function doArchive(db){
  const cutoff=new Date(Date.now()-30*24*60*60*1000).toISOString();
  // Ensure archived_memories table exists
  await db.prepare('CREATE TABLE IF NOT EXISTS archived_memories (key TEXT PRIMARY KEY, value TEXT, level TEXT, archived_at TEXT, original_created_at TEXT)').run();
  // Find old L2 memories
  const old=await db.prepare('SELECT * FROM memories WHERE (accessed_at < ? OR last_accessed < ?) AND level=?').bind(cutoff,cutoff,'L2').all();
  const rows=(old&&old.results)||[];
  if(rows.length>0){
    const ts=new Date().toISOString();
    for(const row of rows){
      await db.prepare('INSERT INTO archived_memories (key,value,level,archived_at,original_created_at) VALUES (?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,archived_at=excluded.archived_at').bind(row.key,row.value||'',row.level||'L2',ts,row.created_at||ts).run();
    }
    await db.prepare('DELETE FROM memories WHERE (accessed_at < ? OR last_accessed < ?) AND level=?').bind(cutoff,cutoff,'L2').run();
  }
  return{archived:rows.length,cutoff,status:'ok'};
}

// ── DuckDuckGo search helper ─────────────────────────────────────────────────
async function duckDuckGoSearch(query){
  try{
    const url='https://api.duckduckgo.com/?q='+encodeURIComponent(query)+'&format=json&no_html=1&skip_disambig=1';
    const r=await fetch(url,{headers:{'Accept':'application/json','User-Agent':'CaffeinebrainAI/1.0'}});
    if(!r.ok)throw new Error('DDG '+r.status);
    const d=await r.json();
    const results=[];
    if(d.AbstractText){results.push({title:d.Heading||query,description:d.AbstractText,url:d.AbstractURL||''});}
    if(d.RelatedTopics&&Array.isArray(d.RelatedTopics)){
      for(const t of d.RelatedTopics.slice(0,5)){
        if(t.Text&&results.length<3){results.push({title:t.Text.split(' - ')[0]||query,description:t.Text,url:t.FirstURL||''});}
      }
    }
    return{query,results:results.slice(0,3),source:'duckduckgo',timestamp:new Date().toISOString()};
  }catch(e){return{query,results:[],source:'duckduckgo',error:e.message,timestamp:new Date().toISOString()};}
}

// ── Auto-search: detect question intent ──────────────────────────────────────
function shouldAutoSearch(msg){
  const m=msg.toLowerCase();
  const qWords=['what ','who ','when ','where ','how ','why ','which ','kya ','kaun ','kab ','kahan ','kaise ','kyun '];
  if(m.trim().endsWith('?'))return true;
  return qWords.some(w=>m.includes(w));
}

export default {
  async fetch(req,env,ctx){
    const u=new URL(req.url),p=u.pathname;
    if(req.method==='OPTIONS')return new Response(null,{headers:CORS});
    if(p==='/health')return R({status:'ok',worker:'caffeine-brain',version:'4.0',primary:'groq/llama-3.3-70b-versatile',fallback:'gemini/gemini-1.5-flash',d1:'connected',mcp_protocol:'json-rpc-2.0',endpoints:['/health','/chat','/mcp','/log','/memory','/events','/agents','/archive','/operate','/search','/bash','/evolve']});
    if(p==='/mcp'){
      if(req.method==='GET')return R({protocol_version:'2024-11-05',capabilities:{tools:{}},server_info:{name:'caffeine-brain',version:'3.1',description:'Autonomous AI brain for caffeine-brainforge',url:'https://caffeine-brain-worker.richard-brown-miami.workers.dev'},tools:TOOLS,status:'live'});
      if(req.method==='POST'){
        let b;try{b=await req.json();}catch(e){return R({error:'Invalid JSON'},400);}
        if(b.jsonrpc==='2.0'){
          const{method:m,params:pr,id}=b;
          if(m==='initialize')return R({jsonrpc:'2.0',id,result:{protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'caffeine-brain',version:'3.1'}}});
          if(m==='tools/list')return R({jsonrpc:'2.0',id,result:{tools:TOOLS}});
          if(m==='notifications/initialized')return R({jsonrpc:'2.0',id:null,result:{}});
          if(m==='tools/call'){
            const tn=pr&&pr.name,ta=(pr&&pr.arguments)||{};
            if(!tn)return R({jsonrpc:'2.0',id,error:{code:-32602,message:'tool name required'}});
            try{const r=await dispatchTool(tn,ta,env);return R({jsonrpc:'2.0',id,result:{content:[{type:'text',text:JSON.stringify(r,null,2)}]}});}
            catch(e){return R({jsonrpc:'2.0',id,error:{code:-32603,message:e.message}});}
          }
          return R({jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found: '+m}});
        }
        const{tool,params:tp}=b;if(!tool)return R({error:'tool or jsonrpc required'},400);
        try{return R(await dispatchTool(tool,tp||{},env));}catch(e){return R({error:e.message},500);}
      }
    }
    if(p==='/chat'&&req.method==='POST'){
      let b;try{b=await req.json();}catch(e){return R({error:'Invalid JSON'},400);}
      if(!b.message)return R({error:'message required'},400);
      try{
        // ── Step 1: Fetch last 10 memories from D1 for context ──
        let memoryContext = '';
        try {
          const memoriesResult = await env.DB.prepare(
            "SELECT key, value FROM memories ORDER BY created_at DESC LIMIT 10"
          ).all();
          if (memoriesResult.results && memoriesResult.results.length > 0) {
            memoryContext = memoriesResult.results
              .map(m => `[${m.key}]: ${(m.value||'').substring(0,200)}`)
              .join('\n');
          }
        } catch (memErr) { /* non-fatal — continue without memory context */ }

        // ── Step 2: Build context — memory + web search + any user-supplied ctx ──
        let chatCtx = b.context || '';
        if (memoryContext) {
          chatCtx = 'STORED MEMORIES — cite by [key_name] in your response:\n' + memoryContext +
                    (chatCtx ? '\n\n' + chatCtx : '');
        }
        let searchData = null;
        if (shouldAutoSearch(b.message)) {
          try {
            searchData = await duckDuckGoSearch(b.message);
            if (searchData.results && searchData.results.length > 0) {
              const sr = searchData.results.map((x,i) => (i+1)+'. '+x.title+': '+x.description).join('\n');
              chatCtx = (chatCtx ? chatCtx + '\n\n' : '') + 'Web search results for context:\n' + sr;
            }
          } catch(se) {}
        }

        // ── Step 3: Call AI (Groq primary, Gemini fallback) ──
        const r = await chat(b.message, chatCtx, env);
        const aiReply = r.reply || '';

        // ── Step 4: Save user message AND AI reply to D1 memories ──
        const timestamp = Date.now();
        ctx.waitUntil(
          env.DB.prepare(
            "INSERT OR REPLACE INTO memories (key, value, created_at) VALUES (?, ?, datetime('now'))"
          ).bind('chat_user_' + timestamp, b.message).run().catch(() => {})
        );
        ctx.waitUntil(
          env.DB.prepare(
            "INSERT OR REPLACE INTO memories (key, value, created_at) VALUES (?, ?, datetime('now'))"
          ).bind('chat_ai_' + timestamp, aiReply.substring(0, 500)).run().catch(() => {})
        );

        // ── Step 5: Log event ──
        ctx.waitUntil(evtLog(env.DB,'chat-endpoint','user-message','pass',['chat']).catch(()=>{}));

        return R({...r, source:'chat', memory_context_used: !!memoryContext,
                  memories_loaded: memoryContext ? memoryContext.split('\n').length : 0,
                  auto_searched: !!searchData,
                  search_results: searchData ? searchData.results : undefined});
      }catch(e){return R({error:e.message},500);}
    }
    if(p==='/log'&&req.method==='POST'){
      let b;try{b=await req.json();}catch(e){return R({error:'Invalid JSON'},400);}
      const entry='## Log Entry\n**Time:** '+new Date().toISOString()+'\n**Agent:** '+(b.agent||'unknown')+'\n**Message:** '+(b.message||'')+'\n\n';
      const gh=await ghLog(entry,env).catch(e=>({status:500}));
      ctx.waitUntil(evtLog(env.DB,b.agent||'log-endpoint','log-entry','pass',['log']).catch(()=>{}));
      return R({status:'logged',github_status:gh.status||200});
    }
    if(p==='/memory'){
      if(req.method==='GET'){const k=u.searchParams.get('key');if(!k)return R({error:'key required'},400);return R(await memRead(env.DB,k));}
      if(req.method==='POST'){let b;try{b=await req.json();}catch(e){return R({error:'Invalid JSON'},400);}return R(await memWrite(env.DB,b.key,b.value,b.level||'L2'));}
    }
    if(p==='/events'){
      const lim=parseInt(u.searchParams.get('limit')||'20');
      const r=await env.DB.prepare('SELECT * FROM events ORDER BY ts DESC LIMIT ?').bind(lim).all();
      return R({events:(r&&r.results)||[],count:(r&&r.results&&r.results.length)||0});
    }
    if(p==='/agents')return R(await agentList(env.DB));
    // /archive — GET returns dry-run count, POST actually archives
    if(p==='/archive'){
      if(req.method==='GET'){
        // Dry-run: count how many would be archived without deleting
        const cutoff=new Date(Date.now()-30*24*60*60*1000).toISOString();
        const old=await env.DB.prepare('SELECT COUNT(*) as c FROM memories WHERE (accessed_at < ? OR last_accessed < ?) AND level=?').bind(cutoff,cutoff,'L2').first();
        return R({archived:0,would_archive:(old&&old.c)||0,cutoff,status:'ok',note:'Use POST /archive to actually archive'});
      }
      if(req.method==='POST'){
        return R(await doArchive(env.DB));
      }
    }
    if(p==='/operate'){
      if(req.method==='GET')return R(await operate({action:'read_state'},env));
      if(req.method==='POST'){let b;try{b=await req.json();}catch(e){return R({error:'Invalid JSON'},400);}return R(await operate(b,env));}
    }
    // ── /bash ENDPOINT ─────────────────────────────────────────────────────────
    // Permanent bash terminal access via Cloudflare Tunnel proxy.
    // The underlying tunnel URL is session-bound (ttyd+cloudflared),
    // so we store/retrieve the current URL in D1. The permanent URL never changes.
    if(p==='/bash'){
      const db = env.DB;
      // POST /bash — update stored tunnel URL
      if(req.method==='POST'){
        let b; try{b=await req.json();}catch(e){return R({error:'Invalid JSON'},400);}
        if(!b.tunnelUrl) return R({error:'tunnelUrl required'},400);
        await memWrite(db,'bash-tunnel-url',b.tunnelUrl,'L1');
        await evtLog(db,'bash-endpoint','update-tunnel-url',b.tunnelUrl,['bash','tunnel']).catch(()=>{});
        return R({status:'saved',tunnelUrl:b.tunnelUrl,permanentUrl:'https://caffeine-brain-worker.richard-brown-miami.workers.dev/bash'});
      }
      // GET /bash?url=<tunnel-url> — redirect to specific URL (also stores it)
      const urlParam = u.searchParams.get('url');
      if(urlParam){
        await memWrite(db,'bash-tunnel-url',urlParam,'L1').catch(()=>{});
        return Response.redirect(urlParam,302);
      }
      // GET /bash — check stored URL, redirect if available, else show setup page
      const stored = await memRead(db,'bash-tunnel-url').catch(()=>({found:false}));
      const tunnelUrl = stored && stored.found ? stored.value : null;
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Caffeine Brainforge — Bash Terminal</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:monospace;background:#0a0a0a;color:#00ff88;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:#111;border:1px solid #00ff88;border-radius:8px;padding:32px;max-width:640px;width:100%}
  h1{font-size:1.4rem;margin-bottom:8px;color:#00ff88}
  .sub{color:#888;font-size:0.85rem;margin-bottom:24px}
  .status{padding:12px 16px;border-radius:6px;margin-bottom:20px;font-size:0.9rem}
  .status.active{background:#0a2a1a;border:1px solid #00ff88;color:#00ff88}
  .status.inactive{background:#2a0a0a;border:1px solid #ff4444;color:#ff6666}
  label{display:block;font-size:0.8rem;color:#888;margin-bottom:6px;margin-top:16px}
  input{width:100%;padding:10px 14px;background:#1a1a1a;border:1px solid #333;border-radius:6px;color:#fff;font-family:monospace;font-size:0.9rem;outline:none}
  input:focus{border-color:#00ff88}
  button{margin-top:14px;width:100%;padding:12px;background:#00ff88;color:#0a0a0a;border:none;border-radius:6px;font-family:monospace;font-size:1rem;font-weight:700;cursor:pointer}
  button:hover{background:#00dd77}
  .launch{display:block;text-align:center;padding:12px;background:#003322;border:1px solid #00ff88;border-radius:6px;color:#00ff88;text-decoration:none;font-size:1rem;margin-bottom:16px}
  .launch:hover{background:#004433}
  pre{background:#0a0a0a;border:1px solid #222;border-radius:6px;padding:16px;overflow-x:auto;font-size:0.78rem;color:#aaa;margin-top:8px;line-height:1.6}
  .dim{color:#555;font-size:0.78rem;margin-top:16px}
</style>
</head>
<body>
<div class="card">
  <h1>🖥️ Caffeine Brainforge — Bash Terminal</h1>
  <p class="sub">Permanent URL: <strong>https://caffeine-brain-worker.richard-brown-miami.workers.dev/bash</strong></p>
  ${tunnelUrl ? `
  <div class="status active">✅ Tunnel active — redirecting in 2 seconds...</div>
  <a href="${tunnelUrl}" class="launch">🚀 Launch Terminal Now →</a>
  <script>setTimeout(()=>window.location.href="${tunnelUrl}",2000);</script>
  ` : `
  <div class="status inactive">⚠️ No active tunnel URL stored. Start the tunnel and update below.</div>
  `}
  <label>Update Tunnel URL (paste new URL after session reset)</label>
  <input type="text" id="turl" placeholder="https://your-tunnel.trycloudflare.com" value="${tunnelUrl||''}">
  <button onclick="saveTunnel()">Save & Launch Terminal</button>
  <p style="margin-top:24px;color:#888;font-size:0.82rem;">📋 To reconnect after session reset, run these commands:</p>
  <pre>ttyd -p 7681 bash &amp;
cloudflared tunnel --url http://localhost:7681 run &quot;agro trust tunnel&quot;</pre>
  <p style="margin-top:8px;color:#888;font-size:0.82rem;">Then paste the new trycloudflare.com URL above, or use:</p>
  <pre>curl -X POST https://caffeine-brain-worker.richard-brown-miami.workers.dev/bash   -H &quot;Content-Type: application/json&quot;   -d &#x27;{&quot;tunnelUrl&quot;: &quot;https://YOUR-URL.trycloudflare.com&quot;}&#x27;</pre>
  <p class="dim">Tunnel: agro trust tunnel | ID: 8690a2f0-925a-48c2-8376-d5fcd2b0f776</p>
</div>
<script>
async function saveTunnel(){
  const url=document.getElementById('turl').value.trim();
  if(!url)return alert('Paste a tunnel URL first');
  const r=await fetch(location.href,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({tunnelUrl:url})});
  const d=await r.json();
  if(d.status==='saved') window.location.href=url;
  else alert('Error: '+JSON.stringify(d));
}
</script>
</body>
</html>`;
      return new Response(html,{status:200,headers:{...CORS,'Content-Type':'text/html;charset=utf-8'}});
    }
    // === /evolve — Self-improvement cycle ===
    if(p==='/evolve'){
      try{
        const prompt='You are Brainforge AI in self-improvement cycle '+Date.now()+'. Hybrid goal: 6 self-evolution dims: (1)Auto Improvement /evolve, (2)Skill Acquisition /search, (3)Identity via SOUL files, (4)Thinking via QA loops, (5)Feature Addition GitHub API, (6)Tool Integration worker-factory. Suggest ONE concrete improvement as JSON: {"dimension":"NAME","action":"desc","reasoning":"why","next_step":"step"}';
        let sug='{"dimension":"THINKING","action":"Log baseline","reasoning":"First cycle","next_step":"Record state in D1"}';
        try{
          const evolveGroqKey = env.GROQ_API_KEY || "";
          const gr=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+evolveGroqKey,'Content-Type':'application/json'},body:JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'user',content:prompt}],max_tokens:300,temperature:0.7})});
          const gd=await gr.json();sug=gd.choices?.[0]?.message?.content||sug;
        }catch(ge){}
        let cyc=1;
        try{const cr=await env.DB.prepare("SELECT COUNT(*) as cnt FROM events WHERE type='evolution'").first();cyc=Number(cr?.cnt||0)+1;}catch(de){}
        try{await env.DB.prepare('INSERT INTO events (type,data,timestamp) VALUES (?,?,?)').bind('evolution',JSON.stringify({cycle:cyc,suggestion:sug,triggered_by:'api'}),new Date().toISOString()).run();}catch(de){}
        return R({status:'ok',cycle:cyc,suggestion:sug,timestamp:new Date().toISOString(),hybrid_goal:'active',dimensions:['auto-improvement','skill-acquisition','identity-development','thinking-improvement','feature-addition','tool-integration']});
      }catch(e){return R({status:'error',error:e.message},500);}
    }

    // === /search — DuckDuckGo live search ===
    if(p==='/search'){
      const q=u.searchParams.get('q')||u.searchParams.get('query');
      if(!q)return R({error:'q parameter required. Use /search?q=your+query'},400);
      try{
        const data=await duckDuckGoSearch(q);
        ctx.waitUntil(evtLog(env.DB,'search-endpoint','ddg-search',q,['search','duckduckgo']).catch(()=>{}));
        // Save search to D1 memory
        ctx.waitUntil(memWrite(env.DB,'last-search-'+Date.now(),JSON.stringify({q,results:data.results}),'L2').catch(()=>{}));
        return R(data);
      }catch(e){return R({error:e.message},500);}
    }

    return R({error:'Not found',path:p},404);
  }
};