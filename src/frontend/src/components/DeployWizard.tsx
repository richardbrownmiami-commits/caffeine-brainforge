import {
  Check,
  ChevronRight,
  Cloud,
  Copy,
  ExternalLink,
  Github,
  Loader2,
  X,
} from "lucide-react";
import { useState } from "react";

type DeployStep = "choose" | "github" | "cloudflare" | "deploying" | "done";

interface Props {
  projectName: string;
  code: string;
  onClose: () => void;
}

export function DeployWizard({ projectName, code, onClose }: Props) {
  const [step, setStep] = useState<DeployStep>("choose");
  const [ghToken, setGhToken] = useState(() => {
    const s = JSON.parse(localStorage.getItem("bf_settings") || "{}");
    return s.githubToken || "";
  });
  const [ghRepo, setGhRepo] = useState(() => {
    const s = JSON.parse(localStorage.getItem("bf_settings") || "{}");
    return s.githubRepo || "";
  });
  const [cfToken, setCfToken] = useState(() => {
    const s = JSON.parse(localStorage.getItem("bf_settings") || "{}");
    return s.cloudflareToken || "";
  });
  const [cfAccountId, setCfAccountId] = useState(() => {
    const s = JSON.parse(localStorage.getItem("bf_settings") || "{}");
    return s.cloudflareAccountId || "";
  });
  const [projectSlug, setProjectSlug] = useState(
    projectName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 28),
  );
  const [deployUrl, setDeployUrl] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [copied, setCopied] = useState(false);

  const saveCredentials = () => {
    const s = JSON.parse(localStorage.getItem("bf_settings") || "{}");
    if (ghToken) s.githubToken = ghToken;
    if (ghRepo) s.githubRepo = ghRepo;
    if (cfToken) s.cloudflareToken = cfToken;
    if (cfAccountId) s.cloudflareAccountId = cfAccountId;
    localStorage.setItem("bf_settings", JSON.stringify(s));
  };

  const deployToGitHub = async () => {
    if (!ghToken || !ghRepo)
      return setError("GitHub token and repo are required.");
    saveCredentials();
    setStep("deploying");
    setError("");
    try {
      // Check if repo exists
      setProgress("Checking repository...");
      const repoRes = await fetch(`https://api.github.com/repos/${ghRepo}`, {
        headers: {
          Authorization: `token ${ghToken}`,
          Accept: "application/vnd.github+json",
        },
      });

      const path = `projects/${projectName}/index.html`;

      // Get existing file SHA if it exists
      let sha: string | undefined;
      const existRes = await fetch(
        `https://api.github.com/repos/${ghRepo}/contents/${path}`,
        {
          headers: {
            Authorization: `token ${ghToken}`,
            Accept: "application/vnd.github+json",
          },
        },
      );
      if (existRes.ok) {
        const existData = await existRes.json();
        sha = existData.sha;
      }

      setProgress("Pushing code to GitHub...");
      const content = btoa(unescape(encodeURIComponent(code)));
      const putRes = await fetch(
        `https://api.github.com/repos/${ghRepo}/contents/${path}`,
        {
          method: "PUT",
          headers: {
            Authorization: `token ${ghToken}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `BrainForge: deploy ${projectName}`,
            content,
            ...(sha ? { sha } : {}),
          }),
        },
      );

      if (!putRes.ok) throw new Error("Failed to push to GitHub.");

      const _repoData = await repoRes.json();
      const _fileUrl = `https://github.com/${ghRepo}/blob/main/${path}`;
      const pagesUrl = `https://${ghRepo.split("/")[0]}.github.io/${ghRepo.split("/")[1]}/projects/${projectName}/`;
      setDeployUrl(pagesUrl);
      setProgress("");
      setStep("done");
    } catch (e: any) {
      setError(e.message || "Deploy failed.");
      setStep("github");
    }
  };

  const deployToCloudflare = async () => {
    if (!cfToken || !cfAccountId)
      return setError("Cloudflare token and Account ID are required.");
    saveCredentials();
    setStep("deploying");
    setError("");
    try {
      setProgress("Creating Cloudflare Pages project...");

      // Check/create project
      const _createRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: projectSlug,
            production_branch: "main",
          }),
        },
      );

      setProgress("Uploading files...");
      // Create a FormData with the HTML file for direct upload
      const formData = new FormData();
      const blob = new Blob([code], { type: "text/html" });
      formData.append("index.html", blob, "index.html");

      const deployRes = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/pages/projects/${projectSlug}/deployments`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${cfToken}` },
          body: formData,
        },
      );

      if (!deployRes.ok) {
        const err = await deployRes.json();
        throw new Error(
          err.errors?.[0]?.message || "Cloudflare deploy failed.",
        );
      }

      setDeployUrl(`https://${projectSlug}.pages.dev`);
      setProgress("");
      setStep("done");
    } catch (e: any) {
      setError(e.message || "Cloudflare deploy failed.");
      setStep("cloudflare");
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(deployUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-[9980] flex items-end sm:items-center justify-center p-4"
      style={{
        background: "oklch(0.04 0.02 280/0.8)",
        backdropFilter: "blur(8px)",
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">
              Deploy App
            </span>
            <span className="text-[10px] text-muted-foreground bg-sidebar-accent px-2 py-0.5 rounded-full">
              {projectName}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {/* Choose platform */}
          {step === "choose" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Choose where to deploy your app:
              </p>
              <button
                type="button"
                onClick={() => setStep("cloudflare")}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-orange-500/25 bg-orange-500/5 hover:bg-orange-500/10 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-orange-500/15 flex items-center justify-center text-lg shrink-0">
                  🌐
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Cloudflare Pages
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Free hosting, global CDN, instant deploy
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
              </button>
              <button
                type="button"
                onClick={() => setStep("github")}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-blue-500/25 bg-blue-500/5 hover:bg-blue-500/10 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                  <Github className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    GitHub Pages
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Push to repo, free GitHub hosting
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
              </button>
              <div className="p-3 rounded-xl bg-sidebar-accent/40 text-[10px] text-muted-foreground">
                No account yet? &nbsp;
                <a
                  href="https://pages.cloudflare.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-400 underline"
                >
                  Cloudflare (free)
                </a>
                &nbsp;|&nbsp;
                <a
                  href="https://github.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 underline"
                >
                  GitHub (free)
                </a>
              </div>
            </div>
          )}

          {/* GitHub form */}
          {step === "github" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep("choose")}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  ← Back
                </button>
                <span className="text-sm font-semibold text-foreground">
                  GitHub Pages Deploy
                </span>
              </div>
              {[
                {
                  label: "GitHub Token",
                  value: ghToken,
                  set: setGhToken,
                  ph: "ghp_...",
                  hint: "github.com → Settings → Developer Settings → Personal Access Tokens",
                },
                {
                  label: "Repository (owner/repo)",
                  value: ghRepo,
                  set: setGhRepo,
                  ph: "username/my-repo",
                  hint: "The repo where code will be pushed",
                },
              ].map((f) => (
                <div key={f.label} className="space-y-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                    {f.label}
                  </span>
                  <input
                    type="password"
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    placeholder={f.ph}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  <p className="text-[9px] text-muted-foreground/60">
                    {f.hint}
                  </p>
                </div>
              ))}
              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={deployToGitHub}
                disabled={!ghToken || !ghRepo}
                className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Github className="w-4 h-4" /> Push to GitHub
              </button>
            </div>
          )}

          {/* Cloudflare form */}
          {step === "cloudflare" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setStep("choose")}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  ← Back
                </button>
                <span className="text-sm font-semibold text-foreground">
                  Cloudflare Pages Deploy
                </span>
              </div>
              {[
                {
                  label: "Cloudflare API Token",
                  value: cfToken,
                  set: setCfToken,
                  ph: "...",
                  hint: "dash.cloudflare.com → My Profile → API Tokens → Create Token",
                },
                {
                  label: "Account ID",
                  value: cfAccountId,
                  set: setCfAccountId,
                  ph: "913f3a...",
                  hint: "dash.cloudflare.com → Workers & Pages → Account ID (right sidebar)",
                },
                {
                  label: "Project Name (slug)",
                  value: projectSlug,
                  set: setProjectSlug,
                  ph: "my-app",
                  hint: "URL will be: your-project.pages.dev",
                  isText: true,
                },
              ].map((f) => (
                <div key={f.label} className="space-y-1.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                    {f.label}
                  </span>
                  <input
                    type={(f as any).isText ? "text" : "password"}
                    value={f.value}
                    onChange={(e) => f.set(e.target.value)}
                    placeholder={f.ph}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                  />
                  <p className="text-[9px] text-muted-foreground/60">
                    {f.hint}
                  </p>
                </div>
              ))}
              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <button
                type="button"
                onClick={deployToCloudflare}
                disabled={!cfToken || !cfAccountId || !projectSlug}
                className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-40 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
              >
                <Cloud className="w-4 h-4" /> Deploy to Cloudflare
              </button>
            </div>
          )}

          {/* Deploying */}
          {step === "deploying" && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Deploying...
                </p>
                <p className="text-xs text-muted-foreground mt-1">{progress}</p>
              </div>
            </div>
          )}

          {/* Done */}
          {step === "done" && (
            <div className="space-y-4">
              <div className="text-center py-3">
                <div className="w-12 h-12 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center mx-auto mb-3">
                  <Check className="w-6 h-6 text-green-400" />
                </div>
                <p className="text-base font-bold text-foreground">Deployed!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your app is live
                </p>
              </div>
              <div className="bg-sidebar-accent/60 rounded-xl p-3 space-y-2">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                  Live URL
                </p>
                <div className="flex items-center gap-2">
                  <p className="flex-1 text-xs font-mono text-primary truncate">
                    {deployUrl}
                  </p>
                  <button
                    type="button"
                    onClick={copyUrl}
                    className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                  >
                    {copied ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                  <a
                    href={deployUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
