import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Clock,
  FolderOpen,
  Lock,
  Menu,
  Monitor,
  RotateCcw,
  Settings,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ChatPanel } from "../components/ChatPanel";
import { DeployWizard } from "../components/DeployWizard";
import { MatrixOverlay } from "../components/MatrixOverlay";
import { PreviewPanel } from "../components/PreviewPanel";
import type { AIProvider } from "../constants/models";
import { type AppLanguage, useAIChat } from "../hooks/useAIChat";
import { useSettings } from "../hooks/useBackend";
import type { ChatMessage } from "../hooks/useTermux";

const PROVIDER_DOT: Record<string, string> = {
  openrouter: "bg-violet-400",
  gemini: "bg-blue-400",
  groq: "bg-orange-400",
  github: "bg-green-400",
  auto: "bg-green-400",
};

const LANG_OPTIONS: { value: AppLanguage; label: string; color: string }[] = [
  { value: "auto", label: "Auto ✨", color: "text-primary" },
  { value: "html", label: "HTML/JS", color: "text-orange-400" },
  { value: "react", label: "React", color: "text-cyan-400" },
  { value: "react-tailwind", label: "React+TW", color: "text-violet-400" },
  { value: "typescript", label: "TypeScript", color: "text-blue-400" },
  { value: "python", label: "Python", color: "text-yellow-400" },
  { value: "sql", label: "SQL", color: "text-green-400" },
  { value: "markdown", label: "Markdown", color: "text-pink-400" },
  { value: "p5js", label: "p5.js", color: "text-rose-400" },
  { value: "threejs", label: "Three.js", color: "text-amber-400" },
  { value: "chartjs", label: "Chart.js", color: "text-teal-400" },
];

interface Snapshot {
  timestamp: number;
  messages: ChatMessage[];
}

function saveSnapshot(n: string, msgs: ChatMessage[]) {
  if (!msgs.length) return;
  const k = `bf_snapshots_${n}`;
  const ex: Snapshot[] = JSON.parse(localStorage.getItem(k) || "[]");
  localStorage.setItem(
    k,
    JSON.stringify(
      [{ timestamp: Date.now(), messages: msgs }, ...ex].slice(0, 10),
    ),
  );
}
function loadSnapshots(n: string): Snapshot[] {
  return JSON.parse(localStorage.getItem(`bf_snapshots_${n}`) || "[]");
}
function relTime(ts: number) {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  const h = Math.floor(m / 60);
  const dy = Math.floor(h / 24);
  return dy > 0
    ? `${dy}d ago`
    : h > 0
      ? `${h}h ago`
      : m > 0
        ? `${m}m ago`
        : "Just now";
}

function EditorSidebar({
  projectName,
  snapshots,
  onRestore,
  onClose,
}: {
  projectName: string;
  snapshots: Snapshot[];
  onRestore: (s: Snapshot) => void;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "oklch(0.10 0 0)" }}
    >
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
          <Zap className="w-4 h-4 text-primary" />
        </div>
        <span className="font-bold text-sm text-foreground flex-1">
          BrainForge
        </span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="px-4 py-3 border-b border-border">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
          Current Project
        </p>
        <p className="text-sm font-medium text-foreground truncate">
          {projectName}
        </p>
      </div>
      <nav className="px-3 py-3 space-y-1">
        <button
          type="button"
          onClick={() => {
            navigate({ to: "/projects" });
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all"
        >
          <FolderOpen className="w-4 h-4 text-blue-400" /> All Projects
        </button>
        <button
          type="button"
          onClick={() => {
            navigate({ to: "/settings" });
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all"
        >
          <Settings className="w-4 h-4 text-violet-400" /> Settings
        </button>
        <button
          type="button"
          onClick={() => {
            navigate({ to: "/settings" });
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all"
        >
          <Bot className="w-4 h-4 text-pink-400" /> Master AI
        </button>
        <button
          type="button"
          onClick={() => {
            navigate({ to: "/settings" });
            onClose();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-all"
        >
          <Lock className="w-4 h-4 text-yellow-400" /> PIN Lock
        </button>
      </nav>
      <div className="flex-1 flex flex-col min-h-0 border-t border-border">
        <div className="px-4 py-3 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-[11px] font-semibold text-foreground">
            Version History
          </span>
          {snapshots.length > 0 && (
            <span className="ml-auto text-[10px] text-muted-foreground">
              {snapshots.length} saved
            </span>
          )}
        </div>
        {snapshots.length === 0 ? (
          <p className="px-4 text-[11px] text-muted-foreground/50">
            No snapshots yet. Chat to create one.
          </p>
        ) : (
          <ScrollArea className="flex-1 px-3 pb-3">
            <div className="space-y-2">
              {snapshots.map((s, i) => (
                <div
                  key={s.timestamp}
                  className="p-3 rounded-lg border border-border bg-white/[0.03] hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-orange-400">
                      {relTime(s.timestamp)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {s.messages.length} msgs
                    </span>
                  </div>
                  <p className="text-[11px] truncate mb-2 text-foreground">
                    {s.messages
                      .filter((m) => m.role === "user")
                      .slice(-1)[0]
                      ?.content.slice(0, 50) || "Empty"}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] w-full gap-1"
                    onClick={() => {
                      onRestore(s);
                      onClose();
                    }}
                    data-ocid={`editor.history.restore.${i + 1}`}
                  >
                    <RotateCcw className="w-3 h-3" /> Restore
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
      <div className="px-4 py-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground/40">
          &copy; {new Date().getFullYear()} BrainForge
        </p>
      </div>
    </div>
  );
}

export function EditorPage() {
  const { projectName } = useParams({ from: "/editor/$projectName" });
  const navigate = useNavigate();
  const { data: settings } = useSettings();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(() =>
    loadSnapshots(projectName),
  );
  const [autoFixStatus, setAutoFixStatus] = useState<string | null>(null);
  const supabaseUrl = localStorage.getItem("bf_supabase_url") || "";
  const supabaseKey = localStorage.getItem("bf_supabase_key") || "";
  const hasSupabase = !!(supabaseUrl && supabaseKey);

  const [language, setLanguage] = useState<AppLanguage>(() => {
    return (
      (localStorage.getItem(`bf_lang_${projectName}`) as AppLanguage) || "auto"
    );
  });
  const autoFixCount = useRef(0);
  const prevLoadingRef = useRef(false);
  const errorCooldown = useRef(false);

  const s = settings as any;
  const provider: AIProvider =
    (s?.aiProvider === "deepseek" ? "auto" : s?.aiProvider) || "auto";
  const openRouterKey = s?.openRouterApiKey || "";
  const openRouterModel = s?.defaultModel || "qwen/qwen3-coder:free";
  const geminiKey = s?.geminiApiKey || "";
  const geminiModel = s?.geminiModel || "gemini-2.0-flash";
  const groqKey = s?.groqApiKey || "";
  const groqModel = s?.groqModel || "llama-3.3-70b-versatile";
  const githubModelsKey = s?.githubModelsKey || "";
  const githubModelsModel = s?.githubModelsModel || "gpt-4o";
  const hasAnyKey = !!(
    openRouterKey ||
    geminiKey ||
    groqKey ||
    githubModelsKey
  );
  const autoFix: boolean = s?.autoFix !== false;

  const [initialMessage] = useState(() => {
    const k = `bf_starter_${projectName}`;
    const v = localStorage.getItem(k) || "";
    if (v) localStorage.removeItem(k);
    return v;
  });

  const { messages, isLoading, error, sendMessage, clearMessages } = useAIChat({
    provider,
    language,
    openRouterKey,
    openRouterModel,
    geminiKey,
    geminiModel,
    groqKey,
    groqModel,
    githubModelsKey,
    githubModelsModel,
    projectName,
    supabaseUrl: hasSupabase ? supabaseUrl : undefined,
    supabaseKey: hasSupabase ? supabaseKey : undefined,
    onLanguageDetected: (lang) => {
      setLanguage(lang);
      localStorage.setItem(`bf_lang_${projectName}`, lang);
    },
  });

  const hasCode = messages.some(
    (m) => m.role === "assistant" && m.content.includes("```"),
  );

  const handleLangChange = (lang: AppLanguage) => {
    setLanguage(lang);
    localStorage.setItem(`bf_lang_${projectName}`, lang);
  };

  useEffect(() => {
    if (prevLoadingRef.current && !isLoading && messages.length > 0) {
      saveSnapshot(projectName, messages);
      setSnapshots(loadSnapshots(projectName));
      setAutoFixStatus(null);
    }
    prevLoadingRef.current = isLoading;
  }, [isLoading, messages, projectName]);

  useEffect(() => {
    if (!autoFix) return;
    const handler = (e: MessageEvent) => {
      if (
        e.data?.type !== "PREVIEW_ERROR" ||
        isLoading ||
        autoFixCount.current >= 3 ||
        errorCooldown.current
      )
        return;
      errorCooldown.current = true;
      setTimeout(() => {
        errorCooldown.current = false;
      }, 3000);
      autoFixCount.current += 1;
      setAutoFixStatus(`🔧 Auto-fixing (${autoFixCount.current}/3)...`);
      setPreviewOpen(false);
      sendMessage(
        `Fix this error: "${e.data.error}"\nReturn the COMPLETE corrected file. Auto-fix ${autoFixCount.current}/3.`,
      );
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [autoFix, isLoading, sendMessage]);

  const handleSend = (msg: string, img?: string) => {
    autoFixCount.current = 0;
    setAutoFixStatus(null);
    saveSnapshot(projectName, messages);
    sendMessage(msg, img);
  };
  const restoreSnapshot = (snap: Snapshot) => {
    localStorage.setItem(
      `bf_chat_${projectName}`,
      JSON.stringify(snap.messages),
    );
    window.location.reload();
  };

  const activeLang =
    LANG_OPTIONS.find((l) => l.value === language) ?? LANG_OPTIONS[0];

  return (
    <div
      className="flex flex-col"
      style={{ height: "100dvh" }}
      data-ocid="editor.page"
    >
      <MatrixOverlay visible={isLoading} />

      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 py-2 border-b border-border shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
          onClick={() => navigate({ to: "/projects" })}
          data-ocid="editor.back.button"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>

        <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">
          {projectName}
        </span>

        {autoFixStatus && (
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 shrink-0">
            {autoFixStatus.includes("⚠") ? (
              <AlertTriangle className="w-3 h-3" />
            ) : (
              <Wrench className="w-3 h-3 animate-spin" />
            )}
          </div>
        )}

        {/* Language selector */}
        <div className="relative shrink-0">
          <select
            value={language}
            onChange={(e) => handleLangChange(e.target.value as AppLanguage)}
            className={`appearance-none bg-muted/50 border border-border rounded-md px-2 py-1 text-[10px] font-mono cursor-pointer focus:outline-none focus:border-primary/50 ${activeLang.color}`}
            title="Select language"
          >
            {LANG_OPTIONS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <span
          className={`w-2 h-2 rounded-full shrink-0 ${hasAnyKey ? (PROVIDER_DOT[provider] ?? "bg-green-400") : "bg-muted-foreground/30"}`}
        />
        {hasSupabase && (
          <span
            className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0"
            title="Supabase configured"
          >
            DB
          </span>
        )}

        <Button
          variant="outline"
          size="sm"
          className={`h-7 px-2 text-xs shrink-0 transition-all ${hasCode ? "border-primary/50 text-primary bg-primary/5" : "border-border text-muted-foreground"}`}
          onClick={() => setPreviewOpen(true)}
          data-ocid="editor.preview.open_button"
        >
          <Monitor className="w-3.5 h-3.5" />
          <span className="ml-1 hidden sm:inline">
            {hasCode ? "Preview ✓" : "Preview"}
          </span>
        </Button>

        <button
          type="button"
          onClick={() => setSidebarOpen(true)}
          className="h-8 w-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 shrink-0 transition-colors"
          data-ocid="editor.menu.button"
          title="Menu & History"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <ChatPanel
          messages={messages as any}
          isLoading={isLoading}
          error={error}
          initialMessage={initialMessage}
          onSend={handleSend}
          onClear={clearMessages}
          apiKeyMissing={!hasAnyKey}
          hasCode={hasCode}
          onPreview={() => setPreviewOpen(true)}
          onHistory={() => setSidebarOpen(true)}
          autoFixStatus={autoFixStatus}
        />
      </div>

      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="right"
          className="p-0 w-[300px] border-border"
          style={{ zIndex: 100 }}
        >
          <EditorSidebar
            projectName={projectName}
            snapshots={snapshots}
            onRestore={restoreSnapshot}
            onClose={() => setSidebarOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {deployOpen && (
        <DeployWizard
          projectName={projectName}
          code={
            (
              messages
                .filter((m: any) => m.role === "assistant" && m.code)
                .slice(-1)[0] as any
            )?.code || ""
          }
          onClose={() => setDeployOpen(false)}
        />
      )}
      {previewOpen && (
        <div
          className="fixed inset-0 z-50 bg-background flex flex-col"
          style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
          data-ocid="editor.preview.overlay"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setPreviewOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium flex-1">
              Preview — {projectName}
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border border-border ${activeLang.color}`}
            >
              {activeLang.label}
            </span>
            <button
              type="button"
              onClick={() => setDeployOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white text-xs font-semibold shadow-lg transition-all"
            >
              🚀 Deploy
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <PreviewPanel
              messages={messages as any}
              termuxUrl=""
              projectName={projectName}
            />
          </div>
        </div>
      )}
    </div>
  );
}
