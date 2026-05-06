import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clipboard,
  FilePen,
  FileText,
  Github,
  Globe,
  Play,
  Rocket,
  Search,
  Square,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const WORKER_BASE = "https://brainforge-api.richard-brown-miami.workers.dev";
const SECRET_HEADER = {
  "X-BrainForge-Secret": "2200",
  "Content-Type": "application/json",
};

const MAX_TASK_CHARS = 500;

type AgentState = "idle" | "running" | "waiting-approval" | "error";

interface LogEntry {
  id: string;
  timestamp: string;
  type: "Think" | "Act" | "Observe" | "Error" | "Info";
  message: string;
  toolName?: string;
}

interface HistoryRun {
  id: string;
  task: string;
  timestamp: string;
  result: "completed" | "failed" | "stopped";
  logs?: LogEntry[];
}

interface AgentStatus {
  state: AgentState;
  pendingAction?: string;
  history?: HistoryRun[];
  totalRuns?: number;
  successRate?: number;
  lastRunTime?: string;
  modelUsed?: string;
}

interface AgentStats {
  total_runs?: number;
  successful_runs?: number;
  failed_runs?: number;
  total_cost_usd?: number;
  last_run_at?: string;
}

interface MemorySummary {
  id: string;
  summary: string;
  created_at?: string;
  timestamp?: string;
}

interface ErrorLogEntry {
  id: string;
  error_type?: string;
  errorMsg?: string;
  timestamp: string;
}

const TOOLS = [
  { id: "readProjectFile", label: "readProjectFile", desc: "Read file content from project", icon: FileText },
  { id: "writeProjectFile", label: "writeProjectFile", desc: "Edit or create project files", icon: FilePen },
  { id: "webSearch", label: "webSearch", desc: "Search the internet for info", icon: Search },
  { id: "fetchURL", label: "fetchURL", desc: "Fetch any URL content", icon: Globe },
  { id: "pushToGitHub", label: "pushToGitHub", desc: "Commit and push to GitHub", icon: Github },
  { id: "deployToPages", label: "deployToPages", desc: "Deploy to Cloudflare Pages", icon: Rocket },
  { id: "runPreview", label: "runPreview", desc: "Run code in sandbox preview", icon: Play },
] as const;

const TASK_TEMPLATES = [
  { label: "Fix all errors", prompt: "Scan all project files, identify all errors, bugs, and broken code, then fix them one by one. Log each fix." },
  { label: "Push to GitHub", prompt: "Read all modified project files, create a meaningful commit message, and push the changes to GitHub." },
  { label: "Deploy to Cloudflare", prompt: "Deploy the current project to Cloudflare Pages. Check for any build errors before deploying." },
  { label: "Summarize project", prompt: "Read all project files and write a concise summary of what this project does, its architecture, and current status." },
];

function getToolIcon(type: LogEntry["type"], toolName?: string): string {
  if (toolName) {
    if (toolName.toLowerCase().includes("search")) return "🔍";
    if (toolName.toLowerCase().includes("write")) return "📝";
    if (toolName.toLowerCase().includes("read")) return "📖";
    if (toolName.toLowerCase().includes("deploy")) return "🚀";
    if (toolName.toLowerCase().includes("github")) return "🐙";
    if (toolName.toLowerCase().includes("fetch")) return "🌐";
    if (toolName.toLowerCase().includes("preview")) return "👁️";
  }
  const map: Record<LogEntry["type"], string> = {
    Think: "💭",
    Act: "⚡",
    Observe: "👀",
    Error: "❌",
    Info: "ℹ️",
  };
  return map[type] || "•";
}

function stateBadge(state: AgentState) {
  const map = {
    idle: { label: "Idle", cls: "bg-muted text-muted-foreground border-border" },
    running: { label: "Running", cls: "bg-green-950/60 text-green-400 border-green-700/50 animate-pulse" },
    "waiting-approval": { label: "Waiting Approval", cls: "bg-amber-950/60 text-amber-400 border-amber-700/50" },
    error: { label: "Error", cls: "bg-red-950/60 text-red-400 border-red-700/50" },
  };
  const { label, cls } = map[state];
  return (
    <Badge variant="outline" className={`text-xs font-medium px-2.5 py-0.5 border ${cls}`}>
      {state === "running" && (
        <span className="mr-1.5 inline-block w-1.5 h-1.5 rounded-full bg-green-400" />
      )}
      {label}
    </Badge>
  );
}

function logTypeBadge(type: LogEntry["type"]) {
  const map = {
    Think: "bg-blue-950/60 text-blue-300 border-blue-700/40",
    Act: "bg-amber-950/60 text-amber-300 border-amber-700/40",
    Observe: "bg-green-950/60 text-green-300 border-green-700/40",
    Error: "bg-red-950/60 text-red-300 border-red-700/40",
    Info: "bg-muted text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={`text-[10px] font-mono px-1.5 py-0 border ${map[type]}`}>
      {type}
    </Badge>
  );
}

function historyResultBadge(result: HistoryRun["result"]) {
  const map = {
    completed: { cls: "bg-green-950/60 text-green-400 border-green-700/40", icon: CheckCircle2 },
    failed: { cls: "bg-red-950/60 text-red-400 border-red-700/40", icon: XCircle },
    stopped: { cls: "bg-muted text-muted-foreground border-border", icon: Square },
  };
  const { cls, icon: Icon } = map[result];
  return (
    <Badge variant="outline" className={`text-[10px] capitalize font-medium px-1.5 border ${cls} flex items-center gap-1`}>
      <Icon className="w-2.5 h-2.5" />
      {result}
    </Badge>
  );
}

export default function AgentPage() {
  const [task, setTask] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<AgentStatus>({ state: "idle" });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toolStatuses, setToolStatuses] = useState<Record<string, "ready" | "in-use" | "done">>({});
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const [toolsOpen, setToolsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [memorySummaries, setMemorySummaries] = useState<MemorySummary[]>([]);
  const [errorLog, setErrorLog] = useState<ErrorLogEntry[]>([]);
  const [errorLogOpen, setErrorLogOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  });

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${WORKER_BASE}/api/stats`, { headers: SECRET_HEADER });
      if (!res.ok) return;
      const data: AgentStats = await res.json();
      setStats(data);
    } catch { /* silent */ }
  }, []);

  const fetchMemorySummaries = useCallback(async () => {
    try {
      const res = await fetch(`${WORKER_BASE}/api/memory-summaries?limit=5`, { headers: SECRET_HEADER });
      if (!res.ok) return;
      const data = await res.json();
      setMemorySummaries(Array.isArray(data) ? data : (data.summaries || []));
    } catch { /* silent */ }
  }, []);

  const fetchErrorLog = useCallback(async () => {
    try {
      const res = await fetch(`${WORKER_BASE}/api/error-log?limit=10`, { headers: SECRET_HEADER });
      if (!res.ok) return;
      const data = await res.json();
      setErrorLog(Array.isArray(data) ? data : (data.errors || []));
    } catch { /* silent */ }
  }, []);

  const closeSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
  }, []);

  const startSSE = useCallback((sid: string) => {
    closeSSE();
    const es = new EventSource(`${WORKER_BASE}/api/stream?sessionId=${sid}`);
    sseRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "status") {
          const newState: AgentState =
            data.status === "running" ? "running"
            : (data.status === "waiting_approval" || data.status === "waiting-approval") ? "waiting-approval"
            : data.status === "failed" ? "error"
            : "idle";
          setStatus((s) => ({
            ...s,
            state: newState,
            pendingAction: data.approvalPendingToolName
              ? `${data.approvalPendingToolName}: ${data.approvalPendingArgs || ""}`
              : s.pendingAction,
            modelUsed: data.model || s.modelUsed,
          }));
          const terminal = ["completed", "failed", "stopped"];
          if (terminal.includes(data.status)) {
            closeSSE();
            setStatus((s) => ({ ...s, state: data.status === "failed" ? "error" : "idle" }));
            fetchStats();
            fetchMemorySummaries();
          }
        }

        if (data.type === "activity" && data.entries) {
          setLogs((prev) => {
            const newEntries: LogEntry[] = data.entries.map((e: any) => ({
              id: String(e.id),
              timestamp: e.timestamp,
              type: e.toolName ? (e.status === "error" ? "Error" : "Act") : "Think",
              message: e.toolName
                ? `${e.toolName}: ${(e.toolOutput || e.toolInput || "").slice(0, 200)}`
                : (e.toolInput || ""),
              toolName: e.toolName,
            }));
            setToolStatuses((ts) => {
              const updated = { ...ts };
              for (const e of newEntries) {
                if (e.toolName) updated[e.toolName] = "done";
              }
              return updated;
            });
            return [...prev, ...newEntries];
          });
        }

        if (data.type === "done") {
          closeSSE();
          setStatus((s) => ({ ...s, state: data.status === "failed" ? "error" : "idle" }));
          fetchStats();
          fetchMemorySummaries();
        }

        if (data.type === "error") {
          closeSSE();
          setStatus((s) => ({ ...s, state: "error" }));
          toast.error(`Agent error: ${data.message}`);
        }
      } catch { /* parse error, ignore */ }
    };

    es.onerror = () => {
      closeSSE();
      setStatus((s) => s.state === "running" ? { ...s, state: "idle" } : s);
    };
  }, [closeSSE, fetchStats, fetchMemorySummaries]);

  useEffect(() => {
    fetchStats();
    fetchMemorySummaries();
    return () => closeSSE();
  }, [fetchStats, fetchMemorySummaries, closeSSE]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setStatus((s) => {
          if (s.state === "running") {
            handleStop();
          }
          return s;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleStart = async () => {
    if (!task.trim()) { toast.error("Enter a task first"); return; }
    setIsLoading(true);
    setLogs([]);
    setToolStatuses({});
    try {
      const stored = JSON.parse(localStorage.getItem("bf_settings") || "{}");
      const openRouterApiKey = stored?.openRouterApiKey || "";
      const defaultModel = stored?.defaultModel || "";
      const res = await fetch(`${WORKER_BASE}/api/run`, {
        method: "POST",
        headers: SECRET_HEADER,
        body: JSON.stringify({ task, openRouterApiKey, defaultModel }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const sid = data.sessionId;
      if (!sid) throw new Error("No sessionId returned");
      setSessionId(sid);
      toast.success("Agent started");
      setStatus((s) => ({ ...s, state: "running" }));
      startSSE(sid);
    } catch (e) {
      toast.error(`Failed to start: ${e instanceof Error ? e.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    try {
      const body: any = {};
      if (sessionId) body.sessionId = sessionId;
      await fetch(`${WORKER_BASE}/api/stop`, {
        method: "POST",
        headers: SECRET_HEADER,
        body: JSON.stringify(body),
      });
      toast.info("Agent stopped");
      closeSSE();
      setStatus((s) => ({ ...s, state: "idle" }));
    } catch {
      toast.error("Failed to stop agent");
    }
  };

  const handleApprove = async (approved: boolean) => {
    try {
      const body: any = { approved };
      if (sessionId) body.sessionId = sessionId;
      const res = await fetch(`${WORKER_BASE}/api/approve`, {
        method: "POST",
        headers: SECRET_HEADER,
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast.success(approved ? "Action approved" : "Action rejected");
      setStatus((s) => ({ ...s, state: "running", pendingAction: undefined }));
      if (sessionId) startSSE(sessionId);
    } catch {
      toast.error("Failed to submit approval");
    }
  };

  const handleCopyLog = () => {
    const text = logs
      .map((l) => `[${new Date(l.timestamp).toLocaleTimeString()}] [${l.type}] ${l.message}`)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => toast.success("Log copied"));
  };

  const toggleRun = (id: string) => {
    setExpandedRuns((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const history = status.history ?? [];
  const isRunning = status.state === "running";
  const isIdle = status.state === "idle";
  const isWaiting = status.state === "waiting-approval";
  const totalRuns = stats?.total_runs ?? (status.totalRuns ?? history.length);
  const successRate = stats != null && stats.total_runs
    ? Math.round(((stats.successful_runs || 0) / stats.total_runs) * 100)
    : status.successRate != null ? status.successRate
    : history.length > 0
      ? Math.round((history.filter((h) => h.result === "completed").length / history.length) * 100)
      : 0;
  const totalCost = stats?.total_cost_usd ?? 0;
  const lastRunTime = stats?.last_run_at ?? (status.lastRunTime ?? history[0]?.timestamp);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-6 py-4" style={{ background: "#12121a" }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-lg font-bold text-foreground tracking-tight">Agent Control Panel</h1>
              {status.modelUsed && (
                <span className="text-[10px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded-full border border-border">
                  {status.modelUsed}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground ml-10.5">
              Give the AI a task — watch it think, act, and execute
            </p>
          </div>
          <div className="flex items-center gap-2 pt-0.5">{stateBadge(status.state)}</div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-0">
        {/* Main column */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 min-w-0">
          {/* Task Templates */}
          <div className="flex flex-wrap gap-2">
            {TASK_TEMPLATES.map((t) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setTask(t.prompt)}
                disabled={isRunning}
                className="text-[11px] px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-40"
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Task Input */}
          <Card className="border-border shadow-none" style={{ background: "#12121a" }}>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-foreground">New Task</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <Textarea
                data-ocid="agent.task_input"
                value={task}
                onChange={(e) => setTask(e.target.value.slice(0, MAX_TASK_CHARS))}
                onKeyDown={(e) => {
                  if (e.ctrlKey && e.key === "Enter" && !isRunning && task.trim()) {
                    e.preventDefault();
                    handleStart();
                  }
                }}
                placeholder="Describe what you want the agent to do..."
                rows={4}
                disabled={isRunning}
                className="resize-none bg-muted/50 border-input text-sm text-foreground placeholder:text-muted-foreground focus-visible:ring-primary/40 disabled:opacity-50"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    data-ocid="agent.start_button"
                    size="sm"
                    onClick={handleStart}
                    disabled={isRunning || isLoading || !task.trim()}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  >
                    <Play className="w-3.5 h-3.5 mr-1.5" />
                    Start Agent
                  </Button>
                  <Button
                    data-ocid="agent.stop_button"
                    size="sm"
                    variant="outline"
                    onClick={handleStop}
                    disabled={isIdle}
                    className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
                  >
                    <Square className="w-3.5 h-3.5 mr-1.5" />
                    Stop
                  </Button>
                </div>
                <span className={`text-[10px] tabular-nums ${task.length >= MAX_TASK_CHARS ? "text-destructive" : "text-muted-foreground"}`}>
                  {task.length}/{MAX_TASK_CHARS}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/50">Ctrl+Enter to run • Escape to stop</p>
            </CardContent>
          </Card>

          {/* Approval Gate */}
          {isWaiting && (
            <Card data-ocid="agent.approval_dialog" className="border-amber-700/50 shadow-none" style={{ background: "rgba(120,80,0,0.12)" }}>
              <CardContent className="px-4 py-4 space-y-3">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-amber-300 mb-1">Agent is waiting for your approval</p>
                    {status.pendingAction && (
                      <p className="text-xs text-amber-200/70 font-mono bg-amber-950/40 rounded px-2 py-1.5 border border-amber-800/40">
                        {status.pendingAction}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button data-ocid="agent.confirm_button" size="sm" onClick={() => handleApprove(true)} className="bg-green-700 hover:bg-green-600 text-white font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Approve ✓
                  </Button>
                  <Button data-ocid="agent.cancel_button" size="sm" variant="outline" onClick={() => handleApprove(false)} className="border-red-700/50 text-red-400 hover:bg-red-950/30 hover:text-red-300">
                    <XCircle className="w-3.5 h-3.5 mr-1.5" />
                    Reject ✗
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Live Steps Feed */}
          <Card className="border-border shadow-none" style={{ background: "#12121a" }}>
            <CardHeader className="pb-2 pt-4 px-4 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-foreground">Live Steps Feed</CardTitle>
              <div className="flex items-center gap-2">
                {isRunning && (
                  <span className="text-[10px] text-green-400 font-mono animate-pulse">● LIVE</span>
                )}
                {logs.length > 0 && (
                  <button
                    type="button"
                    onClick={handleCopyLog}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border bg-muted/30 hover:bg-muted/60"
                  >
                    <Clipboard className="w-3 h-3" />
                    Copy Log
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ScrollArea className="h-64" data-ocid="agent.steps_panel">
                <div ref={scrollRef} className="space-y-1.5 pr-2">
                  {logs.length === 0 ? (
                    <div data-ocid="agent.steps.empty_state" className="h-48 flex flex-col items-center justify-center text-center gap-2">
                      <Bot className="w-8 h-8 text-muted-foreground/40" />
                      <p className="text-xs text-muted-foreground">No activity yet — start an agent task to see live steps</p>
                    </div>
                  ) : (
                    logs.map((entry, i) => (
                      <div key={entry.id ?? i} data-ocid={`agent.log.item.${i + 1}`} className="flex items-start gap-2.5 py-1.5 border-b border-border/40 last:border-0">
                        <span className="text-[10px] text-muted-foreground font-mono mt-0.5 whitespace-nowrap flex-shrink-0">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="text-sm flex-shrink-0 mt-0.5 leading-none">{getToolIcon(entry.type, entry.toolName)}</span>
                        <div className="flex-shrink-0 mt-0.5">{logTypeBadge(entry.type)}</div>
                        <p className="text-xs text-foreground/80 leading-relaxed break-words min-w-0">{entry.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Session Memory */}
          {memorySummaries.length > 0 && (
            <Card className="border-border shadow-none" style={{ background: "#12121a" }}>
              <button
                type="button"
                onClick={() => setMemoryOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors rounded-xl"
              >
                <CardTitle className="text-sm font-semibold text-foreground">Session Memory</CardTitle>
                {memoryOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
              {memoryOpen && (
                <CardContent className="px-4 pb-4 space-y-2">
                  {memorySummaries.map((m, i) => (
                    <div key={m.id ?? i} className="rounded-lg border border-border bg-muted/20 p-3 space-y-1">
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {(m.created_at || m.timestamp) ? new Date(m.created_at || m.timestamp || "").toLocaleString() : "—"}
                      </p>
                      <p className="text-xs text-foreground/70 leading-relaxed line-clamp-2">{m.summary}</p>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* Agent History */}
          <Card className="border-border shadow-none" style={{ background: "#12121a" }}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm font-semibold text-foreground">Recent Runs</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2" data-ocid="agent.history.list">
              {history.length === 0 ? (
                <p data-ocid="agent.history.empty_state" className="text-xs text-muted-foreground py-4 text-center">No runs yet</p>
              ) : (
                history.slice(0, 10).map((run, i) => (
                  <div key={run.id ?? i} data-ocid={`agent.history.item.${i + 1}`} className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                    <button type="button" onClick={() => toggleRun(run.id)} className="w-full flex items-center justify-between gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left">
                      <div className="flex items-center gap-2 min-w-0">
                        {historyResultBadge(run.result)}
                        <span className="text-xs text-foreground/80 truncate">{run.task}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-[10px] text-muted-foreground">{new Date(run.timestamp).toLocaleDateString()}</span>
                        {expandedRuns.has(run.id) ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                      </div>
                    </button>
                    {expandedRuns.has(run.id) && run.logs && run.logs.length > 0 && (
                      <div className="border-t border-border px-3 py-2 space-y-1">
                        {run.logs.map((l, li) => (
                          <div key={`${run.id}-log-${li}`} className="flex items-start gap-2 text-[11px]">
                            {logTypeBadge(l.type)}
                            <span className="text-foreground/60 break-words">{l.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Stats Bar */}
          <div data-ocid="agent.stats_panel" className="grid grid-cols-4 gap-3">
            {[
              { label: "Total Runs", value: String(totalRuns) },
              { label: "Success Rate", value: `${successRate}%` },
              { label: "Total Cost", value: `$${totalCost.toFixed(4)}` },
              { label: "Last Run", value: lastRunTime ? new Date(lastRunTime).toLocaleDateString() : "—" },
            ].map(({ label, value }) => (
              <Card key={label} className="border-border shadow-none" style={{ background: "#12121a" }}>
                <CardContent className="px-4 py-3 text-center">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
                  <p className="text-base font-bold text-foreground">{value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Recent Errors Collapsible */}
          <Card className="border-border shadow-none overflow-hidden" style={{ background: "#12121a" }}>
            <button
              type="button"
              onClick={() => { setErrorLogOpen((v) => !v); if (!errorLogOpen) fetchErrorLog(); }}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
            >
              <span className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                Recent Errors
              </span>
              {errorLogOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {errorLogOpen && (
              <CardContent className="px-4 pb-4 space-y-2">
                {errorLog.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No errors logged</p>
                ) : (
                  errorLog.map((err, i) => (
                    <div key={err.id ?? i} className={`rounded-lg border px-3 py-2 space-y-0.5 ${err.error_type === "feedback" ? "border-blue-700/40 bg-blue-950/20" : "border-red-700/40 bg-red-950/20"}`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono font-medium ${err.error_type === "feedback" ? "text-blue-400" : "text-red-400"}`}>{err.error_type || "error"}</span>
                        <span className="text-[10px] text-muted-foreground">{new Date(err.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-foreground/70 break-words">{err.errorMsg}</p>
                    </div>
                  ))
                )}
              </CardContent>
            )}
          </Card>
        </div>

        {/* Tools Panel */}
        <div className="md:w-64 md:flex-shrink-0 md:border-l md:border-border" style={{ background: "#12121a" }}>
          <button
            type="button"
            data-ocid="agent.tools.toggle"
            onClick={() => setToolsOpen((v) => !v)}
            className="md:hidden w-full flex items-center justify-between px-5 py-3 border-t border-b border-border text-sm font-semibold text-foreground"
            style={{ background: "#12121a" }}
          >
            <span>Available Tools</span>
            {toolsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <div className={`${toolsOpen ? "block" : "hidden"} md:block h-full overflow-y-auto px-4 py-4`}>
            <p className="hidden md:block text-sm font-semibold text-foreground mb-3">Available Tools</p>
            <Separator className="hidden md:block mb-4" />
            <div className="space-y-2">
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                const tStatus = toolStatuses[tool.id] ?? "ready";
                const statusMap = {
                  ready: "bg-muted text-muted-foreground border-border",
                  "in-use": "bg-amber-950/50 text-amber-400 border-amber-700/40",
                  done: "bg-green-950/50 text-green-400 border-green-700/40",
                };
                return (
                  <div key={tool.id} data-ocid={`agent.tool.${tool.id}`} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30 border border-border hover:bg-muted/50 transition-colors">
                    <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Icon className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-[11px] font-mono font-medium text-foreground truncate">{tool.label}</span>
                        <Badge variant="outline" className={`text-[9px] px-1 py-0 flex-shrink-0 border ${statusMap[tStatus]}`}>{tStatus}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-tight">{tool.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
