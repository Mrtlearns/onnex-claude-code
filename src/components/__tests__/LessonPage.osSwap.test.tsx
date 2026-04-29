import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, waitForElementToBeRemoved } from "@testing-library/react";
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
    const { container } = renderLesson("getting-ready");

    // macOS marker — present in mac variant only.
    expect(await screen.findByText(/macOS 13\.0 \(Ventura\)/i)).toBeInTheDocument();

    // Click the Windows chip in the OS toggle.
    const winBtn = screen.getByRole("button", { name: /^Win$/i });
    fireEvent.click(winBtn);

    // Sanity check that we did NOT navigate away from the lesson route.
    await waitFor(() => {
      const article = container.querySelector("article");
      expect(article).not.toBeNull();
    });

    // The Windows-only marker appears once the markdown resolver promise settles.
    await waitFor(
      () => expect(screen.getByText(/Choosing Your Windows Path/i)).toBeInTheDocument(),
      { timeout: 4000 },
    );
    // Mac-only marker should be gone after the resolver swap.
    await waitForElementToBeRemoved(() => screen.queryByText(/macOS 13\.0 \(Ventura\)/i));
  });

  it("OS-variant notice is shown for lessons with multiple variants", async () => {
    renderLesson("getting-ready");
    expect(await screen.findByTestId("os-variant-notice")).toBeInTheDocument();
  });
});
