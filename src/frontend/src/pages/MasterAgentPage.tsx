import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

const WORKER_URL = "https://brainforge-api.richard-brown-miami.workers.dev";
const SECRET = "2200";

type TaskStatus = "pending" | "in_progress" | "done" | "failed";
type Priority = 3 | 5 | 8 | 10;

interface Task {
  id: number;
  instruction: string;
  added_by: string;
  status: TaskStatus;
  priority: Priority;
  result: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

const PRIORITY_LABELS: Record<number, { label: string; color: string; dot: string }> = {
  10: { label: "Critical", color: "text-red-400", dot: "bg-red-500" },
  8: { label: "High", color: "text-orange-400", dot: "bg-orange-400" },
  5: { label: "Normal", color: "text-blue-400", dot: "bg-blue-400" },
  3: { label: "Low", color: "text-zinc-400", dot: "bg-zinc-500" },
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  in_progress: "bg-blue-500/15 text-blue-400 border-blue-500/30 animate-pulse",
  done: "bg-green-500/15 text-green-400 border-green-500/30",
  failed: "bg-red-500/15 text-red-400 border-red-500/30",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  done: "Done",
  failed: "Failed",
};

function apiFetch(endpoint: string, options?: RequestInit) {
  return fetch(`${WORKER_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-BrainForge-Secret": SECRET,
      ...(options?.headers || {}),
    },
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function TaskCard({
  task,
  onUpdate,
  onDelete,
}: {
  task: Task;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [resultExpanded, setResultExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const pri = PRIORITY_LABELS[task.priority] || PRIORITY_LABELS[5];

  const markStatus = async (status: "done" | "failed") => {
    setLoading(true);
    await apiFetch(`/api/master/task/${task.id}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    setLoading(false);
    onUpdate();
  };

  const handleDelete = async () => {
    setLoading(true);
    await apiFetch(`/api/master/task/${task.id}`, { method: "DELETE" });
    setLoading(false);
    onDelete();
  };

  return (
    <div
      className="rounded-lg border p-3 space-y-2 transition-all"
      style={{
        background: "#12121a",
        borderColor:
          task.status === "in_progress"
            ? "rgba(124,58,237,0.4)"
            : "rgba(30,30,46,1)",
        boxShadow:
          task.status === "in_progress"
            ? "0 0 12px rgba(124,58,237,0.15)"
            : "none",
      }}
    >
      {/* Header row */}
      <div className="flex items-start gap-2">
        <span
          className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", pri.dot)}
        />
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm text-zinc-200 cursor-pointer leading-snug",
              !expanded && "line-clamp-2",
            )}
            onClick={() => setExpanded((v) => !v)}
            onKeyDown={(e) => e.key === "Enter" && setExpanded((v) => !v)}
          >
            {task.instruction}
          </p>
          {!expanded && task.instruction.length > 100 && (
            <button
              type="button"
              className="text-xs text-purple-400/70 hover:text-purple-300 mt-0.5"
              onClick={() => setExpanded(true)}
            >
              Show more
            </button>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border",
            STATUS_STYLES[task.status],
          )}
        >
          {STATUS_LABELS[task.status]}
        </span>
      </div>

      {/* Meta */}
      <div className="flex items-center gap-3 text-[10px] text-zinc-500">
        <span className={cn("font-medium", pri.color)}>
          {pri.label}
        </span>
        <span>by {task.added_by}</span>
        <span>{timeAgo(task.created_at)}</span>
      </div>

      {/* Result / Error */}
      {(task.result || task.error) && (
        <div
          className={cn(
            "rounded px-2 py-1.5 text-xs cursor-pointer",
            task.error
              ? "bg-red-500/10 border border-red-500/20 text-red-300"
              : "bg-green-500/10 border border-green-500/20 text-green-300",
          )}
          onClick={() => setResultExpanded((v) => !v)}
          onKeyDown={(e) =>
            e.key === "Enter" && setResultExpanded((v) => !v)
          }
        >
          <span className="font-medium">{task.error ? "Error: " : "Result: "}</span>
          <span
            className={cn(!resultExpanded && "line-clamp-1")}
          >
            {task.error || task.result}
          </span>
        </div>
      )}

      {/* Actions */}
      {(task.status === "pending" || task.status === "in_progress") && (
        <div className="flex gap-1.5 pt-1">
          <button
            type="button"
            disabled={loading}
            onClick={() => markStatus("done")}
            className="flex-1 py-1 rounded text-[10px] font-medium bg-green-600/20 hover:bg-green-600/40 text-green-400 border border-green-600/30 transition-colors disabled:opacity-40"
          >
            ✓ Done
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => markStatus("failed")}
            className="flex-1 py-1 rounded text-[10px] font-medium bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-600/30 transition-colors disabled:opacity-40"
          >
            ✕ Failed
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleDelete}
            className="px-2 py-1 rounded text-[10px] font-medium bg-zinc-700/30 hover:bg-zinc-700/60 text-zinc-400 border border-zinc-700/40 transition-colors disabled:opacity-40"
          >
            Del
          </button>
        </div>
      )}
      {(task.status === "done" || task.status === "failed") && (
        <div className="flex gap-1.5 pt-1">
          <button
            type="button"
            disabled={loading}
            onClick={handleDelete}
            className="px-2 py-1 rounded text-[10px] font-medium bg-zinc-700/30 hover:bg-zinc-700/60 text-zinc-400 border border-zinc-700/40 transition-colors disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default function MasterAgentPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [instruction, setInstruction] = useState("");
  const [priority, setPriority] = useState<Priority>(5);
  const [addedBy, setAddedBy] = useState("user");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const refreshRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTasks = async () => {
    try {
      const res = await apiFetch(`/api/master/tasks?limit=50`);
      if (res.ok) {
        const data: Task[] = await res.json();
        setTasks(data);
        setAgentOnline(true);
      } else {
        setAgentOnline(false);
      }
    } catch {
      setAgentOnline(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    refreshRef.current = setInterval(fetchTasks, 5000);
    return () => {
      if (refreshRef.current) clearInterval(refreshRef.current);
    };
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddTask = async () => {
    if (!instruction.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/master/task", {
        method: "POST",
        body: JSON.stringify({
          instruction: instruction.trim(),
          added_by: addedBy || "user",
          priority,
        }),
      });
      if (res.ok) {
        setInstruction("");
        showToast("✓ Task added to queue");
        fetchTasks();
      } else {
        showToast("✕ Failed to add task");
      }
    } catch {
      showToast("✕ Network error");
    }
    setSubmitting(false);
  };

  const clearDoneTasks = async () => {
    const doneTasks = tasks.filter((t) => t.status === "done");
    for (const t of doneTasks) {
      await apiFetch(`/api/master/task/${t.id}`, { method: "DELETE" });
    }
    showToast(`✓ Cleared ${doneTasks.length} done task(s)`);
    fetchTasks();
  };

  const filteredTasks =
    filter === "all" ? tasks : tasks.filter((t) => t.status === filter);

  const stats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    inProgress: tasks.filter((t) => t.status === "in_progress").length,
    doneToday: tasks.filter((t) => {
      if (t.status !== "done") return false;
      const updated = new Date(t.updated_at).getTime();
      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      return updated >= dayStart.getTime();
    }).length,
  };

  const recentDone = tasks
    .filter((t) => t.status === "done" || t.status === "failed")
    .sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .slice(0, 5);

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: "#0a0a0f" }}
    >
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium text-white shadow-xl"
          style={{ background: "rgba(124,58,237,0.9)", backdropFilter: "blur(8px)" }}
        >
          {toast}
        </div>
      )}

      {/* Header */}
      <div
        className="shrink-0 px-6 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "#1e1e2e", background: "#0d0d16" }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "w-2.5 h-2.5 rounded-full",
                agentOnline === true
                  ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]"
                  : agentOnline === false
                    ? "bg-zinc-600"
                    : "bg-yellow-400 animate-pulse",
              )}
            />
          </div>
          <div>
            <h1
              className="text-lg font-bold"
              style={{
                background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Master Agent
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {agentOnline === true
                ? "Connected · auto-refresh every 5s"
                : agentOnline === false
                  ? "Worker offline"
                  : "Connecting..."}
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="hidden md:flex items-center gap-4">
          {[
            { label: "Total", value: stats.total, color: "text-zinc-300" },
            { label: "Pending", value: stats.pending, color: "text-yellow-400" },
            { label: "In Progress", value: stats.inProgress, color: "text-blue-400" },
            { label: "Done Today", value: stats.doneToday, color: "text-green-400" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <div className={cn("text-lg font-bold leading-none", s.color)}>
                {s.value}
              </div>
              <div className="text-[9px] text-zinc-600 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4 md:p-6">
        {/* Mobile stats */}
        <div className="md:hidden flex gap-3 mb-4">
          {[
            { label: "Total", value: stats.total, color: "text-zinc-300" },
            { label: "Pending", value: stats.pending, color: "text-yellow-400" },
            { label: "Active", value: stats.inProgress, color: "text-blue-400" },
            { label: "Done", value: stats.doneToday, color: "text-green-400" },
          ].map((s) => (
            <div
              key={s.label}
              className="flex-1 rounded-lg p-2 text-center border"
              style={{ background: "#12121a", borderColor: "#1e1e2e" }}
            >
              <div className={cn("text-base font-bold", s.color)}>{s.value}</div>
              <div className="text-[9px] text-zinc-600">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
          {/* LEFT: Add Task */}
          <div
            className="rounded-xl border p-4 space-y-4 h-fit"
            style={{ background: "#12121a", borderColor: "#1e1e2e" }}
          >
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-purple-500 inline-block" />
              Add Task
            </h2>

            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="Tell the agent what to do..."
              rows={4}
              className="w-full rounded-lg px-3 py-2.5 text-sm text-zinc-200 resize-none focus:outline-none transition-colors"
              style={{
                background: "#0a0a0f",
                border: "1px solid #1e1e2e",
                lineHeight: "1.6",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "rgba(124,58,237,0.5)")
              }
              onBlur={(e) => (e.target.style.borderColor = "#1e1e2e")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) handleAddTask();
              }}
            />
            <div className="text-[10px] text-zinc-600 -mt-2 text-right">
              Ctrl+Enter to submit · {instruction.length} chars
            </div>

            {/* Priority selector */}
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">Priority</p>
              <div className="flex gap-2 flex-wrap">
                {([3, 5, 8, 10] as Priority[]).map((p) => {
                  const meta = PRIORITY_LABELS[p];
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium border transition-all",
                        priority === p
                          ? "border-purple-500/60 bg-purple-500/20 text-purple-300"
                          : "border-zinc-700/50 bg-zinc-800/40 text-zinc-500 hover:border-zinc-600",
                      )}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Added by */}
            <div className="space-y-1.5">
              <p className="text-xs text-zinc-500">Added by</p>
              <input
                type="text"
                value={addedBy}
                onChange={(e) => setAddedBy(e.target.value)}
                placeholder="user"
                className="w-full rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none transition-colors"
                style={{ background: "#0a0a0f", border: "1px solid #1e1e2e" }}
                onFocus={(e) =>
                  (e.target.style.borderColor = "rgba(124,58,237,0.5)")
                }
                onBlur={(e) => (e.target.style.borderColor = "#1e1e2e")}
              />
            </div>

            <button
              type="button"
              disabled={submitting || !instruction.trim()}
              onClick={handleAddTask}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
              style={{
                background:
                  submitting || !instruction.trim()
                    ? "#1e1e2e"
                    : "linear-gradient(135deg, #7c3aed, #6d28d9)",
                color: "white",
                boxShadow:
                  submitting || !instruction.trim()
                    ? "none"
                    : "0 0 20px rgba(124,58,237,0.3)",
              }}
            >
              {submitting ? "Adding..." : "Add Task"}
            </button>
          </div>

          {/* RIGHT: Task Queue */}
          <div
            className="rounded-xl border p-4 space-y-3"
            style={{ background: "#12121a", borderColor: "#1e1e2e" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <span className="w-1 h-4 rounded-full bg-blue-500 inline-block" />
                Task Queue
              </h2>
              <button
                type="button"
                onClick={() => { setLoading(true); fetchTasks().finally(() => setLoading(false)); }}
                className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {loading ? "Refreshing..." : "↻ Refresh"}
              </button>
            </div>

            {/* Filter pills */}
            <div className="flex gap-1.5 flex-wrap">
              {(["all", "pending", "in_progress", "done", "failed"] as const).map(
                (s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFilter(s)}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-medium border transition-all",
                      filter === s
                        ? "border-purple-500/60 bg-purple-500/20 text-purple-300"
                        : "border-zinc-700/40 bg-zinc-800/20 text-zinc-500 hover:border-zinc-600",
                    )}
                  >
                    {s === "all"
                      ? "All"
                      : s === "in_progress"
                        ? "In Progress"
                        : s.charAt(0).toUpperCase() + s.slice(1)}
                    {s === "all" && ` (${tasks.length})`}
                    {s !== "all" &&
                      ` (${tasks.filter((t) => t.status === s).length})`}
                  </button>
                ),
              )}
            </div>

            {/* Task list */}
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 scrollbar-thin">
              {filteredTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="text-3xl mb-3 opacity-30">📭</div>
                  <p className="text-sm text-zinc-600">No tasks in queue</p>
                  <p className="text-xs text-zinc-700 mt-1">
                    Add a task on the left to get started
                  </p>
                </div>
              ) : (
                filteredTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onUpdate={fetchTasks}
                    onDelete={fetchTasks}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bottom: Agent Activity */}
        <div
          className="rounded-xl border p-4 mt-4 space-y-3"
          style={{ background: "#12121a", borderColor: "#1e1e2e" }}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-green-500 inline-block" />
              Agent Activity
              <span className="text-[10px] text-zinc-600 font-normal">
                (last 5 completed)
              </span>
            </h2>
            {recentDone.length > 0 && (
              <button
                type="button"
                onClick={clearDoneTasks}
                className="text-[10px] text-red-400/70 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 px-2 py-0.5 rounded transition-colors"
              >
                Clear Done Tasks
              </button>
            )}
          </div>

          {recentDone.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-zinc-700">No completed tasks yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDone.map((task) => (
                <ActivityRow key={task.id} task={task} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityRow({ task }: { task: Task }) {
  const [expanded, setExpanded] = useState(false);
  const statusIcon = task.status === "done" ? "✓" : "✕";
  const statusColor =
    task.status === "done" ? "text-green-400" : "text-red-400";

  return (
    <div
      className="rounded-lg border px-3 py-2 space-y-1"
      style={{ background: "#0a0a0f", borderColor: "#1e1e2e" }}
    >
      <div className="flex items-start gap-2">
        <span className={cn("text-xs font-bold shrink-0 mt-0.5", statusColor)}>
          {statusIcon}
        </span>
        <p className="text-xs text-zinc-300 flex-1 leading-snug">
          {task.instruction}
        </p>
        <span className="text-[10px] text-zinc-600 shrink-0">
          {timeAgo(task.updated_at)}
        </span>
      </div>
      {(task.result || task.error) && (
        <div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-purple-400/60 hover:text-purple-400 transition-colors"
          >
            {expanded ? "▲ Hide result" : "▼ Show result"}
          </button>
          {expanded && (
            <p
              className={cn(
                "text-xs mt-1 rounded px-2 py-1",
                task.error
                  ? "text-red-300 bg-red-500/10"
                  : "text-green-300 bg-green-500/10",
              )}
            >
              {task.error || task.result}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
