import { useEffect } from "react";

/** Warn the user before closing the tab when there are unsaved changes. */
export const useUnsavedChangesPrompt = (when: boolean, message = "You have unsaved changes.") => {
  useEffect(() => {
    if (!when) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [when, message]);
};
