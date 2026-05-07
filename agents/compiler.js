// compiler.js — merge sources/ events into canonical/
// Inspired by agent-soul: append-only sources, compiler generates canonical

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function getAllSourceEvents() {
  const sourcesDir = join(ROOT, 'sources');
  const events = [];
  
  if (!existsSync(sourcesDir)) return events;
  
  const sources = readdirSync(sourcesDir);
  for (const source of sources) {
    const sourceDir = join(sourcesDir, source);
    const files = readdirSync(sourceDir).sort();
    for (const file of files) {
      const content = readFileSync(join(sourceDir, file), 'utf8');
      events.push({ source, file, content });
    }
  }
  return events;
}

function compileToCanonical(events) {
  const discoveries = [];
  const decisions = [];
  
  for (const { source, content } of events) {
    const lines = content.split('\n');
    for (const line of lines) {
      if (line.startsWith('### [') && line.includes('discovery |')) {
        discoveries.push(`- ${line.replace(/^### /, '')}`);
      }
      if (line.startsWith('### [') && line.includes('decision |')) {
        decisions.push(`- ${line.replace(/^### /, '')}`);
      }
    }
  }
  
  return {
    discoveries: discoveries.join('\n'),
    decisions: decisions.join('\n')
  };
}

const events = getAllSourceEvents();
const { discoveries, decisions } = compileToCanonical(events);

const fuzzyMemory = `# Fuzzy Memory — Recent Context (L2, on-demand)
*Auto-compiled from sources/ — do not edit manually*

## Recent Discoveries
${discoveries || '(none yet)'}

## Recent Decisions
${decisions || '(none yet)'}

*Last compiled: ${new Date().toISOString()}*
`;

const canonicalDir = join(ROOT, 'canonical');
if (!existsSync(canonicalDir)) mkdirSync(canonicalDir, { recursive: true });

writeFileSync(join(canonicalDir, 'fuzzy-memory.md'), fuzzyMemory);
console.log('Compiler: canonical/fuzzy-memory.md updated');
console.log(`  Discoveries: ${discoveries.split('\n').filter(Boolean).length}`);
console.log(`  Decisions: ${decisions.split('\n').filter(Boolean).length}`);
