import React, { useState, useEffect, useRef } from 'react';

interface LogEntry {
  id: string;
  timestamp: string;
  type: 'npm' | 'pnpm' | 'terminal' | 'system';
  command: string;
  output: string;
  status: 'running' | 'success' | 'error' | 'warning';
}

const LogPage: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'npm' | 'pnpm' | 'terminal'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => {
      const stored = localStorage.getItem('brainforge_logs');
      if (stored) { try { setLogs(JSON.parse(stored)); } catch {} }
    };
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.type === filter);

  const statusColor = (s: LogEntry['status']) => ({
    success: 'text-green-400', error: 'text-red-400',
    warning: 'text-yellow-400', running: 'text-blue-400',
  }[s] || 'text-gray-300');

  const typeBadge = (t: LogEntry['type']) => ({
    npm: 'bg-red-900 text-red-300', pnpm: 'bg-yellow-900 text-yellow-300',
    terminal: 'bg-green-900 text-green-300', system: 'bg-blue-900 text-blue-300',
  }[t] || 'bg-gray-800 text-gray-300');

  const addDemo = () => {
    const entry: LogEntry = {
      id: Date.now().toString(), timestamp: new Date().toISOString(),
      type: 'npm', command: 'npm install brainforge',
      output: '+ brainforge@0.1.0\nadded 1 package in 0.5s', status: 'success',
    };
    const updated = [...logs, entry];
    setLogs(updated);
    localStorage.setItem('brainforge_logs', JSON.stringify(updated));
  };

  const clearLogs = () => { setLogs([]); localStorage.removeItem('brainforge_logs'); };

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Terminal Logs</h1>
          <p className="text-gray-400 text-sm">npm • pnpm • terminal output</p>
        </div>
        <div className="flex gap-2">
          <button onClick={addDemo} className="px-3 py-1 bg-blue-700 hover:bg-blue-600 rounded text-sm">+ Demo</button>
          <button onClick={clearLogs} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">Clear</button>
          <button onClick={() => setAutoScroll(!autoScroll)} className={`px-3 py-1 rounded text-sm ${autoScroll ? 'bg-green-700' : 'bg-gray-700'}`}>
            Auto-scroll {autoScroll ? 'ON' : 'OFF'}
          </button>
        </div>
      </div>
      <div className="flex gap-2 mb-4">
        {(['all', 'npm', 'pnpm', 'terminal'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-1 rounded-full text-sm font-medium ${filter === f ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {f.toUpperCase()}
          </button>
        ))}
        <span className="ml-auto text-gray-500 text-sm self-center">{filtered.length} entries</span>
      </div>
      <div className="flex-1 overflow-y-auto bg-black rounded-lg p-3 font-mono text-sm space-y-2 border border-gray-800">
        {filtered.length === 0 ? (
          <div className="text-gray-600 text-center py-8">No logs yet. Commands will appear here.</div>
        ) : filtered.map(log => (
          <div key={log.id} className="border-b border-gray-900 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-600 text-xs">{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span className={`px-2 py-0.5 rounded text-xs font-bold ${typeBadge(log.type)}`}>{log.type.toUpperCase()}</span>
              <span className="text-gray-300 font-medium">$ {log.command}</span>
              <span className={`ml-auto text-xs font-bold ${statusColor(log.status)}`}>{log.status.toUpperCase()}</span>
            </div>
            {log.output && <pre className={`text-xs whitespace-pre-wrap pl-4 ${statusColor(log.status)}`}>{log.output}</pre>}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default LogPage;
