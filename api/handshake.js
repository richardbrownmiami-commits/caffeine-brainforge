// handshake.js — iranti-inspired session handshake endpoint
// Any app calls /handshake to get brain context injected into session

import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadBrain() {
  const soul = readFileSync(join(ROOT, 'soul/SOUL.md'), 'utf8');
  const identity = readFileSync(join(ROOT, 'soul/IDENTITY.md'), 'utf8');
  const profile = readFileSync(join(ROOT, 'canonical/profile.md'), 'utf8');
  const stableMemory = readFileSync(join(ROOT, 'canonical/stable-memory.md'), 'utf8');
  return { soul, identity, profile, stableMemory };
}

function buildSystemPrompt(brain) {
  return [
    '# SOUL (L0)',
    brain.soul,
    '',
    '# IDENTITY (L0)',
    brain.identity,
    '',
    '# PROFILE (L1)',
    brain.profile,
    '',
    '# STABLE MEMORY (L1)',
    brain.stableMemory,
  ].join('\n');
}

const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  // Health check
  if (req.url === '/health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'caffeine-brain running', version: '2.0' }));
    return;
  }

  // Handshake endpoint
  if (req.url === '/handshake' && req.method === 'GET') {
    try {
      const brain = loadBrain();
      const systemPrompt = buildSystemPrompt(brain);
      res.writeHead(200);
      res.end(JSON.stringify({
        status: 'ok',
        agent: 'caffeine-brain v2.0',
        system_prompt: systemPrompt,
        protocol: '3-level-loading',
        levels: { l0: 'loaded', l1: 'loaded', l2: 'on-demand' }
      }));
    } catch (err) {
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(5000, () => {
  console.log('caffeine-brain handshake server running on port 5000');
});
