// Memory Decay Agent — archives L2 memories not accessed in 30 days
// Runs via GitHub Actions cron (Sundays 2am UTC)

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'richardbrownmiami-commits';
const REPO = 'caffeine-brainforge';
const API = 'https://api.github.com';

async function ghGet(path) {
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`, {
    headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
  });
  if (!res.ok) return null;
  return res.json();
}

async function ghPut(path, content, message, sha) {
  const body = { message, content: Buffer.from(content).toString('base64') };
  if (sha) body.sha = sha;
  const res = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

async function run() {
  const now = new Date();
  const cutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
  console.log(`Memory Decay Agent started — cutoff: ${cutoff.toISOString()}`);

  let archived = 0;

  // Check sources/ for old event files
  try {
    const sourcesDir = await ghGet('sources');
    if (sourcesDir && Array.isArray(sourcesDir)) {
      for (const item of sourcesDir) {
        if (item.type === 'file' && item.name.endsWith('.md') && item.name !== 'README.md') {
          // Try to parse date from filename e.g. 2025-01-15.md
          const dateMatch = item.name.match(/(\d{4}-\d{2}-\d{2})/);
          if (dateMatch) {
            const fileDate = new Date(dateMatch[1]);
            if (!isNaN(fileDate) && fileDate < cutoff) {
              // Read and move to archived/
              const file = await ghGet(`sources/${item.name}`);
              if (file && file.content) {
                const content = Buffer.from(file.content, 'base64').toString('utf8');
                await ghPut(`sources/archived/${item.name}`, content, `decay: archive ${item.name}`);
                console.log(`Archived: sources/${item.name}`);
                archived++;
              }
            }
          }
        }
      }
    }
  } catch (e) {
    console.log('sources/ check error:', e.message);
  }

  console.log(`Decay complete. Archived ${archived} stale files.`);

  // Update decay log
  const existing = await ghGet('canonical/decay-log.md');
  const entry = `\n- ${now.toISOString()}: decay run — archived ${archived} files`;
  const currentContent = existing
    ? Buffer.from(existing.content, 'base64').toString('utf8')
    : '# Memory Decay Log\n\nRuns every Sunday 2am UTC. Archives L2 sources not updated in 30+ days.\n';
  const updated = currentContent + entry;
  await ghPut('canonical/decay-log.md', updated, 'decay: update log', existing ? existing.sha : undefined);
  console.log('Decay log updated at canonical/decay-log.md');
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
