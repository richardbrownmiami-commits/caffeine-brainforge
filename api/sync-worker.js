// sync-worker.js — GitHub PAT-based brain sync
// Reads canonical files and pushes to GitHub repo
// PAT must be in GITHUB_PAT environment variable — never hardcoded

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const GITHUB_PAT = process.env.GITHUB_PAT;
const REPO_OWNER = 'richardbrownmiami-commits';
const REPO_NAME = 'caffeine-brainforge';

async function githubRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `token ${GITHUB_PAT}`,
        'User-Agent': 'caffeine-brain-sync/2.0',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function pushFile(filePath, content, message) {
  const encoded = Buffer.from(content).toString('base64');
  // Check if file exists (get SHA)
  const check = await githubRequest('GET', `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`);
  const sha = check.status === 200 ? check.body.sha : undefined;
  
  const result = await githubRequest('PUT', `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`, {
    message,
    content: encoded,
    ...(sha ? { sha } : {})
  });
  return result.status;
}

async function syncBrain() {
  if (!GITHUB_PAT) {
    console.error('GITHUB_PAT environment variable not set');
    return;
  }
  
  console.log('Starting brain sync...');
  const timestamp = new Date().toISOString();
  
  const files = [
    { path: 'soul/SOUL.md', local: 'soul/SOUL.md' },
    { path: 'soul/IDENTITY.md', local: 'soul/IDENTITY.md' },
    { path: 'canonical/profile.md', local: 'canonical/profile.md' },
    { path: 'canonical/stable-memory.md', local: 'canonical/stable-memory.md' },
  ];
  
  for (const file of files) {
    try {
      const content = readFileSync(join(ROOT, file.local), 'utf8');
      const status = await pushFile(file.path, content, `brain sync: ${file.path} — ${timestamp}`);
      console.log(`  ${file.path}: HTTP ${status}`);
    } catch (err) {
      console.error(`  ${file.path}: ERROR — ${err.message}`);
    }
  }
  
  console.log('Brain sync complete:', timestamp);
}

syncBrain();
