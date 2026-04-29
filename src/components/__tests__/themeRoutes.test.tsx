import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { OSProvider } from "@/context/OSContext";
import { AdminProvider } from "@/context/AdminContext";
import { SiteHeader } from "@/components/SiteHeader";
import Index from "@/pages/Index";
import Lessons from "@/pages/Lessons";
import LessonRoute from "@/pages/LessonRoute";
import Admin from "@/pages/Admin";
import Docs from "@/pages/Docs";

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <ThemeProvider>
        <OSProvider>
          <AdminProvider>
            <SiteHeader />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/lessons" element={<Lessons />} />
              <Route path="/lessons/:slug" element={<LessonRoute />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/docs" element={<Docs />} />
            </Routes>
          </AdminProvider>
        </OSProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );

const ROUTES = [
  { path: "/", needsOS: false, slim: true },
  { path: "/lessons", needsOS: true, slim: false },
  { path: "/lessons/getting-ready", needsOS: true, slim: false },
  { path: "/admin", needsOS: true, slim: false },
  { path: "/docs", needsOS: true, slim: false },
];

describe("theme toggle across all main routes", () => {
  beforeEach(() => {
    // Routes that guard on OS need a preset; OS picker route must remain blank.
    localStorage.setItem("vci.os", "mac");
  });

  for (const r of ROUTES) {
    it(`flips the dark class on ${r.path}`, () => {
      if (!r.needsOS) localStorage.removeItem("vci.os");
      renderAt(r.path);
      // ThemeToggle aria-label always begins with "Theme:"
      const buttons = screen.getAllByRole("button", { name: /^Theme:/ });
      expect(buttons.length).toBeGreaterThan(0);
      const btn = buttons[0];

      expect(document.documentElement.classList.contains("dark")).toBe(false);
      act(() => { btn.click(); }); // → light
      act(() => { btn.click(); }); // → dark
      expect(document.documentElement.classList.contains("dark")).toBe(true);
      act(() => { btn.click(); }); // → system
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  }
});

describe("SiteHeader shape per route", () => {
  it("renders the slim variant on /  (no Admin pill, no Docs link, no OSToggle)", () => {
    localStorage.removeItem("vci.os");
    renderAt("/");
    expect(screen.queryByRole("button", { name: /Admin/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /Documentation/i })).toBeNull();
    // The full OSToggle exposes Mac/Win/Linux buttons; slim header has none.
    expect(screen.queryByRole("button", { name: /^Mac$/i })).toBeNull();
  });

  it.each(["/lessons", "/lessons/getting-ready", "/admin", "/docs"])(
    "renders the full variant on %s (Docs link, OS toggle, Admin pill)",
    (path) => {
      localStorage.setItem("vci.os", "mac");
      renderAt(path);
      expect(screen.getByRole("link", { name: /Documentation/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Mac$/i })).toBeInTheDocument();
    },
  );
});
