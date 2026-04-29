import { useEffect } from "react";

/**
 * Runs `effect` after `delay` ms of `deps` being unchanged.
 * Cleared on dep change or unmount.
 */
export const useDebouncedEffect = (
  effect: () => void,
  deps: React.DependencyList,
  delay: number,
) => {
  useEffect(() => {
    const t = window.setTimeout(effect, delay);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, delay]);
};
