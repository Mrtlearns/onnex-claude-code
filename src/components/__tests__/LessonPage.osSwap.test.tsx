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

  it("renders macOS body, then swaps to Windows body without leaving the page", async () => {
    renderLesson("getting-ready");

    // macOS marker — present in mac variant only.
    expect(await screen.findByText(/macOS 13\.0 \(Ventura\)/i)).toBeInTheDocument();

    // Click the Windows chip in the OS toggle.
    const winBtn = screen.getByRole("button", { name: /^Win$/i });
    act(() => { winBtn.click(); });

    // Windows marker — present in windows variant only. findByText awaits the
    // async markdown resolver in useResolvedMarkdown.
    expect(await screen.findByText(/Choosing Your Windows Path/i)).toBeInTheDocument();
    expect(screen.queryByText(/macOS 13\.0 \(Ventura\)/i)).toBeNull();
  });

  it("OS-variant notice is shown for lessons with multiple variants", async () => {
    renderLesson("getting-ready");
    expect(await screen.findByTestId("os-variant-notice")).toBeInTheDocument();
  });
});
