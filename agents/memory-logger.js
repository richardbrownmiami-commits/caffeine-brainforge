// memory-logger.js — autonomous discovery logger (session-scoped)
// Uses node-cron + openai-fetch to log discoveries every 10 minutes

import cron from 'node-cron';
import OpenAI from 'openai-fetch';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const client = new OpenAI({
  apiKey: 'bifrost',
  baseURL: 'http://bifrost.bifrost.svc.cluster.local:4000/v1'
});

async function logDiscovery() {
  const timestamp = new Date().toISOString();
  try {
    const res = await client.createChatCompletion({
      model: 'openai/gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a sandbox discovery logger. Generate one concise insight about AI agent architecture, memory persistence, or autonomous systems. Format: "INSIGHT: <one sentence>"'
        },
        { role: 'user', content: 'Log one discovery for the caffeine-brain architecture.' }
      ],
      max_tokens: 100
    });
    
    const insight = res.choices[0].message.content;
    const dateStr = new Date().toISOString().split('T')[0];
    const sourcesDir = join(ROOT, `sources/caffeine`);
    
    if (!existsSync(sourcesDir)) mkdirSync(sourcesDir, { recursive: true });
    
    const entry = `\n### [${timestamp}] discovery | auto-logged\n${insight}\n`;
    appendFileSync(join(sourcesDir, `${dateStr}.md`), entry);
    console.log(`[${timestamp}] Logged:`, insight);
  } catch (err) {
    console.error(`[${timestamp}] Logger error:`, err.message);
  }
}

console.log('Memory logger started — logging every 10 minutes');
logDiscovery(); // Run immediately on start

cron.schedule('*/10 * * * *', logDiscovery);
