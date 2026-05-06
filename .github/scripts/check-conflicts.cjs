#!/usr/bin/env node
/**
 * BrainForge — Structural Conflict Detector
 * Scans src/frontend/src/ for duplicate component/type names.
 * Skips .d.ts declaration files (they mirror their .ts counterparts).
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
    } else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
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

for (const filePath of files) {
  const rel = path.relative(ROOT, filePath);
  const src = readFile(filePath);

  // Duplicate exported component names (capitals only — React components)
  const componentRe = /export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/g;
  let m;
  while ((m = componentRe.exec(src)) !== null) {
    const name = m[1];
    if (componentMap.has(name)) {
      conflicts.push({
        file: rel,
        type: 'duplicate-component',
        detail: `"${name}" also exported from ${path.relative(ROOT, componentMap.get(name))}`,
      });
    } else {
      componentMap.set(name, filePath);
    }
  }
}

const report = { passed: conflicts.length === 0, scannedFiles: files.length, conflicts };

if (report.passed) {
  console.log(`✅ Conflict check passed. Scanned ${files.length} source file(s).`);
  process.exit(0);
} else {
  console.error('❌ Structural conflicts detected:');
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
