// auto-update-brain.js
// Runs via GitHub Actions cron every midnight UTC
// Fetches latest ICP/AI news and updates brain files

import { Octokit } from '@octokit/rest';
import Parser from 'rss-parser';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const parser = new Parser();
const REPO_OWNER = 'richardbrownmiami-commits';
const REPO_NAME = 'caffeine-brainforge';

async function fetchICPNews() {
  try {
    const feed = await parser.parseURL('https://forum.dfinity.org/latest.rss');
    return feed.items.slice(0, 5).map(i => `- ${i.title} (${i.pubDate?.slice(0,10) || 'recent'})`).join('\n');
  } catch (e) {
    return '- ICP forum fetch failed: ' + e.message;
  }
}

async function pushToGitHub(path, content, message) {
  try {
    let sha;
    try {
      const existing = await octokit.repos.getContent({ owner: REPO_OWNER, repo: REPO_NAME, path });
      sha = existing.data.sha;
    } catch (e) { /* new file */ }

    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER, repo: REPO_NAME, path, message,
      content: Buffer.from(content).toString('base64'),
      ...(sha ? { sha } : {})
    });
    console.log('Pushed:', path);
  } catch (e) {
    console.error('Push failed:', path, e.message);
  }
}

async function main() {
  console.log('Auto-update started:', new Date().toISOString());
  const news = await fetchICPNews();
  const date = new Date().toISOString().slice(0, 10);
  const content = `# Auto-Update: ${date}\n\n## ICP Forum Latest\n${news}\n\n## Update Time\n${new Date().toISOString()}\n`;
  await pushToGitHub(`sources/auto-updates/update-${date}.md`, content, `auto-update: brain sync ${date}`);
  console.log('Auto-update complete');
}

main().catch(console.error);
