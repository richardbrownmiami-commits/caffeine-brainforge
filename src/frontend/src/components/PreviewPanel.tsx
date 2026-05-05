import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  ChevronRight,
  Code2,
  Download,
  ExternalLink,
  FileCode,
  FileText,
  Loader2,
  Monitor,
  RefreshCw,
  Rocket,
  RotateCcw,
  Save,
  Smartphone,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AppLanguage } from "../hooks/useAIChat";
import type { ChatMessage } from "../hooks/useTermux";

interface PreviewPanelProps {
  messages: ChatMessage[];
  termuxUrl: string;
  projectName: string;
  language?: AppLanguage;
}

function extractCode(messages: ChatMessage[]) {
  let html = "";
  let css = "";
  let js = "";
  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    const full = msg.content.match(/```html\n?([\s\S]*?)```/i);
    if (full && (full[1].includes("<!DOCTYPE") || full[1].includes("<html"))) {
      html = full[1];
      css = "";
      js = "";
      continue;
    }
    for (const m of msg.content.matchAll(
      /```(html|css|javascript|js|jsx|tsx|ts)\n?([\s\S]*?)```/gi,
    )) {
      const l = m[1].toLowerCase();
      if (l === "html") html = m[2];
      else if (l === "css") css = m[2];
      else js = m[2];
    }
  }
  return { html, css, js };
}

const SAFETY =
  "<scr" +
  `ipt>try{Object.defineProperty(window,'parent',{get:()=>window,configurable:true});Object.defineProperty(window,'top',{get:()=>window,configurable:true});}catch(e){}var _ce=console.error;console.error=function(){try{window.parent.postMessage({type:'PREVIEW_ERROR',error:[...arguments].join(' ')},'*');}catch(e){}_ce.apply(console,arguments);};window.onerror=function(m,s,l){try{window.parent.postMessage({type:'PREVIEW_ERROR',error:m+' (line '+l+')'},'*');}catch(e){}return true;};window.addEventListener('unhandledrejection',e=>{try{window.parent.postMessage({type:'PREVIEW_ERROR',error:String(e.reason)},'*');}catch(e2){}});</scr` +
  "ipt>";

function buildDoc(
  html: string,
  css: string,
  js: string,
  language: AppLanguage = "html",
): string {
  if (!html && !css && !js) return "";

  // Full HTML document -- inject safety script and return
  if (html.includes("<!DOCTYPE") || html.includes("<html")) {
    return html.replace(/<head>/i, `<head>${SAFETY}`);
  }

  // React mode -- wrap JSX in Babel
  if (language === "react" || language === "react-tailwind") {
    const tailwindCDN =
      language === "react-tailwind"
        ? '<script src="https://cdn.tailwindcss.com"></script>'
        : "";
    return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://unpkg.com/react@18/umd/react.development.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
${tailwindCDN}
${SAFETY}
<style>body{margin:0;background:#0a0a0a;color:#fff;font-family:system-ui,sans-serif}${css}</style>
</head><body><div id="root"></div>
<script type="text/babel">
${js || html}
</script></body></html>`;
  }

  // TypeScript mode -- Babel with TS preset
  if (language === "typescript") {
    return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
${SAFETY}
<style>body{margin:0;background:#0a0a0a;color:#fff;font-family:system-ui,sans-serif}${css}</style>
</head><body><div id="app"></div>
<script type="text/babel" data-presets="typescript">
${js || html}
</script></body></html>`;
  }

  // Default HTML/CSS/JS
  return `<!DOCTYPE html><html><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${SAFETY}<style>*{box-sizing:border-box}${css}</style>
</head><body>${html}<script>${js}</script></body></html>`;
}

export function PreviewPanel({
  messages,
  projectName,
  language = "html",
}: PreviewPanelProps) {
  const [view, setView] = useState<"preview" | "edit">("preview");
  const [selFile, setSelFile] = useState<
    "index.html" | "style.css" | "script.js"
  >("index.html");
  const [previewKey, setPreviewKey] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployUrl, setDeployUrl] = useState(
    () => localStorage.getItem(`bf_deploy_url_${projectName}`) || "",
  );
  const [editHtml, setEditHtml] = useState("");
  const [editCss, setEditCss] = useState("");
  const [editJs, setEditJs] = useState("");
  const [unsaved, setUnsaved] = useState(false);
  const [liveDoc, setLiveDoc] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const prevHtml = useRef("");

  const { html: aiHtml, css: aiCss, js: aiJs } = extractCode(messages);

  useEffect(() => {
    if (aiHtml && aiHtml !== prevHtml.current) {
      prevHtml.current = aiHtml;
      setEditHtml(aiHtml);
      setEditCss(aiCss);
      setEditJs(aiJs);
      setUnsaved(false);
      setLiveDoc("");
    }
  }, [aiHtml, aiCss, aiJs]);

  const html = editHtml || aiHtml;
  const css = editCss || aiCss;
  const js = editJs || aiJs;
  const srcDoc = useMemo(
    () => liveDoc || buildDoc(html, css, js, language),
    [liveDoc, html, css, js, language],
  );
  const hasCode = !!(html || css || js);

  const getContent = (f: string) =>
    f === "index.html"
      ? html || "<!-- No HTML yet -->"
      : f === "style.css"
        ? css || "/* No CSS yet */"
        : js || "// No JS yet";
  const setContent = (f: string, v: string) => {
    if (f === "index.html") setEditHtml(v);
    else if (f === "style.css") setEditCss(v);
    else setEditJs(v);
    setUnsaved(true);
  };

  const applyEdits = () => {
    const h =
      selFile === "index.html" ? taRef.current?.value || editHtml : editHtml;
    const c =
      selFile === "style.css" ? taRef.current?.value || editCss : editCss;
    const j = selFile === "script.js" ? taRef.current?.value || editJs : editJs;
    setLiveDoc(buildDoc(h, c, j, language));
    setPreviewKey((k) => k + 1);
    setUnsaved(false);
    setView("preview");
  };

  const resetToAi = () => {
    setEditHtml(aiHtml);
    setEditCss(aiCss);
    setEditJs(aiJs);
    setLiveDoc("");
    setUnsaved(false);
    setPreviewKey((k) => k + 1);
  };

  const files = [
    {
      name: "index.html" as const,
      icon: <FileText className="w-3.5 h-3.5 text-orange-400" />,
    },
    {
      name: "style.css" as const,
      icon: <FileCode className="w-3.5 h-3.5 text-blue-400" />,
    },
    {
      name: "script.js" as const,
      icon: <FileCode className="w-3.5 h-3.5 text-yellow-400" />,
    },
  ];

  const exportZip = async () => {
    if (!hasCode) return;
    setExporting(true);
    try {
      await new Promise<void>((res, rej) => {
        if ((window as any).JSZip) {
          res();
          return;
        }
        const sc = document.createElement("script");
        sc.src =
          "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
        sc.onload = () => res();
        sc.onerror = rej;
        document.head.appendChild(sc);
      });
      const zip = new (window as any).JSZip();
      if (html.includes("<!DOCTYPE") || html.includes("<html")) {
        zip.file("index.html", html);
      } else {
        zip.file("index.html", srcDoc || buildDoc(html, css, js, language));
        if (css) zip.file("style.css", css);
        if (js) zip.file("script.js", js);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const deployApp = async () => {
    const saved = JSON.parse(localStorage.getItem("bf_settings") || "{}");
    const token = saved.githubToken || "";
    const repo = saved.githubRepo || "";
    if (!token) {
      alert("Add GitHub token in Settings → GitHub & Deploy.");
      return;
    }
    if (!repo) {
      alert("Add GitHub repo in Settings → GitHub & Deploy.");
      return;
    }
    if (!hasCode) {
      alert("No code to deploy yet.");
      return;
    }
    setDeploying(true);
    try {
      const doc = liveDoc || buildDoc(html, css, js, language);
      const path = `docs/${projectName}/index.html`;
      const api = `https://api.github.com/repos/${repo}/contents/${path}`;
      const get = await fetch(api, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const sha = get.ok ? (await get.json()).sha : undefined;
      const put = await fetch(api, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: `deploy: ${projectName}`,
          content: btoa(unescape(encodeURIComponent(doc))),
          ...(sha ? { sha } : {}),
        }),
      });
      if (!put.ok) {
        const e = await put.json().catch(() => ({}));
        throw new Error(e?.message || "Deploy failed");
      }
      const u = `https://cdn.jsdelivr.net/gh/${repo}@main/${path}`;
      setDeployUrl(u);
      localStorage.setItem(`bf_deploy_url_${projectName}`, u);
      const ps = JSON.parse(localStorage.getItem("bf_projects") || "[]");
      localStorage.setItem(
        "bf_projects",
        JSON.stringify(
          ps.map((p: any) =>
            p.name === projectName ? { ...p, deployUrl: u } : p,
          ),
        ),
      );
      alert(`Deployed! Live at: ${u}`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div
      className="flex flex-col h-full bg-background"
      data-ocid="preview.panel"
    >
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center rounded-md border border-border overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setView("preview")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 text-[11px] transition-colors",
              view === "preview"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <Monitor className="w-3 h-3" /> Preview
          </button>
          <button
            type="button"
            onClick={() => setView("edit")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 text-[11px] border-l border-border transition-colors",
              view === "edit"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <Code2 className="w-3 h-3" /> Edit{unsaved ? " *" : ""}
          </button>
        </div>
        <div className="flex-1" />
        {hasCode && (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={exportZip}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
            </Button>
            {view === "preview" && (
              <>
                <Button
                  variant={mobile ? "default" : "ghost"}
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setMobile((v) => !v)}
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setPreviewKey((k) => k + 1)}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
            {deployUrl && (
              <a
                href={deployUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-green-400 hover:underline shrink-0"
              >
                <ExternalLink className="w-3 h-3" /> Live
              </a>
            )}
            <button
              type="button"
              onClick={deployApp}
              disabled={deploying}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-medium shrink-0 disabled:opacity-50"
            >
              {deploying ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" /> Deploying...
                </>
              ) : (
                <>
                  <Rocket className="w-3 h-3" /> Deploy
                </>
              )}
            </button>
          </>
        )}
      </div>

      {view === "preview" && (
        <div className="flex-1 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          {srcDoc ? (
            <div
              className={cn(
                "h-full flex items-center justify-center",
                mobile ? "p-4" : "p-0",
              )}
            >
              <div
                className={cn(
                  mobile
                    ? "w-[375px] h-full max-h-[812px] rounded-[2rem] overflow-hidden shadow-2xl border-4 border-zinc-700 bg-white relative"
                    : "w-full h-full",
                )}
              >
                {mobile && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-zinc-700 rounded-b-xl z-10" />
                )}
                <iframe
                  key={previewKey}
                  srcDoc={srcDoc}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
                  title="Preview"
                  className="w-full h-full border-0 bg-white"
                  data-ocid="preview.canvas_target"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
              <Monitor className="w-10 h-10 opacity-20" />
              <p className="text-sm">Preview will appear here</p>
              <p className="text-xs opacity-50">
                Ask AI to build something in chat
              </p>
            </div>
          )}
        </div>
      )}

      {view === "edit" && (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-36 shrink-0 border-r border-border bg-muted/20 flex flex-col">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase">
                Files
              </p>
            </div>
            <div className="flex-1 py-1">
              {files.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => setSelFile(f.name)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors text-left",
                    selFile === f.name
                      ? "bg-primary/15 text-foreground font-medium border-r-2 border-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40",
                  )}
                >
                  {f.icon}
                  <span className="truncate font-mono">{f.name}</span>
                  {selFile === f.name && (
                    <ChevronRight className="w-3 h-3 ml-auto shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <div className="px-2 py-2 border-t border-border space-y-1">
              <button
                type="button"
                onClick={applyEdits}
                className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Save className="w-3 h-3" /> Apply
              </button>
              {(editHtml !== aiHtml ||
                editCss !== aiCss ||
                editJs !== aiJs) && (
                <button
                  type="button"
                  onClick={resetToAi}
                  className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[10px] border border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
              )}
              <p className="text-[9px] text-muted-foreground/50 text-center">
                {hasCode ? (unsaved ? "✏️ Unsaved" : "✅ Saved") : "⏳ Waiting"}
              </p>
            </div>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-muted/10 shrink-0">
              {files.find((f) => f.name === selFile)?.icon}
              <span className="text-[11px] font-mono">{selFile}</span>
              <span className="text-[10px] text-muted-foreground ml-auto">
                {getContent(selFile).split("\n").length} lines
              </span>
            </div>
            <textarea
              ref={taRef}
              key={selFile}
              defaultValue={getContent(selFile)}
              onChange={(e) => setContent(selFile, e.target.value)}
              spellCheck={false}
              className="flex-1 p-3 text-[11px] font-mono leading-relaxed text-green-300 resize-none focus:outline-none"
              style={{
                background: "oklch(0.07 0 0)",
                tabSize: 2,
                lineHeight: "1.7",
                caretColor: "oklch(0.76 0.16 158)",
              }}
              data-ocid="preview.editor"
            />
          </div>
        </div>
      )}
    </div>
  );
}
