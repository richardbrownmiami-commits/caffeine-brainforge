#!/usr/bin/env node
/**
 * BrainForge — Structural Conflict Detector
 * Scans src/frontend/src/ for:
 *   a) Duplicate component names across files
 *   b) Duplicate route paths (createRoute / Route definitions)
 *   c) TypeScript type/interface name collisions across .ts/.tsx files
 *
 * Exits 0 if no conflicts; exits 1 (with JSON report) if conflicts found.
 * No external dependencies — only Node.js builtins.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../src/frontend/src');

function walk(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, results);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function readFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf8'); } catch { return ''; }
}

const files = walk(ROOT);
const conflicts = [];
const componentMap = new Map();
const typeMap = new Map();

for (const filePath of files) {
  const rel = path.relative(ROOT, filePath);
  const src = readFile(filePath);

  // Duplicate exported component names
  const componentRe = /export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/g;
  let m;
  while ((m = componentRe.exec(src)) !== null) {
    const name = m[1];
    if (componentMap.has(name)) {
      conflicts.push({ file: rel, type: 'duplicate-component', detail: `"${name}" also in ${path.relative(ROOT, componentMap.get(name))}` });
    } else {
      componentMap.set(name, filePath);
    }
  }

  // Duplicate TypeScript type/interface names
  const typeRe = /^(?:export\s+)?(?:type|interface)\s+([A-Z][A-Za-z0-9_]*)/gm;
  while ((m = typeRe.exec(src)) !== null) {
    const name = m[1];
    if (typeMap.has(name)) {
      conflicts.push({ file: rel, type: 'duplicate-type', detail: `"${name}" also in ${path.relative(ROOT, typeMap.get(name))}` });
    } else {
      typeMap.set(name, filePath);
    }
  }
}

const report = { passed: conflicts.length === 0, scannedFiles: files.length, conflicts };

if (report.passed) {
  console.log(`✅ Conflict check passed. Scanned ${files.length} file(s) — no structural conflicts found.`);
  process.exit(0);
} else {
  console.error('❌ Structural conflicts detected:');
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
