import { useCallback, useEffect, useRef, useState } from "react";
import { loadWorkspace, saveWorkspace, tickDemo, type Workspace } from "@/lib/strategy-workspace";
import type { Rules } from "@/lib/trading";

export function useStrategyWorkspace(threadId: string | undefined, rules?: Rules, duration?: number) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const ref = useRef<{ id: string; value: Workspace } | null>(null);
  useEffect(() => {
    if (!threadId) return;
    const value = tickDemo(loadWorkspace(threadId, rules, duration), Date.now());
    ref.current = { id: threadId, value };
    setWorkspace(value);
    saveWorkspace(threadId, value);
    const timer = setInterval(() => {
      if (!ref.current || ref.current.id !== threadId) return;
      const next = tickDemo(ref.current.value, Date.now());
      ref.current = { id: threadId, value: next };
      saveWorkspace(threadId, next);
      setWorkspace(next);
    }, 1000);
    return () => {
      clearInterval(timer);
      const current = ref.current;
      if (current?.id === threadId) {
        const value = { ...current.value, session: { ...current.value.session, status: current.value.session.status === "running" ? "paused" as const : current.value.session.status } };
        saveWorkspace(threadId, value);
      }
      ref.current = null;
    };
    // Rules are copied on creation, never silently overwrite conversation contracts.
  }, [threadId]);
  const update = useCallback((fn: (w: Workspace) => Workspace) => {
    const current = ref.current;
    if (!current) return;
    const value = fn(current.value);
    ref.current = { id: current.id, value };
    saveWorkspace(current.id, value);
    setWorkspace(value);
  }, []);
  const get = useCallback((id: string) => ref.current?.id === id ? ref.current.value : loadWorkspace(id), []);
  const updateFor = useCallback((id: string, fn: (w: Workspace) => Workspace) => {
    if (ref.current?.id === id) update(fn);
    else saveWorkspace(id, fn(loadWorkspace(id)));
  }, [update]);
  return { workspace, update, get, updateFor };
}