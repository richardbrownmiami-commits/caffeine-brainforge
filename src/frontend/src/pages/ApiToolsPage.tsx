import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface HeaderPair {
  id: string;
  key: string;
  value: string;
}

interface HttpHistoryItem {
  id: string;
  method: HttpMethod;
  url: string;
  status: number | null;
  statusText: string;
  responseTime: number;
  timestamp: string;
  responseBody: string;
  responseHeaders: Record<string, string>;
  error?: string;
}

interface PingResult {
  id: string;
  url: string;
  online: boolean;
  status: number | null;
  responseTime: number;
  timestamp: string;
  error?: string;
}

type ApiStatusState = "unknown" | "checking" | "online" | "offline";

interface ApiEndpoint {
  id: string;
  name: string;
  url: string;
  headers?: Record<string, string>;
  status: ApiStatusState;
  responseTime: number | null;
  lastChecked: string | null;
  custom?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function now() {
  return new Date().toLocaleTimeString();
}

function statusColor(status: number | null | undefined): string {
  if (!status) return "bg-muted text-muted-foreground";
  if (status >= 200 && status < 300)
    return "bg-primary/20 text-primary border border-primary/30";
  if (status >= 300 && status < 400)
    return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
  return "bg-destructive/20 text-destructive border border-destructive/30";
}

function statusLabel(
  status: number | null | undefined,
  error?: string,
): string {
  if (error && !status) return "Error";
  if (!status) return "—";
  return String(status);
}

// ─── HTTP Call Tab ────────────────────────────────────────────────────────────

function HttpCallTab() {
  const [url, setUrl] = useState("https://");
  const [method, setMethod] = useState<HttpMethod>("GET");
  const [headers, setHeaders] = useState<HeaderPair[]>([]);
  const [body, setBody] = useState("");
  const [showHeaders, setShowHeaders] = useState(false);
  const [showBody, setShowBody] = useState(false);
  const [showRespHeaders, setShowRespHeaders] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<HttpHistoryItem | null>(null);
  const [history, setHistory] = useState<HttpHistoryItem[]>([]);

  const bodyAllowed = ["POST", "PUT", "PATCH"].includes(method);

  function addHeader() {
    setHeaders((h) => [...h, { id: uid(), key: "", value: "" }]);
  }

  function updateHeader(id: string, field: "key" | "value", val: string) {
    setHeaders((h) => h.map((r) => (r.id === id ? { ...r, [field]: val } : r)));
  }

  function removeHeader(id: string) {
    setHeaders((h) => h.filter((r) => r.id !== id));
  }

  async function sendRequest() {
    if (!url || url === "https://") return;
    setLoading(true);
    const start = Date.now();
    const reqHeaders: Record<string, string> = {};
    for (const { key, value } of headers) {
      if (key) reqHeaders[key] = value;
    }

    try {
      const init: RequestInit = { method, headers: reqHeaders };
      if (bodyAllowed && body) init.body = body;
      const res = await fetch(url, init);
      const elapsed = Date.now() - start;
      const text = await res.text().catch(() => "");
      const respHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => {
        respHeaders[k] = v;
      });

      const item: HttpHistoryItem = {
        id: uid(),
        method,
        url,
        status: res.status,
        statusText: res.statusText,
        responseTime: elapsed,
        timestamp: now(),
        responseBody: text,
        responseHeaders: respHeaders,
      };
      setResponse(item);
      setHistory((h) => [item, ...h].slice(0, 10));
    } catch (err) {
      const elapsed = Date.now() - start;
      const item: HttpHistoryItem = {
        id: uid(),
        method,
        url,
        status: null,
        statusText: "",
        responseTime: elapsed,
        timestamp: now(),
        responseBody: "",
        responseHeaders: {},
        error: String(err),
      };
      setResponse(item);
      setHistory((h) => [item, ...h].slice(0, 10));
    } finally {
      setLoading(false);
    }
  }

  function restoreFromHistory(item: HttpHistoryItem) {
    setUrl(item.url);
    setMethod(item.method);
    setResponse(item);
  }

  function copyResponse() {
    if (response?.responseBody)
      navigator.clipboard.writeText(response.responseBody);
  }

  return (
    <div className="space-y-4">
      {/* URL + Method + Send */}
      <div className="flex gap-2">
        <Select
          value={method}
          onValueChange={(v) => setMethod(v as HttpMethod)}
        >
          <SelectTrigger
            className="w-32 shrink-0"
            data-ocid="httpcall.method_select"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(["GET", "POST", "PUT", "DELETE", "PATCH"] as HttpMethod[]).map(
              (m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com/endpoint"
          className="flex-1 font-mono text-sm"
          data-ocid="httpcall.url_input"
          onKeyDown={(e) => e.key === "Enter" && sendRequest()}
        />
        <Button
          onClick={sendRequest}
          disabled={loading}
          data-ocid="httpcall.send_button"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="ml-1 hidden sm:inline">
            {loading ? "Sending…" : "Send"}
          </span>
        </Button>
      </div>

      {/* Headers section */}
      <Card className="bg-card border-border">
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-accent/30 transition-colors rounded-t-md"
          onClick={() => setShowHeaders((s) => !s)}
          data-ocid="httpcall.headers_toggle"
        >
          <span>
            Request Headers{" "}
            {headers.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {headers.length}
              </Badge>
            )}
          </span>
          {showHeaders ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
        {showHeaders && (
          <CardContent className="pt-0 pb-3 space-y-2">
            {headers.map((h, i) => (
              <div
                key={h.id}
                className="flex gap-2"
                data-ocid={`httpcall.header.${i + 1}`}
              >
                <Input
                  placeholder="Key"
                  value={h.key}
                  onChange={(e) => updateHeader(h.id, "key", e.target.value)}
                  className="flex-1 text-sm"
                />
                <Input
                  placeholder="Value"
                  value={h.value}
                  onChange={(e) => updateHeader(h.id, "value", e.target.value)}
                  className="flex-1 text-sm"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeHeader(h.id)}
                  data-ocid={`httpcall.remove_header_button.${i + 1}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addHeader}
              data-ocid="httpcall.add_header_button"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Header
            </Button>
          </CardContent>
        )}
      </Card>

      {/* Body section */}
      {bodyAllowed && (
        <Card className="bg-card border-border">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-accent/30 transition-colors rounded-t-md"
            onClick={() => setShowBody((s) => !s)}
            data-ocid="httpcall.body_toggle"
          >
            <span>Request Body</span>
            {showBody ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          {showBody && (
            <CardContent className="pt-0 pb-3">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder='{"key": "value"}'
                className="font-mono text-sm min-h-[120px]"
                data-ocid="httpcall.body_textarea"
              />
            </CardContent>
          )}
        </Card>
      )}

      {/* Response */}
      {response && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge className={statusColor(response.status)}>
                  {statusLabel(response.status, response.error)}
                </Badge>
                {response.status && (
                  <span className="text-sm text-muted-foreground">
                    {response.statusText}
                  </span>
                )}
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {response.responseTime}ms
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={copyResponse}
                data-ocid="httpcall.copy_response_button"
              >
                <Copy className="h-4 w-4 mr-1" /> Copy
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {response.error && (
              <div
                className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-sm text-destructive"
                data-ocid="httpcall.error_state"
              >
                {response.error}
              </div>
            )}

            {Object.keys(response.responseHeaders).length > 0 && (
              <div>
                <button
                  type="button"
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1 transition-colors"
                  onClick={() => setShowRespHeaders((s) => !s)}
                  data-ocid="httpcall.resp_headers_toggle"
                >
                  {showRespHeaders ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                  Response Headers (
                  {Object.keys(response.responseHeaders).length})
                </button>
                {showRespHeaders && (
                  <div className="rounded-md bg-muted/40 border border-border p-2 space-y-1">
                    {Object.entries(response.responseHeaders).map(([k, v]) => (
                      <div key={k} className="text-xs font-mono flex gap-2">
                        <span className="text-primary shrink-0">{k}:</span>
                        <span className="text-muted-foreground break-all">
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {response.responseBody && (
              <ScrollArea className="max-h-[400px] rounded-md bg-muted/30 border border-border p-3">
                <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-all">
                  {(() => {
                    try {
                      return JSON.stringify(
                        JSON.parse(response.responseBody),
                        null,
                        2,
                      );
                    } catch {
                      return response.responseBody;
                    }
                  })()}
                </pre>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
            History
          </p>
          <div className="space-y-1" data-ocid="httpcall.history_list">
            {history.map((item, i) => (
              <button
                key={item.id}
                type="button"
                className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent/30 transition-colors text-left"
                onClick={() => restoreFromHistory(item)}
                data-ocid={`httpcall.history.${i + 1}`}
              >
                <span className="shrink-0 font-mono text-xs text-primary w-14">
                  {item.method}
                </span>
                <span className="flex-1 truncate text-muted-foreground font-mono text-xs min-w-0">
                  {item.url}
                </span>
                <Badge
                  className={`shrink-0 text-xs ${statusColor(item.status)}`}
                >
                  {statusLabel(item.status, item.error)}
                </Badge>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {item.responseTime}ms
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {item.timestamp}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ping Tab ────────────────────────────────────────────────────────────────

const QUICK_PINGS = [
  {
    label: "BrainForge Worker",
    url: "https://brainforge-api.richard-brown-miami.workers.dev",
  },
  {
    label: "ShipMyWheels Worker",
    url: "https://shipmywheels-api.richard-brown-miami.workers.dev",
  },
];

function PingTab() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [latest, setLatest] = useState<PingResult | null>(null);
  const [history, setHistory] = useState<PingResult[]>([]);
  const [autoPing, setAutoPing] = useState(false);
  const [countdown, setCountdown] = useState(30);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const ping = useCallback(
    async (targetUrl?: string) => {
      const pingUrl = targetUrl ?? url;
      if (!pingUrl) return;
      setLoading(true);
      const start = Date.now();
      let online = false;
      let status: number | null = null;
      let error: string | undefined;

      try {
        const res = await fetch(pingUrl, {
          method: "HEAD",
          signal: AbortSignal.timeout(8000),
        });
        online = true;
        status = res.status;
      } catch {
        try {
          await fetch(pingUrl, {
            method: "HEAD",
            mode: "no-cors",
            signal: AbortSignal.timeout(8000),
          });
          online = true;
        } catch (e2) {
          online = false;
          error = String(e2);
        }
      }

      const elapsed = Date.now() - start;
      const result: PingResult = {
        id: uid(),
        url: pingUrl,
        online,
        status,
        responseTime: elapsed,
        timestamp: now(),
        error,
      };
      setLatest(result);
      setHistory((h) => [result, ...h].slice(0, 5));
      setLoading(false);
    },
    [url],
  );

  useEffect(() => {
    if (autoPing) {
      setCountdown(30);
      timerRef.current = setInterval(() => {
        ping();
        setCountdown(30);
      }, 30000);
      countRef.current = setInterval(
        () => setCountdown((c) => (c > 0 ? c - 1 : 30)),
        1000,
      );
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countRef.current) clearInterval(countRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countRef.current) clearInterval(countRef.current);
    };
  }, [autoPing, ping]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {QUICK_PINGS.map((q) => (
          <Button
            key={q.url}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setUrl(q.url);
              ping(q.url);
            }}
            data-ocid={`ping.quick_${q.label.toLowerCase().replace(/\s+/g, "_")}_button`}
          >
            <Globe className="h-3 w-3 mr-1" />
            {q.label}
          </Button>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="flex-1 font-mono text-sm"
          data-ocid="ping.url_input"
          onKeyDown={(e) => e.key === "Enter" && ping()}
        />
        <Button
          type="button"
          onClick={() => ping()}
          disabled={loading}
          data-ocid="ping.ping_button"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-1">{loading ? "Pinging…" : "Ping"}</span>
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          checked={autoPing}
          onCheckedChange={setAutoPing}
          data-ocid="ping.auto_ping_toggle"
        />
        <span className="text-sm text-muted-foreground">
          Auto-ping every 30s
          {autoPing && (
            <span className="ml-2 text-primary font-mono">({countdown}s)</span>
          )}
        </span>
      </div>

      {latest && (
        <Card className="bg-card border-border">
          <CardContent className="pt-5">
            <div className="flex flex-col items-center gap-3 py-2">
              {latest.online ? (
                <CheckCircle className="h-12 w-12 text-primary" />
              ) : (
                <XCircle className="h-12 w-12 text-destructive" />
              )}
              <div className="text-center">
                <p
                  className={`text-xl font-bold ${latest.online ? "text-primary" : "text-destructive"}`}
                >
                  {latest.online ? "Online" : "Offline"}
                </p>
                <p className="text-sm text-muted-foreground font-mono mt-1 break-all">
                  {latest.url}
                </p>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-mono">{latest.responseTime}ms</span>
                </span>
                {latest.status && (
                  <Badge className={statusColor(latest.status)}>
                    {latest.status}
                  </Badge>
                )}
                <span className="text-muted-foreground">
                  Pinged at {latest.timestamp}
                </span>
              </div>
              {latest.error && (
                <p
                  className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2 text-center"
                  data-ocid="ping.error_state"
                >
                  {latest.error}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {history.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">
            Recent Pings
          </p>
          <div className="space-y-1" data-ocid="ping.history_list">
            {history.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-md px-3 py-2 bg-muted/20 border border-border"
                data-ocid={`ping.history.${i + 1}`}
              >
                {item.online ? (
                  <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-destructive" />
                )}
                <span className="flex-1 truncate text-sm font-mono text-muted-foreground min-w-0">
                  {item.url}
                </span>
                {item.status && (
                  <Badge
                    className={`shrink-0 text-xs ${statusColor(item.status)}`}
                  >
                    {item.status}
                  </Badge>
                )}
                <span className="shrink-0 text-xs font-mono text-muted-foreground">
                  {item.responseTime}ms
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {item.timestamp}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── API Status Tab ───────────────────────────────────────────────────────────

const PRESET_APIS: Omit<
  ApiEndpoint,
  "status" | "responseTime" | "lastChecked"
>[] = [
  {
    id: "bf-worker",
    name: "BrainForge Worker",
    url: "https://brainforge-api.richard-brown-miami.workers.dev",
    headers: { "X-BrainForge-Secret": "2200" },
  },
  {
    id: "bf-frontend",
    name: "BrainForge Frontend",
    url: "https://brainforge-7xn.pages.dev",
  },
  {
    id: "smw-worker",
    name: "ShipMyWheels Worker",
    url: "https://shipmywheels-api.richard-brown-miami.workers.dev",
    headers: { "X-SMW-Secret": "SMW2200" },
  },
  {
    id: "smw-frontend",
    name: "ShipMyWheels Frontend",
    url: "https://shipmywheels.pages.dev",
  },
];

const INTERVALS = [
  { label: "30s", value: 30000 },
  { label: "1 min", value: 60000 },
  { label: "5 min", value: 300000 },
];

function initPresets(): ApiEndpoint[] {
  return PRESET_APIS.map((p) => ({
    ...p,
    status: "unknown" as ApiStatusState,
    responseTime: null,
    lastChecked: null,
  }));
}

function loadCustomUrls(): ApiEndpoint[] {
  try {
    const raw = localStorage.getItem("bf_api_status_custom_urls");
    if (!raw) return [];
    return JSON.parse(raw) as ApiEndpoint[];
  } catch {
    return [];
  }
}

function saveCustomUrls(list: ApiEndpoint[]) {
  localStorage.setItem("bf_api_status_custom_urls", JSON.stringify(list));
}

function ApiStatusTab() {
  const [presets, setPresets] = useState<ApiEndpoint[]>(initPresets);
  const [customs, setCustoms] = useState<ApiEndpoint[]>(loadCustomUrls);
  const [newUrl, setNewUrl] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [intervalMs, setIntervalMs] = useState(30000);
  const [countdown, setCountdown] = useState(30);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkOne = useCallback(async (id: string, allApis: ApiEndpoint[]) => {
    const isPreset = PRESET_APIS.some((p) => p.id === id);
    const setter = isPreset ? setPresets : setCustoms;
    setter((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, status: "checking" as ApiStatusState } : e,
      ),
    );

    const endpoint = allApis.find((a) => a.id === id);
    if (!endpoint) return;

    const start = Date.now();
    let status: ApiStatusState = "offline";
    let responseTime: number | null = null;

    try {
      const res = await fetch(endpoint.url, {
        method: "GET",
        headers: endpoint.headers ?? {},
        signal: AbortSignal.timeout(10000),
      });
      responseTime = Date.now() - start;
      status = res.status >= 200 && res.status < 400 ? "online" : "offline";
    } catch {
      try {
        await fetch(endpoint.url, {
          method: "HEAD",
          mode: "no-cors",
          signal: AbortSignal.timeout(10000),
        });
        responseTime = Date.now() - start;
        status = "online";
      } catch {
        responseTime = Date.now() - start;
        status = "offline";
      }
    }

    const checked = now();
    setter((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, status, responseTime, lastChecked: checked } : e,
      ),
    );
  }, []);

  const checkApi = useCallback(
    (id: string) => {
      checkOne(id, [...presets, ...customs]);
    },
    [presets, customs, checkOne],
  );

  const checkAll = useCallback(() => {
    const all = [...presets, ...customs];
    for (const a of all) {
      checkOne(a.id, all);
    }
  }, [presets, customs, checkOne]);

  useEffect(() => {
    if (autoRefresh) {
      const secs = Math.floor(intervalMs / 1000);
      setCountdown(secs);
      timerRef.current = setInterval(() => {
        checkAll();
        setCountdown(secs);
      }, intervalMs);
      countRef.current = setInterval(
        () => setCountdown((c) => (c > 0 ? c - 1 : secs)),
        1000,
      );
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countRef.current) clearInterval(countRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countRef.current) clearInterval(countRef.current);
    };
  }, [autoRefresh, intervalMs, checkAll]);

  function addCustom() {
    if (!newUrl) return;
    const entry: ApiEndpoint = {
      id: uid(),
      name: newUrl.replace(/^https?:\/\//, "").split("/")[0],
      url: newUrl,
      status: "unknown",
      responseTime: null,
      lastChecked: null,
      custom: true,
    };
    const next = [...customs, entry];
    setCustoms(next);
    saveCustomUrls(next);
    setNewUrl("");
  }

  function removeCustom(id: string) {
    const next = customs.filter((c) => c.id !== id);
    setCustoms(next);
    saveCustomUrls(next);
  }

  function statusBadgeClass(s: ApiStatusState) {
    switch (s) {
      case "online":
        return "bg-primary/20 text-primary border border-primary/30";
      case "offline":
        return "bg-destructive/20 text-destructive border border-destructive/30";
      case "checking":
        return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  }

  const allApis = [...presets, ...customs];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={autoRefresh}
            onCheckedChange={setAutoRefresh}
            data-ocid="status.auto_refresh_toggle"
          />
          <span className="text-sm text-muted-foreground">
            Auto-refresh
            {autoRefresh && (
              <span className="ml-2 text-primary font-mono">
                ({countdown}s)
              </span>
            )}
          </span>
        </div>
        <Select
          value={String(intervalMs)}
          onValueChange={(v) => setIntervalMs(Number(v))}
        >
          <SelectTrigger className="w-28" data-ocid="status.interval_select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INTERVALS.map((i) => (
              <SelectItem key={i.value} value={String(i.value)}>
                {i.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={checkAll}
          data-ocid="status.check_all_button"
        >
          <RefreshCw className="h-4 w-4 mr-1" /> Check All
        </Button>
      </div>

      <div className="space-y-3" data-ocid="status.api_list">
        {allApis.map((api, i) => (
          <Card
            key={api.id}
            className="bg-card border-border"
            data-ocid={`status.api.${i + 1}`}
          >
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium text-sm text-foreground">
                      {api.name}
                    </span>
                    {api.custom && (
                      <Badge variant="secondary" className="text-xs">
                        Custom
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs font-mono text-muted-foreground truncate">
                    {api.url}
                  </p>
                  {api.lastChecked && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last checked: {api.lastChecked}
                      {api.responseTime !== null && (
                        <span className="ml-2 font-mono">
                          {api.responseTime}ms
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={statusBadgeClass(api.status)}>
                    {api.status === "checking" ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        Checking
                      </>
                    ) : api.status === "online" ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Online
                      </>
                    ) : api.status === "offline" ? (
                      <>
                        <XCircle className="h-3 w-3 mr-1" />
                        Offline
                      </>
                    ) : (
                      "Unknown"
                    )}
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => checkApi(api.id)}
                    disabled={api.status === "checking"}
                    data-ocid={`status.check_button.${i + 1}`}
                  >
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                  {api.custom && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCustom(api.id)}
                      data-ocid={`status.remove_button.${i + 1}`}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Add Custom URL
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2">
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://my-api.example.com"
              className="flex-1 font-mono text-sm"
              data-ocid="status.custom_url_input"
              onKeyDown={(e) => e.key === "Enter" && addCustom()}
            />
            <Button
              type="button"
              onClick={addCustom}
              data-ocid="status.add_custom_button"
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ApiToolsPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6" data-ocid="api_tools.page">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 border border-primary/30">
          <Zap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">API Tools</h1>
          <p className="text-sm text-muted-foreground">
            HTTP calls, ping, and status monitoring
          </p>
        </div>
      </div>

      <Tabs defaultValue="http" data-ocid="api_tools.tabs">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="http" data-ocid="api_tools.http_tab">
            HTTP Call
          </TabsTrigger>
          <TabsTrigger value="ping" data-ocid="api_tools.ping_tab">
            Ping
          </TabsTrigger>
          <TabsTrigger value="status" data-ocid="api_tools.status_tab">
            API Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="http" className="mt-4">
          <HttpCallTab />
        </TabsContent>

        <TabsContent value="ping" className="mt-4">
          <PingTab />
        </TabsContent>

        <TabsContent value="status" className="mt-4">
          <ApiStatusTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
