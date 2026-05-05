import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "./useTermux";

const WORKER_URL =
  import.meta.env.VITE_CF_WORKER_URL ||
  "https://brainforge-api.richard-brown-miami.workers.dev";
const MAX_MEMORY_MESSAGES = 50;

// Build a fresh system prompt scoped to a specific project
function buildProjectSystemPrompt(
  projectName: string,
  rules: string,
  memory: string,
): string {
  return `You are the dedicated AI builder for project "${projectName}".
Your ONLY job is to build and improve this specific project.

## YOUR RULES
${rules}

## YOUR MEMORY (what you know about this project)
${memory || "No memory yet -- this is a fresh project."}

## HOW TO RESPOND
- Generate clean, complete HTML/CSS/JS or React code
- When building, return the full code inside a code block
- When fixing errors, return the corrected full code
- Keep track of what was built and what changed
- You do NOT help with other projects`;
}

async function loadFromWorker(
  scope: string,
): Promise<{ memory: string; rules: string; messageCount: number }> {
  try {
    const [memRes, rulesRes] = await Promise.all([
      fetch(`${WORKER_URL}/api/memory/${encodeURIComponent(scope)}`),
      fetch(`${WORKER_URL}/api/rules/${encodeURIComponent(scope)}`),
    ]);
    const memData = memRes.ok ? await memRes.json() : {};
    const rulesData = rulesRes.ok ? await rulesRes.json() : {};
    return {
      memory: memData.content || "",
      rules: rulesData.content || "",
      messageCount: memData.message_count || 0,
    };
  } catch {
    return { memory: "", rules: "", messageCount: 0 };
  }
}

async function saveMemoryToWorker(
  scope: string,
  messages: ChatMessage[],
  projectName: string,
) {
  try {
    // Build memory summary from messages
    const recentMessages = messages.slice(-MAX_MEMORY_MESSAGES);
    const summary = buildMemorySummary(recentMessages, projectName);
    await fetch(`${WORKER_URL}/api/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scope,
        content: summary,
        message_count: messages.length,
      }),
    });
  } catch {
    // Silent fail -- memory save is best effort
  }
}

function buildMemorySummary(
  messages: ChatMessage[],
  projectName: string,
): string {
  const now = new Date().toISOString();
  const userMessages = messages.filter((m) => m.role === "user");
  const assistantMessages = messages.filter((m) => m.role === "assistant");
  const lastUserMsg = userMessages[userMessages.length - 1]?.content || "";
  const lastAiMsg =
    assistantMessages[assistantMessages.length - 1]?.content || "";

  // Extract code blocks from assistant messages to know what was built
  const codeBlocks = assistantMessages
    .map((m) => {
      const match = m.content.match(/```[\w]*\n([\s\S]{1,200})/);
      return match ? match[1] : null;
    })
    .filter(Boolean);

  return `# Memory for project: ${projectName}
Last updated: ${now}
Total messages: ${messages.length}

## What was discussed
${userMessages
  .slice(-5)
  .map((m, i) => `- User message ${i + 1}: ${m.content.slice(0, 100)}`)
  .join("\n")}

## What was built
${codeBlocks.length > 0 ? `${codeBlocks.length} code generation(s) performed` : "No code generated yet"}

## Last exchange
User: ${lastUserMsg.slice(0, 200)}
AI: ${lastAiMsg.slice(0, 200)}

## Session history (${messages.length} messages total, showing last ${Math.min(messages.length, MAX_MEMORY_MESSAGES)})
${messages
  .slice(-10)
  .map((m) => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 80)}...`)
  .join("\n")}
`;
}

export function useOpenRouterChat(
  apiKey: string,
  model: string,
  projectName: string,
) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [memoryLoaded, setMemoryLoaded] = useState(false);
  const [rules, setRules] = useState("");
  const [memory, setMemory] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scope = `project-${projectName}`;

  // Load chat history + memory + rules on mount / project change
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setMemoryLoaded(false);
      setMessages([]);
      try {
        // Load saved chat messages from D1
        const msgRes = await fetch(
          `${WORKER_URL}/api/messages/${encodeURIComponent(projectName)}`,
        );
        const savedMessages: ChatMessage[] = msgRes.ok
          ? (await msgRes.json()).map((m: any) => ({
              role: m.role,
              content: m.content,
            }))
          : [];

        // Load memory + rules
        const { memory: mem, rules: rul } = await loadFromWorker(scope);

        if (!cancelled) {
          setMessages(savedMessages);
          setMemory(mem);
          setRules(rul);
          setMemoryLoaded(true);
        }
      } catch {
        if (!cancelled) setMemoryLoaded(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectName, scope]);

  // Auto-save memory after messages change (debounced 3s)
  useEffect(() => {
    if (!memoryLoaded || messages.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveMemoryToWorker(scope, messages, projectName);
    }, 3000);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [messages, memoryLoaded, scope, projectName]);

  const sendMessage = useCallback(
    async (message: string) => {
      setError(null);
      const userMsg: ChatMessage = { role: "user", content: message };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      // Check rules for conflicts before sending
      if (rules) {
        const notAllowedMatch = rules.match(
          /## NOT ALLOWED\n([\s\S]*?)(?:##|$)/,
        );
        if (notAllowedMatch) {
          const _restrictions = notAllowedMatch[1].toLowerCase();
          const msgLower = message.toLowerCase();
          if (
            (msgLower.includes("brainforge") && msgLower.includes("change")) ||
            (msgLower.includes("modify") && msgLower.includes("brainforge"))
          ) {
            setError(
              "⚠️ Rules conflict: Modifying BrainForge itself is not allowed for project AIs. Use Master AI in Settings instead.",
            );
            setIsLoading(false);
            return;
          }
        }
      }

      // Save user message to D1
      fetch(`${WORKER_URL}/api/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectName,
          role: "user",
          content: message,
        }),
      }).catch(() => {});

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        if (!apiKey)
          throw new Error(
            "No OpenRouter API key set. Add it in Settings > API.",
          );

        const systemPrompt = buildProjectSystemPrompt(
          projectName,
          rules,
          memory,
        );
        const history = messages
          .slice(-20)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch(
          "https://openrouter.ai/api/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://brainforge-7xn.pages.dev",
              "X-Title": "BrainForge",
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                ...history,
                { role: "user", content: message },
              ],
              stream: false,
            }),
            signal: abortRef.current.signal,
          },
        );

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const msg = err?.error?.message || `HTTP ${res.status}`;
          if (res.status === 401)
            throw new Error(
              "Invalid OpenRouter API key. Check Settings > API.",
            );
          if (res.status === 402)
            throw new Error("OpenRouter quota exceeded. Try a free model.");
          if (res.status === 429)
            throw new Error("Rate limited. Wait a moment and try again.");
          throw new Error(msg);
        }

        const data = await res.json();
        const reply: ChatMessage = {
          role: "assistant",
          content: data.choices?.[0]?.message?.content || "No response",
        };
        setMessages((prev) => [...prev, reply]);

        // Save AI reply to D1
        fetch(`${WORKER_URL}/api/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectName,
            role: "assistant",
            content: reply.content,
          }),
        }).catch(() => {});

        // Immediate memory save after AI responds
        setTimeout(() => {
          saveMemoryToWorker(scope, [...messages, userMsg, reply], projectName);
        }, 500);
      } catch (e: any) {
        if (e.name !== "AbortError") setError(e.message || "Request failed");
      } finally {
        setIsLoading(false);
      }
    },
    [apiKey, model, messages, projectName, rules, memory, scope],
  );

  const clearMessages = useCallback(async () => {
    setMessages([]);
    setError(null);
    // Clear from D1
    await fetch(
      `${WORKER_URL}/api/messages/${encodeURIComponent(projectName)}`,
      { method: "DELETE" },
    ).catch(() => {});
  }, [projectName]);

  const clearMemory = useCallback(async () => {
    setMemory("");
    await fetch(`${WORKER_URL}/api/memory/${encodeURIComponent(scope)}`, {
      method: "DELETE",
    }).catch(() => {});
  }, [scope]);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    clearMemory,
    memoryLoaded,
    rules,
    memory,
  };
}
