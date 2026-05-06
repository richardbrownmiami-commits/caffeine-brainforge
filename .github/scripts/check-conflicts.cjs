#!/usr/bin/env node
/**
 * BrainForge — Structural Conflict Detector
 * Scans src/frontend/src/ for:
 *   a) Duplicate component names across files
 *   b) Duplicate route paths (createRoute / Route definitions)
 *   c) TypeScript type/interface name collisions across .ts/.tsx files
 *   d) Imports of non-existent local files
 *
 * Exits 0 if no conflicts; exits 1 (with JSON report) if conflicts found.
 * No external dependencies — only Node.js builtins.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../src/frontend/src');

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

/** Resolve a relative import path from a source file to an absolute path. */
function resolveImport(fromFile, importPath) {
  if (!importPath.startsWith('.')) return null; // skip node_modules / aliases
  const base = path.dirname(fromFile);
  const candidates = [
    path.resolve(base, importPath),
    path.resolve(base, importPath + '.ts'),
    path.resolve(base, importPath + '.tsx'),
    path.resolve(base, importPath + '.js'),
    path.resolve(base, importPath + '.jsx'),
    path.resolve(base, importPath, 'index.ts'),
    path.resolve(base, importPath, 'index.tsx'),
    path.resolve(base, importPath, 'index.js'),
  ];
  return candidates.find(c => fs.existsSync(c)) ?? null;
}

// ── Scan ─────────────────────────────────────────────────────────────────────

const files = walk(ROOT);
const conflicts = [];

// Track maps for duplicate detection
const componentMap = new Map(); // componentName → filePath
const routeMap = new Map();     // routePath → filePath
const typeMap = new Map();      // typeName → filePath

for (const filePath of files) {
  const rel = path.relative(ROOT, filePath);
  const src = readFile(filePath);

  // ── a) Duplicate component names ──────────────────────────────────────────
  const componentRe = /export\s+(?:default\s+)?(?:function|const|class)\s+([A-Z][A-Za-z0-9_]*)/g;
  let m;
  while ((m = componentRe.exec(src)) !== null) {
    const name = m[1];
    if (componentMap.has(name)) {
      conflicts.push({
        file: rel,
        type: 'duplicate-component',
        detail: `Component "${name}" also defined in ${path.relative(ROOT, componentMap.get(name))}`,
      });
    } else {
      componentMap.set(name, filePath);
    }
  }

  // ── b) Duplicate route paths ───────────────────────────────────────────────
  const routeRe = /(?:createRoute|createFileRoute|Route)[^;{]*path\s*:\s*[\'"](\\/[^\'"]*)[\'"\`]/g;
  while ((m = routeRe.exec(src)) !== null) {
    const routePath = m[1];
    if (routeMap.has(routePath)) {
      conflicts.push({
        file: rel,
        type: 'duplicate-route',
        detail: `Route path "${routePath}" also defined in ${path.relative(ROOT, routeMap.get(routePath))}`,
      });
    } else {
      routeMap.set(routePath, filePath);
    }
  }

  const fileRouteRe = /createFileRoute\s*\(\s*[\'"](\/[^\'"]*)[\'"]\s*\)/g;
  while ((m = fileRouteRe.exec(src)) !== null) {
    const routePath = m[1];
    if (routeMap.has(routePath)) {
      conflicts.push({
        file: rel,
        type: 'duplicate-route',
        detail: `Route path "${routePath}" also defined in ${path.relative(ROOT, routeMap.get(routePath))}`,
      });
    } else {
      routeMap.set(routePath, filePath);
    }
  }

  // ── c) TypeScript type/interface name collisions ───────────────────────────
  const typeRe = /^(?:export\s+)?(?:type|interface)\s+([A-Z][A-Za-z0-9_]*)/gm;
  while ((m = typeRe.exec(src)) !== null) {
    const name = m[1];
    if (typeMap.has(name)) {
      conflicts.push({
        file: rel,
        type: 'duplicate-type',
        detail: `Type/interface "${name}" also defined in ${path.relative(ROOT, typeMap.get(name))}`,
      });
    } else {
      typeMap.set(name, filePath);
    }
  }

  // ── d) Imports of non-existent local files ────────────────────────────────
  const importRe = /from\s+[\'"](\.\.[\/][^\'"]|\.[\/][^\'"])[\'"]/g;
  while ((m = importRe.exec(src)) !== null) {
    const importPath = m[1];
    const resolved = resolveImport(filePath, importPath);
    if (resolved === null) {
      conflicts.push({
        file: rel,
        type: 'missing-import',
        detail: `Cannot resolve local import "${importPath}"`,
      });
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

const report = {
  passed: conflicts.length === 0,
  scannedFiles: files.length,
  conflicts,
};

if (report.passed) {
  console.log(`✅ Conflict check passed. Scanned ${files.length} file(s) — no structural conflicts found.`);
  process.exit(0);
} else {
  console.error('❌ Structural conflicts detected:');
  console.error(JSON.stringify(report, null, 2));
  process.exit(1);
}
