import { useCallback, useEffect, useRef, useState } from "react";

export interface TermuxStatus {
  connected: boolean;
  checking: boolean;
  lastChecked: Date | null;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function useTermuxStatus(termuxUrl: string) {
  const [status, setStatus] = useState<TermuxStatus>({
    connected: false,
    checking: false,
    lastChecked: null,
  });

  const check = useCallback(async () => {
    if (!termuxUrl) return;
    setStatus((s) => ({ ...s, checking: true }));
    try {
      const res = await fetch(`${termuxUrl}/api/status`, {
        signal: AbortSignal.timeout(5000),
      });
      const data = await res.json();
      setStatus({
        connected: !!data?.ok,
        checking: false,
        lastChecked: new Date(),
      });
    } catch {
      setStatus({ connected: false, checking: false, lastChecked: new Date() });
    }
  }, [termuxUrl]);

  useEffect(() => {
    if (!termuxUrl) return;
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, [termuxUrl, check]);

  return { ...status, recheck: check };
}

export function useTermuxChat(termuxUrl: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (message: string, projectName: string) => {
      if (!termuxUrl) {
        setError("Termux URL not configured. Go to Settings.");
        return;
      }
      setError(null);
      const userMsg: ChatMessage = { role: "user", content: message };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        const res = await fetch(`${termuxUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, history, projectName }),
          signal: abortRef.current.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const reply: ChatMessage = {
          role: "assistant",
          content: data.reply || data.error || "No reply",
        };
        setMessages((prev) => [...prev, reply]);
      } catch (e: any) {
        if (e.name !== "AbortError") {
          setError(e.message || "Connection failed");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [termuxUrl, messages],
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, isLoading, error, sendMessage, clearMessages };
}

export async function termuxWriteFile(
  termuxUrl: string,
  project: string,
  filename: string,
  content: string,
): Promise<void> {
  await fetch(`${termuxUrl}/api/files/write`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, filename, content }),
  });
}

export async function termuxReadFile(
  termuxUrl: string,
  project: string,
  file: string,
): Promise<string> {
  const res = await fetch(
    `${termuxUrl}/api/files/read?project=${encodeURIComponent(project)}&file=${encodeURIComponent(file)}`,
  );
  const data = await res.json();
  return data.content || "";
}

export async function termuxRunCommand(
  termuxUrl: string,
  command: string,
  project: string,
): Promise<{ output: string; success: boolean }> {
  const res = await fetch(`${termuxUrl}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, project }),
  });
  return res.json();
}
