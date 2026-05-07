#!/usr/bin/env node
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const API_URL = process.env.BRAINFORGE_API_URL || 'https://brainforge-api.richard-brown-miami.workers.dev';
const SECRET = process.env.BRAINFORGE_SECRET || '';
const args = process.argv.slice(2);
const command = args[0];

async function apiCall(endpoint: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Secret': SECRET },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

async function cmdInit() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string) => new Promise<string>(resolve => rl.question(q, resolve));
  const apiUrl = await ask('API URL (Enter for default): ');
  const secret = await ask('Secret key: ');
  const projectId = await ask('Default project ID: ');
  const envContent = [
    `BRAINFORGE_API_URL=${apiUrl || API_URL}`,
    `BRAINFORGE_SECRET=${secret}`,
    `BRAINFORGE_PROJECT_ID=${projectId || 'default'}`,
  ].join('\n');
  fs.writeFileSync(path.join(process.cwd(), '.env'), envContent);
  console.log('Config saved to .env');
  rl.close();
}

async function cmdStatus() {
  try {
    const result = await apiCall('/api/status');
    console.log(JSON.stringify(result, null, 2));
  } catch {
    console.error('Could not reach BrainForge Worker API');
  }
}

async function cmdChat() {
  const message = args.slice(1).join(' ');
  if (!message) { console.error('Usage: brainforge chat <message>'); process.exit(1); }
  try {
    const result = await apiCall('/api/ai', 'POST', { message, projectId: process.env.BRAINFORGE_PROJECT_ID || 'default' }) as Record<string, unknown>;
    console.log('Reply:', result.reply || JSON.stringify(result));
  } catch { console.error('Chat failed'); }
}

function cmdHelp() {
  console.log(`
BrainForge CLI

Commands:
  brainforge init        Setup config (.env)
  brainforge status      Check Worker API status
  brainforge chat <msg>  Send message to AI
  brainforge help        Show this help

Install:
  npm install brainforge
  pnpm add brainforge
`);
}

(async () => {
  switch (command) {
    case 'init': await cmdInit(); break;
    case 'status': await cmdStatus(); break;
    case 'chat': await cmdChat(); break;
    default: cmdHelp();
  }
})();
