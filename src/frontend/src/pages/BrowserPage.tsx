import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  Clipboard,
  ClipboardPaste,
  ExternalLink,
  Globe,
  Maximize2,
  Minimize2,
  RotateCcw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type PanelId = "A" | "B";

interface PanelState {
  url: string;
  inputUrl: string;
  history: string[];
  historyIndex: number;
  isLoading: boolean;
  hasError: boolean;
}

interface ClipboardState {
  text: string;
  source: PanelId | null;
  timestamp: number;
}

const INITIAL_PANEL: PanelState = {
  url: "",
  inputUrl: "",
  history: [],
  historyIndex: -1,
  isLoading: false,
  hasError: false,
};

function BrowserPanel({
  panelId,
  state,
  onNavigate,
  onBack,
  onForward,
  onRefresh,
  onMaximize,
  onInputChange,
  onLoad,
  onError,
  isMaximized,
  otherMaximized,
}: {
  panelId: PanelId;
  state: PanelState;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onRefresh: () => void;
  onMaximize: () => void;
  onInputChange: (val: string) => void;
  onLoad: () => void;
  onError: () => void;
  isMaximized: boolean;
  otherMaximized: boolean;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const canBack = state.historyIndex > 0;
  const canForward = state.historyIndex < state.history.length - 1;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      let url = state.inputUrl.trim();
      if (!url) return;
      if (
        !url.startsWith("http://") &&
        !url.startsWith("https://") &&
        url !== "about:blank"
      ) {
        url = `https://${url}`;
      }
      onNavigate(url);
    }
  };

  const handleRefresh = () => {
    if (iframeRef.current && state.url) {
      iframeRef.current.src = state.url;
    }
    onRefresh();
  };

  if (otherMaximized) return null;

  return (
    <div className="flex flex-col flex-1 min-w-0 bg-card border border-border rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-card border-b border-border shrink-0">
        <Badge
          variant="outline"
          className="text-xs shrink-0 font-mono text-primary border-primary/40"
        >
          Panel {panelId}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onBack}
          disabled={!canBack}
          aria-label="Back"
          data-ocid={`browser.panel_${panelId.toLowerCase()}.back_button`}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onForward}
          disabled={!canForward}
          aria-label="Forward"
          data-ocid={`browser.panel_${panelId.toLowerCase()}.forward_button`}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={handleRefresh}
          disabled={!state.url}
          aria-label="Refresh"
          data-ocid={`browser.panel_${panelId.toLowerCase()}.refresh_button`}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Input
          value={state.inputUrl}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter URL and press Enter..."
          className="h-7 text-sm bg-background font-mono flex-1 min-w-0"
          data-ocid={`browser.panel_${panelId.toLowerCase()}.input`}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={onMaximize}
          aria-label={isMaximized ? "Restore" : "Maximize"}
          data-ocid={`browser.panel_${panelId.toLowerCase()}.maximize_button`}
        >
          {isMaximized ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={() => state.url && window.open(state.url, "_blank")}
          disabled={!state.url}
          aria-label="Open in new tab"
          data-ocid={`browser.panel_${panelId.toLowerCase()}.open_tab_button`}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>

      {/* Iframe area */}
      <div className="relative flex-1 min-h-0">
        {!state.url && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <Globe className="h-12 w-12 opacity-30" />
            <p className="text-sm">Enter a URL above to start browsing</p>
          </div>
        )}

        {state.isLoading && state.url && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
            <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        )}

        {state.hasError && state.url && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-card">
            <Card className="p-6 max-w-sm text-center border-border">
              <p className="text-sm font-medium text-foreground mb-1">
                This site blocks embedding.
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                The page has set security headers that prevent it from loading
                in a frame.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.open(state.url, "_blank")}
                className="gap-2"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open in new tab &rarr;
              </Button>
            </Card>
          </div>
        )}

        {state.url && !state.hasError && (
          <iframe
            ref={iframeRef}
            src={state.url}
            title={`Panel ${panelId}`}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
            onLoad={onLoad}
            onError={onError}
            data-ocid={`browser.panel_${panelId.toLowerCase()}.canvas_target`}
          />
        )}
      </div>
    </div>
  );
}

export default function BrowserPage() {
  const [panelA, setPanelA] = useState<PanelState>({ ...INITIAL_PANEL });
  const [panelB, setPanelB] = useState<PanelState>({ ...INITIAL_PANEL });
  const [maximized, setMaximized] = useState<PanelId | null>(null);
  const [clipboard, setClipboard] = useState<ClipboardState>({
    text: "",
    source: null,
    timestamp: 0,
  });
  const [pasteFeedback, setPasteFeedback] = useState<string | null>(null);

  // unused ref kept to satisfy exhaustive-deps in navigate
  const _navigateRef = useRef(null);
  void _navigateRef;

  const setPanel = useCallback(
    (id: PanelId) => (id === "A" ? setPanelA : setPanelB),
    [],
  );

  const navigate = useCallback(
    (id: PanelId, url: string) => {
      setPanel(id)((prev) => {
        const newHistory = [
          ...prev.history.slice(0, prev.historyIndex + 1),
          url,
        ];
        return {
          ...prev,
          url,
          inputUrl: url,
          history: newHistory,
          historyIndex: newHistory.length - 1,
          isLoading: true,
          hasError: false,
        };
      });
    },
    [setPanel],
  );

  const goBack = useCallback(
    (id: PanelId) => {
      setPanel(id)((prev) => {
        if (prev.historyIndex <= 0) return prev;
        const newIndex = prev.historyIndex - 1;
        const url = prev.history[newIndex];
        return {
          ...prev,
          url,
          inputUrl: url,
          historyIndex: newIndex,
          isLoading: true,
          hasError: false,
        };
      });
    },
    [setPanel],
  );

  const goForward = useCallback(
    (id: PanelId) => {
      setPanel(id)((prev) => {
        if (prev.historyIndex >= prev.history.length - 1) return prev;
        const newIndex = prev.historyIndex + 1;
        const url = prev.history[newIndex];
        return {
          ...prev,
          url,
          inputUrl: url,
          historyIndex: newIndex,
          isLoading: true,
          hasError: false,
        };
      });
    },
    [setPanel],
  );

  const onLoad = useCallback(
    (id: PanelId) => setPanel(id)((prev) => ({ ...prev, isLoading: false })),
    [setPanel],
  );

  const onError = useCallback(
    (id: PanelId) =>
      setPanel(id)((prev) => ({ ...prev, isLoading: false, hasError: true })),
    [setPanel],
  );

  const onRefresh = useCallback(
    (id: PanelId) =>
      setPanel(id)((prev) => ({ ...prev, isLoading: true, hasError: false })),
    [setPanel],
  );

  const toggleMaximize = (id: PanelId) =>
    setMaximized((prev) => (prev === id ? null : id));

  // Selection-based clipboard detection
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;
      const text = selection.toString().trim();
      if (text.length > 0) {
        setClipboard({ text, source: null, timestamp: Date.now() });
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", handleSelectionChange);
  }, []);

  const copyFromPanel = useCallback(async (id: PanelId) => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setClipboard({ text, source: id, timestamp: Date.now() });
      }
    } catch {
      // Clipboard read permission denied; user needs to copy manually
    }
  }, []);

  const pasteToPanel = useCallback(
    async (targetId: PanelId) => {
      if (!clipboard.text) return;
      try {
        await navigator.clipboard.writeText(clipboard.text);
      } catch {
        // ignore write errors
      }
      setPasteFeedback(
        `Text copied to clipboard. Click a text field in Panel ${targetId}, then press Ctrl+V (Cmd+V on Mac) to paste.`,
      );
      setTimeout(() => setPasteFeedback(null), 5000);
    },
    [clipboard.text],
  );

  const copyClipboardToSystem = useCallback(async () => {
    if (!clipboard.text) return;
    try {
      await navigator.clipboard.writeText(clipboard.text);
      setPasteFeedback("Copied to clipboard!");
      setTimeout(() => setPasteFeedback(null), 2000);
    } catch {
      // ignore
    }
  }, [clipboard.text]);

  return (
    <div
      className="flex flex-col h-[calc(100vh-4rem)] p-2 gap-2"
      data-ocid="browser.page"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          <h1 className="text-sm font-semibold text-foreground">
            Dual Panel Browser
          </h1>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Sandbox Mode
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground hidden sm:block">
          Sites blocking iframe embedding will show an error with an open-in-tab
          link.
        </p>
      </div>

      {/* Panels + clipboard overlay */}
      <div className="relative flex flex-row flex-1 min-h-0 gap-1">
        <BrowserPanel
          panelId="A"
          state={panelA}
          onNavigate={(url) => navigate("A", url)}
          onBack={() => goBack("A")}
          onForward={() => goForward("A")}
          onRefresh={() => onRefresh("A")}
          onMaximize={() => toggleMaximize("A")}
          onInputChange={(val) => setPanelA((p) => ({ ...p, inputUrl: val }))}
          onLoad={() => onLoad("A")}
          onError={() => onError("A")}
          isMaximized={maximized === "A"}
          otherMaximized={maximized === "B"}
        />

        {!maximized && <div className="w-px bg-border shrink-0 self-stretch" />}

        <BrowserPanel
          panelId="B"
          state={panelB}
          onNavigate={(url) => navigate("B", url)}
          onBack={() => goBack("B")}
          onForward={() => goForward("B")}
          onRefresh={() => onRefresh("B")}
          onMaximize={() => toggleMaximize("B")}
          onInputChange={(val) => setPanelB((p) => ({ ...p, inputUrl: val }))}
          onLoad={() => onLoad("B")}
          onError={() => onError("B")}
          isMaximized={maximized === "B"}
          otherMaximized={maximized === "A"}
        />

        {/* Floating clipboard relay bar — centered between panels */}
        {!maximized && (
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1.5 pointer-events-none"
            data-ocid="browser.clipboard_relay.panel"
          >
            <Card className="bg-card/95 backdrop-blur-sm border-border shadow-lg px-3 py-2.5 flex flex-col items-center gap-2 w-[200px] pointer-events-auto">
              <div className="flex items-center gap-1.5">
                <Clipboard className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground">
                  Clipboard Relay
                </span>
              </div>

              {clipboard.text ? (
                <>
                  <div className="w-full">
                    {clipboard.source && (
                      <p className="text-[10px] text-muted-foreground mb-0.5">
                        From Panel {clipboard.source}
                      </p>
                    )}
                    <p className="text-xs text-foreground font-mono bg-background rounded px-1.5 py-1 truncate">
                      {clipboard.text.slice(0, 50)}
                      {clipboard.text.length > 50 ? "\u2026" : ""}
                    </p>
                  </div>

                  <div className="flex gap-1 w-full">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 h-6 text-[10px] px-1.5 gap-0.5"
                      onClick={() => pasteToPanel("A")}
                      disabled={clipboard.source === "A"}
                      data-ocid="browser.clipboard_relay.paste_a_button"
                    >
                      <ClipboardPaste className="h-3 w-3" />
                      &rarr; A
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="flex-none h-6 w-6 p-0"
                      onClick={copyClipboardToSystem}
                      aria-label="Copy to system clipboard"
                      data-ocid="browser.clipboard_relay.copy_button"
                    >
                      <Clipboard className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 h-6 text-[10px] px-1.5 gap-0.5"
                      onClick={() => pasteToPanel("B")}
                      disabled={clipboard.source === "B"}
                      data-ocid="browser.clipboard_relay.paste_b_button"
                    >
                      B &larr;
                      <ClipboardPaste className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                  Select text on the page, or use Capture buttons to read
                  clipboard.
                </p>
              )}

              {/* Manual capture */}
              <div className="flex gap-1 w-full">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="flex-1 h-6 text-[10px] px-1"
                  onClick={() => copyFromPanel("A")}
                  data-ocid="browser.clipboard_relay.capture_a_button"
                >
                  Capture A
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="flex-1 h-6 text-[10px] px-1"
                  onClick={() => copyFromPanel("B")}
                  data-ocid="browser.clipboard_relay.capture_b_button"
                >
                  Capture B
                </Button>
              </div>
            </Card>

            {pasteFeedback && (
              <div
                className="bg-primary/10 border border-primary/30 rounded px-3 py-2 max-w-[240px] pointer-events-auto"
                data-ocid="browser.clipboard_relay.toast"
              >
                <p className="text-[11px] text-primary text-center">
                  {pasteFeedback}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
