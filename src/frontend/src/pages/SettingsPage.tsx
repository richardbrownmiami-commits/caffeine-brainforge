import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "@tanstack/react-router";
import {
  Brain,
  CheckCircle2,
  ChevronLeft,
  Database,
  Github,
  Key,
  Lock,
  Save,
  Server,
  Settings,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  useClearCustomPrompt,
  useCustomPrompt,
  useSaveCustomPrompt,
  useSaveSettings,
  useSettings,
} from "../hooks/useBackend";

const WORKER_BASE = "https://brainforge-api.richard-brown-miami.workers.dev";
const SECRET_HEADER = {
  "X-BrainForge-Secret": "2200",
  "Content-Type": "application/json",
};

type Page = null | "api" | "ai" | "termux" | "github" | "pinlock" | "securekeys";

const HUB_BUTTONS = [
  {
    id: "api" as Page,
    label: "API Keys",
    icon: Key,
    color: "from-violet-500/20 to-purple-500/20 border-violet-500/30 text-violet-300",
    desc: "OpenRouter, Gemini, Groq, GitHub, Supabase",
  },
  {
    id: "ai" as Page,
    label: "AI Settings",
    icon: Brain,
    color: "from-cyan-500/20 to-blue-500/20 border-cyan-500/30 text-cyan-300",
    desc: "Model, temperature, auto-fix, search",
  },
  {
    id: "termux" as Page,
    label: "Termux",
    icon: Terminal,
    color: "from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-300",
    desc: "Termux server URL for local execution",
  },
  {
    id: "github" as Page,
    label: "GitHub & Deploy",
    icon: Github,
    color: "from-orange-500/20 to-amber-500/20 border-orange-500/30 text-orange-300",
    desc: "Token, repo, Cloudflare deploy",
  },
  {
    id: "pinlock" as Page,
    label: "PIN Lock",
    icon: Lock,
    color: "from-yellow-500/20 to-amber-500/20 border-yellow-500/30 text-yellow-300",
    desc: "App PIN protection & session timeout",
  },
  {
    id: "securekeys" as Page,
    label: "Secure Keys",
    icon: Server,
    color: "from-pink-500/20 to-rose-500/20 border-pink-500/30 text-pink-300",
    desc: "Keys stored securely in Worker D1",
  },
];

function SubPageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-4 py-4 border-b border-border shrink-0">
      <button
        type="button"
        onClick={onBack}
        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
      {children}
    </div>
  );
}

function SecureKeyField({ label, keyName }: { label: string; keyName: string }) {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`${WORKER_BASE}/api/config`, {
        method: "POST",
        headers: SECRET_HEADER,
        body: JSON.stringify({ key: keyName, value: value.trim() }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      setValue("");
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // silent fallback
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={`Enter ${label}...`}
        type="password"
        className="h-8 text-xs flex-1"
      />
      <Button
        size="sm"
        onClick={handleSave}
        disabled={saving || !value.trim()}
        className="h-8 text-xs shrink-0"
      >
        {saved ? (
          <>
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-green-400" />
            Saved ✓
          </>
        ) : saving ? (
          "..."
        ) : (
          <>
            <Save className="w-3 h-3 mr-1" />
            Save
          </>
        )}
      </Button>
    </div>
  );
}

function SecureKeysPage({ onBack }: { onBack: () => void }) {
  const [migrating, setMigrating] = useState(false);
  const [migrated, setMigrated] = useState(false);

  const handleMigrateFromLocalStorage = async () => {
    setMigrating(true);
    try {
      const stored = JSON.parse(localStorage.getItem("bf_settings") || "{}");
      const keyMap: Record<string, string> = {
        openRouterApiKey: "openrouter_api_key",
        githubToken: "github_token",
        cloudflareToken: "cloudflare_token",
        telegramBotToken: "telegram_bot_token",
        telegramChatId: "telegram_chat_id",
      };
      const promises = Object.entries(keyMap)
        .filter(([lsKey]) => stored[lsKey])
        .map(([lsKey, cfgKey]) =>
          fetch(`${WORKER_BASE}/api/config`, {
            method: "POST",
            headers: SECRET_HEADER,
            body: JSON.stringify({ key: cfgKey, value: stored[lsKey] }),
          }),
        );
      await Promise.allSettled(promises);
      // Remove migrated keys from localStorage
      const cleaned = { ...stored };
      for (const lsKey of Object.keys(keyMap)) {
        delete cleaned[lsKey];
      }
      localStorage.setItem("bf_settings", JSON.stringify(cleaned));
      setMigrated(true);
      setTimeout(() => setMigrated(false), 4000);
    } catch {
      // silent
    } finally {
      setMigrating(false);
    }
  };

  const secureFields = [
    { label: "OpenRouter API Key", keyName: "openrouter_api_key" },
    { label: "GitHub Token", keyName: "github_token" },
    { label: "Cloudflare API Token", keyName: "cloudflare_token" },
    { label: "Telegram Bot Token", keyName: "telegram_bot_token" },
    { label: "Telegram Chat ID", keyName: "telegram_chat_id" },
  ];

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="Secure API Keys (Worker D1)" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <div className="p-3 rounded-lg border border-pink-500/20 bg-pink-500/5">
          <p className="text-xs font-semibold text-pink-300 mb-1">Why use this?</p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Keys stored here are saved in your Cloudflare Worker's D1 database — not in your browser.
            They won't appear in DevTools and persist across devices. The Agent will automatically load them.
          </p>
        </div>

        <div className="space-y-4">
          {secureFields.map((f) => (
            <FieldGroup key={f.keyName} label={f.label}>
              <SecureKeyField label={f.label} keyName={f.keyName} />
            </FieldGroup>
          ))}
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-xs font-semibold text-foreground">Migrate from localStorage</p>
          <p className="text-[10px] text-muted-foreground">
            Move any API keys stored in your browser to the secure Worker database and remove them from localStorage.
          </p>
          <Button
            onClick={handleMigrateFromLocalStorage}
            disabled={migrating}
            className="w-full h-8 text-xs bg-pink-700 hover:bg-pink-600 text-white"
            data-ocid="settings.securekeys.migrate_button"
          >
            {migrated ? "✓ Migrated!" : migrating ? "Migrating..." : "Migrate from localStorage"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ApiPage({ onBack }: { onBack: () => void }) {
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const s = settings as any;

  const [openRouterKey, setOpenRouterKey] = useState(s?.openRouterApiKey || "");
  const [defaultModel, setDefaultModel] = useState(s?.defaultModel || "qwen/qwen3-coder:free");
  const [geminiKey, setGeminiKey] = useState(s?.geminiApiKey || "");
  const [geminiModel, setGeminiModel] = useState(s?.geminiModel || "gemini-2.0-flash");
  const [groqKey, setGroqKey] = useState(s?.groqApiKey || "");
  const [groqModel, setGroqModel] = useState(s?.groqModel || "llama-3.3-70b-versatile");
  const [githubModelsKey, setGithubModelsKey] = useState(s?.githubModelsKey || "");
  const [githubModelsModel, setGithubModelsModel] = useState(s?.githubModelsModel || "gpt-4o");

  const [supUrl, setSupUrl] = useState(() => localStorage.getItem("bf_supabase_url") || "");
  const [supKey, setSupKey] = useState(() => localStorage.getItem("bf_supabase_key") || "");
  const [supSaved, setSupSaved] = useState(false);

  const handleSave = () => {
    save.mutate({
      openRouterApiKey: openRouterKey,
      defaultModel,
      geminiApiKey: geminiKey,
      geminiModel,
      groqApiKey: groqKey,
      groqModel,
      githubModelsKey,
      githubModelsModel,
    } as any);
  };

  const handleSupabaseSave = () => {
    localStorage.setItem("bf_supabase_url", supUrl);
    localStorage.setItem("bf_supabase_key", supKey);
    setSupSaved(true);
    setTimeout(() => setSupSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="API Keys" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* OpenRouter */}
        <div className="p-3 rounded-lg border border-violet-500/20 bg-violet-500/5 space-y-3">
          <p className="text-xs font-semibold text-violet-300">OpenRouter</p>
          <FieldGroup label="API Key">
            <Input
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
              placeholder="sk-or-..."
              type="password"
              className="h-8 text-xs"
            />
          </FieldGroup>
          <FieldGroup label="Model">
            <Input
              value={defaultModel}
              onChange={(e) => setDefaultModel(e.target.value)}
              placeholder="qwen/qwen3-coder:free"
              className="h-8 text-xs"
            />
          </FieldGroup>
        </div>
        {/* Gemini */}
        <div className="p-3 rounded-lg border border-blue-500/20 bg-blue-500/5 space-y-3">
          <p className="text-xs font-semibold text-blue-300">Google Gemini</p>
          <FieldGroup label="API Key">
            <Input value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIzaSy..." type="password" className="h-8 text-xs" />
          </FieldGroup>
          <FieldGroup label="Model">
            <Input value={geminiModel} onChange={(e) => setGeminiModel(e.target.value)} placeholder="gemini-2.0-flash" className="h-8 text-xs" />
          </FieldGroup>
        </div>
        {/* Groq */}
        <div className="p-3 rounded-lg border border-orange-500/20 bg-orange-500/5 space-y-3">
          <p className="text-xs font-semibold text-orange-300">Groq</p>
          <FieldGroup label="API Key">
            <Input value={groqKey} onChange={(e) => setGroqKey(e.target.value)} placeholder="gsk_..." type="password" className="h-8 text-xs" />
          </FieldGroup>
          <FieldGroup label="Model">
            <Input value={groqModel} onChange={(e) => setGroqModel(e.target.value)} placeholder="llama-3.3-70b-versatile" className="h-8 text-xs" />
          </FieldGroup>
        </div>
        {/* GitHub Models */}
        <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/5 space-y-3">
          <p className="text-xs font-semibold text-green-300">GitHub Models</p>
          <FieldGroup label="Token">
            <Input value={githubModelsKey} onChange={(e) => setGithubModelsKey(e.target.value)} placeholder="ghp_..." type="password" className="h-8 text-xs" />
          </FieldGroup>
          <FieldGroup label="Model">
            <Input value={githubModelsModel} onChange={(e) => setGithubModelsModel(e.target.value)} placeholder="gpt-4o" className="h-8 text-xs" />
          </FieldGroup>
        </div>
        <Button onClick={handleSave} disabled={save.isPending} className="w-full h-8 text-xs" data-ocid="settings.api.save_button">
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {save.isPending ? "Saving..." : save.isSuccess ? "Saved ✓" : "Save API Keys"}
        </Button>

        {/* Supabase for built apps */}
        <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 space-y-3">
          <p className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5" /> Supabase
            <span className="text-[9px] text-muted-foreground">(for your built apps)</span>
          </p>
          <p className="text-[10px] text-muted-foreground">
            BrainForge stores your data in D1+GitHub. These keys are only for apps you build.
          </p>
          <FieldGroup label="Supabase URL">
            <Input value={supUrl} onChange={(e) => setSupUrl(e.target.value)} placeholder="https://xxx.supabase.co" className="h-8 text-xs" />
          </FieldGroup>
          <FieldGroup label="Anon Key">
            <Input value={supKey} onChange={(e) => setSupKey(e.target.value)} placeholder="eyJhbGci..." type="password" className="h-8 text-xs" />
          </FieldGroup>
          <Button onClick={handleSupabaseSave} className="w-full h-8 text-xs bg-emerald-600 hover:bg-emerald-700" data-ocid="settings.supabase.save_button">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {supSaved ? "Saved ✓" : "Save Supabase Keys"}
          </Button>
        </div>
      </div>
    </div>
  );
}

const MAX_PROMPT_CHARS = 2000;

function CustomPromptSection() {
  const { data: savedPrompt = "" } = useCustomPrompt();
  const savePrompt = useSaveCustomPrompt();
  const clearPrompt = useClearCustomPrompt();
  const [draft, setDraft] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const value = draft !== null ? draft : savedPrompt;
  const isActive = savedPrompt.trim().length > 0;

  const handleSave = () => {
    const trimmed = (draft ?? savedPrompt).trim();
    savePrompt.mutate(trimmed, {
      onSuccess: () => {
        setDraft(null);
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 3000);
      },
    });
  };

  const handleClear = () => {
    clearPrompt.mutate(undefined, {
      onSuccess: () => {
        setDraft(null);
        setShowSuccess(false);
      },
    });
  };

  return (
    <div className="p-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          Custom System Prompt
          {isActive && (
            <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-medium">
              ACTIVE
            </span>
          )}
        </p>
        {isActive && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
            data-ocid="settings.ai.prompt.delete_button"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Appended to every AI request across all projects. Use this to set your preferred tone, language, or coding style.
      </p>
      <div className="space-y-1.5">
        <Textarea
          value={value}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_PROMPT_CHARS))}
          onBlur={() => { if (draft !== null && draft !== savedPrompt) handleSave(); }}
          placeholder="e.g. Always write clean, commented code. Prefer functional components. Use TypeScript strict mode."
          className="text-xs resize-none min-h-[90px] bg-background/50"
          data-ocid="settings.ai.prompt.textarea"
        />
        <div className="flex items-center justify-between">
          <span className={`text-[10px] tabular-nums ${value.length >= MAX_PROMPT_CHARS ? "text-destructive" : "text-muted-foreground"}`}>
            {value.length} / {MAX_PROMPT_CHARS}
          </span>
          {showSuccess && (
            <span className="text-[10px] text-cyan-400" data-ocid="settings.ai.prompt.success_state">Saved ✓</span>
          )}
        </div>
      </div>
      <Button
        onClick={handleSave}
        disabled={savePrompt.isPending || draft === null || draft === savedPrompt}
        className="w-full h-8 text-xs"
        data-ocid="settings.ai.prompt.save_button"
      >
        <Save className="w-3.5 h-3.5 mr-1.5" />
        {savePrompt.isPending ? "Saving..." : "Save Custom Prompt"}
      </Button>
    </div>
  );
}

function AiSettingsPage({ onBack }: { onBack: () => void }) {
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const s = settings as any;
  const [provider, setProvider] = useState(s?.aiProvider || "auto");
  const [temp, setTemp] = useState(String(s?.temperature ?? 0.7));
  const [maxTok, setMaxTok] = useState(String(s?.maxTokens ?? 4096));
  const [autoFix, setAutoFix] = useState<boolean>(s?.autoFix !== false);
  const [liveSearch, setLiveSearch] = useState<boolean>(!!s?.liveSearch);
  const [proactive, setProactive] = useState<boolean>(!!s?.proactiveAI);

  const handleSave = () => {
    save.mutate({
      aiProvider: provider as any,
      temperature: Number.parseFloat(temp) || 0.7,
      maxTokens: Number.parseInt(maxTok) || 4096,
      autoFix,
      liveSearch,
      proactiveAI: proactive,
    } as any);
  };

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="AI Settings" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <FieldGroup label="Provider">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full h-8 bg-card border border-border rounded-md px-2 text-xs text-foreground"
          >
            <option value="auto">Auto (best available)</option>
            <option value="openrouter">OpenRouter</option>
            <option value="gemini">Gemini</option>
            <option value="groq">Groq</option>
            <option value="github">GitHub Models</option>
          </select>
        </FieldGroup>
        <FieldGroup label="Temperature">
          <Input value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="0.7" className="h-8 text-xs" />
        </FieldGroup>
        <FieldGroup label="Max Tokens">
          <Input value={maxTok} onChange={(e) => setMaxTok(e.target.value)} placeholder="4096" className="h-8 text-xs" />
        </FieldGroup>
        <div className="flex items-center justify-between py-2 border-b border-border">
          <div>
            <p className="text-xs font-medium text-foreground">Auto-fix errors</p>
            <p className="text-[10px] text-muted-foreground">AI retries up to 3 times on error</p>
          </div>
          <Switch checked={autoFix} onCheckedChange={setAutoFix} />
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border">
          <div>
            <p className="text-xs font-medium text-foreground">Live internet search</p>
            <p className="text-[10px] text-muted-foreground">DuckDuckGo before each response</p>
          </div>
          <Switch checked={liveSearch} onCheckedChange={setLiveSearch} />
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border">
          <div>
            <p className="text-xs font-medium text-foreground">Proactive AI</p>
            <p className="text-[10px] text-muted-foreground">AI suggests improvements automatically</p>
          </div>
          <Switch checked={proactive} onCheckedChange={setProactive} />
        </div>
        <Button onClick={handleSave} disabled={save.isPending} className="w-full h-8 text-xs" data-ocid="settings.ai.save_button">
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {save.isPending ? "Saving..." : save.isSuccess ? "Saved ✓" : "Save AI Settings"}
        </Button>
        <CustomPromptSection />
      </div>
    </div>
  );
}

function TermuxPage({ onBack }: { onBack: () => void }) {
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const s = settings as any;
  const [url, setUrl] = useState(s?.termuxUrl || "");

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="Termux" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="p-3 rounded-lg border border-green-500/20 bg-green-500/5">
          <p className="text-[10px] text-green-300/70 mb-1">Run BrainForge Worker locally via Termux on Android.</p>
          <p className="text-[10px] text-muted-foreground">
            Start with: <code className="text-green-400 bg-green-950/40 px-1 rounded">node server.js</code> in Termux
          </p>
        </div>
        <FieldGroup label="Termux Server URL">
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:3000" className="h-8 text-xs" />
        </FieldGroup>
        <Button onClick={() => save.mutate({ termuxUrl: url } as any)} disabled={save.isPending} className="w-full h-8 text-xs" data-ocid="settings.termux.save_button">
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {save.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

function GithubPage({ onBack }: { onBack: () => void }) {
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const s = settings as any;
  const [token, setToken] = useState(s?.githubToken || "");
  const [repo, setRepo] = useState(s?.githubRepo || "");
  const [cfToken, setCfToken] = useState(s?.cloudflareToken || "");
  const [cfAccount, setCfAccount] = useState(s?.cloudflareAccountId || "");

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="GitHub & Deploy" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="p-3 rounded-lg border border-orange-500/20 bg-orange-500/5 space-y-3">
          <p className="text-xs font-semibold text-orange-300">GitHub</p>
          <FieldGroup label="Personal Access Token">
            <Input value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_..." type="password" className="h-8 text-xs" />
          </FieldGroup>
          <FieldGroup label="Repository (owner/repo)">
            <Input value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="username/repo" className="h-8 text-xs" />
          </FieldGroup>
        </div>
        <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 space-y-3">
          <p className="text-xs font-semibold text-amber-300">Cloudflare Deploy</p>
          <FieldGroup label="API Token">
            <Input value={cfToken} onChange={(e) => setCfToken(e.target.value)} placeholder="CF API token" type="password" className="h-8 text-xs" />
          </FieldGroup>
          <FieldGroup label="Account ID">
            <Input value={cfAccount} onChange={(e) => setCfAccount(e.target.value)} placeholder="913f3a25..." className="h-8 text-xs" />
          </FieldGroup>
        </div>
        <Button
          onClick={() => save.mutate({ githubToken: token, githubRepo: repo, cloudflareToken: cfToken, cloudflareAccountId: cfAccount } as any)}
          disabled={save.isPending}
          className="w-full h-8 text-xs"
          data-ocid="settings.github.save_button"
        >
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {save.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}

function PinLockPage({ onBack }: { onBack: () => void }) {
  const [pin, setPin] = useState(() => localStorage.getItem("bf_pin") || "");
  const [confirmPin, setConfirmPin] = useState("");
  const [enabled, setEnabled] = useState(() => !!localStorage.getItem("bf_pin"));
  const [timeout, setTimeoutVal] = useState(() => localStorage.getItem("bf_pin_timeout") || "30");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const handleSave = () => {
    setError("");
    if (enabled) {
      if (pin.length < 4) { setError("PIN must be at least 4 digits"); return; }
      if (pin !== confirmPin) { setError("PINs do not match"); return; }
      localStorage.setItem("bf_pin", pin);
      localStorage.setItem("bf_pin_timeout", timeout);
    } else {
      localStorage.removeItem("bf_pin");
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <SubPageHeader title="PIN Lock" onBack={onBack} />
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="p-3 rounded-lg border border-yellow-500/20 bg-yellow-500/5">
          <p className="text-[10px] text-yellow-300/70">
            PIN lock protects your BrainForge from unauthorized access. You'll need to enter your PIN each time you open the app.
          </p>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-xs font-medium text-foreground">Enable PIN Lock</p>
            <p className="text-[10px] text-muted-foreground">Require PIN on app open</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        {enabled && (
          <>
            <FieldGroup label="New PIN (min 4 digits)">
              <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="Enter PIN" type="password" maxLength={8} className="h-8 text-xs" />
            </FieldGroup>
            <FieldGroup label="Confirm PIN">
              <Input value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))} placeholder="Confirm PIN" type="password" maxLength={8} className="h-8 text-xs" />
            </FieldGroup>
            <FieldGroup label="Session Timeout (minutes)">
              <Input value={timeout} onChange={(e) => setTimeoutVal(e.target.value)} placeholder="30" className="h-8 text-xs" />
            </FieldGroup>
          </>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button onClick={handleSave} className="w-full h-8 text-xs bg-yellow-600 hover:bg-yellow-700" data-ocid="settings.pin.save_button">
          <Save className="w-3.5 h-3.5 mr-1.5" />
          {saved ? "Saved ✓" : "Save PIN Settings"}
        </Button>
        {!enabled && localStorage.getItem("bf_pin") && (
          <Button variant="destructive" className="w-full h-8 text-xs" onClick={() => { localStorage.removeItem("bf_pin"); setPin(""); setConfirmPin(""); setSaved(true); }} data-ocid="settings.pin.delete_button">
            Remove PIN Lock
          </Button>
        )}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const [page, setPage] = useState<Page>(null);

  if (page === "api") return <ApiPage onBack={() => setPage(null)} />;
  if (page === "ai") return <AiSettingsPage onBack={() => setPage(null)} />;
  if (page === "termux") return <TermuxPage onBack={() => setPage(null)} />;
  if (page === "github") return <GithubPage onBack={() => setPage(null)} />;
  if (page === "pinlock") return <PinLockPage onBack={() => setPage(null)} />;
  if (page === "securekeys") return <SecureKeysPage onBack={() => setPage(null)} />;

  return (
    <div className="flex flex-col h-full" data-ocid="settings.page">
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border shrink-0">
        <Settings className="w-4 h-4 text-primary" />
        <h1 className="text-sm font-semibold text-foreground">Settings</h1>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-3">
          {HUB_BUTTONS.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => setPage(btn.id)}
                className={`flex flex-col items-start gap-2 p-4 rounded-xl border bg-gradient-to-br transition-all hover:scale-[1.02] active:scale-[0.98] ${btn.color}`}
                data-ocid={`settings.${btn.id}.button`}
              >
                <Icon className="w-5 h-5" />
                <div>
                  <p className="text-xs font-semibold">{btn.label}</p>
                  <p className="text-[10px] opacity-70 leading-tight mt-0.5">{btn.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="text-center mt-6 space-y-1.5">
          <p className="text-[10px] text-muted-foreground/30">
            Made with love by <span className="text-violet-400/60">Pinka</span> &amp; <span className="text-cyan-400/60">Claude (Ara)</span>
          </p>
          <Link to="/policy" className="text-[10px] text-muted-foreground/25 hover:text-muted-foreground/60 underline transition-colors">
            Legal Policy &amp; Terms
          </Link>
        </div>
      </div>
    </div>
  );
}
