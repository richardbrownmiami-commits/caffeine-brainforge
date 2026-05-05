/**
 * storage.ts
 * IndexedDB-backed storage for large data (50MB+).
 * Falls back to localStorage for small settings.
 * Also handles GitHub session auto-save/restore.
 */

const DB_NAME = "brainforge";
const DB_VERSION = 1;
const STORE = "kv";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSet(key: string, value: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Fallback to localStorage
    try {
      localStorage.setItem(key, value);
    } catch {}
  }
}

export async function idbGet(key: string): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return localStorage.getItem(key);
  }
}

export async function idbRemove(key: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.removeItem(key);
  }
}

export async function idbKeys(): Promise<string[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return Object.keys(localStorage).filter((k) => k.startsWith("bf_"));
  }
}

/** Estimate storage used in bytes */
export async function estimateStorage(): Promise<{
  used: number;
  quota: number;
}> {
  try {
    const est = await navigator.storage.estimate();
    return { used: est.usage || 0, quota: est.quota || 50 * 1024 * 1024 };
  } catch {
    const lsSize = Object.keys(localStorage)
      .filter((k) => k.startsWith("bf_"))
      .reduce((acc, k) => acc + (localStorage.getItem(k) || "").length * 2, 0);
    return { used: lsSize, quota: 5 * 1024 * 1024 };
  }
}

// ---- GitHub Session Auto-Save / Restore ----

const GITHUB_TOKEN_KEY = "bf_settings";

function getGitHubCreds(): { token: string; repo: string } {
  try {
    const s = JSON.parse(localStorage.getItem(GITHUB_TOKEN_KEY) || "{}");
    return { token: s.githubToken || "", repo: s.githubRepo || "" };
  } catch {
    return { token: "", repo: "" };
  }
}

export async function pushSessionToGitHub(
  projectName: string,
  messages: unknown[],
): Promise<void> {
  const { token, repo } = getGitHubCreds();
  if (!token || !repo || messages.length === 0) return;

  const path = `sessions/${projectName}/session.json`;
  const content = JSON.stringify(
    { projectName, messages, savedAt: new Date().toISOString() },
    null,
    2,
  );

  try {
    // Get existing sha
    const getRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/${path}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const sha = getRes.ok ? (await getRes.json()).sha : undefined;

    await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: `session: ${projectName}`,
        content: btoa(unescape(encodeURIComponent(content))),
        ...(sha ? { sha } : {}),
      }),
    });
  } catch {
    // Silent fail -- session push is best effort
  }
}

export async function pullSessionFromGitHub(
  projectName: string,
): Promise<unknown[] | null> {
  const { token, repo } = getGitHubCreds();
  if (!token || !repo) return null;

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/contents/sessions/${projectName}/session.json`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const decoded = JSON.parse(atob(data.content.replace(/\n/g, "")));
    return decoded.messages || null;
  } catch {
    return null;
  }
}
