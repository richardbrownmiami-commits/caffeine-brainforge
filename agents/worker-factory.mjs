/**
 * worker-factory.mjs
 * ─────────────────────────────────────────────────────────────
 * Gives the AI brain system the ability to autonomously create
 * and deploy new Cloudflare Workers without wrangler.
 *
 * Usage:
 *   node worker-factory.mjs --name my-worker --description "..." --code ./worker.js
 *
 *   Or import deployWorker() from another script.
 *
 * Credentials: set via environment variables or pass at runtime.
 *   CF_ACCOUNT_ID, CF_API_TOKEN, GH_PAT
 * ─────────────────────────────────────────────────────────────
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/* ─── CREDENTIALS — set via environment variables ─── */
// CF_ACCOUNT_ID and CF_API_TOKEN are stored in Cloudflare Worker secrets
// GH_PAT is stored in GitHub Actions secrets
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID || '<SET_CF_ACCOUNT_ID>';
const CF_API_TOKEN  = process.env.CF_API_TOKEN  || '<SET_CF_API_TOKEN>';
const GH_PAT        = process.env.GH_PAT        || '<SET_GH_PAT>';
const GH_REPO       = process.env.GH_REPO       || 'richardbrownmiami-commits/caffeine-brainforge';
const GH_BRANCH     = 'main';
const REGISTRY_PATH = 'canonical/worker-registry.md';

/* ─── BASE WORKER TEMPLATE (wraps custom code) ─── */
const WORKER_WRAPPER = (name, description, innerCode) => `
/**
 * Cloudflare Worker: ${name}
 * Purpose: ${description}
 * Deployed by: worker-factory.mjs (caffeine-brainforge)
 * Deployed at: ${new Date().toISOString()}
 */

${innerCode}

// Default fetch handler if none defined above
if (typeof handleRequest === 'undefined') {
  addEventListener('fetch', event => {
    event.respondWith(new Response(JSON.stringify({
      worker: '${name}',
      status: 'ok',
      timestamp: new Date().toISOString(),
    }), { headers: { 'Content-Type': 'application/json' } }));
  });
}
`.trim();

/* ─── DEPLOY WORKER TO CLOUDFLARE ─── */
async function deployWorker({ name, description = '', code, routes = [] }) {
  if (!name || !code) throw new Error('name and code are required');

  const workerCode = WORKER_WRAPPER(name, description, code);
  const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/${name}`;

  console.log(`\n🚀 Deploying worker: ${name}`);
  console.log(`   URL: ${url}`);

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/javascript',
    },
    body: workerCode,
  });

  const responseText = await res.text();
  let responseJson;
  try { responseJson = JSON.parse(responseText); } catch { responseJson = { raw: responseText }; }

  if (!res.ok) {
    console.error(`❌ Cloudflare deploy FAILED — HTTP ${res.status}`);
    console.error('   Response:', JSON.stringify(responseJson, null, 2));
    throw new Error(`Cloudflare deploy failed: HTTP ${res.status} — ${responseJson?.errors?.[0]?.message || responseText}`);
  }

  console.log(`✅ Worker deployed — HTTP ${res.status}`);

  const workerUrlFallback = `https://${name}.workers.dev`;

  // Register in GitHub
  const registryUrl = await registerInGitHub({ name, description, workerUrl: workerUrlFallback, routes });

  return {
    success: true,
    name,
    workerUrl: workerUrlFallback,
    cloudflareStatus: res.status,
    registryEntry: registryUrl,
  };
}

/* ─── REGISTER WORKER IN GITHUB REGISTRY ─── */
async function registerInGitHub({ name, description, workerUrl, routes }) {
  const apiUrl = `https://api.github.com/repos/${GH_REPO}/contents/${REGISTRY_PATH}`;
  const headers = {
    'Authorization': `token ${GH_PAT}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };

  let existingContent = '';
  let sha = null;

  const getRes = await fetch(apiUrl, { headers });
  if (getRes.ok) {
    const data = await getRes.json();
    existingContent = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf8');
    sha = data.sha;
    console.log(`📋 Existing registry fetched (SHA: ${sha})`);
  } else if (getRes.status === 404) {
    existingContent = `# Worker Registry\n\nAutomatically maintained by worker-factory.mjs\n\n`;
    console.log(`📋 Registry not found — will create new`);
  } else {
    console.error(`⚠ Could not fetch registry — HTTP ${getRes.status}`);
    existingContent = `# Worker Registry\n\n`;
  }

  const timestamp = new Date().toISOString();
  const routeList = routes.length > 0 ? routes.map(r => `  - \`${r}\``).join('\n') : '  - (default)';

  const newEntry = `
## ${name}

| Field       | Value |
|-------------|-------|
| **URL**     | \`${workerUrl}\` |
| **Purpose** | ${description} |
| **Routes**  | |
${routeList}
| **Deployed**| ${timestamp} |

`;

  const updatedContent = existingContent + newEntry;
  const encoded = Buffer.from(updatedContent, 'utf8').toString('base64');

  const putBody = {
    message: `worker-factory: register ${name} (${timestamp})`,
    content: encoded,
    branch: GH_BRANCH,
  };
  if (sha) putBody.sha = sha;

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(putBody),
  });

  const putData = await putRes.json();

  if (putRes.ok) {
    console.log(`✅ Registry updated — HTTP ${putRes.status} (commit: ${putData.commit?.sha?.slice(0, 8) || 'N/A'})`);
    return `https://github.com/${GH_REPO}/blob/${GH_BRANCH}/${REGISTRY_PATH}`;
  } else {
    console.error(`❌ Registry update FAILED — HTTP ${putRes.status}: ${putData.message}`);
    return null;
  }
}

/* ─── CLI INTERFACE ─── */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node worker-factory.mjs [options]

Options:
  --name         <name>        Worker name (required)
  --description  <text>        What this worker does
  --code         <file.js>     Path to worker JS file (required)
  --routes       <r1,r2,...>   Comma-separated route paths
  --inline-code  <js>          Inline JavaScript code string

Environment variables required:
  CF_ACCOUNT_ID   Cloudflare account ID
  CF_API_TOKEN    Cloudflare API token with Workers:Edit permission
  GH_PAT          GitHub personal access token
  GH_REPO         GitHub repo (default: richardbrownmiami-commits/caffeine-brainforge)

Example:
  CF_ACCOUNT_ID=xxx CF_API_TOKEN=yyy GH_PAT=zzz \\
  node worker-factory.mjs \\
    --name research-worker \\
    --description "Fetches latest AI news" \\
    --code ./workers/research.js \\
    --routes /research,/news
    `);
    return;
  }

  function getArg(flag) {
    const i = args.indexOf(flag);
    return i !== -1 && args[i + 1] ? args[i + 1] : null;
  }

  const name        = getArg('--name');
  const description = getArg('--description') || 'Deployed by worker-factory.mjs';
  const codeFile    = getArg('--code');
  const inlineCode  = getArg('--inline-code');
  const routesStr   = getArg('--routes');
  const routes      = routesStr ? routesStr.split(',').map(r => r.trim()) : [];

  if (!name && !codeFile && !inlineCode) {
    console.log('ℹ  No arguments provided. Use --help for usage.\n');
    console.log('Required env vars: CF_ACCOUNT_ID, CF_API_TOKEN, GH_PAT');
    return;
  }

  if (!name) { console.error('❌ --name is required'); process.exit(1); }

  let code;
  if (codeFile) {
    const fullPath = resolve(codeFile);
    if (!existsSync(fullPath)) { console.error(`❌ Code file not found: ${fullPath}`); process.exit(1); }
    code = readFileSync(fullPath, 'utf8');
    console.log(`📂 Loaded code from ${fullPath} (${code.length} chars)`);
  } else if (inlineCode) {
    code = inlineCode;
  } else {
    console.error('❌ Either --code <file> or --inline-code <js> is required');
    process.exit(1);
  }

  try {
    const result = await deployWorker({ name, description, code, routes });
    console.log('\n🎉 Deployment complete:');
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('\n❌ Deployment failed:', err.message);
    process.exit(1);
  }
}

/* ─── EXPORTS ─── */
export { deployWorker, registerInGitHub };

/* ─── RUN IF CALLED DIRECTLY ─── */
const isMain = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) main();
