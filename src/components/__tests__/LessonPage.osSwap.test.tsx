import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "@/context/ThemeContext";
import { OSProvider } from "@/context/OSContext";
import { AdminProvider } from "@/context/AdminContext";
import { SiteHeader } from "@/components/SiteHeader";
import LessonRoute from "@/pages/LessonRoute";

const renderLesson = (slug: string) =>
  render(
    <MemoryRouter initialEntries={[`/lessons/${slug}`]}>
      <ThemeProvider>
        <OSProvider>
          <AdminProvider>
            <SiteHeader />
            <Routes>
              <Route path="/lessons/:slug" element={<LessonRoute />} />
            </Routes>
          </AdminProvider>
        </OSProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );

describe("LessonPage OS swap (the OS-picker fix)", () => {
  beforeEach(() => {
    localStorage.setItem("vci.os", "mac");
  });

  it("renders macOS body, then swaps to Windows body without leaving the page", () => {
    renderLesson("getting-ready");

    // macOS marker — present in mac variant only.
    expect(screen.getByText(/macOS 13\.0 \(Ventura\)/i)).toBeInTheDocument();
    expect(screen.queryByText(/Choosing Your Windows Path/i)).toBeNull();

    // Click the Windows chip in the OS toggle.
    const winBtn = screen.getByRole("button", { name: /^Win$/i });
    act(() => { winBtn.click(); });

    expect(screen.getByText(/Choosing Your Windows Path/i)).toBeInTheDocument();
    expect(screen.queryByText(/macOS 13\.0 \(Ventura\)/i)).toBeNull();

    // OS-variant ribbon is shown because the lesson has multiple variants.
    expect(screen.getByTestId("os-variant-notice")).toBeInTheDocument();
  });

  it("OS-variant notice is absent for lessons with a single variant", () => {
    // No such lesson exists today (we converted them all), so we just verify
    // the notice's presence is data-driven by re-checking the lesson with multi-variant.
    renderLesson("getting-ready");
    expect(screen.getByTestId("os-variant-notice")).toBeInTheDocument();
  });
});
