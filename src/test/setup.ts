import "@testing-library/jest-dom";
import "fake-indexeddb/auto";
import { beforeEach } from "vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Reset persistent web storage between tests so suites don't bleed.
beforeEach(() => {
  try { localStorage.clear(); } catch { /* ignore */ }
  try { sessionStorage.clear(); } catch { /* ignore */ }
  try {
    document.documentElement.classList.remove("dark");
    document.documentElement.style.colorScheme = "";
  } catch { /* ignore */ }
});
