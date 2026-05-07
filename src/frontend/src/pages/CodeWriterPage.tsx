import React, { useState } from 'react';

async function writeCodeToRepo(
  instruction: string,
  filePath: string,
  content: string,
  pat: string,
  repo: string
): Promise<{ success: boolean; message: string }> {
  let sha: string | undefined;
  try {
    const existing = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
      headers: { Authorization: `Bearer ${pat}`, Accept: 'application/vnd.github+json' },
    });
    if (existing.ok) { const d = await existing.json(); sha = d.sha; }
  } catch {}

  const body: Record<string, unknown> = {
    message: `feat: ${instruction.substring(0, 72)}`,
    content: btoa(unescape(encodeURIComponent(content))),
  };
  if (sha) body.sha = sha;

  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  // Log to localStorage
  const logs = JSON.parse(localStorage.getItem('brainforge_logs') || '[]');
  logs.push({
    id: Date.now().toString(),
    timestamp: new Date().toISOString(),
    type: 'terminal',
    command: `write ${filePath}`,
    output: res.ok ? `Written: ${filePath}` : `Failed: ${res.status}`,
    status: res.ok ? 'success' : 'error',
  });
  localStorage.setItem('brainforge_logs', JSON.stringify(logs));

  return { success: res.ok, message: res.ok ? `Written: ${filePath}` : `Error: ${res.status}` };
}

const CodeWriterPage: React.FC = () => {
  const [instruction, setInstruction] = useState('');
  const [filePath, setFilePath] = useState('');
  const [code, setCode] = useState('');
  const [pat, setPat] = useState(localStorage.getItem('bf_github_pat') || '');
  const [repo, setRepo] = useState(localStorage.getItem('bf_github_repo') || 'richardbrownmiami-commits/caffeine-brainforge');
  const [status, setStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleWrite = async () => {
    if (!instruction || !filePath || !code || !pat || !repo) {
      setStatus({ success: false, message: 'All fields required' });
      return;
    }
    setLoading(true);
    setStatus(null);
    if (pat) localStorage.setItem('bf_github_pat', pat);
    if (repo) localStorage.setItem('bf_github_repo', repo);
    const result = await writeCodeToRepo(instruction, filePath, code, pat, repo);
    setStatus(result);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 p-4 gap-4">
      <div>
        <h1 className="text-xl font-bold text-white">Code Writer</h1>
        <p className="text-gray-400 text-sm">Write code directly to your GitHub repository</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">GitHub PAT</label>
          <input type="password" value={pat} onChange={e => setPat(e.target.value)}
            placeholder="ghp_..."
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">Repository</label>
          <input value={repo} onChange={e => setRepo(e.target.value)}
            placeholder="owner/repo"
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm text-gray-400">Instruction (commit message)</label>
        <input value={instruction} onChange={e => setInstruction(e.target.value)}
          placeholder="Add dark mode toggle to settings page"
          className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm text-gray-400">File Path</label>
        <input value={filePath} onChange={e => setFilePath(e.target.value)}
          placeholder="src/frontend/src/pages/MyPage.tsx"
          className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500" />
      </div>

      <div className="flex flex-col gap-1 flex-1">
        <label className="text-sm text-gray-400">Code</label>
        <textarea value={code} onChange={e => setCode(e.target.value)}
          placeholder="// Paste or write your code here..."
          className="flex-1 min-h-48 bg-black border border-gray-700 rounded px-3 py-2 text-sm text-green-300 font-mono focus:outline-none focus:border-purple-500 resize-none" />
      </div>

      <div className="flex items-center gap-4">
        <button onClick={handleWrite} disabled={loading}
          className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded font-medium text-white transition-colors">
          {loading ? 'Writing...' : 'Write to Repo'}
        </button>
        {status && (
          <span className={`text-sm font-medium ${status.success ? 'text-green-400' : 'text-red-400'}`}>
            {status.message}
          </span>
        )}
      </div>
    </div>
  );
};

export default CodeWriterPage;
