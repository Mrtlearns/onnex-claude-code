import { useCallback, useRef, useState } from "react";

/**
 * Minimal undo/redo stack. Coalesces rapid edits within `coalesceMs`
 * so typing a word doesn't create dozens of history entries.
 */
export function useHistory<T>(initial: T, coalesceMs = 600) {
  const [value, setValue] = useState<T>(initial);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const lastPushAt = useRef<number>(0);
  const lastCommitted = useRef<T>(initial);
  const [, force] = useState(0);
  const rerender = () => force((x) => x + 1);

  const reset = useCallback((v: T) => {
    past.current = [];
    future.current = [];
    lastCommitted.current = v;
    lastPushAt.current = 0;
    setValue(v);
    rerender();
  }, []);

  const set = useCallback(
    (next: T) => {
      const now = Date.now();
      if (now - lastPushAt.current > coalesceMs) {
        past.current.push(lastCommitted.current);
        if (past.current.length > 100) past.current.shift();
        future.current = [];
      }
      lastPushAt.current = now;
      lastCommitted.current = next;
      setValue(next);
      rerender();
    },
    [coalesceMs],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (prev === undefined) return;
    future.current.push(lastCommitted.current);
    lastCommitted.current = prev;
    lastPushAt.current = 0;
    setValue(prev);
    rerender();
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) return;
    past.current.push(lastCommitted.current);
    lastCommitted.current = next;
    lastPushAt.current = 0;
    setValue(next);
    rerender();
  }, []);

  return {
    value,
    set,
    reset,
    undo,
    redo,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
