import {
  Check,
  ChevronRight,
  FolderPlus,
  Key,
  Rocket,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";

const PROVIDERS = [
  {
    id: "openrouter",
    label: "OpenRouter",
    desc: "Free models (Llama, Mistral, etc.)",
    color: "text-violet-400",
    key: "openRouterKey",
    placeholder: "sk-or-v1-...",
  },
  {
    id: "gemini",
    label: "Gemini",
    desc: "Google AI Studio -- free tier",
    color: "text-blue-400",
    key: "geminiKey",
    placeholder: "AIza...",
  },
  {
    id: "groq",
    label: "Groq",
    desc: "Blazing fast Llama 3.3 / Qwen3",
    color: "text-orange-400",
    key: "groqKey",
    placeholder: "gsk_...",
  },
  {
    id: "github",
    label: "GitHub Models",
    desc: "GPT-4o, DeepSeek, etc.",
    color: "text-green-400",
    key: "githubModelsKey",
    placeholder: "ghp_...",
  },
];

const STEPS = [
  { id: "welcome", label: "Welcome", icon: Zap },
  { id: "apikey", label: "API Key", icon: Key },
  { id: "ready", label: "Ready", icon: Rocket },
];

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState(0);
  const [keyValue, setKeyValue] = useState("");
  const [saved, setSaved] = useState(false);

  const provider = PROVIDERS[selected];

  const saveKey = () => {
    if (!keyValue.trim()) return;
    const settings = JSON.parse(localStorage.getItem("bf_settings") || "{}");
    settings[provider.key] = keyValue.trim();
    localStorage.setItem("bf_settings", JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setStep(2), 600);
  };

  const skip = () => setStep(2);

  return (
    <div
      className="fixed inset-0 z-[9990] flex items-center justify-center p-4"
      style={{
        background: "oklch(0.04 0.02 280/0.95)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="flex border-b border-border">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = i < step;
            const active = i === step;
            return (
              <div
                key={s.id}
                className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-[10px] font-medium transition-colors ${
                  done
                    ? "text-green-400 bg-green-500/5"
                    : active
                      ? "text-primary bg-primary/5"
                      : "text-muted-foreground/40"
                }`}
              >
                {done ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Icon className="w-3 h-3" />
                )}
                {s.label}
              </div>
            );
          })}
        </div>

        {/* Step 0 -- Welcome */}
        {step === 0 && (
          <div className="p-6 space-y-5">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
                <Zap
                  className="w-8 h-8 text-primary fill-primary"
                  strokeWidth={0}
                />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  Welcome to BrainForge
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  AI-powered app builder. Describe what you want -- BrainForge
                  builds it.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { icon: "🤖", text: "10+ AI providers with auto-rotation" },
                {
                  icon: "🌐",
                  text: "10 languages: React, Python, SQL, Three.js...",
                },
                { icon: "🚀", text: "One-click deploy to GitHub & Cloudflare" },
                { icon: "🔒", text: "Your data stays on your infrastructure" },
              ].map((f) => (
                <div
                  key={f.text}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-sidebar-accent/40"
                >
                  <span className="text-base">{f.icon}</span>
                  <span className="text-xs text-muted-foreground">
                    {f.text}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              Get Started <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 1 -- API Key */}
        {step === 1 && (
          <div className="p-6 space-y-4">
            <div>
              <h2 className="text-base font-bold text-foreground">
                Add an API Key
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                BrainForge uses AI to build your apps. Choose a provider and
                paste your key.
              </p>
            </div>

            {/* Provider selector */}
            <div className="grid grid-cols-2 gap-2">
              {PROVIDERS.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setSelected(i);
                    setKeyValue("");
                    setSaved(false);
                  }}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    selected === i
                      ? "border-primary/50 bg-primary/8"
                      : "border-border bg-sidebar-accent/30 hover:border-border/70"
                  }`}
                >
                  <p
                    className={`text-xs font-semibold ${selected === i ? p.color : "text-foreground"}`}
                  >
                    {p.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    {p.desc}
                  </p>
                </button>
              ))}
            </div>

            {/* Key input */}
            <div className="space-y-2">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                {provider.label} API Key
              </span>
              <input
                type="password"
                value={keyValue}
                onChange={(e) => {
                  setKeyValue(e.target.value);
                  setSaved(false);
                }}
                placeholder={provider.placeholder}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary/50 transition-colors font-mono"
                onKeyDown={(e) => e.key === "Enter" && saveKey()}
              />
              <p className="text-[10px] text-muted-foreground/60">
                Keys are stored locally in your browser only.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={skip}
                className="flex-1 py-2.5 rounded-xl border border-border text-muted-foreground text-xs font-medium hover:text-foreground hover:border-border/70 transition-colors"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={saveKey}
                disabled={!keyValue.trim() || saved}
                className="flex-[2] py-2.5 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 text-primary-foreground text-xs font-medium flex items-center justify-center gap-2 transition-colors"
              >
                {saved ? (
                  <>
                    <Check className="w-3 h-3" /> Saved!
                  </>
                ) : (
                  <>
                    Save &amp; Continue <ChevronRight className="w-3 h-3" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 -- Ready */}
        {step === 2 && (
          <div className="p-6 space-y-5">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto">
                <Rocket className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">
                  You&apos;re all set!
                </h2>
                <p className="text-xs text-muted-foreground mt-1">
                  BrainForge is ready. Create your first project and describe
                  what you want to build.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { step: "1", text: 'Click "New Project" on the Projects page' },
                { step: "2", text: "Give your project a name" },
                { step: "3", text: "Describe what you want to build" },
                { step: "4", text: "BrainForge AI will build it for you!" },
              ].map((s) => (
                <div
                  key={s.step}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-sidebar-accent/40"
                >
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
                    {s.step}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.text}
                  </span>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                localStorage.setItem("bf_onboarded", "1");
                onComplete();
              }}
              className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Rocket className="w-4 h-4" /> Start Building!
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function useOnboarding() {
  const [showWizard, setShowWizard] = useState(false);

  useEffect(() => {
    const onboarded = localStorage.getItem("bf_onboarded");
    if (onboarded) return;
    // Check if no API keys set
    const s = JSON.parse(localStorage.getItem("bf_settings") || "{}");
    const hasKey =
      s.openRouterKey || s.geminiKey || s.groqKey || s.githubModelsKey;
    if (!hasKey) setShowWizard(true);
  }, []);

  return { showWizard, setShowWizard };
}
