import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

// ── Types ────────────────────────────────────────────────────────────────────
export interface ChatThread {
  id: string;
  title: string;
  createdAt: number;
}

const WORKER_URL = 'http://127.0.0.1:8787';
const LS_THREADS = 'shopmate_chats';
const LS_ACTIVE  = 'shopmate_active_thread_id';

// ── Helpers ──────────────────────────────────────────────────────────────────
function readLocalThreads(): ChatThread[] {
  try {
    const raw = localStorage.getItem(LS_THREADS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeLocalThreads(threads: ChatThread[]) {
  localStorage.setItem(LS_THREADS, JSON.stringify(threads));
}

function readLocalActiveId(): string {
  const saved = localStorage.getItem(LS_ACTIVE);
  if (saved) return saved;
  const id = crypto.randomUUID();
  localStorage.setItem(LS_ACTIVE, id);
  return id;
}

// Retrieve JWT stored by the service worker after sign-in
async function getJwt(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get('jwt', (result) => {
      resolve(result.jwt ?? null);
    });
  });
}

async function apiFetch(path: string, options?: RequestInit) {
  const jwt = await getJwt();
  return fetch(`${WORKER_URL}/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(jwt ? { 'Authorization': `Bearer ${jwt}` } : {}),
      ...(options?.headers ?? {}),
    },
  });
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useThreads() {
  const initialId = readLocalActiveId();

  const [threads, setThreads] = useState<ChatThread[]>(() => {
    const local = readLocalThreads();
    if (local.length > 0) return local;
    const initial: ChatThread = { id: initialId, title: 'New Chat', createdAt: Date.now() };
    writeLocalThreads([initial]);
    return [initial];
  });

  const [activeThreadId, setActiveThreadIdState] = useState<string>(initialId);

  // Track whether we've already synced from KV so we don't double-merge
  const didSyncRef = useRef(false);

  // ── On mount: load from KV and merge ──────────────────────────────────────
  useEffect(() => {
    if (didSyncRef.current) return;
    didSyncRef.current = true;

    apiFetch('/threads')
      .then(r => r.ok ? r.json() : { threads: [] })
      .then(({ threads: remote }: { threads: ChatThread[] }) => {
        if (!remote || remote.length === 0) return;

        setThreads(local => {
          // Merge: KV is source of truth, but keep any local-only threads
          // (created while signed out) that aren't in remote yet.
          const remoteIds = new Set(remote.map(t => t.id));
          const localOnly = local.filter(t => !remoteIds.has(t.id));
          const merged = [...remote, ...localOnly];
          merged.sort((a, b) => b.createdAt - a.createdAt);

          writeLocalThreads(merged);

          // If the active thread was wiped (e.g. cleared storage), restore it
          setActiveThreadIdState(prev => {
            const stillExists = merged.some(t => t.id === prev);
            if (!stillExists && merged.length > 0) {
              const next = merged[0].id;
              localStorage.setItem(LS_ACTIVE, next);
              return next;
            }
            return prev;
          });

          return merged;
        });
      })
      .catch(() => { /* network error — stay with local */ });
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeThreadTitle = useMemo(() => {
    const found = threads.find(t => t.id === activeThreadId);
    return found ? found.title : 'Shop Mate';
  }, [threads, activeThreadId]);

  // ── Setters ───────────────────────────────────────────────────────────────
  const setActiveThreadId = useCallback((id: string) => {
    setActiveThreadIdState(id);
    localStorage.setItem(LS_ACTIVE, id);
  }, []);

  // ── Persist helpers ───────────────────────────────────────────────────────
  const syncUpsert = useCallback((thread: ChatThread) => {
    apiFetch('/threads', {
      method: 'POST',
      body: JSON.stringify(thread),
    }).catch(() => { /* silent — local is already updated */ });
  }, []);

  const syncDelete = useCallback((id: string) => {
    apiFetch(`/threads/${id}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  // ── Thread actions ────────────────────────────────────────────────────────
  const updateActiveThreadTitle = useCallback((promptText: string) => {
    setThreads(prev => {
      const updated = prev.map(t => {
        if (t.id === activeThreadId && t.title === 'New Chat') {
          const truncated = promptText.length > 35 ? promptText.slice(0, 32) + '...' : promptText;
          const next = { ...t, title: truncated };
          syncUpsert(next);
          return next;
        }
        return t;
      });
      writeLocalThreads(updated);
      return updated;
    });
  }, [activeThreadId, syncUpsert]);

  const handleNewChat = useCallback((hasMessages: boolean) => {
    if (!hasMessages) return;
    const newId = crypto.randomUUID();
    const newThread: ChatThread = { id: newId, title: 'New Chat', createdAt: Date.now() };

    setThreads(prev => {
      const updated = [newThread, ...prev];
      writeLocalThreads(updated);
      return updated;
    });

    // Persist to KV (title will be updated on first message)
    syncUpsert(newThread);

    setActiveThreadId(newId);
  }, [setActiveThreadId, syncUpsert]);

  const handleDeleteThread = useCallback((id: string) => {
    setThreads(prev => {
      const updated = prev.filter(t => t.id !== id);
      writeLocalThreads(updated);
      return updated;
    });

    syncDelete(id);

    if (id === activeThreadId) {
      setThreads(prev => {
        const remaining = prev.filter(t => t.id !== id);
        if (remaining.length > 0) {
          setActiveThreadId(remaining[0].id);
        } else {
          const newId = crypto.randomUUID();
          const fresh: ChatThread = { id: newId, title: 'New Chat', createdAt: Date.now() };
          const withFresh = [fresh];
          writeLocalThreads(withFresh);
          syncUpsert(fresh);
          setActiveThreadIdState(newId);
          localStorage.setItem(LS_ACTIVE, newId);
          return withFresh;
        }
        return remaining;
      });
    }
  }, [activeThreadId, setActiveThreadId, syncDelete, syncUpsert]);

  return {
    threads,
    activeThreadId,
    setActiveThreadId,
    activeThreadTitle,
    updateActiveThreadTitle,
    handleNewChat,
    handleDeleteThread,
  };
}
